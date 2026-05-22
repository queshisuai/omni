# Activity Artist Governance Phase 2 Design

## 背景

Phase 1 已完成活动多艺人阵容、艺人搜索、活动新建/编辑回填和 C 端公开阵容展示。本阶段继续做艺人治理闭环，目标是让平台在活动发布前能够确认艺人档案可信、识别风险艺人，并阻止含有问题阵容的活动上架。

本阶段只覆盖发布前治理，不处理已发布活动被风险艺人影响后的自动停票、恢复售票审查、通知/待办、阵容变更退款。这些能力留到 Phase 3 和 Phase 4。

## 目标

- 主办方可以提交平台艺人档案候选，进入待审核状态。
- Admin 可以审核艺人档案，通过或拒绝。
- Admin 可以标记和清除风险艺人。
- 活动发布时校验完整阵容，发现未审核、被拒绝、禁用或风险艺人时阻止发布。
- 现有 seed/admin 已维护艺人默认视为审核通过，避免破坏当前演示数据和已建活动。

## 非目标

- 不自动下架或停止已发布活动。
- 不创建 notification 站内消息、待办或阵容变更通知。
- 不实现特殊退款入口。
- 不引入跨服务表访问；ticket 服务继续只拥有 artist/activity/activity_artist。
- 不暴露风险原因给 C 端。

## 数据模型

### `artist` 审核字段

在 `artist` 表新增或正式启用以下字段：

- `review_status`：`pending`、`approved`、`rejected`。默认 `approved`，兼容现有正式艺人。
- `review_note`：审核备注。
- `submitted_by`：提交人 userId，ticket 服务只保存 copied id。
- `reviewed_by`：审核人 userId，ticket 服务只保存 copied id。
- `reviewed_at`：审核时间。
- `update_time`：更新时间。

Phase 1 已预留风险字段，本阶段正式启用：

- `risk_status`：`normal`、`risky`。默认 `normal`。
- `risk_reason`：风险原因，仅 B 端/admin 可见。
- `risk_marked_by`、`risk_marked_at`：风险标记审计。
- `risk_cleared_by`、`risk_cleared_at`：风险清除审计。

## 后端 API

### 主办方提交艺人档案

`POST /api/ticket/admin/artists/submissions`

请求字段：

- `userId`
- `name`
- `alias`
- `artistType`
- `countryOrRegion`
- `agency`
- `representativeWorks`
- `categoryTags`
- `description`
- `sourceNote`

权限：admin 或 organizer。

行为：

- 校验 `name` 非空。
- 创建 `artist.status=1`、`review_status=pending`、`risk_status=normal`。
- `submitted_by=userId`。
- 返回创建后的艺人档案。

### Admin 审核艺人档案

`GET /api/ticket/admin/artists/pending?userId=...`

- 仅 admin。
- 返回 `review_status=pending` 的艺人列表。

`POST /api/ticket/admin/artists/{id}/review`

请求字段：

- `userId`
- `action`：`approve` 或 `reject`
- `note`

行为：

- 仅 admin。
- `approve` 设置 `review_status=approved`。
- `reject` 设置 `review_status=rejected`。
- 写入 `reviewed_by`、`reviewed_at`、`review_note`、`update_time`。

### Admin 风险标记

`POST /api/ticket/admin/artists/{id}/risk`

请求字段：

- `userId`
- `riskStatus`：`normal` 或 `risky`
- `reason`

行为：

- 仅 admin。
- `risky` 必须填写 `reason`。
- 标记风险写入 `risk_status=risky`、`risk_reason`、`risk_marked_by`、`risk_marked_at`、`update_time`。
- 清除风险写入 `risk_status=normal`，清空当前风险原因，写入 `risk_cleared_by`、`risk_cleared_at`、`update_time`。

## 发布拦截

活动发布入口继续走 `ActivityAdminService.updateActivityStatus()`。当目标状态是上架状态 `status=1` 时，在现有场次/票档校验基础上增加阵容治理校验：

- 活动必须至少有一个 active 阵容艺人。
- 阵容艺人必须存在。
- 艺人 `status` 必须为 `1`。
- `review_status` 必须为 `approved`。空值按 `approved` 兼容历史数据。
- `risk_status` 不得为 `risky`。

失败提示：

- 无阵容：`上架活动前至少需要一个已审核艺人`
- 未审核或拒绝：`阵容中存在未审核艺人，请先完成艺人档案审核`
- 风险艺人：`阵容中存在风险艺人，暂不能上架`
- 禁用/不存在：`阵容中存在不可用艺人，暂不能上架`

## 前端

后台最小接入：

- 艺人选择器搜索结果展示审核状态和风险状态。
- 搜索不到艺人时，提供“提交艺人档案审核”表单。
- Admin 可在后台查看待审核艺人并通过/拒绝。
- Admin 可在艺人详情中标记/清除风险。

为了控制范围，本阶段不新增复杂艺人库管理页面，只实现活动表单相关的提交入口和一个最小 admin 审核列表。

## 测试策略

后端先按 TDD 覆盖：

- 发布活动时无阵容被拦截。
- 发布活动时包含待审核艺人被拦截。
- 发布活动时包含风险艺人被拦截。
- 发布活动时所有艺人审核通过且正常，继续通过原有发布校验。
- 主办方提交艺人档案后状态为 `pending`。
- Admin 审核通过/拒绝写入审计字段。
- Admin 标记/清除风险写入审计字段。

前端验证：

- `pnpm typecheck`。
- 活动表单艺人搜索结果类型包含审核/风险字段。
- 提交艺人档案表单 payload 类型正确。

## 风险

- 发布状态历史语义主要使用 `status=1`，本阶段不重构生命周期状态机。
- 现有艺人默认审核通过，避免演示数据被阻断；真实生产导入时必须按迁移策略显式确认历史艺人可信。
- Phase 2 不处理已发布活动风险，这会在风险标记后留下已发布活动仍可见的问题；Phase 3 必须补齐自动停票和恢复审查。
