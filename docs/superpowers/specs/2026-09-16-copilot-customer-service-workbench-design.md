# Copilot 客服工作台前端接入设计

**日期：** 2026-09-16  
**状态：** 方案 A 已获批准，待实现  
**范围：** `frontend` B 端客服工作台；不修改 Copilot 后端核心、数据库结构或 C 端客服链路

## 1. 目标与边界

在现有 `/console/customer-service/sessions` 三栏客服工作台中接入 AI 客服 Copilot，形成：

`查看会话 -> 生成 AI 草稿 -> 人工接受/编辑/拒绝 -> 回填人工回复框 -> 人工发送`

Copilot 建议始终是独立草稿，不渲染为客户消息、人工已发送消息或新的 `support_message`。`Accept` 和 `Edit` 只更新 `support_ai_suggestion` 状态；只有人工点击“发送”才调用现有 `sendSupportMessage()`。

不新增平行客服页面，不引入 Axios、Redux、UI 框架或新的消息发送链路，不修改数据库迁移和 Java 业务逻辑。

## 2. 现状与真实 ID 映射

- `/console/support-conversations` 仅作兼容跳转，唯一实现页面是 `customer-service/sessions/page.tsx`。
- 当前选中会话来自 `selectedSession: CsSessionVO`。
- `CsSessionVO.id` 由 `CsSessionService` 对应 `support_conversation.id` 返回；消息查询使用同一 `id` 访问 `/api/user/cs/sessions/{sessionId}/messages`。
- 现有发送函数 `sendSupportMessage(conversationId, content)` 调用 `/api/user/support/conversations/{conversationId}/messages`。
- 本阶段按已核对的当前实现使用 `selectedSession.id` 作为 `sendSupportMessage()` 的 `conversationId`，不扩展或猜测其他 ID 关系。

## 3. 组件边界

### 3.1 `SupportCopilotPanel`

建议文件：`frontend/src/components/customer-service/SupportCopilotPanel.tsx`

组件接收当前 `sessionId`、权限状态和草稿回填回调，内部管理：

- 当前 `SupportAiSuggestion`；
- Generate、Accept、Edit、Reject 的 loading 和状态转换；
- 409 过期、502 事实校验失败、503 AI 不可用及普通错误；
- AI 草稿详情展示：回复建议、摘要、问题类型、推荐动作、缺失信息、事实依据；
- Edit 模式下的人工草稿文本；
- `Accept` 后调用 `onDraftChange(suggestionText)`，不调用消息发送 API。

会话变更后由 `sessionId` 变化触发清空；所有异步响应必须校验请求对应的 `sessionId`，旧会话响应不得覆盖新会话状态。

### 3.2 `sessions/page.tsx`

页面继续负责：

- 当前会话和消息列表；
- 人工回复文本编辑器；
- 发送按钮、发送 loading、发送成功后的消息刷新；
- Copilot 面板的挂载、会话 ID 传递和草稿回填；
- 会话切换时清空人工回复草稿及 Copilot 相关页面状态；
- 检测消息列表变化后提示当前 Copilot 可能已过期。

人工回复编辑器与内部备注编辑器分开，避免 Accept 覆盖内部备注。发送按钮只调用：

`sendSupportMessage(selectedSession.id, replyDraft)`

发送成功后重新加载当前会话消息；不调用 `/copilot/*`。

## 4. 前端类型与 API

在 `frontend/src/types/api.ts` 增加与 Java Controller Response DTO 的 JSON 一一对应的类型。实现前再次直接读取 `CsCopilotSuggestionResponse`、相关 Request DTO 和 Controller，确认 JSON 字段名、nullability、时间字段、`messageCutoff`、`missingInformation`、`sourceEvidence`，不得根据 Java Entity 猜测：

- `SupportAiSuggestionStatus`：
  `GENERATING | READY | ACCEPTED | ACCEPTED_EDITED | REJECTED | EXPIRED | FAILED`
- `CsCopilotSourceEvidenceResponse`：`factKey`、`text`
- `SupportAiSuggestion`：`suggestionId`、`conversationId`、`agentId`、`messageCutoff`、`contextDigest`、`status`、`suggestionText`、`summary`、`issueType`、`recommendedAction`、`missingInformation`、`sourceEvidence`、`editedText` 及时间字段
- `CsCopilotEditRequest`：`editedText`
- `CsCopilotRejectRequest`：`reason`

在现有 `frontend/src/lib/api.ts` 的 `request<T>()` 基础设施上新增 Copilot API 方法，不修改 `request<T>()` 的底层实现：

