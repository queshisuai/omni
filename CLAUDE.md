# Omni 万象抢票平台

> 全量文件索引可参考 [`PROJECT_INDEX.md`](./PROJECT_INDEX.md)，但该索引存在部分历史描述。本文是给 AI/开发者使用的当前运行手册，以本机 `prod-split` 联调、物理拆库、Sentinel、Seata 和 Next.js 前端代理现状为准。

## 当前状态

- 项目是类大麦网票务平台，采用 **B 端主导、C 端参与** 模式。
- B 端包含 admin 平台管理员和 organizer 主办方；C 端包含普通用户浏览、购票、订单、退款和通知。
- 评价系统和动态系统已经移除；不要恢复 `ReviewSection`、`MomentSection`、`SocialController`、review/moment API 或相关持久化代码。
- 当前推荐运行方式是 `prod-split`：Java 业务服务按服务拆分 PostgreSQL database，抢票服务独立使用 `omni_grab`，网关不连接业务数据库。
- `omni_ticket` 只作为历史共享库、迁移源或 local-schema disposable 实验库，不再作为当前业务运行库；当前票务库必须是 `omni_ticket_split`。
- 分布式保护 Sentinel 已完成：网关、用户、票务、订单、支付核心链路已接入限流、熔断或降级保护。
- 分布式事务 Seata 已完成：订单、票务、支付核心写链路已接入全局事务，事务组为 `omni_tx_group`。
- SeatCraft Designer 已进入当前业务主链路：支持场馆默认布局、活动/场次/站点草稿、版本发布/回滚、票档区域绑定、场次座位生成和下单占座。
- 后台订单页当前要求：状态筛选 `全部 / 已支付 / 已退款 / 已取消`，显示数量；分页支持输入页码跳转；平台管理员查看全部活动订单，主办方仅查看自己活动订单。该权限规则由后端从 `Authorization` JWT 解析当前用户，不能信任前端传入的 `userId`。

## 协作规则

- 默认使用中文回答；命令、代码、日志、异常类名和接口路径保持原文。
- 涉及下载依赖、拉 Docker 镜像、安装包或大规模联网操作时，不要直接执行；先说明需要下载什么，让用户自行下载或明确授权。
- 知识图、代码导航或类似提效工具可按需下载和安装；需要额外工具、下载量较大或可能影响本机环境时，先说明用途、来源、影响和推荐命令，也可以直接向用户说明工具需求或实现想法。
- 如果任务需要沉淀新的工具流程、skills 或 agent 能力，可以优先放入全局 skills，便于跨项目复用；落地前说明用途、触发场景和维护位置。
- 需要下载时优先提示使用镜像源，并给出可复制命令；例如 npm/pnpm 可使用 `https://registry.npmmirror.com`，Maven 可检查本机 `settings.xml` 镜像，Docker 可使用当前 Docker Desktop 配置的 registry mirror。
- 不要因为依赖下载失败就擅自改 lockfile、删除 `node_modules`、清空 Maven 本地仓库或重置 Docker volume。
- 能用本地已有依赖完成的检查可以直接运行；如果命令可能触发大量依赖下载，先提醒用户。
- 回答排障问题时先给直接结论和下一步命令，再解释原因；不要只给泛泛建议。
- 修改代码或文档时保持最小改动，不做无关重构，不回滚用户已有改动。

## 技术栈

| 层级 | 技术 |
|:---|:---|
| Java 后端 | Spring Boot 2.7.18 + Spring Cloud 2021.0.8 + Spring Cloud Alibaba 2021.0.5.0 |
| 网关 | Spring Cloud Gateway + Netty |
| 数据库 | PostgreSQL 17 |
| 缓存/抢票状态 | Redis 7 |
| ORM | MyBatis-Plus 3.5.3.1 |
| 连接池 | Druid 1.2.18 |
| 注册/配置中心 | Nacos 2.4.3 |
| 分布式保护 | Sentinel |
| 分布式事务 | Seata 1.6.1 |
| Java 鉴权 | JJWT 0.11.5 |
| 前端 | Next.js 16.2.1 + React 19.2.4 + TypeScript |
| 抢票服务 | NestJS + Redis Lua + PostgreSQL |
| 构建 | Maven / pnpm / npm |

## 目录速览

