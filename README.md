# Omni 万象抢票平台

Omni 是一个类大麦网票务平台，当前交付口径是 **B 端主导、C 端参与**：平台管理员和主办方在后台完成活动、场次、票档、座位图、订单、退款、风控、客服和核验管理，普通用户在前台完成浏览、购票、抢票、候补、支付、评价和票夹查看。

本文只保留生产前最后阶段需要的信息。历史计划、一次性验收记录、浏览器会话、演示稿构建产物、本地上传文件和旧前端归档不再作为项目交付面。

## 当前生产前状态

- 推荐运行方式是 `prod-split`：Java 业务服务按服务拆分 PostgreSQL database，`java-gateway` 不连接业务数据库。
- `grab-service` 独立使用 `omni_grab`，Redis 负责抢票库存、幂等、用户 hold 和座位 hold。
- `omni_ticket` 仅保留为历史共享库、迁移源或 local-schema disposable 实验库；当前票务运行库必须是 `omni_ticket_split`。
- Sentinel 已覆盖网关、用户、票务、订单、支付关键链路。
- Seata 已覆盖订单、票务、支付核心跨服务写链路，事务组为 `omni_tx_group`。
- 评价系统当前允许迭代：`activity_review` / `activity_question`；动态系统仍禁止恢复。
- 前端使用 Next.js 代理 `/api/**` 到后端网关，用户可见文案必须是中文。

## 技术栈

| 层级 | 技术 |
|:---|:---|
| Java 后端 | Spring Boot 2.7.18 + Spring Cloud 2021.0.8 + Spring Cloud Alibaba 2021.0.5.0 |
| 网关 | Spring Cloud Gateway + Netty |
| 数据库 | PostgreSQL 17 |
| 缓存 / 抢票状态 | Redis 7 |
| MQ | RabbitMQ 3.13 |
| ORM | MyBatis-Plus 3.5.3.1 |
| 注册 / 配置中心 | Nacos 2.4.3 |
| 分布式事务 | Seata 1.6.1 |
| 前端 | Next.js 16.2.1 + React 19.2.4 + TypeScript |
| 抢票服务 | NestJS + Redis Lua + PostgreSQL |
| 构建 | Maven / pnpm / npm |

## 目录结构

```text
Omni/
├── java/                          # Java 微服务父工程
│   ├── java-common/               # 公共模块
│   ├── java-gateway/              # 网关 :8088
│   ├── java-user/                 # 用户/客服/权限服务 :8081
│   ├── java-ticket/               # 票务/活动/座位图服务 :8082
│   ├── java-order/                # 订单/票夹服务 :8083
│   ├── java-payment/              # 支付/退款服务 :8084
│   └── java-notification/         # 通知服务 :8085
├── frontend/                      # Next.js 前端 :3000
├── nestjs/grab-service/           # 抢票/候补服务 :3001
├── docker/                        # Docker 中间件配置
├── sql/                           # 数据库脚本
│   ├── production-split/          # 生产物理拆库迁移资产
│   ├── migrations/shared/         # 历史共享库迁移归档
│   ├── local/                     # 仅本地 disposable DB 使用
│   └── seeds/prod-split-real-demo/# 本地真实演示数据
├── scripts/                       # 启动、边界检查、拆库导入导出、runtime verifier
├── docs/                          # 保留的设计、边界、运维和生产就绪文档
├── runtime/                       # 本地运行时目录，不应提交内容
└── start-project.ps1              # 推荐本机启动脚本
```

## 数据库拓扑

| 服务 | 数据库 |
|:---|:---|
| `java-user` | `omni_user` |
| `java-ticket` | `omni_ticket_split` |
| `java-order` | `omni_order` |
| `java-payment` | `omni_payment` |
| `java-notification` | `omni_notification` |
| `grab-service` | `omni_grab` |
| `java-gateway` | 不连接业务数据库 |

本机默认连接：`localhost:5432` / `postgres` / `123456`。生产环境必须通过环境变量或部署平台注入真实凭据，不要写入仓库。

## 本机启动

推荐：

```powershell
powershell -ExecutionPolicy Bypass -File start-project.ps1
```

脚本会检查 Java、Maven、Node、pnpm/npm，注入本地默认 `JWT_SECRET` 和 `INTERNAL_API_TOKEN`，以 `prod-split` 启动五个 Java 业务服务，启动 `grab-service` 和前端。

Docker 中间件模式：

```powershell
powershell -ExecutionPolicy Bypass -File start-project.ps1 -UseDockerInfra
```

注意：当前 `scripts/start-infra.ps1` 只检查本机 PostgreSQL 并启动 Docker Redis、Nacos；不会启动 PostgreSQL 容器，也不会启动 RabbitMQ。需要 RabbitMQ 时运行：

```powershell
docker compose up -d rabbitmq
```

