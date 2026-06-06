# Codex 项目规则

## 协作规则
-任务完成合并主分支 不要进行任何提交和推送
- 默认使用中文回答；命令、代码、日志、异常类名和接口路径保持原文。
- 回答要简洁直接，避免不必要的铺垫和冗余解释。
- 用户可见的提示、警告、错误、注解、按钮反馈和状态说明必须使用中文；不要新增英文文案。代码标识、枚举值、接口字段和日志中的技术名词可保持原文。
- 涉及下载依赖、拉 Docker 镜像、安装包或大规模联网操作时，不要直接执行；先说明需要下载什么，让用户自行下载或明确授权。
- 提效工具可按需下载和安装；需要额外工具、下载量较大或可能影响本机环境时，先说明用途、来源、影响和推荐命令，也可以直接向用户说明工具需求或实现想法。
- 需要下载时优先提示使用镜像源，并给出可复制命令；例如 npm/pnpm 可使用 `https://registry.npmmirror.com`，Maven 可检查本机 `settings.xml` 镜像，Docker 可使用当前 Docker Desktop 配置的 registry mirror。
- 不要因为依赖下载失败就擅自改 lockfile、删除 `node_modules`、清空 Maven 本地仓库或重置 Docker volume。
- 能用本地已有依赖完成的检查可以直接运行；如果命令可能触发大量依赖下载，先提醒用户。
- 回答排障问题时先给直接结论和下一步命令，再解释原因；不要只给泛泛建议。
- 如果任务描述不清晰，先提问确认，再开始执行。
- 修改代码或文档时保持最小改动；也可以做对目标必要且完整的改动。不做无关重构，不回滚用户已有改动。
# Omni 万象抢票平台

> 全量文件索引见 [`PROJECT_INDEX.md`](./PROJECT_INDEX.md)。本文是给 AI/开发者使用的当前运行手册，以本机 `prod-split` 五库联调状态为准。

## 当前状态

- 项目是类大麦网票务平台，采用 **B 端主导、C 端参与** 模式。
- B 端包含 admin 平台管理员和 organizer 主办方；C 端包含普通用户浏览、购票、订单查看。
- 评价系统已重新纳入 C 端活动详情、购后观演反馈和购前问答范围；允许维护活动评价、评价审核、评价举报和活动问答能力。
- 动态系统仍然禁止恢复；不要恢复 `MomentSection`、`SocialController`、moment API 或旧 social/moment 持久化代码。新增评价能力应围绕 activity review / activity question 命名，不要混用旧社交动态边界。
- 本机当前默认运行方式是 `prod-split`：五个业务服务分别连接五个 PostgreSQL database。
- `omni_ticket` 现在只作为历史共享库、迁移源或 local-schema disposable 实验库，不再作为当前业务运行库。

## 技术栈

| 层级 | 技术 |
|:---|:---|
| 后端 | Java Spring Cloud Alibaba 微服务 |
| 网关 | Spring Cloud Gateway + Netty |
| 数据库 | PostgreSQL |
| ORM | MyBatis-Plus 3.5.3.1 |
| 注册中心 | Nacos 2.4.3 |
| 前端 | Next.js 16 + React 19 |
| 构建 | Maven / pnpm |

## 目录速览

```text
Omni/
├── java/                          # Java 微服务
│   ├── java-gateway/              # 网关 :8088，不拥有业务数据库
│   ├── java-user/                 # 用户服务 :8081
│   ├── java-ticket/               # 票务服务 :8082
│   ├── java-order/                # 订单服务 :8083
│   ├── java-payment/              # 支付服务 :8084
│   ├── java-notification/         # 通知服务 :8085
│   └── java-common/               # 公共模块
├── frontend/                      # Next.js 前端 :3000
├── nestjs/grab-service/           # 抢票核心预留 :3001
├── sql/
│   ├── init.sql                   # 历史共享库初始化
│   ├── seed.sql                   # 种子数据
│   ├── local/                     # 仅本地 disposable DB 使用
│   ├── migrations/shared/         # 历史共享库增量 SQL 归档
│   └── production-split/          # 生产物理拆库迁移资产
├── scripts/                       # 边界检查、拆库导入导出、runtime verifier
└── docs/                          # 设计、边界、运维文档
```

