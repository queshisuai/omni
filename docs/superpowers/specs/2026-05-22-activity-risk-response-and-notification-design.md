# Activity Risk Response And Notification Design

## 背景

Phase 2 已完成艺人档案审核、风险艺人标记和活动发布前拦截。剩余链路需要处理已发布活动被风险艺人影响后的售卖状态、主办方处理申请、admin 恢复售票审查，以及阵容变更通知和特殊退款入口。

## 目标

- Admin 标记风险艺人后，ticket 服务自动停止受影响已发布活动的售票。
- 主办方可提交风险处理/恢复售票申请。
- Admin 审核恢复售票申请，确认活动阵容已安全后恢复售票。
- ticket 通过 notification internal API 创建站内消息/待办，不直接写 notification 数据库。
- 阵容变更触发已购用户通知，并允许用户以“阵容变更”为原因申请退款。

## 非目标

- 不引入 MQ/outbox/CDC。
- 不实现真实短信/邮件推送。
- 不自动退款；退款仍进入现有 payment 审核流程。
- 不向 C 端暴露风险原因或风险艺人名称。

## 数据模型

### ticket 库

新增 `activity_risk_resolution`：

- `id`
- `activity_id`
- `organizer_id`
- `risk_artist_id`
- `status`：`pending`、`approved`、`rejected`
- `resolution_note`
- `review_note`
- `submitted_by`
- `reviewed_by`
- `reviewed_at`
- `create_time`
- `update_time`

扩展 `activity`：

- `risk_suspended_reason`
- `risk_suspended_at`
- `risk_restored_at`

已发布活动被风险艺人影响时：

- `activity.status=0`
- `activity.publish_status='risk_suspended'`
- 关联 active `session.status=0`
- 关联 active `ticket_type.status=0`

恢复售票时：

- 通过现有发布校验和 Phase 2 艺人治理校验。
- `activity.status=1`
- `activity.publish_status='published'`
- 恢复活动下场次/票档 `status=1`。

### notification 库

不新增复杂表。扩展 `notification` 用现有字段保存站内消息/待办：

- `type='IN_APP'`：站内消息。
- `type='TODO'`：待办。
- `content`：结构化文本，包含业务类型和摘要。
- `user_id`、`order_id` 继续是 copied id。

## 后端 API

### ticket admin 风险处理

`POST /api/ticket/admin/activities/{id}/risk-resolution`

- 主办方提交处理说明。
- 仅活动 organizer 或 admin 可提交。
- 创建 `activity_risk_resolution.status=pending`。
- 通知 admin 待审核。

`GET /api/ticket/admin/risk-resolutions?userId=...&status=pending`

- admin 查看全部。
- organizer 只看自己的活动。

`POST /api/ticket/admin/risk-resolutions/{id}/review`

- 仅 admin。
- `approve` 时重新校验活动阵容安全后恢复售票。
- `reject` 时保持停止售票。

### notification internal

`POST /api/notification/internal/messages`

- Header：`X-Internal-Token`
- Body：`userId`、`orderId`、`type`、`content`
- 创建 notification 记录。

### payment refund

扩展 `ApplyRefundRequest.reasonType`：

- 普通退款不传或传 `normal`。
- 阵容变更退款传 `cast_change`。

payment 保存到现有 `refund_request.reason` 时拼接明确前缀：`阵容变更：...`，不改变 payment 表结构。

## 通知策略

- 风险停票：通知活动 organizer。
- 主办方提交恢复申请：创建 admin 待办。
- admin 审核通过/拒绝：通知 organizer。
- 阵容变更：查询已购订单用户，通知每个已购用户。

ticket 不直接查询 order 表；通过现有 order internal API 获取 paid orders。

## C 端展示

当 `publish_status='risk_suspended'` 或 `status=0` 且有风险暂停原因时，C 端展示：

`该活动暂时停止售票`

不展示风险原因。

## 测试

- 标记风险艺人会停止已发布活动售票。
- 未发布活动不被恢复/停票误处理。
- 恢复申请只能由活动主办方或 admin 提交。
- admin 通过恢复申请前会重新执行艺人治理校验。
- notification internal token 不正确返回 403。
- 阵容变更触发通知调用。
- `reasonType=cast_change` 的退款申请保存为阵容变更原因。
