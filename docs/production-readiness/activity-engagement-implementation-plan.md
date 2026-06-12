# 活动评价与问答正式化实施计划

## 目标

把现有 `activity_review` / `activity_question` 从 C 端残留功能升级为正式活动互动模块，覆盖已购票校验、评价审核、举报处理、问答隐藏/回复、订单页入口和后台入口。

## 第一轮范围

- 评价归 `java-ticket`，订单资格通过 `java-order` internal API 校验，不新增跨服务 Mapper 或跨库 SQL。
- 新评价必须携带 `orderId`，订单需属于当前用户，且订单状态为已支付或已退款，并且订单活动与当前活动一致。
- 新评价默认进入待审核；活动详情只展示已通过评价。
- 平台具备评价通过、隐藏、恢复、举报处理能力。
- 问答继续作为购前问答，不归入动态系统；后台可回复、隐藏、恢复。
- 前端补订单页评价入口、活动详情待审核提示、控制台评价管理入口。
- 补生产分库 SQL 资产并执行本地迁移验证。

## 边界

- 不恢复 `SocialController`、moment API、旧 social/moment 持久化代码。
- 不把订单表迁入 ticket；只通过 internal API 读取订单摘要。
- 不引入新依赖。

## 验证

- `mvn -pl java-ticket -Dtest=ActivityEngagementServiceTest,ActivityEngagementControllerTest,ActivityEngagementAdminControllerTest test`
- `node --test --experimental-strip-types frontend/src/lib/api.test.ts frontend/src/lib/console-auth.test.ts frontend/src/lib/console-paths.test.ts`
- `pnpm typecheck`
- `powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1`
- 本地 `omni_ticket_split` / `omni_user` 迁移执行和表结构核验。