## 数据库拓扑

### 当前本机运行库

| 服务 | 数据库 |
|:---|:---|
| `java-user` | `omni_user` |
| `java-ticket` | `omni_ticket_split` |
| `java-order` | `omni_order` |
| `java-payment` | `omni_payment` |
| `java-notification` | `omni_notification` |
| `java-gateway` | 不连接业务数据库 |

### 连接信息

- PostgreSQL 主机：`localhost`
- 端口：`5432`
- 用户：`postgres`
- 密码：`123456`
- 表名无前缀；保留字表名需要双引号，例如 `"user"`、`"order"`。
- `user.role` 取值：`user`、`organizer`、`admin`。
- 下单用户必须真实存在于 `omni_user."user"`，否则 user internal API 校验会失败。

### `omni_ticket` 使用边界

- 默认 `application.yml` 仍保留历史共享库配置，用于兼容旧阶段说明，不代表当前推荐运行方式。
- 当前本机联调必须使用 `prod-split` 或等价 datasource 覆盖，禁止误启默认 profile 后连回 `omni_ticket`。
- `local-schema` 只允许用于本地 disposable DB；`sql/local/*` 禁止进入 staging / production 迁移链路。

### 本机 Docker 基础设施边界

- 本机 Docker Compose 不再启动 PostgreSQL 容器；PostgreSQL 固定使用宿主机 `localhost:5432`。
- `docker-compose.yml` 只保留 Nacos、Seata、Redis、RabbitMQ、frontend、grab-service 等容器依赖，禁止恢复 `postgres` / `omni-postgres` 服务作为本机默认运行库。
- Seata 使用 `scripts/start-seata-docker.ps1` 启动/刷新，脚本会自动探测当前宿主机非回环 IPv4，并同步更新 Nacos 配置中心与 Seata 服务注册表。
- 网络环境变化后，先运行 `powershell -ExecutionPolicy Bypass -File scripts\start-seata-docker.ps1`，再重启 IDEA 中的 `java-ticket`、`java-order`、`java-payment`。

## 启动方式

### 推荐本机启动

```powershell
powershell -ExecutionPolicy Bypass -File start-project.ps1
```

脚本默认行为：
- 检查本机 PostgreSQL，并启动/检查 Nacos。
- 以 `prod-split` profile 启动五个业务服务。
- 为五个业务服务注入当前本机五库 datasource。
- 启动前端开发服务。

### 历史共享库模式

仅需要回到旧共享库模式时使用：

```powershell
powershell -ExecutionPolicy Bypass -File start-project.ps1 -UseSharedDatabase
```

### 手动启动命令

五个业务服务统一使用 `prod-split`，不要混用 profile。示例：

```powershell
cd java/java-user
mvn spring-boot:run -Dspring-boot.run.profiles=prod-split -Dspring-boot.run.arguments="--spring.datasource.url=jdbc:postgresql://localhost:5432/omni_user --spring.datasource.username=postgres --spring.datasource.password=123456 --internal.api.token=omni-local-internal-token"
```

前端：

```powershell
cd frontend
pnpm dev
```

Nacos：

```powershell
C:\nacos\bin\startup.cmd -m standalone
```

## 服务端口

| 服务 | 端口 | 说明 |
|:---|:---|:---|
| Nacos | 8848 | 注册中心 / 配置中心 |
| java-gateway | 8088 | API 网关 |
| java-user | 8081 | 用户服务 |
| java-ticket | 8082 | 票务服务 |
| java-order | 8083 | 订单服务 |
| java-payment | 8084 | 支付服务 |
| java-notification | 8085 | 通知服务 |
| frontend | 3000 | Next.js 前端 |
| grab-service | 3001 | NestJS 抢票核心预留 |

