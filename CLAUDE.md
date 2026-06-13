# Omni 万象抢票平台

> 本文是给 AI/开发者使用的当前运行手册，以 `prod-split`、物理拆库、Sentinel、Seata、Next.js 前端代理和本地 PostgreSQL 五库联调为准。

## 当前状态

- 项目是类大麦网票务平台，采用 **B 端主导、C 端参与** 模式。
- B 端包含平台管理员和主办方；C 端包含普通用户浏览、购票、抢票、候补、支付、订单、退款、通知、评价和票夹。
- 推荐运行方式是 `prod-split`：Java 业务服务按服务拆分 PostgreSQL database，`grab-service` 独立使用 `omni_grab`，`java-gateway` 不连接业务数据库。
- `omni_ticket` 只作为历史共享库、迁移源或 local-schema disposable 实验库；当前票务库必须是 `omni_ticket_split`。
- Sentinel 已覆盖网关、用户、票务、订单、支付关键链路。
- Seata 已覆盖订单、票务、支付核心写链路，事务组为 `omni_tx_group`。
- SeatCraft 已进入当前业务主链路，支持场馆模板、活动/场次草稿、版本发布/回滚、票档区域绑定、场次座位生成和下单占座。
- 评价系统允许迭代：活动评价、评价审核、评价举报和活动问答均围绕 `activity_review` / `activity_question`；动态系统禁止恢复。

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
| 分布式保护 | Sentinel |
| 分布式事务 | Seata 1.6.1 |
| Java 鉴权 | JJWT 0.11.5 |
| 前端 | Next.js 16.2.1 + React 19.2.4 + TypeScript |
| 抢票服务 | NestJS + Redis Lua + PostgreSQL |

## 目录速览

```text
java/                         Java 微服务父工程
frontend/                     Next.js 前端
nestjs/grab-service/          抢票/候补服务
docker/                       Docker 中间件配置
sql/production-split/         生产物理拆库迁移资产
sql/local/                    仅本地 disposable DB 使用
sql/seeds/prod-split-real-demo/ 本地真实演示数据
scripts/                      启动、检查、导入导出和 runtime verifier
docs/microservices/           微服务边界与表所有权
docs/operations/              运维、拆库、Seata
docs/production-readiness/    生产环境变量、默认值审计、外部观测试点
runtime/                      本地运行时目录，内容不提交
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

本机默认：`localhost:5432` / `postgres` / `123456`。表名无前缀，保留字表名需要双引号，例如 `"user"`、`"order"`。

## 端口

| 服务 | 端口 | 说明 |
|:---|:---|:---|
| frontend | 3000 | Next.js 前端 |
| grab-service | 3001 | NestJS 抢票/候补服务 |
| PostgreSQL | 5432 | 本机业务数据库 |
| Redis | 6379 | 抢票库存、幂等、hold |
| RabbitMQ | 5672 / 15672 | 事件消息 / 管理台 |
| Nacos HTTP | 8848 | 注册中心 / 配置中心 |
| Nacos gRPC | 9848 | Nacos 2.x 客户端通信 |
| Seata Console | 7091 | 控制台，默认 `seata / seata` |
| Seata TC | 8091 | Transaction Coordinator |
| java-user | 8081 | 用户服务 |
| java-ticket | 8082 | 票务服务 |
| java-order | 8083 | 订单服务 |
| java-payment | 8084 | 支付服务 |
| java-notification | 8085 | 通知服务 |
| java-gateway | 8088 | API 网关 |

## 启动方式

推荐：

```powershell
powershell -ExecutionPolicy Bypass -File start-project.ps1
```

`start-project.ps1` 默认行为：

- 检查 Java、Maven、Node、pnpm/npm。
- 未配置时写入本地默认 `JWT_SECRET` 和 `INTERNAL_API_TOKEN`。
- 启动/检查本机 PostgreSQL 与 Nacos。
- 以 `prod-split` profile 启动五个 Java 业务服务，`java-gateway` 使用默认 profile。
- 注入 datasource、`internal.api.token`、`jwt.secret`、Nacos 注册 IP 和 `runtime/uploads` 上传目录。
- 启动 `nestjs/grab-service` 与 `frontend`。

Docker 中间件模式：

```powershell
powershell -ExecutionPolicy Bypass -File start-project.ps1 -UseDockerInfra
```

当前 `scripts/start-infra.ps1` 只检查本机 PostgreSQL 并启动 Docker Redis、Nacos；不会启动 PostgreSQL 容器，也不会启动 RabbitMQ。需要 RabbitMQ 时运行：

```powershell
docker compose up -d rabbitmq
```

Seata 刷新：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-seata-docker.ps1
```

