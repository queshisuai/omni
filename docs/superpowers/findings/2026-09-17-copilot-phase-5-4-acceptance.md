# Copilot Phase ⑤-4 验收发现

## 运行态

- `java-user` 在 `8081` 监听，Ollama 在 `11434` 可访问，Gateway 在 `8088` 监听。
- 未认证访问 `java-user` 客服接口返回 `401`。
- 本地 `support_conversation.id=988111` 当前为 `CLOSED`，需要在测试结束后恢复原值。
- `support_ai_suggestion` 已有历史记录，后续测试必须使用新生成记录并按 ID 记录结果。
- 副作用快照首次脚本因将 `electronic_ticket` 查询到了 `omni_ticket_split` 而中止；正确 owner 是 `omni_order`，中止发生在任何 Copilot 写操作之前。
- 本轮真实 API 已新增 `support_message` 两条：一条是 C3 人工发送，一条是 C6 stale message 触发消息截点；Copilot Accept/Edit/Reject 没有直接新增消息。
- 当前新增 Copilot 记录 `16-20` 的最终状态分别为 `ACCEPTED`、`ACCEPTED_EDITED`、`REJECTED`、`EXPIRED`、`EXPIRED`。

## 待验证

- 真实 JWT 获取方式与临时 skill group visibility。
- C1-C9 API 链路、消息和业务表副作用。
- B 端真实浏览器 UI、会话隔离和新消息提示。
- Finder fixture 的非空结果及数据来源链路。