- `generateCsCopilotSuggestion(sessionId)`
- `acceptCsCopilotSuggestion(suggestionId)`
- `editCsCopilotSuggestion(suggestionId, body)`
- `rejectCsCopilotSuggestion(suggestionId, body?)`

请求路径严格对应：

- `POST /api/user/cs/sessions/{sessionId}/copilot/suggestions`
- `POST /api/user/cs/copilot/suggestions/{suggestionId}/accept`
- `POST /api/user/cs/copilot/suggestions/{suggestionId}/edit`
- `POST /api/user/cs/copilot/suggestions/{suggestionId}/reject`

不修改 `request<T>()` 基础设施。为支持 409/502/503 业务展示，沿用现有 `ApiError.code`；必要时只补充 Copilot 专用中文错误映射，不暴露 Java exception、prompt、模型细节或凭证。

## 5. 权限与状态机

页面从 `getUser()` 读取 `permissionCodes`，只有包含 `support.ai.use` 才显示“生成 AI 回复建议”；前端不因角色名自行扩大 Copilot 权限，后端仍是最终权限边界。

后端仍是最终权限边界。前端隐藏按钮只改善交互，不替代后端鉴权。

状态展示规则：

- 无建议：显示“暂无 AI 回复建议”和“生成 AI 回复建议”；
- `GENERATING`：显示“正在分析会话……”，禁止重复生成；
- `READY`：显示草稿详情、“AI 建议尚未发送”和接受/编辑/拒绝；由于后端 `edit` 只允许 `ACCEPTED`，点击“编辑”先接受草稿并进入本地编辑态，保存修改时再调用 `/edit`；
- `ACCEPTED`：显示“已接受 AI 建议，可继续修改”，回复文本进入人工输入框；
- `ACCEPTED_EDITED`：显示已修改状态，保留 `suggestionText` 原文；
- `REJECTED`：清空当前草稿展示；
- `EXPIRED`：禁止接受、编辑、拒绝，显示“会话内容已发生变化，当前 AI 建议已失效，请重新生成。”；
- `FAILED`：保留失败状态和重新生成入口。

## 6. 过期与消息刷新

Copilot 生成成功时记录当前会话的消息快照标识，仅用于前端提示，不替代后端 `messageCutoff + contextDigest` 校验。

当当前会话消息重新加载后，若消息集合发生变化且当前建议仍为 `READY` 或 `ACCEPTED`，显示“会话内容已更新，已有 AI 建议可能已失效”，同时提供“重新生成”。该提示只影响 Copilot UI：

- 绝不清空 `replyDraft`；
- 绝不用 Copilot 内容自动覆盖 `replyDraft`；
- 不自动重新生成；
- 不自动发送。

尤其在 `ACCEPTED` 后客服正在人工修改回复时，消息更新不能覆盖人工草稿。最终 Accept/Edit 仍以服务端 `messageCutoff + contextDigest` 为准。

收到 409 后：

1. 将当前建议标记为 `EXPIRED`；
2. 禁止旧 suggestion 的 Accept/Edit/Reject；
3. 保留过期提示；
4. “重新生成”重新调用当前 `sessionId` 的 Generate，不复用旧 `suggestionId`；
5. 不自动发送人工消息。

## 7. 事实依据展示

`sourceEvidence` 直接使用后端返回的 `text` 渲染为列表，显示 `text`，必要时以 `factKey` 作为辅助标识。前端不查询数据库、不访问 ES、不根据 `factKey` 重新拼接事实，也不自行解释订单或退款状态。

## 8. 测试设计

新增前端 Copilot 组件/API 结构测试，至少覆盖：

1. 无 `support.ai.use` 不显示 Generate；
2. Generate loading 且禁止重复提交；
3. `READY` 展示所有 Copilot 字段；
4. Accept 回填人工回复编辑器；
5. Accept 不调用 `/messages`；
6. Edit 只调用 `/copilot/suggestions/{id}/edit`；
7. Reject 清空草稿且不发送；
8. 409 标记 `EXPIRED`、禁用旧操作并提供重新生成；
9. 503 显示 AI 暂不可用；
10. 502 显示事实校验失败；
11. 切换会话清理 Copilot；
12. 新建议替换旧建议；
13. 编辑后保留原始 `suggestionText`；
14. 人工点击发送才调用 `sendSupportMessage(selectedSession.id, draft)`；
15. 新消息刷新后的过期提示不自动覆盖人工输入文本。

## 9. 验收命令

```powershell
cd frontend
pnpm typecheck
pnpm build
node --test src/lib/customer-service-workbench.test.ts src/lib/api.test.ts
```

同时执行：

```powershell
git diff --check
```

不执行 Git commit、push 或 merge，不执行数据库迁移，不启动或修改 C 端 `/messages/stream` 链路。
