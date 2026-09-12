# 主办方入驻审核和管理设计

**日期：** 2026-09-12

## 目标

将 `/console/organizer-applications` 重构为“入驻审核申请流”和“正式主办方名录与管控”双 Tab 高密度表格页面，并补齐申请材料预览、审批、合作冻结和审计闭环。

## 已确认的边界

- 路径保持 `/console/organizer-applications`。
- 侧边栏显示“主办方入驻审核和管理”。
- 既有 `organizer.review` 权限映射保留；页面和后端名录操作同时允许 `organizer.review` 或 `organizer.account.manage`。
- 主办方申请、申请材料关联、用户资质状态、运营分配和操作审计均归属 `java-user` / `omni_user`。
- 禁止 `java-user` 直接访问 `omni_ticket_split`。
- 活动数不作为 `java-user` 列表查询的同步阻塞项；先返回可空快照，前端或后续异步流程补充，失败显示 `-`。
- 本页面不再调用旧的 `POST /api/ticket/admin/organizers/deactivate` 退款/下架链路。新的取消合作/冻结操作只修改用户域资质状态并记录审计，不自动退款；已售订单仍由原履约和退款流程处理。
- 不伪造营业执照或身份证图片。没有材料时显示“未上传”。

## 方案

### 材料模型

新增 `organizer_application_material` 表，不向 `organizer_application` 横向增加图片字段。

建议字段：

- `id BIGSERIAL PRIMARY KEY`
- `application_id BIGINT NOT NULL`
- `asset_id BIGINT NOT NULL`
- `material_type VARCHAR(64) NOT NULL`
- `create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`

`application_id` 和 `asset_id` 均为 `java-user` 所有数据。增加申请、材料类型和资产索引；同一申请允许多个材料类型和同一类型多张图片，避免未来法人身份证正反面、许可证等材料再次改表。

复用 `user_asset` 的文件存储和摘要校验逻辑，新增主办方材料上传方法，使用材料业务类型区分文件目录。首次提交时先创建 `PENDING` 申请单，再上传材料；材料接口只允许申请人操作自己的 `PENDING` 申请，`APPROVED` 或 `REJECTED` 申请均拒绝追加、替换或删除材料。后台只返回申请关联材料，不通过跨服务查询材料。

申请单作为审核历史归档，不再按 `user_id` 唯一。迁移时移除现有 `user_id` 唯一索引，保留普通索引；服务层以同一用户最新申请状态控制提交：

- 无历史申请：创建新申请单。
- 最新申请为 `PENDING`：按业务允许更新申请文本并继续维护材料。
- 最新申请为 `REJECTED`：创建新的申请单，原申请及其材料保持不变。
- 最新申请为 `APPROVED` 且用户资质仍有效：拒绝再次提交。
- 已取消/冻结的历史主办方如允许重新申请：创建新的申请单，不能复用旧申请材料。

新申请单生成后，C 端后续材料必须绑定新 `application_id`；后台申请流按 `create_time DESC, id DESC` 展示所有审核历史。正式主办方名录展示资质编号时，按用户关联最新一条 `APPROVED` 申请读取，不能被后续驳回记录覆盖。

### 申请审核接口

`GET /api/user/organizer/applications/admin`

- 参数：`page`、`size`、`keyword`、`status`、`subjectType`
- `status` 对外使用 `PENDING`、`APPROVED`、`REJECTED`，服务内部继续映射现有数字状态，避免改变数据库编码。
- `keyword` 在 `organizer_name`、`contact_name`、`contact_phone` 和关联用户手机号/昵称范围内匹配。
- 返回 `PageResult<OrganizerApplicationResponse>`，每行包含用户 ID、材料摘要、审核信息和当前用户资质状态。

`POST /api/user/organizer/applications/{id}/approve`

- body 可选 `{ "reviewNote": "..." }`
- 仅允许待审核申请。
- 在 `omni_user` 本地事务内更新申请状态、审核人、审核时间和用户 `role=organizer`、`organizerStatus=1`。
- 写入 `operation_audit_log`，动作使用 `organizer_application.approve`。

`POST /api/user/organizer/applications/{id}/reject`

- body 必须包含非空 `reviewNote`。
- 仅允许待审核申请。
- 更新申请和用户审核状态，并写入 `organizer_application.reject` 审计。

申请材料接口：

- `POST /api/user/organizer/applications/{id}/materials`：当前申请人上传材料，multipart 字段为 `materialType` 和 `file`；服务端要求申请归属当前用户且状态为 `PENDING`。
- `GET /api/user/organizer/applications/{id}/materials`：申请人或具备审核权限的后台人员读取材料元数据。
- 材料 URL 使用现有用户上传资源配置；若当前部署要求私有访问，则保留同一 DTO，将 URL 替换为需要认证的下载地址，不改变页面契约。

### 正式主办方名录接口

`GET /api/user/console/organizers`

- 参数：`page`、`size`、`keyword`、`followUpOperator`、`cooperationStatus`
- 查询范围为 `user.role=organizer` 且 `user.organizerStatus=1` 或历史已取消/冻结记录，具体状态由筛选项决定。
- 在 `omni_user` 内查询 `user`、`organizer_application`、`organizer_ops_assignment`，批量解析运营员姓名。
- 返回 `OrganizerDirectoryResponse`，包含主办方名称、主体类型、统一社会信用代码/资质编号、联系人、运营跟进人、可空 `onsaleActivityCount`、合作状态和更新时间。
- `organizer_application.license_no` 作为当前统一社会信用代码/资质编号展示来源；历史数据缺失时显示“未填写”。

