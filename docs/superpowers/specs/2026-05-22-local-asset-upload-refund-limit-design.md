# 本地素材上传、头像、限购与部分退款设计

## 背景

当前项目里头像、活动海报、巡演海报、艺人头像、场地审批材料等字段主要以 URL 字符串形式保存。演示 seed 已经使用本地静态海报路径，但后台表单仍存在手填 URL 的入口。后续项目会部署到服务器或虚拟机，因此需要把外链 URL 替换为可控的本地文件上传，并为素材建立服务内索引。

同时，订单退款和售票规则需要补齐两个核心能力：用户买多张票后可以部分退款；活动上架时 admin 或 organizer 可以设置个人限购张数或不限购。

## 目标

- 建立服务内素材索引，而不是新增独立素材数据库。
- 文件保存到本地上传根目录，数据库只保存相对路径、公开访问路径和元数据。
- 替换所有需要用户输入 URL 的业务入口为本地上传。
- 完善用户头像上传，并让个人中心、Header 等位置展示上传头像。
- 活动或站点发布前可配置个人限购数量或不限购，下单时强制校验。
- 支持订单部分退款：用户可选择退一张或多张，而不是只能整单退款。

## 非目标

- 不新增独立 `java-asset` 服务。
- 不新增独立 `omni_asset` 数据库。
- 不把文件二进制写入 PostgreSQL。
- 不引入对象存储、CDN、MQ、CDC 或 outbox。
- 不改变当前五库 `prod-split` 拆库拓扑。
- 不允许跨服务 Mapper、Entity 或 SQL join。

## 总体方案

采用“服务内 asset 表 + 统一本地文件根目录 + 业务表继续存公开路径”的方案。

各服务只管理自己拥有的素材索引：

| 场景 | 服务 | 数据库 | 索引表 |
| --- | --- | --- | --- |
| 用户头像 | `java-user` | `omni_user` | `user_asset` |
| 活动海报 | `java-ticket` | `omni_ticket_split` | `ticket_asset` |
| 巡演海报 | `java-ticket` | `omni_ticket_split` | `ticket_asset` |
| 站点海报 | `java-ticket` | `omni_ticket_split` | `ticket_asset` |
| 艺人头像 | `java-ticket` | `omni_ticket_split` | `ticket_asset` |
| 场地审批材料 | 后续私有存储方案 | 后续设计 | 后续设计 |

统一本地根目录由配置控制：

```text
OMNI_UPLOAD_ROOT=C:\Users\Administrator\Desktop\omni\runtime\uploads
```

服务器或虚拟机部署时使用：

```text
OMNI_UPLOAD_ROOT=/opt/omni/uploads
```

文件目录按服务和业务类型拆分：

```text
runtime/uploads/
├── user/
│   └── avatar/YYYY/MM/<uuid>.<ext>
└── ticket/
    ├── activity-poster/YYYY/MM/<uuid>.<ext>
    ├── tour-poster/YYYY/MM/<uuid>.<ext>
    ├── station-poster/YYYY/MM/<uuid>.<ext>
    └── artist-avatar/YYYY/MM/<uuid>.<ext>
```

公开访问路径统一为：

```text
/uploads/<service>/<bizType>/YYYY/MM/<uuid>.<ext>
```

业务表现阶段继续保存 `public_url` 字符串，避免一次性迁移所有业务字段：

- `user.avatar`
- `artist.avatar`
- `activity.poster`
- `tour.poster`
- `station.poster`

Phase 1 不通过 `/uploads/ticket/**` 公开上传 `venue-proof` 或其他证明材料；场地申请证明、活动外部审批文件等敏感材料后续用私有存储和鉴权下载单独设计。

asset 表用于记录元数据和后续清理、审计、迁移。

## 数据模型

### `java-user`: `user_asset`

```sql
CREATE TABLE user_asset (
    id BIGSERIAL PRIMARY KEY,
    uploader_id BIGINT NOT NULL,
    biz_type VARCHAR(64) NOT NULL,
    original_name VARCHAR(255),
    stored_name VARCHAR(255) NOT NULL,
    relative_path VARCHAR(500) NOT NULL,
    public_url VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    sha256 VARCHAR(128),
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_asset_uploader ON user_asset(uploader_id);
CREATE INDEX idx_user_asset_biz_type ON user_asset(biz_type);
```