该脚本会探测宿主机非回环 IPv4，启动/复用 Nacos，重建 `seata-config-init`，重建 `seata-server`，并刷新 Nacos 中的 Seata 地址。网络环境变化后先运行它，再重启 `java-ticket`、`java-order`、`java-payment`。

手动启动示例：

```powershell
cd java/java-user
mvn spring-boot:run -Dspring-boot.run.profiles=prod-split -Dspring-boot.run.arguments="--spring.datasource.url=jdbc:postgresql://localhost:5432/omni_user --spring.datasource.username=postgres --spring.datasource.password=123456 --internal.api.token=omni-local-internal-token --jwt.secret=omni-local-jwt-secret-must-be-at-least-32-bytes"
```

抢票服务手动启动：

```powershell
cd nestjs/grab-service
$env:GRAB_SERVICE_PORT='3001'
$env:GRAB_DB_HOST='localhost'
$env:GRAB_DB_PORT='5432'
$env:GRAB_DB_NAME='omni_grab'
$env:GRAB_DB_USER='postgres'
$env:GRAB_DB_PASSWORD='123456'
$env:REDIS_HOST='localhost'
$env:REDIS_PORT='6379'
$env:ORDER_SERVICE_URL='http://localhost:8083'
$env:TICKET_SERVICE_URL='http://localhost:8082'
$env:NOTIFICATION_SERVICE_URL='http://localhost:8088'
$env:INTERNAL_API_TOKEN='omni-local-internal-token'
$env:JWT_SECRET='omni-local-jwt-secret-must-be-at-least-32-bytes'
$env:RABBITMQ_HOST='localhost'
$env:RABBITMQ_PORT='5672'
$env:RABBITMQ_USER='admin'
$env:RABBITMQ_PASSWORD='123456'
npm run start:dev
```

前端：

```powershell
cd frontend
pnpm dev
```

## 测试账号

| 手机号 | 密码 | 角色 | userId |
|:---|:---|:---|:---|
| `13800000001` | `123456` | admin | `2002` |
| `13800000002` | `123456` | organizer | `2003` |
| `13900000001` | `123456` | user | `2004` |

登录字段使用 `account`：

```powershell
curl.exe --% -s -m 10 -X POST http://localhost:8088/api/user/login -H "Content-Type: application/json" -d "{\"loginType\":\"password\",\"account\":\"13900000001\",\"password\":\"123456\"}"
```

PowerShell 下传 JSON 优先使用 `curl.exe --%`，避免引号转义导致假 500。

## API 与鉴权

- 统一响应：`Result<T>`，成功 `code=200`。
- 浏览器请求使用 `Authorization: Bearer <token>`。
- JWT 包含 `userId`、`phone`、`role`。
- B 端生产级接口必须从 `Authorization` 解析当前用户，不能相信前端 query/body 传入的 `userId`。
- 历史接口中仍有部分 admin/tour/session/venue API 使用 `userId` query/body；改造时按接口逐步迁移。
- 内部接口使用 `X-Internal-Token`，配置名为 `internal.api.token` 或环境变量 `INTERNAL_API_TOKEN`。
- 前端 `frontend/src/lib/api.ts` 默认 `NEXT_PUBLIC_API_URL=''`，浏览器请求先打到 Next.js `/api/**`。
- 代理目标默认 `http://localhost:8088`，可用 `API_PROXY_TARGET` 覆盖；代理会转发 `authorization`。