```text
Omni/
├── java/                          # Java 微服务父工程
│   ├── java-common/               # Result、异常、JWT、MyBatis 配置等公共模块
│   ├── java-gateway/              # 网关 :8088，不拥有业务数据库
│   ├── java-user/                 # 用户服务 :8081
│   ├── java-ticket/               # 票务服务 :8082
│   ├── java-order/                # 订单服务 :8083
│   ├── java-payment/              # 支付服务 :8084
│   └── java-notification/         # 通知服务 :8085
├── frontend/                      # Next.js 前端 :3000
├── nestjs/grab-service/           # 抢票入口服务 :3001
├── docker/seata/                  # Seata Server 配置和 Nacos 配置导入脚本
├── sql/
│   ├── docker-init/               # Docker PostgreSQL 初始化脚本
│   ├── local/                     # 仅本地 disposable DB 使用
│   ├── migrations/shared/         # 历史共享库增量 SQL 归档
│   └── production-split/          # 生产物理拆库迁移资产
├── scripts/                       # 启动、边界检查、拆库导入导出、runtime verifier
├── docs/                          # 设计、边界、运维文档
├── runtime/uploads/               # 本地公开上传文件
└── start-project.ps1              # 当前推荐一键启动脚本
```

## 运行形态

### 数据库拓扑

| 服务 | 当前数据库 |
|:---|:---|
| `java-user` | `omni_user` |
| `java-ticket` | `omni_ticket_split` |
| `java-order` | `omni_order` |
| `java-payment` | `omni_payment` |
| `java-notification` | `omni_notification` |
| `grab-service` | `omni_grab` |
| `java-gateway` | 不连接业务数据库 |

连接默认值：

- PostgreSQL：`localhost:5432`
- 用户：`postgres`
- 密码：`123456`
- 表名无前缀；保留字表名需要双引号，例如 `"user"`、`"order"`。
- `user.role` 取值：`user`、`organizer`、`admin`。
- 下单用户必须真实存在于 `omni_user."user"`，否则 user internal API 校验会失败。

### 端口

| 服务 | 端口 | 说明 |
|:---|:---|:---|
| frontend | 3000 | Next.js 前端 |
| grab-service | 3001 | NestJS 抢票入口服务 |
| PostgreSQL | 5432 | 本地或 Docker 数据库 |
| Redis | 6379 | 抢票库存、幂等、座位 hold |
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
| Sentinel Dashboard | 8858 | 可选，本项目不强制自带 |

## 启动方式

### 推荐本机启动

```powershell
powershell -ExecutionPolicy Bypass -File start-project.ps1
```

`start-project.ps1` 默认行为：

- 检查 Java、Maven、Node、pnpm/npm。
- 如果未配置，写入本地默认 `JWT_SECRET=omni-local-jwt-secret-must-be-at-least-32-bytes`。
- 如果未配置，写入本地默认 `INTERNAL_API_TOKEN=omni-local-internal-token`。
- 启动/检查 PostgreSQL 与 Nacos。
- 以 `prod-split` profile 启动五个有数据库的 Java 业务服务，`java-gateway` 使用默认 profile。
- 为 Java 业务服务注入当前本机 datasource、`internal.api.token`、`jwt.secret`、Nacos 注册 IP 和 `runtime/uploads` 上传目录。
- 启动 `nestjs/grab-service`，并注入 `omni_grab`、Redis、JWT 和 internal token。
- 启动 `frontend` 开发服务。

Docker 中间件模式：

```powershell
powershell -ExecutionPolicy Bypass -File start-project.ps1 -UseDockerInfra
```

