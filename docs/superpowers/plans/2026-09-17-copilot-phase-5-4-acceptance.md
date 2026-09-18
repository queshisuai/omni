# Copilot Phase ⑤-4 验收计划

## 目标

在本地/开发环境对 Copilot、B 端客服工作台和 AI Ticket Finder 做一次可记录的系统级联调与安全边界验收，不扩展产品功能，不修改数据库结构。

## 阶段

- [x] 代码审计与测试计划确认
- [x] Java、Frontend 构建与定向回归
- [x] 微服务边界与生产 split SQL 静态检查
- [ ] 真实运行态 Copilot C1-C9
- [ ] 前端真实页面验收
- [ ] 会话切换、新消息与权限矩阵
- [ ] Finder 非空 fixture 回归
- [ ] 日志安全审计与延迟记录
- [ ] 更新 `implementation-notes.md` 并生成最终报告

## 当前约束

- 只使用本地测试库 `omni_user` 的临时、可恢复夹具。
- 不打印 JWT、密码、token、手机号全文或其他敏感凭证。
- 不执行 `commit`、`push`、`merge`、`reset`、`restore`、`checkout`、`clean`、`rebase`。

## 已知基线

- Java reactor、Frontend 定向测试、`pnpm typecheck`、`pnpm build`、边界检查和 `git diff --check` 已在本阶段前通过。
- `java-user:8081` 当前使用 `prod-split` 和最新源码；Ollama 使用本地 `Qwen2.5:7b`。
- 当前 CUA 浏览器连接受 Codex auth method `apikey` 环境错误阻塞，将改用可用的本地浏览器自动化方式或明确记录环境问题。