## 业务流程

### C 端购票

```text
登录 -> 浏览/搜索活动 -> 活动详情
-> 选择场次和票档/座位 -> 创建订单或提交抢票请求
-> 支付宝沙盒 QR 或 page pay
-> 支付同步/回调 -> java-order 标记订单已支付
-> ticket 确认售出/占用座位 -> 查看订单/票夹
```

关键接口：

- `POST /api/user/login`
- `GET /api/ticket/activities`
- `GET /api/ticket/categories`
- `GET /api/ticket/activities/{id}`
- `GET /api/ticket/sessions/{sessionId}/ticket-types/{ticketTypeId}/seats`
- `POST /api/order/create`
- `POST /api/order/create-with-seats`
- `POST /api/grab/requests`
- `POST /api/waitlist/entries`
- `POST /api/payment/alipay/qr-pay`
- `GET /api/payment/alipay/sync/{orderId}`
- `GET /api/order/user/{userId}`

### B 端后台

- 平台管理员可以查看全平台后台订单、审核主办方、审核场馆申请、审核站点配置、处理风险和艺人治理。
- 主办方只能查看和管理自己创建或归属自己的活动、巡演、场次、票档、座位图和订单。
- 后台订单接口是 `GET /api/ticket/admin/orders`，当前应从 JWT 解析操作者；前端不要传 `userId`。
- 用户侧订单回收站/隐藏只影响 C 端个人列表，不影响 B 端后台订单查看。

### 抢票与候补

- Gateway 路由 `/api/grab/**` 和 `/api/waitlist/**` 到 `grab-service`。
- Redis Lua 负责库存扣减、幂等、用户 hold 和座位 hold。
- 抢票成功后通过 order internal API 创建订单，携带 `X-Internal-Token`。
- 订单创建失败或超时必须恢复 Redis 库存和 hold。
- 候补队列只管理资格和顺序，库存释放后复用订单服务创建待支付订单。

### 退款

- 用户申请退款在 `java-payment`。
- 退款审核通过 `java-order`、`java-ticket` 做订单和票务权限/影响校验。
- 内部状态更新受 Seata 保护；真实支付宝退款、通知、Redis 和外部副作用不由 Seata AT 回滚。
- 外部退款成功但内部落库失败时走补偿或人工处理。

### 评价与问答

- `java-ticket` 拥有 `activity_review`、`activity_question` 相关表。
- 评价和问答不跨服务查询 user 表，`userId` 为 copied id。
- 用户购后可评分和文字评价，主办方可回复，平台管理员可审核评价和处理举报。
- 新增评价相关 internal API 必须校验 `X-Internal-Token`。

## 订单状态

| 状态值 | 后端常量 | 前端含义 |
|:---|:---|:---|
| `1` | `STATUS_PENDING` | 待支付 |
| `2` | `STATUS_PAID` | 已支付 |
| `3` | `STATUS_CANCELLED` | 已取消 |
| `4` | `STATUS_REFUNDED` | 已退款 |

前端订单页已按 `STATUS_PENDING=1` 对齐，不要改回 0。

## Seata

- Seata Server 版本：`1.6.1`
- Nacos group：`SEATA_GROUP`
- Nacos dataId：`seataServer.properties`
- 事务组：`omni_tx_group`
- vgroup 映射：`service.vgroupMapping.omni_tx_group=default`
- 已接入：`java-order`、`java-ticket`、`java-payment`
- 未接入：`java-user`、`java-notification`、`java-gateway`
- 必须存在 `undo_log` 的库：`omni_order`、`omni_ticket_split`、`omni_payment`