允许的 `biz_type`：

- `avatar`

### `java-ticket`: `ticket_asset`

```sql
CREATE TABLE ticket_asset (
    id BIGSERIAL PRIMARY KEY,
    uploader_id BIGINT NOT NULL,
    biz_type VARCHAR(64) NOT NULL,
    original_name VARCHAR(255),
    stored_name VARCHAR(255) NOT NULL,
    relative_path VARCHAR(500) NOT NULL,
    public_url VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    sha256 VARCHAR(128),
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ticket_asset_uploader ON ticket_asset(uploader_id);
CREATE INDEX idx_ticket_asset_biz_type ON ticket_asset(biz_type);
```

允许的 `biz_type`：

- `activity-poster`
- `tour-poster`
- `station-poster`
- `artist-avatar`

## 上传接口

### 用户服务

```text
POST /api/user/assets/avatar
Content-Type: multipart/form-data
字段：file
```

行为：

- 必须登录。
- 校验文件类型为图片。
- 建议限制大小不超过 2MB。
- 保存到 `user/avatar/YYYY/MM/`。
- 写入 `user_asset`。
- 更新当前用户 `user.avatar = public_url`。
- 返回最新 `UserInfoResponse` 或 `AssetUploadResponse`。

### 票务服务

```text
POST /api/ticket/admin/assets
Content-Type: multipart/form-data
字段：file, userId, bizType
```

行为：

- `userId` 必须存在且有权限。
- admin 可上传所有 `bizType`。
- organizer 可上传自己创建活动、巡演、站点需要的公开图片素材。
- Phase 1 只允许公开图片素材：`activity-poster`、`tour-poster`、`station-poster`、`artist-avatar`。不支持 `venue-proof`，PDF 永远拒绝。
- 写入 `ticket_asset`，返回 `AssetUploadResponse`。

返回结构：

```json
{
  "id": 1,
  "bizType": "activity-poster",
  "publicUrl": "/uploads/ticket/activity-poster/2026/05/xxx.webp",
  "originalName": "poster.jpg",
  "mimeType": "image/jpeg",
  "sizeBytes": 123456
}
```

## 静态文件访问

本地开发环境由 Spring Boot 或网关映射 `/uploads/**` 到 `OMNI_UPLOAD_ROOT`。生产或虚拟机部署时推荐 Nginx 直接托管：

```text
location /uploads/ {
    alias /opt/omni/uploads/;
    expires 30d;
}
```

后端仍返回 `/uploads/...`，前端无需关心文件所在磁盘路径。

## 前端替换规则

以下手填 URL 入口改为上传控件：

- 个人资料头像。
- 后台创建/编辑活动海报。
- 后台创建/编辑 Tour 海报。
- 后台创建/编辑 Station 海报。
- 艺人头像。
- 场地申请 proof file 和活动外部审批文件 `venueApprovalFileUrl` 不在 Phase 1 公开上传范围内，后续使用私有存储和鉴权下载方案。

上传成功后，前端把返回的 `publicUrl` 写入现有表单字段并展示预览。

## 活动限购

### 数据模型

在 `activity` 添加：

```sql
ALTER TABLE activity ADD COLUMN IF NOT EXISTS per_user_limit INTEGER;
```

规则：

- `NULL` 表示不限购。
- 正整数表示每个用户在该活动下最多可持有的有效票数。
- 限购按活动维度计算，不按单场次或单票档计算，避免用户换场次绕过限制。

### 下单校验

`java-order` 下单前通过 ticket internal API 获取活动限购信息，或在既有 quote internal API 中增加 `activityId`、`perUserLimit`。

order 服务计算：

```text
用户该 activity 下已支付且未退款的票数 + 本次购买数量 <= perUserLimit
```

不允许 order 直接查 ticket 表。

### 退款对限购的影响

- 整单已退款或部分退款的票数不再占用限购额度。
- 待审核退款仍占用额度，避免用户申请退款后立即绕过限购继续购买。

## 部分退款

### 当前问题

现有退款以 `order_id` 为粒度，`refund_request.amount` 等于整单金额。用户买两张票时无法只退一张。