Seata 本地刷新：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-seata-docker.ps1
```

网络环境变化后先刷新 Seata，再重启 `java-ticket`、`java-order`、`java-payment`。

## 入口与账号

| 入口 | 地址 |
|:---|:---|
| 用户前台 | http://localhost:3000 |
| 管理后台 | http://localhost:3000/console |
| API 网关 | http://localhost:8088 |
| Nacos | http://localhost:8848/nacos |
| RabbitMQ 管理台 | http://localhost:15672 |
| Seata 控制台 | http://localhost:7091 |

| 手机号 | 密码 | 角色 | userId |
|:---|:---|:---|:---|
| `13800000001` | `123456` | admin | `2002` |
| `13800000002` | `123456` | organizer | `2003` |
| `13900000001` | `123456` | user | `2004` |

登录字段使用 `account`，不要使用旧字段 `phone`：

```powershell
curl.exe --% -s -m 10 -X POST http://localhost:8088/api/user/login -H "Content-Type: application/json" -d "{\"loginType\":\"password\",\"account\":\"13900000001\",\"password\":\"123456\"}"
```

## 核心业务链路

```text
登录 -> 浏览/搜索活动 -> 活动详情
-> 选择场次、票档、座位或提交抢票
-> 创建订单 / 候补递补生成订单
-> 支付宝沙盒 QR 或 page pay
-> 支付同步/回调
-> order 标记已支付 -> ticket 确认售出/占座 -> 票夹出票
```

关键接口：

- `POST /api/user/login`
- `GET /api/ticket/activities`
- `GET /api/ticket/activities/{id}`
- `POST /api/order/create`
- `POST /api/order/create-with-seats`
- `POST /api/grab/requests`
- `POST /api/waitlist/entries`
- `POST /api/payment/alipay/qr-pay`
- `GET /api/payment/alipay/sync/{orderId}`
- `GET /api/order/user/{userId}`

订单状态：`1=待支付`、`2=已支付`、`3=已取消`、`4=已退款`。

## 微服务边界

- 禁止新增跨服务 Mapper、Entity、XML mapper 或 SQL join。
- `java-order` 不直接访问 user/ticket 表，通过 `java-user` 和 `java-ticket` internal API 完成校验、报价、库存/座位锁定、确认售出和释放。
- `java-payment` 不直接访问 order/user/ticket 表，通过 internal API 获取/更新订单和做退款校验。
- `java-notification` 的 `userId`、`orderId` 是 copied id，不拥有 user/order 数据。
- `grab-service` 不直接写 ticket/order/user DB，抢票成功后通过 Gateway 调用 order internal API。
- 所有新增 internal API 必须校验 `X-Internal-Token`。

## 验收命令

边界验收：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
```

生产拆库 runtime verifier：

```powershell
$env:PGPASSWORD='123456'
powershell -ExecutionPolicy Bypass -File scripts/verify-production-split-runtime.ps1 -UserHost localhost -TicketHost localhost -OrderHost localhost -PaymentHost localhost -NotificationHost localhost -TargetDatabaseByService 'ticket=omni_ticket_split'
```

前端检查：

```powershell
cd frontend
pnpm typecheck
```

当前数据库连接检查：

```powershell
$env:PGPASSWORD='123456'
psql -h localhost -p 5432 -U postgres -d postgres -t -A -c "SELECT datname, application_name, state FROM pg_stat_activity WHERE datname LIKE 'omni%' ORDER BY datname, application_name, state;"
```

正常情况下不应出现业务 JDBC 连接到 `omni_ticket`。

## 保留文档

- `CLAUDE.md`：开发者/AI 运行手册。
- `AGENTS.md`：Codex 项目规则。
- `docs/microservices/`：微服务边界和拆库约束。
- `docs/operations/2026-05-20-production-physical-db-split-design.md`
- `docs/operations/2026-05-20-production-physical-db-split-implementation.md`
- `docs/operations/production-db-split-cutover-checklist.md`
- `docs/operations/seata-local-verification.md`
- `docs/production-readiness/production-env-vars.md`
- `docs/production-readiness/production-defaults-audit.md`
- `docs/production-readiness/sentry-evaluation-and-trial-plan.md`
- `docs/production-readiness/posthog-evaluation-and-trial-plan.md`

## 生产前清理结论

以下内容不应进入生产交付面，已在本轮清理或列为可删除对象：

- 浏览器/Agent 会话产物：`.playwright-mcp/`、`.superpowers/`、`.codex-logs/`。
- 一次性计划和流水文档：`task_plan.md`、`progress.md`、`findings.md`、`docs/superpowers/`、已完成的 `*-implementation-plan.md`。
- 旧扫描报告和过期索引：`docs/test-file-cleanup-report.md`、`PROJECT_INDEX.md`。
- 演示稿/答辩构建产物：`outputs/`、`unit-test/`、项目报告 `.docx`。
- 本地运行文件：`runtime/` 下的上传文件、预览图、日志、pids、service-env。
- 旧实现归档：`vue-archive/`。
- 临时依赖分析文件：`seata-dependency-baseline.txt`。

后续如果需要保留验收证据，应放到外部归档或 issue/发布记录，不再堆在源码根目录。

## 操作纪律

- 不要提交真实密钥、token、数据库 dump、运行 artifact 或上传文件。
- 不要把 `sql/local/*` 用于 staging / production。
- 不要把默认 `application.yml` 改成 local-schema 或生产拆库专用配置。
- 后端改动后必须重新编译并重启对应服务才会生效。
- 涉及边界、拆库、Seata、Sentinel 的改动必须同步测试和文档。
- 前端页面和入口按钮必须与后端能力对接，不能只让后端测试通过。