验证依据：`docs/operations/seata-local-verification.md`。

## 微服务边界

| 服务 | 拥有数据 | 不能做的事 |
|:---|:---|:---|
| `java-user` | 用户、用户资产、主办方申请、客服、RBAC | 不直接写票务、订单、支付表 |
| `java-ticket` | 活动、巡演、站点、场次、票档、SeatCraft、场馆、艺人、风险、评价、问答 | 不直接写订单/支付表 |
| `java-order` | 订单、订单座位、订单快照、电子票、订单状态 | 不直接查 user/ticket 表 |
| `java-payment` | 支付记录、退款申请、支付宝交互状态 | 不直接查 order/user/ticket 表 |
| `java-notification` | 通知消息 | 不拥有 user/order 数据 |
| `grab-service` | 抢票请求、候补队列、Redis 抢票状态 | 不直接写 ticket/order/user DB |
| `java-gateway` | 路由、鉴权转发、限流入口 | 不拥有业务数据库 |

硬约束：

- 禁止新增跨服务 Mapper、Entity、XML mapper 或 SQL join。
- 所有新增 internal API 必须校验 `X-Internal-Token`。
- MyBatis-Plus 查询优先使用 `LambdaQueryWrapper`。
- `OrderService.createOrder()` 写 order-owned `order_snapshot`。
- `ActivityService.listActivities()` 已批量查询优化，避免恢复 N+1 查询。

## 前端约定

- 使用 `src/lib/api.ts` 的 `request<T>()` 统一请求封装。
- 认证状态在 `src/lib/auth.ts` 管理，token key 为 `damai_token`，user key 为 `damai_user`。
- 登录、订单、支付和抢票页不允许 mock/offline 降级。
- B 端 `console/*` 页面使用 `ConsoleLayout`。
- 用户可见文案必须是中文。
- 品牌色：`#ff1268`。
- Node 要求 `>=24`。

常用检查：

```powershell
cd frontend
pnpm typecheck
pnpm lint
node --test src/lib/*.test.ts
```

如果全量 `pnpm lint` 失败，先确认是否由当前改动引入；不要顺手重构无关页面。

## 验收命令

边界检查：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
```

单项检查：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-service-boundaries.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-cross-owner-fks.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-local-schema-profiles.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-local-schema-sql.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1
```

生产拆库 runtime verifier：

```powershell
$env:PGPASSWORD='123456'
powershell -ExecutionPolicy Bypass -File scripts/verify-production-split-runtime.ps1 -UserHost localhost -TicketHost localhost -OrderHost localhost -PaymentHost localhost -NotificationHost localhost -TargetDatabaseByService 'ticket=omni_ticket_split'
```

当前数据库连接检查：

```powershell
$env:PGPASSWORD='123456'
psql -h localhost -p 5432 -U postgres -d postgres -t -A -c "SELECT datname, application_name, state FROM pg_stat_activity WHERE datname LIKE 'omni%' ORDER BY datname, application_name, state;"
```

正常情况下不应出现业务 JDBC 连接到 `omni_ticket`。

## 生产物理拆库资产

- 设计：`docs/operations/2026-05-20-production-physical-db-split-design.md`
- 实施：`docs/operations/2026-05-20-production-physical-db-split-implementation.md`
- Cutover checklist：`docs/operations/production-db-split-cutover-checklist.md`
- Manifest：`sql/production-split/manifest.json`
- 导出脚本：`scripts/export-production-split.ps1`
- 导入脚本：`scripts/import-production-split.ps1`
- Runtime verifier：`scripts/verify-production-split-runtime.ps1`
- 生产环境变量：`docs/production-readiness/production-env-vars.md`

真实 staging / production cutover 必须先完成 Production Migration Safety Gate、cutover checklist 和人工批准。不得把 `sql/local/*` 当作生产迁移 SQL。

## 常见问题