## 测试账号

| 手机号 | 密码 | 角色 | userId |
|:---|:---|:---|:---|
| `13800000001` | `123456` | admin | `2002` |
| `13800000002` | `123456` | organizer | `2003` |
| `13900000001` | `123456` | user | `2004` |

登录请求字段使用 `account`，不要使用旧字段 `phone`：

```powershell
curl.exe --% -s -m 10 -X POST http://localhost:8088/api/user/login -H "Content-Type: application/json" -d "{\"loginType\":\"password\",\"account\":\"13900000001\",\"password\":\"123456\"}"
```

PowerShell 下调用 `curl.exe` 传 JSON 时优先使用 `--%`，避免引号转义导致假 500。

## 业务流程

### C 端购票

```text
登录 -> 浏览/搜索活动 -> 活动详情
-> 选择场次和票档/座位 -> 创建订单
-> 支付宝沙盒 QR 或 page pay
-> 支付同步/回调 -> java-order 标记订单已支付
-> 查看订单
```

关键接口：
- 登录：`POST /api/user/login`
- 活动列表：`GET /api/ticket/activities`
- 活动详情：`GET /api/ticket/activities/{id}`
- 创建订单：`POST /api/order/create` 或 `POST /api/order/create-with-seats`
- 支付二维码：`POST /api/payment/alipay/qr-pay`
- 支付同步：`GET /api/payment/alipay/sync/{orderId}`
- 订单列表：`GET /api/order/user/{userId}`

### 订单状态

| 状态值 | 后端常量 | 前端含义 |
|:---|:---|:---|
| `1` | `STATUS_PENDING` | 待支付 |
| `2` | `STATUS_PAID` | 已支付 |
| `3` | `STATUS_CANCELLED` | 已取消 |
| `4` | `STATUS_REFUNDED` | 已退款 |

前端订单页已按 `STATUS_PENDING=1` 对齐，不要改回 0。

## 微服务边界

### 硬约束

- 禁止新增跨服务 Mapper、Entity、XML mapper 或 SQL join。
- `java-order` 不直接访问 user/ticket 表；通过 `java-user` 和 `java-ticket` internal API 完成用户校验、报价、库存锁定、座位锁定、确认售出和释放。
- `java-payment` 不直接访问 order/user/ticket 表；通过 `java-order` 获取/更新订单，通过 `java-user` 和 `java-ticket` 做退款审核校验。
- `java-notification` 的 `userId`、`orderId` 是 copied id，不拥有 user/order 数据，不直接查 user/order 表。
- 所有新增 internal API 必须校验 `X-Internal-Token`。
- internal token 配置名是 `internal.api.token` 或环境变量 `INTERNAL_API_TOKEN`。

### 重要代码约定

- 统一响应：`Result<T>`，成功 `code=200`。
- JWT 包含 `userId`、`phone`、`role`。
- MyBatis-Plus 查询优先使用 `LambdaQueryWrapper`。
- `OrderService.createOrder()` 会写 order-owned `order_snapshot`，订单列表/详情展示不再跨查 ticket 表。
- `ActivityService.listActivities()` 已批量查询优化，避免恢复 N+1 查询。

## 验收命令

### 一键边界验收

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
```

### 单项检查

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-service-boundaries.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-cross-owner-fks.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-local-schema-profiles.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-local-schema-sql.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1
```

### `prod-split` runtime verifier

本机 ticket 数据库使用 `omni_ticket_split`，运行 verifier 时必须覆盖 ticket 目标库：

```powershell
$env:PGPASSWORD='123456'
powershell -ExecutionPolicy Bypass -File scripts/verify-production-split-runtime.ps1 -UserHost localhost -TicketHost localhost -OrderHost localhost -PaymentHost localhost -NotificationHost localhost -TargetDatabaseByService 'ticket=omni_ticket_split'
```

### 前端检查

```powershell
cd frontend
pnpm typecheck
```