基础设施单独启动：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-infra.ps1
```

注意：`scripts/start-infra.ps1` 只启动 Docker PostgreSQL、Redis、Nacos，不会启动 Seata。需要 Seata 时按下面命令单独启动。

### Seata 本地启动

宿主机 Java 服务要能连到 Seata 注册到 Nacos 的地址，因此 `SEATA_ADVERTISE_HOST` 必须是宿主机可达的非回环 IPv4，不能用 `127.0.0.1`、`localhost`、`0.0.0.0` 或 `::1`。

```powershell
$env:SEATA_ADVERTISE_HOST='<宿主机可达的非回环IPv4>'
$env:SEATA_ADVERTISE_PORT='8091'
docker compose up -d postgres redis nacos seata-config-init seata-server
```

`seata-config-init` 会把 `docker/seata/seataServer.properties` 发布到 Nacos 的 `SEATA_GROUP / seataServer.properties`。它成功退出后可以删除容器本身；不要删除 Nacos/PostgreSQL/Redis 的数据卷。

### 历史共享库模式

仅需要回到旧共享库模式时使用：

```powershell
powershell -ExecutionPolicy Bypass -File start-project.ps1 -UseSharedDatabase
```

除迁移或对照验证外，不要用该模式开发当前业务。

### 手动启动示例

Java 业务服务统一使用 `prod-split`，不要混用 profile。示例：

```powershell
cd java/java-user
mvn spring-boot:run -Dspring-boot.run.profiles=prod-split -Dspring-boot.run.arguments="--spring.datasource.url=jdbc:postgresql://localhost:5432/omni_user --spring.datasource.username=postgres --spring.datasource.password=123456 --internal.api.token=omni-local-internal-token --jwt.secret=omni-local-jwt-secret-must-be-at-least-32-bytes"
```

前端：

```powershell
cd frontend
pnpm dev
```

抢票服务：

```powershell
cd nestjs/grab-service
$env:GRAB_SERVICE_PORT='3001'
$env:GRAB_DB_HOST='localhost'
$env:GRAB_DB_NAME='omni_grab'
$env:GRAB_DB_USER='postgres'
$env:GRAB_DB_PASSWORD='123456'
$env:REDIS_HOST='localhost'
$env:REDIS_PORT='6379'
$env:ORDER_SERVICE_URL='http://localhost:8088'
$env:INTERNAL_API_TOKEN='omni-local-internal-token'
$env:JWT_SECRET='omni-local-jwt-secret-must-be-at-least-32-bytes'
npm run start:dev
```

## Docker 资源说明

| 资源 | 作用 | 是否可直接删除 |
|:---|:---|:---|
| `omni-postgres` / `omni-postgres-data` | 所有本地业务库数据 | 不要删，除非明确重置数据库 |
| `omni-redis` / `omni-redis-data` | 抢票库存、幂等和 hold 状态 | 不要在压测/排障中随意删 |
| `omni-nacos` / `omni-nacos-data` / `omni-nacos-logs` | 注册中心和 Seata 配置 | 不要删，删后需重新导入 Seata 配置 |
| `omni-seata` | Seata Server | 可停止/重建，但先确保无事务验证正在运行 |
| `omni-seata-config-init` | 一次性向 Nacos 导入 Seata 配置 | 成功退出后可删除 |
| `omni-grab-service` | Docker 版抢票服务 | 只在容器化运行时需要 |
| `omni-frontend` | Docker 版前端 | 只在容器化运行时需要 |

常用查看命令：

```powershell
docker compose ps
docker logs omni-seata --tail 100
docker logs omni-seata-config-init --tail 100
```

## 测试账号

| 手机号 | 密码 | 角色 | userId |
|:---|:---|:---|:---|
| `13800000001` | `123456` | admin | `2002` |
| `18664150921` | `111111` | admin | `2010` |
| `13800000002` | `123456` | organizer | `2003` |
| `13900000001` | `123456` | user | `2004` |

登录请求字段使用 `account`，不要使用旧字段 `phone`：

```powershell
curl.exe --% -s -m 10 -X POST http://localhost:8088/api/user/login -H "Content-Type: application/json" -d "{\"loginType\":\"password\",\"account\":\"13900000001\",\"password\":\"123456\"}"
```

PowerShell 下调用 `curl.exe` 传 JSON 时优先使用 `--%`，避免引号转义导致假 500。

## API 与鉴权约定

- 统一响应：`Result<T>`，成功 `code=200`。
- 浏览器请求使用 `Authorization: Bearer <token>`。
- JWT 包含 `userId`、`phone`、`role`。
- 新增生产级 B 端接口时，后端应从 `Authorization` 解析当前用户，不能相信前端 query/body 传入的 `userId`。
- 历史接口中仍有部分 admin/tour/session/venue API 使用 `userId` query/body；改造时按接口逐步迁移，不要一次性破坏前端。
- 内部接口使用 `X-Internal-Token`，配置名为 `internal.api.token` 或环境变量 `INTERNAL_API_TOKEN`。
- 前端 `frontend/src/lib/api.ts` 默认 `NEXT_PUBLIC_API_URL=''`，浏览器请求先打到 Next.js `/api/**`。
- Next.js 路由 `frontend/src/app/api/[...path]/route.ts` 和 `frontend/src/app/uploads/[...path]/route.ts` 通过 `server-proxy.ts` 转发到后端。
- 代理目标默认 `http://localhost:8088`，可用 `API_PROXY_TARGET` 覆盖；代理会转发 `authorization`。
- 普通 API 超时为 `5000ms`，支付宝 QR pay 超时为 `15000ms`。

## 业务流程

### C 端购票

```text
登录 -> 浏览/搜索活动 -> 活动详情
-> 选择场次和票档/座位 -> 创建订单或提交抢票请求
-> 支付宝沙盒 QR 或 page pay
-> 支付同步/回调 -> java-order 标记订单已支付
-> ticket 确认售出/占用座位 -> 查看订单
```

关键接口：

- 登录：`POST /api/user/login`
- 活动列表：`GET /api/ticket/activities`
- 分类列表：`GET /api/ticket/categories`
- 活动详情：`GET /api/ticket/activities/{id}`
- 座位图：`GET /api/ticket/sessions/{sessionId}/ticket-types/{ticketTypeId}/seats`
- 创建订单：`POST /api/order/create` 或 `POST /api/order/create-with-seats`
- 抢票请求：`POST /api/grab/requests`
- 支付二维码：`POST /api/payment/alipay/qr-pay`
- 支付同步：`GET /api/payment/alipay/sync/{orderId}`
- 订单列表：`GET /api/order/user/{userId}`

### B 端后台

- 平台管理员可以查看全平台后台订单、审核主办方、审核场馆申请、审核站点配置、处理风险和艺人治理。
- 主办方只能查看和管理自己创建或归属自己的活动、巡演、场次、票档、座位图和订单。
- 后台订单接口是 `GET /api/ticket/admin/orders`，当前已从 JWT 解析操作者；前端 `listConsoleOrders()` 不再传 `userId`。
- 用户侧订单回收站/隐藏只影响 C 端个人列表，不影响 B 端后台订单查看。

### SeatCraft

- `java-ticket` 拥有场馆、区域、座位、SeatCraft 布局、版本、区块、活动、场次、票档和场次座位。
- 座位信息必须来自座位图：至少包含区域/区块、行、列/座号、座位标签、坐标、状态、绑定票档。
- 活动/场次/站点 SeatCraft 支持草稿、发布、版本列表、回滚和删除版本。
- 场次座位生成后，购票占座应更新 `session_seat` 使用状态；订单侧只保存 order-owned `order_seat` 和快照信息。
- 如果订单支付成功但票档已售、SeatCraft 座位占用和订单座位信息未同步，优先判断补偿是否能保证三方一致；无法可靠补偿时应走退款，不要手工只改单表。

### 抢票服务

- 入口：`/api/grab/requests`，由 Gateway 路由到 `grab-service`。
- `grab-service` 使用 `JwtAuthGuard`，缺少 `JWT_SECRET` 会返回或记录“JWT 未配置”。
- Redis Lua 负责库存扣减、用户幂等、用户 hold 和座位 hold。
- 主要 Redis key：
  - `grab:stock:{sessionId}:{ticketTypeId}`
  - `grab:idempotency:{userId}:{idempotencyKey}`
  - `grab:user-hold:{userId}:{sessionId}:{ticketTypeId}`
  - `grab:seat-hold:{seatId}`
- 抢票库存未初始化时应失败关闭，常见错误是“抢票库存未初始化”。
- 抢票成功后通过 Gateway 调用 order internal API，携带 `X-Internal-Token`；订单创建失败或超时必须恢复 Redis 库存和 hold。

### 退款

- 用户申请退款在 `java-payment`，退款审核会通过 `java-order`、`java-ticket` 做订单和票务权限/影响校验。
- 内部状态更新受 Seata 保护；真实支付宝退款、通知、Redis 和外部副作用不由 Seata AT 回滚。
- 外部退款成功但内部落库失败时，继续走补偿/人工处理，不要假设 Seata 能撤销支付宝侧结果。

### 订单状态

| 状态值 | 后端常量 | 前端含义 |
|:---|:---|:---|
| `1` | `STATUS_PENDING` | 待支付 |
| `2` | `STATUS_PAID` | 已支付 |
| `3` | `STATUS_CANCELLED` | 已取消 |
| `4` | `STATUS_REFUNDED` | 已退款 |

前端订单页已按 `STATUS_PENDING=1` 对齐，不要改回 0。

## Sentinel

Sentinel 规则在各服务 `*SentinelConfig` 中初始化，资源名是测试和运行约定的一部分，改名必须同步更新测试。

| 服务 | 保护范围 |
|:---|:---|
| `java-gateway` | `/api/grab/**`、下单、支付关键接口、登录/验证码、票务热点读接口 |
| `java-user` | `user-login-password`、`user-send-code` |
| `java-ticket` | `ticket-sales-lock-stock`、`ticket-sales-lock-seats`、`ticket-sales-confirm-sold`、`ticket-seat-map-read` |
| `java-order` | `order-internal-create`、`order-internal-create-with-seats`、`order-internal-mark-paid`，以及 user/ticket Feign 调用熔断 |
| `java-payment` | `payment-alipay-sync`、`payment-alipay-notify`、`payment-refund-apply`，以及 order client/支付宝渠道熔断 |
| `grab-service` | 由 Gateway `/api/grab/**` 保护；服务内部靠 Redis Lua、幂等和 hold 保证正确性 |

Gateway 限流触发时返回 `429` JSON：

```json
{"code":429,"message":"系统繁忙，请稍后重试","data":null}
```

## Seata

- Seata Server 版本：`1.6.1`
- Nacos group：`SEATA_GROUP`
- Nacos dataId：`seataServer.properties`
- 事务组：`omni_tx_group`
- vgroup 映射：`service.vgroupMapping.omni_tx_group=default`
- 本地 Server store mode：file，仅适合本地联调
- 控制台账号：`seata / seata`

接入范围：

- `java-order`、`java-ticket`、`java-payment` 已接入 `spring-cloud-starter-alibaba-seata`。
- `java-user`、`java-notification`、`java-gateway` 未接入 Seata。
- 全局事务覆盖创建订单、带座创建订单、取消订单、全额/部分退款标记、支付确认等跨服务写流程。
- `omni_order`、`omni_ticket_split`、`omni_payment` 必须存在 Seata AT `undo_log` 表。
- `undo_log` SQL 位于：
  - `sql/production-split/order/20260528_seata_undo_log.sql`
  - `sql/production-split/ticket/20260528_seata_undo_log.sql`
  - `sql/production-split/payment/20260528_seata_undo_log.sql`
  - `sql/docker-init/010-seata-undo-log.sql`
  - `sql/local/20260528_seata_undo_log.sql`

验证依据见 [`docs/operations/seata-local-verification.md`](./docs/operations/seata-local-verification.md)。已有验证包括 TM/RM 注册、`order -> ticket` XID 传播、AT 分支提交/回滚、Spring 依赖漂移检查和边界检查。

不覆盖范围：

- 支付宝真实支付/退款不由 Seata AT 回滚。
- Redis、通知、外部 API 不由 Seata AT 保证。
- 外部副作用成功但内部落库失败时继续走补偿或人工退款。

## 微服务边界

### 服务所有权

| 服务 | 拥有数据 | 不能做的事 |
|:---|:---|:---|
| `java-user` | 用户、头像/用户资产、主办方申请 | 不直接写票务、订单、支付表 |
| `java-ticket` | 活动、巡演、站点、场次、票档、SeatCraft、场馆、艺人、风险、票务资产 | 不直接写订单/支付表 |
| `java-order` | 订单、订单座位、订单快照、订单状态 | 不直接查 user/ticket 表 |
| `java-payment` | 支付记录、退款申请、支付宝交互状态 | 不直接查 order/user/ticket 表 |
| `java-notification` | 通知消息 | 不拥有 user/order 数据 |
| `grab-service` | 抢票请求、Redis 抢票状态 | 不直接写 ticket/order/user DB |
| `java-gateway` | 路由、鉴权转发、限流入口 | 不拥有业务数据库 |

### 硬约束

- 禁止新增跨服务 Mapper、Entity、XML mapper 或 SQL join。
- `java-order` 通过 `java-user` 和 `java-ticket` internal API 完成用户校验、报价、库存锁定、座位锁定、确认售出和释放。
- `java-payment` 通过 `java-order` 获取/更新订单，通过 `java-user` 和 `java-ticket` 做退款审核校验。
- `java-notification` 的 `userId`、`orderId` 是 copied id，不直接查 user/order 表。
- 所有新增 internal API 必须校验 `X-Internal-Token`。
- MyBatis-Plus 查询优先使用 `LambdaQueryWrapper`。
- `OrderService.createOrder()` 会写 order-owned `order_snapshot`，订单列表/详情展示不再跨查 ticket 表。
- `ActivityService.listActivities()` 已批量查询优化，避免恢复 N+1 查询。

## 前端约定

- 使用 `src/lib/api.ts` 的 `request<T>()` 统一请求封装。
- 认证状态在 `src/lib/auth.ts` 管理，token key 为 `damai_token`，user key 为 `damai_user`。
- 登录、订单、支付和抢票页不允许 mock/offline 降级；后端不可用时直接显示失败。
- B 端 `console/*` 页面使用 `ConsoleLayout` 侧边栏布局。
- 通用分页逻辑优先放在 `src/lib/pagination.ts`，订单筛选逻辑优先放在 `src/lib/console-orders.ts`。
- 品牌色：`#ff1268`。
- 前端运行要求 Node `>=24`。
- 常用检查命令：

```powershell
cd frontend
pnpm typecheck
pnpm lint
node --test src/lib/*.test.ts
```

如果全量 `pnpm lint` 失败，先确认是否是当前改动引入。项目里 SeatCraft/活动详情等页面历史上出现过旧 lint 问题，修复时不要顺手重构无关页面；当前任务只需保证相关文件和 `typecheck` 通过。

## 验收命令

### Java 边界检查

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

### 针对性测试

```powershell
cd java
mvn -pl java-ticket -Dtest=AdminControllerTest test
mvn -pl java-order,java-ticket,java-payment -Dtest=OrderSeataCreateOrderTest,OrderSeataCancelRefundTest,PaymentSeataConfirmationTest,TicketSalesInternalSeataTest test
```

涉及 `java-common` 后：

```powershell
cd java
mvn install -pl java-common -am
```

### `prod-split` runtime verifier

本机 ticket 数据库使用 `omni_ticket_split`，运行 verifier 时必须覆盖 ticket 目标库：

```powershell
$env:PGPASSWORD='123456'
powershell -ExecutionPolicy Bypass -File scripts/verify-production-split-runtime.ps1 -UserHost localhost -TicketHost localhost -OrderHost localhost -PaymentHost localhost -NotificationHost localhost -TargetDatabaseByService 'ticket=omni_ticket_split'
```

### 当前数据库连接检查

```powershell
$env:PGPASSWORD='123456'
psql -h localhost -p 5432 -U postgres -d postgres -t -A -c "SELECT datname, application_name, state FROM pg_stat_activity WHERE datname LIKE 'omni%' ORDER BY datname, application_name, state;"
```

正常情况下不应出现业务 JDBC 连接到 `omni_ticket`。

## 生产物理拆库资产

- 已批准设计：`docs/superpowers/specs/2026-05-20-production-physical-db-split-design.md`
- 实施计划：`docs/superpowers/plans/2026-05-20-production-physical-db-split-implementation.md`
- Cutover checklist：`docs/operations/production-db-split-cutover-checklist.md`
- Manifest：`sql/production-split/manifest.json`
- 导出脚本：`scripts/export-production-split.ps1`
- 导入脚本：`scripts/import-production-split.ps1`
- Runtime verifier：`scripts/verify-production-split-runtime.ps1`

真实 staging / production cutover 仍必须先完成 Production Migration Safety Gate、cutover checklist 和人工批准。不得把 `sql/local/*` 当作生产迁移 SQL。

## 常见问题

| 问题 | 原因 | 处理 |
|:---|:---|:---|
| 服务又连到 `omni_ticket` | 误启默认 profile 或旧 IDE 启动配置 | 改用 `prod-split`，显式注入 datasource，ticket 库应为 `omni_ticket_split` |
| Druid 报 `url: ${SPRING_DATASOURCE_URL}` | 环境变量或启动参数未注入，配置占位符原样进入运行时 | 用 `start-project.ps1`，或手动传 `--spring.datasource.url=jdbc:postgresql://localhost:5432/<db>` |
| IntelliJ 启动 `NoClassDefFoundError: SpringApplication` | IDEA Run Configuration classpath/module 不是 Maven 模块运行时 classpath | 重新导入 Maven，选择模块 classpath，或先用 `mvn spring-boot:run` |
| 端口 `8081` 已占用 | user 服务或旧 Java 进程还在运行 | 查找并停止占用进程，或临时换端口验证 |
| internal 接口 403 | token 参数名错误或服务间 token 不一致 | 使用 `--internal.api.token=omni-local-internal-token` 或 `INTERNAL_API_TOKEN` |
| 抢票返回 401 / “JWT 未配置” | `grab-service` 缺少 `JWT_SECRET` 或前端未带 token | 使用 `start-project.ps1` 默认值，或手动设置 `JWT_SECRET` 并重新登录 |
| 后台订单 401 | 后端现在从 `Authorization` 解析操作者，token 缺失或过期 | 重新登录，确认前端代理转发 `authorization` |
| `/api/ticket/categories` 或 `/api/ticket/activities` 500 | ticket 服务未启动、连错库、SQL/数据缺失或代理目标错误 | 检查 `java-ticket` 日志、`omni_ticket_split`、`API_PROXY_TARGET` |
| 上传图片 500 | 后端上传目录或 `/uploads/**` 代理异常 | 检查 `runtime/uploads`、`omni.upload.root`、`frontend/src/app/uploads/[...path]/route.ts` |
| `无法添加文件系统：<illegal path>` | 浏览器 DevTools Workspaces/Overrides 添加了非法路径，通常不是项目或 Docker 错误 | 在 DevTools 里清理 Workspaces/Overrides，或忽略该浏览器提示 |
| Gateway 503 | 后端未注册到 Nacos 或服务未启动 | 检查 Nacos、服务端口、启动 profile |
| Seata 注册失败 | Seata TC 未启动、Nacos 配置缺失或 advertise host 不可达 | 检查 `8091`、`seataServer.properties`、`SEATA_ADVERTISE_HOST` |
| Seata Hessian serializer warning | Hessian 依赖未完整加载，当前使用其他序列化时可能非致命 | 只要 TM/RM 注册成功且事务提交/回滚正常，可先观察 |
| 下单失败 | 用户不存在、票档/库存无效、座位 hold 异常或 internal API 不通 | 使用测试账号，检查 user/ticket/order/grab 服务 |
| 支付同步仍待支付 | 沙盒交易未真正支付、回调未触发或 payment/order/ticket 链路异常 | 检查 `/api/payment/alipay/sync/{orderId}`、payment/order/ticket 日志 |
| 座位长期“生成中” | 场次 SeatCraft 未发布/未生成，或支付后确认售出未落到 `session_seat` | 检查场次 SeatCraft 版本、票档绑定、`session_seat`、`order_seat` 和 Seata 日志 |
| 修改 common 后 `NoSuchMethodError` | `java-common` 未重新安装或服务未重启 | `mvn install -pl java-common -am` 后重启相关服务 |

## 操作纪律

- 后端代码修改后必须重新编译并重启对应服务才会生效。
- 修改 `java-common` 后，先 `mvn install -pl java-common -am`，再重启依赖服务。
- 进行微服务边界相关改动后必须运行 `scripts/verify-microservice-boundaries.ps1`。
- 修改 Sentinel 资源名、规则或 Seata 全局事务入口时，必须同步更新对应单元测试和本文。
- 涉及订单、票务、支付跨服务写链路时，不得绕过 Seata 全局事务或删除 `undo_log` 表。
- Seata 只能保证数据库内部事务边界；支付宝、Redis、通知等外部副作用必须设计补偿。
- 不要提交本地备份、数据库 dump、运行 artifact、`backups/` 或 `runtime/uploads` 里的临时文件。
- 不要恢复已删除的评价/动态系统。
- 不要把默认 `application.yml` 改成 local-schema 或生产拆库专用配置；当前推荐运行入口是 `prod-split` profile 和 `start-project.ps1`。
- 不要把 `omni_ticket` 当作当前运行库；票务服务当前运行库是 `omni_ticket_split`。
- 新增 B 端权限接口时，优先从 JWT/Authorization 解析当前用户，避免“前端传谁就按谁查”。
