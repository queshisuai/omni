# 场馆资料审核页面重构设计

**日期：** 2026-09-12

## 目标

将 `/console/venue/applications` 从松散卡片列表重构为高密度、服务端分页的场馆资料审核工作台，支持状态、城市、容量规模和材料完整度切片，使用右侧 Drawer 完成资质核验、审核通过入库和驳回审计闭环。

## 范围与边界

- 场馆申请、正式场馆、场馆材料和私有附件均归属 `java-ticket` 与 `omni_ticket_split`。
- 不在 `java-ticket` 新增跨服务 Mapper、Entity、XML mapper 或 SQL join。
- 审核操作不直接访问 `omni_user`，通过 `UserAccessService.writeOperationAudit()` 调用 `java-user` internal 审计接口。
- 页面权限码为 `venue.review`；后端统一调用 `UserAccessService.requirePermission(userId, "venue.review")`。
- 保留现有 `/review` 兼容入口，新的前端审核流程使用独立的 `/approve` 与 `/reject` 接口。

## 数据模型

### 场馆扩展字段

在 `venue_application` 和 `venue` 中增加以下可空字段：

- `venue_name_en VARCHAR(200)`
- `venue_type VARCHAR(50)`
- `province VARCHAR(50)`
- `district VARCHAR(50)`

历史数据兼容规则：

- `province` 或 `district` 为空时，VO 展示回退到现有 `city` 和完整 `address`。
- `venue_name_en` 为空时不渲染英文次标题。
- `venue_type` 为空时展示“综合演艺场馆”。

### 材料关联表

新增 `venue_application_material`：

- `id BIGSERIAL PRIMARY KEY`
- `venue_application_id BIGINT NOT NULL`
- `material_type VARCHAR(50) NOT NULL`
- `asset_id BIGINT NOT NULL`
- `note TEXT`
- `valid_from TIMESTAMP`
- `valid_to TIMESTAMP`
- `create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`
- `update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`

`material_type` 初始只允许：

- `FIRE_SAFETY_PERMIT`
- `VENUE_LEASE_AGREEMENT`

建立申请编号、材料类型、资产编号索引，并建立申请记录到材料记录的同库外键。`asset_id` 关联同一 `omni_ticket_split` 内的 `private_asset`，不建立跨数据库外键。

增量脚本：

`sql/production-split/ticket/20260912_venue_application_material.sql`

仅面向 `omni_ticket_split` 执行。共享本地 schema 如需保持测试可运行，另提供对应的 `sql/migrations/shared/` 迁移，但不得进入 staging 或 production 迁移链路。

### 历史通用凭证兼容

保留 `venue_application.proofAssetId`、`proofFileUrl` 和 `proofNote`。

VO 组装时：

- 新关联材料映射为结构化材料。
- 当旧字段任一存在时，追加虚拟材料项 `LEGACY_GENERAL_PROOF`。
- 历史项文案为“通用审批综合证明材料（历史凭证）”。
- 历史单附件记录的完整度为“包含通用证明（历史数据）”，不标记为缺少消防或缺少租赁协议。

## 后端接口

### 查询接口

`GET /api/ticket/admin/venue-applications`

返回标准 `PageResult<VenueApplicationVO>`，支持：

- `page`：默认 `1`
- `size`：默认 `10`
- `keyword`：匹配场馆名称、资质编号、地址、联系人姓名和手机号
- `status`：`PENDING`、`APPROVED`、`REJECTED`
- `city`
- `capacityScale`：`EXTRA_LARGE`、`LARGE`、`MEDIUM`、`SMALL`
- `materialCompleteness`：`ALL`、`COMPLETE`、`MISSING_FIRE`、`MISSING_LEASE`

容量梯队：

- `EXTRA_LARGE`：`capacity >= 30000`
- `LARGE`：`10000 <= capacity < 30000`
- `MEDIUM`：`3000 <= capacity < 10000`
- `SMALL`：`capacity < 3000`

历史通用证明的完整度规则：

- 仅有历史通用证明：归入 `COMPLETE` 的兼容结果，不归入缺少消防或缺少租赁。
- 新结构化材料：按两类材料是否存在分别计算。
- `capacity IS NULL` 不命中四个容量梯队，仍可在“全部”中展示。

### 审核接口

通过：

`POST /api/ticket/admin/venue-applications/{id}/approve`

请求体：

```json
{
  "reviewNote": "材料核验通过"
}
```

驳回：

`POST /api/ticket/admin/venue-applications/{id}/reject`

请求体：

```json
{
  "reviewNote": "请补充有效的消防安全检查合格证明"
}
```

服务层在 `trim()` 后校验驳回原因非空。两类接口都只允许处理待审核申请。

审核通过事务：