| 问题 | 原因 | 处理 |
|:---|:---|:---|
| 服务又连到 `omni_ticket` | 误启默认 profile 或旧 IDE 启动配置 | 改用 `prod-split`，显式注入 datasource，ticket 库应为 `omni_ticket_split` |
| `-UseDockerInfra` 后 RabbitMQ 不通 | `start-infra.ps1` 当前只启动 Redis、Nacos | 执行 `docker compose up -d rabbitmq` |
| Druid 报 `url: ${SPRING_DATASOURCE_URL}` | 环境变量或启动参数未注入 | 用 `start-project.ps1`，或手动传 `--spring.datasource.url=jdbc:postgresql://localhost:5432/<db>` |
| internal 接口 403 | token 参数名错误或服务间 token 不一致 | 使用 `--internal.api.token=omni-local-internal-token` 或 `INTERNAL_API_TOKEN` |
| 抢票返回 401 / “JWT 未配置” | `grab-service` 缺少 `JWT_SECRET` 或前端未带 token | 使用 `start-project.ps1` 默认值，或手动设置 `JWT_SECRET` 并重新登录 |
| 后台订单 401 | 后端从 `Authorization` 解析操作者，token 缺失或过期 | 重新登录，确认前端代理转发 `authorization` |
| Gateway 503 | 后端未注册到 Nacos 或服务未启动 | 检查 Nacos、服务端口、启动 profile |
| Seata 注册失败 | Seata TC 未启动、Nacos 配置缺失或 advertise host 不可达 | 运行 `scripts\start-seata-docker.ps1` 后重启 ticket/order/payment |
| 下单失败 | 用户不存在、票档/库存无效、座位 hold 异常或 internal API 不通 | 使用测试账号，检查 user/ticket/order/grab 服务 |
| 支付同步仍待支付 | 沙盒交易未真正支付、回调未触发或 payment/order/ticket 链路异常 | 检查 `/api/payment/alipay/sync/{orderId}` 和服务日志 |
| 座位长期“生成中” | 场次 SeatCraft 未发布/未生成，或支付后确认售出未落到 `session_seat` | 检查场次 SeatCraft 版本、票档绑定、`session_seat`、`order_seat` 和 Seata 日志 |
| 修改 common 后 `NoSuchMethodError` | `java-common` 未重新安装或服务未重启 | `mvn install -pl java-common -am` 后重启相关服务 |

## 清理边界

源码交付面不保留以下内容：

- `.playwright-mcp/`、`.superpowers/`、`.codex-logs/`
- `task_plan.md`、`progress.md`、`findings.md`
- `docs/superpowers/` 和已完成的 `*-implementation-plan.md`
- `outputs/`、`unit-test/`、`vue-archive/`
- `runtime/` 下的上传文件、日志、预览图、pids、service-env
- `seata-dependency-baseline.txt`
- 本地数据库 dump、备份文件、演示构建产物

需要保留的长期文档应沉淀为 `docs/microservices/`、`docs/operations/` 或 `docs/production-readiness/` 下的 runbook / checklist / audit，而不是根目录流水记录。

## 操作纪律

- 后端代码修改后必须重新编译并重启对应服务才会生效。
- 修改 `java-common` 后先 `mvn install -pl java-common -am`，再重启依赖服务。
- 边界相关改动后必须运行 `scripts/verify-microservice-boundaries.ps1`。
- 修改 Sentinel 资源名、规则或 Seata 全局事务入口时，必须同步单元测试和本文。
- 涉及订单、票务、支付跨服务写链路时，不得绕过 Seata 全局事务或删除 `undo_log` 表。
- 支付宝、Redis、通知等外部副作用必须设计补偿，不要假设 Seata 能回滚外部系统。
- 不要把默认 `application.yml` 改成 local-schema 或生产拆库专用配置。
- 新增 B 端权限接口时，优先从 JWT/Authorization 解析当前用户。