### 设计原则

- 退款申请仍属于 `java-payment`。
- 座位和订单票明细仍属于 `java-order`。
- 票务库存和座位释放仍通过 ticket internal API。
- 不新增跨服务 SQL。

### 数据模型

在 `refund_request` 增加：

```sql
ALTER TABLE refund_request ADD COLUMN IF NOT EXISTS quantity INTEGER;
ALTER TABLE refund_request ADD COLUMN IF NOT EXISTS order_seat_ids VARCHAR(500);
ALTER TABLE refund_request ADD COLUMN IF NOT EXISTS refund_type VARCHAR(32) DEFAULT 'full';
```

含义：

- `refund_type='full'`：整单退款。
- `refund_type='partial'`：部分退款。
- `quantity`：本次申请退款张数。
- `order_seat_ids`：逗号分隔的 order-owned `order_seat.id`，用于坐席票精确退款。

后续可再拆成 `refund_request_seat` 子表；第一阶段用字符串字段降低改动范围。

### 订单服务 internal API

新增 order internal 能力：

```text
GET /api/order/internal/orders/{orderId}/refund-options
POST /api/order/internal/orders/{orderId}/mark-partial-refunded
```

`refund-options` 返回：

- 订单总张数。
- 已退款张数。
- 可退款张数。
- 单价。
- 可退款 order seats。

`mark-partial-refunded` 在支付宝退款成功后：

- 标记指定 `order_seat` 为 refunded。
- 若全部票都已退，订单状态改为 `STATUS_REFUNDED=4`。
- 若只退一部分，订单状态保持 `STATUS_PAID=2`，但列表页展示“部分退款”。
- 调 ticket internal API 释放对应座位或库存。

### 支付服务退款申请

`applyRefund` 增加参数：

```json
{
  "orderId": 1,
  "reason": "...",
  "reasonType": "cast_change",
  "quantity": 1,
  "orderSeatIds": [11]
}
```

计算金额：

```text
refundAmount = unitPrice * quantity
```

必须通过 order internal API 获取可退款明细，不能只信前端传参。

### 前端退款交互

订单详情退款弹窗：

- 显示订单总票数、已退票数、可退票数。
- 如果有座位，允许勾选具体座位。
- 如果无座位或站区票，选择退款数量。
- 保留“常规退款 / 阵容变更专属退款”。
- 展示预计退款金额。

## 错误处理

- 上传文件类型不支持：返回 `400 文件类型不支持`。
- 上传超过大小限制：返回 `400 文件大小超过限制`。
- 上传目录不可写：返回 `500 文件存储不可用`。
- 下单超过限购：返回 `400 超过本活动个人限购数量`。
- 部分退款数量超过可退数量：返回 `400 可退款票数不足`。
- 重复申请同一座位退款：返回 `400 所选票已存在退款申请或已退款`。

## 验收标准

- 用户可以上传头像，刷新后头像仍展示。
- 活动、Tour、Station、艺人、场地申请不再要求用户手填外链 URL。
- 上传文件实际落盘到 `OMNI_UPLOAD_ROOT` 下。
- 数据库业务字段保存 `/uploads/...` 公开路径，asset 表保存元数据。
- 活动设置每人限购后，下单超过限制会失败。
- 买两张票的订单可申请只退一张。
- 部分退款成功后，只释放被退的座位或库存。
- 不新增跨服务 Mapper、Entity、XML mapper 或 SQL join。

## 开放问题

- 第一阶段是否接受图片不做服务端压缩，只限制类型和大小。默认接受，后续再加压缩。
- 站区票部分退款时没有逐座位 `order_seat` 可选，默认按数量退款并释放站区库存。
- 当前阶段 `refund_request.order_seat_ids` 使用逗号分隔字段降低改动量；如果后续退款明细需要复杂查询，再迁移为子表。

## 实施顺序

1. 建立上传根目录配置、静态文件映射、`user_asset` 与 `ticket_asset`。
2. 实现用户头像上传闭环。
3. 替换 ticket 侧海报、艺人头像、场地证明上传入口。
4. 增加活动个人限购字段和下单校验。
5. 增加部分退款申请、审核、订单座位释放和前端选择交互。