1. 校验 `venue.review` 权限。
2. 读取待审核申请。
3. 存在有效 `venueId` 时关联现有正式场馆；否则使用申请快照创建 `venue`。
4. 将扩展字段、城市、地址和容量同步到新建场馆。
5. 更新申请状态、审核人、审核备注和审核时间。
6. 通过 `UserAccessService.writeOperationAudit()` 写入 `VENUE_REVIEW_APPROVE`。

驳回事务：

1. 校验 `venue.review` 权限。
2. 校验 `reviewNote.trim()` 非空。
3. 更新申请为 `REJECTED`，写入审核人、原因和审核时间。
4. 写入 `VENUE_REVIEW_REJECT` 审计事件。

审计目标类型为 `venue_application`，`targetId` 为申请编号，`targetRef` 使用“场馆资料审核”。

## VO 结构

`VenueApplicationVO` 保留现有申请字段，并新增：

- `venueNameEn`
- `venueType`
- `province`
- `district`
- `capacityScale`
- `materialCompleteness`
- `materials`
- `legacyProof`

材料项至少包含：

- `id`
- `materialType`
- `label`
- `assetId`
- `originalFilename`
- `contentType`
- `fileSize`
- `validFrom`
- `validTo`
- `previewUrl` 或受保护下载标识
- `legacy`

前端不直接拼接不可信 URL；图片统一经过 `SafeImage`，私有文件通过已有受保护下载链路获取。

## 前端交互

### 审核页面

文件：`frontend/src/app/console/venue/applications/page.tsx`

- 状态 Tab：
  - 待审核申请，显示待办数量
  - 已入库场馆档案
  - 已驳回记录
- 城市快捷标签：
  - 全部城市、北京、上海、深圳、广州、成都、杭州
- 筛选：
  - 关键字
  - 容量规模
  - 材料完整度
- 主表使用固定列宽、`whitespace-nowrap`、长文本截断和横向滚动兜底。
- 操作列：
  - 待审核显示“审核凭证”
  - 已通过/已驳回显示“查看档案”
- 分页统一使用 `GlobalPagination`，默认每页 10 条。

### Drawer

使用 `frontend/src/components/ui/Drawer.tsx`，宽度 `w-[640px]`。

内容分区：

1. 基本物理信息：中英文名称、省市区、详细地址、类型、容量、联系人。
2. 消防安全检查合格证明：缩略图、文件名、有效期、查看/下载。
3. 场地租赁/运营授权协议：文件名、有效期、查看/下载。
4. 历史通用证明：使用兼容文案展示。
5. 经营范围与提报说明。
6. 待审核时显示审核控制台。

审核控制台：

- 审批意见为可选文本域。
- “审核通过并纳入场馆库”调用 `/approve`。
- “驳回申请”调用 `/reject`。
- 驳回前必须对 `reviewNote.trim()` 做前端校验，空值阻断提交并显示中文错误。
- 成功后关闭 Drawer，刷新当前查询、Tab 待办计数和当前页。

### 提报页面

文件：`frontend/src/app/console/venue/apply/page.tsx`

- 增加英文名、场馆类型、省份、区县字段。
- 保留原有通用审批说明和通用附件兼容入口。
- 新增消防证明和租赁/运营授权协议分别上传。
- 上传仍使用 `uploadPrivateAsset()`，分别使用对应 `bizType`。
- 提交请求同时发送结构化字段和两类材料资产编号。
- 历史申请列表继续兼容旧 VO。

## 测试策略

### Java 测试

- 材料类型写入、查询和 VO 组装。
- 旧字段映射为 `LEGACY_GENERAL_PROOF`。
- 历史通用证明不被材料缺失筛选误判。
- 城市、容量规模、关键字、状态和材料完整度分页查询。
- 通过自动创建/关联场馆。
- 驳回原因空白校验。
- `venue.review` 权限校验。
- 审核通过和驳回均写入正确审计动作。

### 前端测试

- API 查询参数和 PageResult 解析。
- 状态 Tab、城市和容量筛选参数。
- 表格关键列和 `GlobalPagination`。
- Drawer、`SafeImage` 和历史材料文案。
- 驳回原因 trim 校验。
- 提报端新字段和两类附件提交。

### 验收命令

```powershell
cd frontend
pnpm typecheck
```

```powershell
mvn -pl java-ticket "-Dtest=VenueApplicationServiceTest,VenueApplicationReviewCoverageTest" test
```

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
```

## 非目标

- 不恢复任何动态、Moment 或旧 social 持久化代码。
- 不把 `operation_audit_log` 复制到 `omni_ticket_split`。
- 不修改 `omni_ticket` 历史共享库作为当前运行库。
- 不在本轮增加材料 OCR、自动真伪识别或批量审核。
