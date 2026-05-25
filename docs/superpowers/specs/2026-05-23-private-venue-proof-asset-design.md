# Private Venue Proof Asset Design

## Goal

为场地凭证材料提供私有上传和鉴权下载能力，替换当前手填 `proofFileUrl` 的公开外链模式。第一期接入 `venue-proof`，底层能力设计为通用私有附件，后续可复用到其他审批材料。

## Scope

- 新增通用私有附件表和服务内文件存储。
- 第一业务接入点是 `VenueApplication` 的场地审批凭证附件。
- 上传文件不走 `/uploads/ticket/**`，不被静态资源直接公开。
- 文件二进制不写入 PostgreSQL。
- 下载必须经过登录鉴权和业务对象权限判断。
- 前端只替换明确的创建/审核入口：`/console/venue/apply` 和 `/console/venue/applications`。
- 不盲目改普通展示页，不改 SeatCraft/座位设计器交互。

## Non-Goals

- 不新增独立 asset 微服务。
- 不新增独立 `omni_asset` 数据库。
- 不设计公开 CDN 或对象存储直传。
- 不处理文件在线预览和 Office 文档解析。
- 不做跨服务附件共享。`java-ticket` 管理 ticket 侧私有附件。

## Recommended Approach

采用“通用私有附件表 + 业务绑定鉴权 + 先上传后提交”。

流程：

1. 主办方在 `/console/venue/apply` 先上传凭证附件。
2. 后端保存文件到私有目录，写入 `private_asset`，状态为 `pending`。
3. 上传接口返回 `assetId` 和元信息，不返回公开 URL。
4. 前端提交 `VenueApplication` 时携带 `proofAssetId`。
5. `VenueApplicationService.submit()` 创建申请后，将 `proofAssetId` 绑定到该申请，状态改为 `bound`。
6. 申请人和 admin 通过鉴权下载接口下载附件。

## Storage

私有文件根目录使用服务内配置，默认值建议：

```text
runtime/private-uploads/ticket
```

目录结构建议：

```text
runtime/private-uploads/ticket/{bizType}/{yyyy}/{MM}/{uuid}.{ext}
```

示例：

```text
runtime/private-uploads/ticket/venue-proof/2026/05/8f4f7f0c-9e5a-4d30-a9ff-6c9d7f0a1234.pdf
```

该目录不注册为 Spring static resource handler。所有读取必须通过 Controller 返回文件流。

## Database

新增 `private_asset` 表，位于 `omni_ticket_split`，生产拆库 SQL 放在 `sql/production-split/ticket/`，历史 shared 迁移可同步归档到 `sql/migrations/shared/`。

建议字段：

```sql
CREATE TABLE IF NOT EXISTS private_asset (
  id BIGSERIAL PRIMARY KEY,
  service_name VARCHAR(50) NOT NULL DEFAULT 'ticket',
  biz_type VARCHAR(50) NOT NULL,
  biz_id BIGINT,
  uploader_id BIGINT NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  stored_filename VARCHAR(255) NOT NULL,
  relative_path VARCHAR(500) NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL,
  sha256 VARCHAR(64),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  bind_time TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_private_asset_uploader ON private_asset(uploader_id);
CREATE INDEX IF NOT EXISTS idx_private_asset_biz ON private_asset(biz_type, biz_id);
CREATE INDEX IF NOT EXISTS idx_private_asset_status ON private_asset(status);
```

状态定义：

- `pending`：文件已上传，但未绑定业务对象。
- `bound`：文件已绑定业务对象。
- `deleted`：逻辑删除，不允许下载。

`venue_application` 新增字段：

```sql
ALTER TABLE venue_application ADD COLUMN IF NOT EXISTS proof_asset_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_venue_application_proof_asset ON venue_application(proof_asset_id);
```

不建立跨表外键，保持现有迁移和服务内治理风格。`proof_file_url` 暂时保留，用于历史数据兼容和过渡，不再作为新上传入口。

## Backend Components

### Entity and Mapper

新增：

- `PrivateAsset`
- `PrivateAssetMapper`
- `PrivateAssetService`

`PrivateAssetService` 负责：

- 校验文件类型和大小。
- 生成私有文件路径。
- 写入磁盘。
- 记录元数据。
- 绑定业务对象。
- 下载前做权限判断。

### Upload API

新增接口：

```text
POST /api/ticket/admin/private-assets
Content-Type: multipart/form-data
```

字段：

- `userId`
- `bizType=venue-proof`
- `file`

限制：

- 允许 MIME：`application/pdf`、`image/jpeg`、`image/png`、`image/webp`。
- 允许扩展名：`.pdf`、`.jpg`、`.jpeg`、`.png`、`.webp`。
- 单文件上限：20MB。
- 当前用户必须是 admin 或 organizer。

响应只返回元信息：