### 当前数据库连接检查

```powershell
$env:PGPASSWORD='123456'
psql -h localhost -p 5432 -U postgres -d postgres -t -A -c "SELECT datname, application_name, state FROM pg_stat_activity WHERE datname LIKE 'omni%' ORDER BY datname, application_name, state;"
```

正常情况下不应出现业务 JDBC 连接到 `omni_ticket`。

## 生产物理拆库资产

- 已批准设计：`docs/operations/2026-05-20-production-physical-db-split-design.md`
- 实施计划：`docs/operations/2026-05-20-production-physical-db-split-implementation.md`
- Cutover checklist：`docs/operations/production-db-split-cutover-checklist.md`
- Manifest：`sql/production-split/manifest.json`
- 导出脚本：`scripts/export-production-split.ps1`
- 导入脚本：`scripts/import-production-split.ps1`
- Runtime verifier：`scripts/verify-production-split-runtime.ps1`

真实 staging / production cutover 仍必须先完成 Production Migration Safety Gate、cutover checklist 和人工批准。不得把 `sql/local/*` 当作生产迁移 SQL。

## 前端约定

- 使用 `src/lib/api.ts` 的 `request<T>()` 统一请求封装。
- 认证状态在 `src/lib/auth.ts` 管理，token 和 user 存 localStorage。
- 登录、订单页都不允许 mock/offline 降级；后端不可用时直接显示失败。
- B 端 `console/*` 页面使用 ConsoleLayout 侧边栏布局。
- 品牌色：`#ff1268`。
- 当前 API 超时在 `api.ts` 中配置为 800ms。

## 常见问题

| 问题 | 原因 | 处理 |
|:---|:---|:---|
| 服务又连到 `omni_ticket` | 误启默认 profile 或旧 IDE 启动配置 | 改用 `prod-split`，显式注入五库 datasource |
| 服务误连旧 Docker 数据库 | 恢复了 `postgres`/`omni-postgres` 容器或旧 Docker datasource | 删除 Docker PostgreSQL 路径，统一使用宿主机 `localhost:5432` 五库 |
| Seata RM 注册失败并连接旧 IP | Nacos 中 Seata 注册表或 `service.default.grouplist` 残留旧 `SEATA_ADVERTISE_HOST` | 运行 `scripts\start-seata-docker.ps1` 刷新 Nacos 后重启 IDEA 中的 ticket/order/payment |
| internal 接口 403 | token 参数名错误或服务间 token 不一致 | 使用 `--internal.api.token=omni-local-internal-token` 或 `INTERNAL_API_TOKEN` |
| PowerShell curl 登录 500 | JSON 引号被 PowerShell 改写 | 使用 `curl.exe --%` |
| Gateway 503 | 后端未注册到 Nacos 或服务未启动 | 检查 Nacos、服务端口和启动 profile |
| 下单失败 | 用户不存在、票档/库存无效或 internal API 不通 | 使用测试账号，检查 user/ticket/order 服务 |
| 支付同步仍待支付 | 沙盒交易未真正支付或回调未触发 | 检查 `/api/payment/alipay/sync/{orderId}` 和 payment/order 服务 |
| 修改 common 后 NoSuchMethodError | `java-common` 未重新安装或服务未重启 | `mvn install -pl java-common -am` 后重启相关服务 |

## 操作纪律

- 后端代码修改后必须重新编译并重启对应服务才会生效。
- 进行边界相关改动后必须运行 `scripts/verify-microservice-boundaries.ps1`。
- 不要提交本地备份、数据库 dump、运行 artifact 或 `backups/`。
- 评价系统当前允许作为活动详情、购后反馈和购前问答能力迭代；不要恢复动态系统、`SocialController`、`MomentSection`、moment API 或旧 social/moment 持久化代码。
- 不要把默认 `application.yml` 改成 local-schema 或生产拆库专用配置；当前推荐运行入口是 `prod-split` profile 和 `start-project.ps1`。