`POST /api/user/console/organizers/{organizerId}/revoke`

- body 必须包含非空 `{ "reason": "..." }`。
- 允许 `organizer.review` 或 `organizer.account.manage`。
- 仅允许当前有效主办方执行冻结/取消合作。
- 更新 `user.role=user`、`user.organizerStatus=3`，保留 `organizerName` 和历史申请材料。
- 写入 `operation_audit_log`，动作使用 `organizer.revoke`，`reason` 保存强制审计原因。
- 不在本地同步修改票务库，不触发支付退款；后续可通过领域事件或票务侧异步任务限制新增场次。

### 活动数弱依赖

第一阶段名录接口允许 `onsaleActivityCount=null`。前端先渲染用户域分页结果，再使用已认证的票务后台批量概览接口 `POST /api/ticket/admin/organizers/batch-onsale-summary` 补充当前页主办方活动数。请求体为 `{ "organizerIds": [ ... ] }`，只发送去重后的正整数 ID。

当前页没有有效主办方 ID 时直接跳过统计请求；不为每行发起单独请求。统计请求设置 3000ms 超时，超时、网络异常、票务服务不可用或返回未知主办方时仅将对应单元格显示为 `-`，不影响列表、分页和冻结操作。`frontend/src/lib/api.ts` 的统一请求封装增加可选超时能力，页面仍通过 `request<T>()` 体系调用。

票务批量统计接口建议使用批量主办方 ID 入参和单次聚合查询，禁止前端为每行发起 N 次请求。该接口属于 `java-ticket` 自有数据查询，使用 internal token 或现有后台权限链路，不改变 `java-user` 的数据库边界。

## 前端结构

修改 `frontend/src/app/console/layout.tsx` 菜单文案，保留 href 和权限映射；同步更新 `console-paths.ts` 中同一路径的展示文案。

重构 `frontend/src/app/console/organizer-applications/page.tsx`：

### Tab 1：入驻审核申请流

- 默认激活。
- 筛选：关键字、申请状态、主体类型。
- 表格列：申请单号/申请时间、商户名称与用户 ID、主体类型、联系人及手机号、营业执照状态、申请状态、操作。
- 使用 `GlobalPagination`，默认每页 10 条。
- 点击行、“立即审核”或“查看详情”打开右侧 `Drawer`。
- Drawer 展示基础联系信息、申请材料图片、经营范围、申请说明、审核信息；图片点击打开图片预览层。
- 待审核申请在 Drawer 底部显示“审核通过”和“驳回申请”；通过备注可选，驳回原因必填并在提交前校验。

### Tab 2：正式主办方名录

- 筛选：主办方名称、运营跟进人、合作状态。
- 表格列：主办方名称/认证状态、统一社会信用代码、对接联系人、平台运营跟进人、旗下在售活动数、合作状态、操作。
- 点击行打开 Drawer 查看主办方详情、资质材料和合作状态。
- “取消合作/冻结”打开危险 `Modal`，固定展示业务影响说明，原因必填后调用 `revoke`。
- 活动数加载状态使用骨架或“统计中”，异常使用 `-`；不阻塞用户域列表。

所有请求通过 `frontend/src/lib/api.ts` 的 `request<T>()` 或同文件已有 multipart 封装完成；不引入 Axios。所有用户可见交互、错误和状态文案使用中文。

## 错误处理

- 未登录：跳转 `/login?ru=/console/organizer-applications`。
- 无 `organizer.review` 且无 `organizer.account.manage`：跳转 `/console`。
- 列表请求失败：显示中文错误和“重新加载”。
- 审核/冻结提交失败：保留抽屉或弹窗输入，显示后端中文错误，不模拟成功。
- 状态未知时禁止写操作，并显示“状态待核对”。
- 驳回原因、冻结原因仅接受 trim 后非空内容。
- 图片加载失败显示“材料加载失败”，不影响其他材料和详情文本。

## 测试策略

### Java

- `OrganizerApplicationServiceTest`：分页参数、关键字/状态/主体类型筛选、审批权限、审批审计、驳回非空原因、重复处理冲突。
- 新增材料服务测试：材料类型校验、文件类型/大小校验、申请归属校验、材料关联写入。
- 新增名录服务测试：同库查询映射、运营员批量解析、状态筛选、冻结原因非空、冻结审计、无权限拒绝。
- Controller 测试：新路径参数映射、`PENDING/APPROVED/REJECTED` 转换、`organizer.review` / `organizer.account.manage` 权限、缺少 internal token 的 internal 接口拒绝。

### 前端

- 更新页面入口结构测试：双 Tab、表格表头、`GlobalPagination`、`Drawer`、审核 Modal、冻结危险 Modal。
- API 单元测试：分页 query string、状态枚举、审核/驳回/revoke body、材料 multipart 字段。
- 保留未知状态防写和驳回非空校验回归测试。
- `pnpm typecheck` 作为前端验收。

### 边界与迁移

- 迁移脚本必须位于 `sql/production-split/user/`，并在生产 manifest 中登记。
- 若本地运行库使用独立拆库，执行 user 库迁移后再运行后端测试；不修改 `omni_ticket_split`。
- 最终运行 `scripts/verify-microservice-boundaries.ps1`，确认无跨库 Mapper、Entity、XML 或 SQL Join。

## 非目标

- 本次不恢复动态/Moment 相关代码。
- 本次不自动退款、不批量下架既有已售活动、不在 `java-user` 中直连票务数据库。
- 本次不引入完整异步事件总线；活动数事件化更新作为后续迭代。