```json
{
  "id": 123,
  "bizType": "venue-proof",
  "originalFilename": "approval.pdf",
  "contentType": "application/pdf",
  "fileSize": 123456,
  "status": "pending"
}
```

### Download API

新增接口：

```text
GET /api/ticket/admin/private-assets/{id}/download
```

鉴权规则：

- 必须携带有效登录 token。
- `deleted` 状态返回 `404`。
- `pending` 状态只允许 `uploader_id` 对应用户下载。
- `bound` 且 `biz_type=venue-proof` 时：
  - admin 允许下载。
  - `venue_application.applicant_id` 等于当前用户允许下载。
  - 其他用户返回 `403`。

响应使用文件流，设置：

- `Content-Type` 为记录中的 `content_type`。
- `Content-Disposition: attachment; filename*=UTF-8''approval.pdf`，文件名需按 RFC 5987 编码。

### VenueApplication Integration

`VenueApplicationRequest` 新增：

```java
private Long proofAssetId;
```

`VenueApplicationResponse` 新增：

```java
private Long proofAssetId;
private PrivateAssetResponse proofAsset;
```

提交校验调整为：

- `proofNote` 和 `proofAssetId` 至少一项必填。
- 如果传 `proofAssetId`：
  - asset 必须存在。
  - `bizType` 必须是 `venue-proof`。
  - `status` 必须是 `pending`。
  - `uploaderId` 必须等于当前提交用户。

提交成功后：

- 将 asset 绑定到 `venue_application.id`。
- 更新 asset：`biz_id=application.id`、`status=bound`、`bind_time=now`。
- 更新 application：`proof_asset_id=asset.id`。

## Frontend Components

### `/console/venue/apply`

替换当前 `proofFileUrl` 手填链接入口：

- 新增私有附件上传控件。
- 上传完成后保存 `proofAssetId` 和文件元信息。
- 提交时带 `proofAssetId`。
- 上传中禁用提交或提示“附件上传中”。
- 表单校验改为“凭证说明或附件至少一项必填”。

保留 `proofFileUrl` 类型字段兼容历史响应，但新建表单不再让用户手填公开链接。

### `/console/venue/applications`

审核页展示附件元信息：

- 显示原文件名、大小。
- 提供“下载凭证”按钮。
- 下载按钮调用鉴权下载接口，不使用 `/uploads/ticket/**`。

### Applicant List

“我的地点凭证”列表可显示附件文件名和下载按钮。下载规则仍走同一接口，由后端判断申请人权限。

## Security Rules

- 不返回公开 URL。
- 不注册静态资源映射。
- 不允许路径穿越，文件名只用于展示，真实存储名由 UUID 生成。
- 同时校验 MIME 和扩展名。
- 下载前必须查询业务对象并判断权限。
- 不信任客户端传入的 `bizId` 绑定，`VenueApplicationService` 创建申请后由后端绑定真实 application id。
- `userId` 仍按当前 AdminController/VenueApplication 接口现状传入；后续可单独规划改为 token subject，不混入本任务。

## Error Handling

- 未登录：`401`。
- 角色无权限：`403`。
- 文件类型不允许：`400`。
- 文件超过 20MB：`400`。
- asset 不存在或已删除：`404`。
- pending asset 属于其他用户：`403`。
- bound asset 绑定到其他业务对象：提交时 `400`。
- 文件落盘失败：返回内部错误；实现应避免留下可下载的半成品记录。

## Migration and Compatibility

- `proof_file_url` 保留，不删除。
- 历史申请如果只有 `proof_file_url`，审核页继续显示文本链接或原始值，但不把它转换成私有附件。
- 新申请优先使用 `proof_asset_id`。
- 后续可以单独做历史材料迁移，但不属于本期。

## Tests

后端测试：

- 上传允许 PDF/JPG/PNG/WEBP。
- 上传拒绝不支持 MIME 或扩展名。
- 上传拒绝超过 20MB 文件。
- pending asset 仅上传者可下载。
- bound `venue-proof` 仅申请人和 admin 可下载。
- organizer 不能下载别人场地申请的附件。
- 提交 `VenueApplication` 时绑定 `proofAssetId`。
- `proofNote` 和 `proofAssetId` 至少一项必填。

前端验证：

- `pnpm typecheck`。
- `/console/venue/apply` 提交参数包含 `proofAssetId`。
- 上传中不允许误提交。
- 审核页下载按钮调用鉴权下载接口。

边界验证：

- `scripts/verify-microservice-boundaries.ps1`。
- production split SQL 检查脚本。

## Acceptance Criteria

- 新上传的场地凭证不会出现在 `/uploads/ticket/**` 下。
- 未登录用户不能下载私有附件。
- 非申请人 organizer 不能下载他人 `venue-proof`。
- admin 能下载所有场地凭证附件。
- 申请人能下载自己的场地凭证附件。
- 新建场地凭证申请可以通过私有附件满足凭证材料要求。
- 历史 `proof_file_url` 数据不被破坏。
