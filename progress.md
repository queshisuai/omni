# 大麦迁移体验改进进度

## 2026-06-01

- 恢复上下文并读取 `task_plan.md`、`progress.md`、`findings.md`、`git status` 和 `git diff --stat`。
- 确认当前主工作区已有未提交改动：实名证件号加密相关代码、既有文档草稿和规划文件。
- 用户要求按 P0/P1/P2 完成大麦迁移体验计划；已将根目录 `task_plan.md` 重写为新的执行计划。
- 当前执行切片：P0-A 票夹后端闭环，先做电子票建模、支付后出票、我的票夹、动态入场码和核销接口。
- 接续完成 P2：新增 `activity_marketing_rule` 营销规则表、Java 营销配置 API、前端 `/console/activities/[id]/marketing` 页面和活动列表“营销”入口。
- 扩展平台运营驾驶舱：`AdminSummaryResponse` 新增热门活动、订单/支付超时、退款/风控指标；grab-service 新增 `/api/grab/admin/ops-summary` 返回抢票失败原因和候补转化。
- 启动 P3 大麦对比增量体验：先补帮助中心/在线客服、搜索历史与移动端底部导航。
- 新增用户服务客服闭环：FAQ、可选本地大模型 AI 客服、项目规则兜底回复、客服会话/消息记录、人工客服接入/关闭、平台管理员客服账号创建与注销。
- 新增前端客服入口：`/help` 帮助中心与在线客服、`/support` 人工客服工作台、`/console/support-accounts` 平台客服账号管理、登录后 `support` 角色直达客服工作台。
- 新增搜索体验：搜索历史、热门搜索、联想组合；Header 城市选择写入本地状态并联动首页/搜索筛选。
- 新增移动端底部 Tab： 首页 / 分类 / 票夹 / 我的。
- 新增评价/评分/问答闭环：`java-ticket` 提供活动评价列表、评分统计、提交评价、问答列表和提问接口；活动详情页展示评分概览、评价和问答入口。
- 新增个性化推荐：活动详情写入浏览信号，首页按最近浏览的品类、艺人、城市生成“猜你喜欢”。
- 新增订单详情页：`/orders/[id]` 展示订单状态、履约时间线、活动/票档/实名观演人、电子票入口和退款时间线。
- 修复新增客服与评价问答生产 SQL 校验：补齐 owner 注释，并把 `support_conversation`、`support_message`、`activity_review`、`activity_question` 加入分库 SQL 安全检查白名单。
- 补齐本地大模型客服适配层：新增 Ollama 兼容 HTTP 客户端，默认关闭；启用后会把 Omni 项目规则作为系统提示词传给本地模型，失败时自动回落到规则回复。
- 修复 `java-user` 启动失败：`OllamaSupportLocalModelClient` 有生产构造器和测试构造器，Spring 未明确构造器时会尝试无参构造；现已给生产构造器标记 `@Autowired` 并增加 Spring 容器回归测试。
- 修复本地启动配置问题：`java-user` 在 `prod-split` 下启动需要 `OMNI_ID_NO_KEY`，而 PowerShell/Maven 不会自动读取 `.env`；`start-project.ps1` 现在会静默加载根目录 `.env`，并在本地开发缺省时设置 `OMNI_ID_NO_KEY`。

## 验证记录

- `mvn -pl java-ticket test`：589 个测试通过。
- `node --test frontend/src/lib/marketing-tools.test.ts frontend/src/lib/api.test.ts`：16 个测试通过。
- `cd frontend && npm run typecheck`：通过。
- `cd nestjs/grab-service && .\node_modules\.bin\jest.cmd --runInBand src/grab/grab-ops.service.spec.ts src/grab/grab.service.spec.ts src/waitlist/waitlist.service.spec.ts`：29 个测试通过。
- `cd nestjs/grab-service && npm run build`：通过。
- `powershell -ExecutionPolicy Bypass -File scripts\check-production-split-sql.ps1`：通过。
- `cd java && mvn -pl java-user "-Dtest=SupportAiServiceTest,SupportAccountServiceTest,CustomerSupportServiceTest" test`：10 个测试通过。
- `node --test frontend/src/lib/support-tools.test.ts frontend/src/lib/search-experience.test.ts`：6 个测试通过。
- `cd frontend && npm run typecheck`：通过。
- `powershell -ExecutionPolicy Bypass -File scripts\check-production-split-sql.ps1`：通过。
- `node --test frontend/src/lib/orders-experience.test.ts frontend/src/lib/personalized-recommendations.test.ts frontend/src/lib/support-tools.test.ts frontend/src/lib/search-experience.test.ts frontend/src/lib/api.test.ts`：22 个测试通过。
- `cd frontend && npm run typecheck`：通过。
- `cd java && mvn -pl java-user,java-ticket test`：`java-user` 54 个测试通过，`java-ticket` 594 个测试通过。
- `cd java && mvn -pl java-order test`：187 个测试通过。
- `cd nestjs/grab-service && .\node_modules\.bin\jest.cmd --runInBand src/grab/grab-ops.service.spec.ts src/grab/grab.service.spec.ts src/waitlist/waitlist.service.spec.ts`：29 个测试通过。
- `cd nestjs/grab-service && npm run build`：通过。
- `cd java && mvn -pl java-user "-Dtest=SupportAiServiceTest,CustomerSupportServiceTest,OllamaSupportLocalModelClientTest" test`：10 个测试通过。
- `cd java && mvn -pl java-user test`：58 个测试通过。
- `powershell -ExecutionPolicy Bypass -File scripts\check-production-split-sql.ps1`：通过。
- `cd java && mvn -pl java-user "-Dtest=OllamaSupportLocalModelClientTest#springCanCreateClientBeanWithoutDefaultConstructor" test`：先复现无参构造失败，修复后 1 个测试通过。
- `cd java && mvn -pl java-user test`：59 个测试通过。
- `powershell` 解析 `start-project.ps1`：语法通过。
- `cd java && mvn -pl java-user "-Dtest=LocalSchemaRuntimeConfigTest,UserAttendeeServiceTest" test`：7 个测试通过。
