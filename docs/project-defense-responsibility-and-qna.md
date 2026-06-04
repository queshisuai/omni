# 项目答辩分工与评审问答

> 说明：下面成员 A-F 是占位名，答辩前请替换为真实姓名。本文按“负责什么、代码在哪里、怎么实现、老师可能怎么问”组织，方便现场分人讲解。

## 1. 总体架构说明

项目是类大麦票务平台，采用前后端分离和微服务架构。

| 层级 | 组件 | 说明 | 主要位置 |
|:---|:---|:---|:---|
| 前端 | Next.js | C 端浏览、购票、订单、通知，B 端活动、场馆、退款、运营后台 | `frontend/src/app/`、`frontend/src/lib/api.ts` |
| 网关 | Spring Cloud Gateway | 统一入口、动态路由、限流保护 | `java/java-gateway/` |
| 用户服务 | java-user | 登录注册、用户资料、角色权限、客服、RBAC | `java/java-user/` |
| 票务服务 | java-ticket | 活动、场次、票档、座位图、库存和锁座 | `java/java-ticket/` |
| 订单服务 | java-order | 创建订单、订单快照、支付状态、电子票、退款订单状态 | `java/java-order/` |
| 支付服务 | java-payment | 支付宝沙箱、支付同步、退款审核与退款状态 | `java/java-payment/` |
| 通知服务 | java-notification | 站内通知、通知汇总、已读/删除状态 | `java/java-notification/` |
| 抢票服务 | NestJS grab-service | 抢票排队、Redis 库存 hold、组队抢票、候补队列 | `nestjs/grab-service/` |
| 公共模块 | java-common | 统一响应、异常、JWT、MQ 常量和队列声明 | `java/java-common/` |

当前服务端口：

| 服务 | 端口 | 职责 |
|:---|:---|:---|
| `java-gateway` | `8088` | API 统一入口 |
| `java-user` | `8081` | 用户与权限 |
| `java-ticket` | `8082` | 活动票务 |
| `java-order` | `8083` | 订单 |
| `java-payment` | `8084` | 支付 |
| `java-notification` | `8085` | 通知 |
| `grab-service` | `3001` | 抢票/候补 |
| `frontend` | `3000` | 前端 |

## 2. 团队分工

| 成员 | 负责方向 | 对应模块 | 核心技术关键词 |
|:---|:---|:---|:---|
| 成员 A | 业务需求、数据库设计、服务边界 | SQL、用户/票务/订单表设计、服务拆分文档 | PostgreSQL、MyBatis-Plus、数据库拆分 |
| 成员 B | 高并发抢票、缓存与 Redis | NestJS 抢票服务、Redis 库存和排队 | Redis、Lua、幂等、队列 |
| 成员 C | 微服务治理与网关 | Gateway、Nacos、OpenFeign、Sentinel | Spring Cloud Alibaba、Gateway、Nacos、Sentinel |
| 成员 D | 订单、支付和分布式事务 | java-order、java-payment、java-ticket 内部库存接口 | Seata、支付宝沙箱、OpenFeign |
| 成员 E | 前端展示与系统演示 | Next.js 前台、后台、搜索、订单、通知页面 | Next.js、React、API 代理 |
| 成员 F | MQ 异步通知、候补联动、ES 检索说明 | RabbitMQ、通知服务、候补 MQ、ES 检索扩展 | RabbitMQ、DLQ、Elasticsearch |

## 3. 成员 A：业务需求、数据库和服务边界

### 负责内容

成员 A 主要负责把票务平台拆成用户、票务、订单、支付、通知、抢票等业务边界，并设计 PostgreSQL 表结构。

### 代码和文档位置

| 内容 | 位置 |
|:---|:---|
| 服务边界说明 | `docs/microservices/service-boundaries.md` |
| 表归属说明 | `docs/microservices/table-ownership.md` |
| 当前数据库脚本 | `sql/production-split/`、`sql/migrations/shared/` |
| Docker 初始化数据库 | `sql/docker-init/` |
| 本地数据库连接说明 | `/opt/pgsql_task.md` |

### 实现说明

数据库按服务拆分，每个服务只拥有自己的业务表。比如：

| 服务 | 拥有数据 |
|:---|:---|
| `java-user` | 用户、观演人、角色权限、客服记录 |
| `java-ticket` | 活动、场次、票档、座位、场馆 |
| `java-order` | 订单、订单座位、订单快照、电子票 |
| `java-payment` | 支付流水、退款申请 |
| `java-notification` | 通知消息 |
| `grab-service` | 抢票请求、候补记录、组队抢票记录 |

服务之间不直接跨库查表，而是通过 internal API 和 OpenFeign 调用。例如订单服务创建订单时，不直接查票务表，而是调用票务服务报价和锁座接口。

## 4. 成员 B：Redis 高并发抢票

### 负责内容

成员 B 负责抢票服务的高并发入口，核心目标是把大量用户请求先放到 Redis 排队和库存 hold 中，避免直接打爆数据库。

### 代码位置

| 内容 | 位置 |
|:---|:---|
| Redis 封装 | `nestjs/grab-service/src/grab/redis.service.ts` |
| 抢票提交入口 | `nestjs/grab-service/src/grab/grab.controller.ts`、`nestjs/grab-service/src/grab/grab.service.ts` |
| Redis 库存扣减和幂等 | `nestjs/grab-service/src/grab/grab-admission.service.ts` |
| Redis 排队队列 | `nestjs/grab-service/src/grab/grab-queue.service.ts` |
| 可见库存展示 | `nestjs/grab-service/src/grab/visible-stock.service.ts` |
| 抢票后台 worker | `nestjs/grab-service/src/grab/grab-worker.service.ts` |

### 实现说明

Redis 主要做三件事：

1. 库存预扣：`grab:stock:{sessionId}:{ticketTypeId}` 保存抢票侧可见库存。
2. 幂等控制：`grab:idempotency:{userId}:{idempotencyKey}` 防止用户重复提交。
3. 排队处理：`grab:queue:{sessionId}` 是待处理队列，`grab:queue:inflight:{sessionId}` 是处理中队列。

关键实现是 `grab-admission.service.ts` 中的 Lua 脚本。Lua 在 Redis 内部原子执行，保证“检查库存、检查用户 hold、检查座位 hold、扣减库存、写入幂等 key”是一个整体，不会出现并发下超卖。

答辩话术：

> 我负责 Redis 抢票层。普通请求不会直接落数据库，而是先进入 Redis 队列和库存 hold。扣库存用 Lua 脚本一次性完成检查和扣减，所以并发情况下不会出现两个请求同时抢到同一份库存。成功后 worker 再调用订单服务创建正式订单，数据库仍然是最终事实源。

## 5. 成员 C：网关、Nacos、Feign 和 Sentinel

### 负责内容

成员 C 负责微服务治理：所有请求先进 Gateway，Gateway 根据路径转发到对应服务；服务之间通过 Nacos 发现和 OpenFeign 调用；热点接口使用 Sentinel 限流保护。

### 代码位置

| 内容 | 位置 |
|:---|:---|
| Gateway 路由 | `java/java-gateway/src/main/resources/application.yml` |
| Gateway Sentinel | `java/java-gateway/src/main/java/com/omni/gateway/config/GatewaySentinelConfig.java` |
| 用户服务 Feign 开启 | `java/java-user/src/main/java/com/omni/user/UserApplication.java` |
| 票务服务 Feign Client | `java/java-ticket/src/main/java/com/omni/ticket/client/` |
| 订单服务 Feign Client | `java/java-order/src/main/java/com/omni/order/client/` |
| 支付服务 Feign Client | `java/java-payment/src/main/java/com/omni/payment/client/` |
| Sentinel 业务配置 | `java/java-user/src/main/java/com/omni/user/config/UserSentinelConfig.java`、`java/java-ticket/src/main/java/com/omni/ticket/config/TicketSentinelConfig.java`、`java/java-order/src/main/java/com/omni/order/config/OrderSentinelConfig.java`、`java/java-payment/src/main/java/com/omni/payment/config/PaymentSentinelConfig.java` |

### 实现说明

Gateway 路由示例：

| 路径 | 转发目标 |
|:---|:---|
| `/api/user/**` | `lb://java-user` |
| `/api/ticket/**` | `lb://java-ticket` |
| `/api/order/**` | `lb://java-order` |
| `/api/payment/**` | `lb://java-payment` |
| `/api/notification/**` | `lb://java-notification` |
| `/api/grab/**`、`/api/waitlist/**` | `http://localhost:3001` |

`lb://` 表示通过 Nacos 注册中心按服务名发现实例。服务间内部接口统一带 `X-Internal-Token`，例如 `java-order` 调 `java-ticket` 的锁座接口，防止外部用户绕过网关直接调用内部接口。

Sentinel 主要保护这些热点：

| 热点 | 保护点 |
|:---|:---|
| 登录和验证码 | `UserSentinelConfig` |
| 抢票、候补、下单、支付回调 | `GatewaySentinelConfig` |
| 票务锁库存、锁座、确认售出 | `TicketSentinelConfig` |
| 订单创建和支付标记 | `OrderSentinelConfig` |
| 支付宝回调、退款申请 | `PaymentSentinelConfig` |

## 6. 成员 D：订单、支付和 Seata 分布式事务

### 负责内容

成员 D 负责核心交易链路：创建订单、锁库存、支付成功、订单状态变更、退款和 Seata 事务一致性。

### 代码位置

| 内容 | 位置 |
|:---|:---|
| 创建订单和订单状态 | `java/java-order/src/main/java/com/omni/order/service/OrderService.java` |
| 订单接口 | `java/java-order/src/main/java/com/omni/order/controller/OrderController.java` |
| 票务内部销售接口 | `java/java-ticket/src/main/java/com/omni/ticket/service/TicketSalesInternalService.java`、`java/java-ticket/src/main/java/com/omni/ticket/controller/TicketSalesInternalController.java` |
| 支付宝服务 | `java/java-payment/src/main/java/com/omni/payment/service/AlipayService.java` |
| 支付确认事务 | `java/java-payment/src/main/java/com/omni/payment/service/PaymentConfirmationService.java` |
| 退款服务 | `java/java-payment/src/main/java/com/omni/payment/service/RefundService.java` |
| Seata 配置 | `docker/seata/application.yml`、`docker/seata/seataServer.properties` |
| Seata undo_log | `sql/docker-init/010-seata-undo-log.sql`、`sql/production-split/*/20260528_seata_undo_log.sql` |

### 实现说明

下单流程：

1. 前端调用 `/api/order/create` 或 `/api/order/create-with-seats`。
2. `OrderService` 先调用 `java-user` 校验用户。
3. 再调用 `java-ticket` 报价、锁库存或锁座。
4. 订单服务写入订单表和订单快照。
5. 支付成功后，`java-payment` 调用 `java-order` 标记已支付。
6. `java-order` 再调用 `java-ticket` 确认售出，并生成电子票。

Seata 通过 `@GlobalTransactional` 保护跨服务写操作。例如：

| 方法 | 事务名 |
|:---|:---|
| `OrderService.createOrder` | `omni-create-order` |
| `OrderService.createOrderWithSeats` | `omni-create-order-with-seats` |
| `OrderService.markRefunded` | `omni-mark-refunded` |
| `PaymentConfirmationService.confirmPayment` | `omni-confirm-payment` |

答辩话术：

> 我负责订单支付链路。这个链路跨订单、票务、支付三个服务，所以核心写操作加了 Seata 的 `@GlobalTransactional`。如果支付确认时订单状态更新成功但支付流水更新失败，Seata 会根据 undo_log 回滚，避免支付和订单状态不一致。

## 7. 成员 E：前端展示和演示联调

### 负责内容

成员 E 负责前端页面、用户交互、后台管理和演示流程。

### 代码位置

| 内容 | 位置 |
|:---|:---|
| 前端 API 封装 | `frontend/src/lib/api.ts` |
| Next.js API 代理 | `frontend/src/app/api/[...path]/route.ts`、`frontend/src/lib/server-proxy.ts` |
| 首页 | `frontend/src/app/page.tsx` |
| 搜索页 | `frontend/src/app/search/page.tsx` |
| 活动详情和购票 | `frontend/src/app/activity/[id]/page.tsx` |
| 订单页 | `frontend/src/app/orders/page.tsx`、`frontend/src/app/orders/[id]/page.tsx` |
| 通知页 | `frontend/src/app/notifications/page.tsx` |
| 管理后台布局 | `frontend/src/app/console/layout.tsx` |
| 活动、场馆、退款、角色等后台页面 | `frontend/src/app/console/` |

### 实现说明

前端通过 `frontend/src/lib/api.ts` 统一封装请求，自动带上 JWT token，并把后端英文错误或通用错误转成中文提示。开发环境中 Next.js 的 `/api/[...path]` 会代理到 Gateway，默认目标是 `http://localhost:8088`，避免前端直接维护多个后端服务地址。

搜索页路径：

1. `frontend/src/app/search/page.tsx` 读取关键词、城市、分类、价格、状态等筛选条件。
2. 调用 `frontend/src/lib/api.ts` 的 `listActivities`。
3. 请求到 `/api/ticket/activities`。
4. Gateway 转发到 `java-ticket`。
5. `ActivityController.listActivities` 调用 `ActivityService.searchActivities` 返回分页结果。

## 8. 成员 F：RabbitMQ、通知、候补和 ES

### 负责内容

成员 F 负责异步消息链路、通知服务、候补联动，以及 Elasticsearch 检索扩展说明。

## 8.1 RabbitMQ 如何实现

### 代码位置

| 内容 | 位置 |
|:---|:---|
| MQ 常量 | `java/java-common/src/main/java/com/omni/common/mq/MqConstants.java` |
| MQ 队列、交换机、绑定 | `java/java-common/src/main/java/com/omni/common/mq/MqConfig.java` |
| 事务提交后发送工具 | `java/java-common/src/main/java/com/omni/common/mq/MqPublishSupport.java` |
| 通知消息体 | `java/java-common/src/main/java/com/omni/common/mq/message/NotificationMessage.java` |
| 候补释放消息体 | `java/java-common/src/main/java/com/omni/common/mq/message/WaitlistReleasedMessage.java` |
| 候补支付消息体 | `java/java-common/src/main/java/com/omni/common/mq/message/WaitlistOrderPaidMessage.java` |
| 票务通知生产者 | `java/java-ticket/src/main/java/com/omni/ticket/mq/NotificationMqProducer.java` |
| 用户通知生产者 | `java/java-user/src/main/java/com/omni/user/mq/NotificationMqProducer.java` |
| 订单候补生产者 | `java/java-order/src/main/java/com/omni/order/mq/WaitlistMqProducer.java` |
| 通知消费者 | `java/java-notification/src/main/java/com/omni/notification/mq/NotificationMessageListener.java` |
| 候补消费者 | `nestjs/grab-service/src/waitlist/waitlist-mq.consumer.ts` |
| 通知落库逻辑 | `java/java-notification/src/main/java/com/omni/notification/service/NotificationService.java` |

### MQ 拓扑

| 业务 | Exchange | Queue | Routing Key |
|:---|:---|:---|:---|
| 通知发送 | `omni.notification` | `notification.send.queue` | `notification.send` |
| 通知重试 | `omni.notification.retry` | `notification.send.retry.queue` | `notification.send.retry` |
| 通知死信 | `omni.notification.dlx` | `notification.send.dlq` | `notification.send.dlq` |
| 候补释放 | `omni.waitlist` | `waitlist.released.queue` | `waitlist.released` |
| 候补支付 | `omni.waitlist` | `waitlist.order-paid.queue` | `waitlist.order-paid` |
| 候补重试 | `omni.waitlist.retry` | `waitlist.*.retry.queue` | `waitlist.*.retry` |
| 候补死信 | `omni.waitlist.dlx` | `waitlist.*.dlq` | `waitlist.*.dlq` |

### 实现说明

RabbitMQ 做异步削峰和业务解耦：

1. 业务服务只负责发送消息，不同步等待通知服务处理。
2. `MqPublishSupport.afterCommitOrNow` 确保数据库事务提交后再发消息，避免事务回滚了但消息已经发出去。
3. 通知服务用 `@RabbitListener` 消费 `notification.send.queue`，把消息转换成站内通知并落库。
4. 消费失败先进入 retry queue，重试队列设置 `x-message-ttl=10000`，10 秒后再回到主队列。
5. 重试超过 3 次进入死信队列，方便排查问题。

候补链路：

1. 订单取消或退款后，`OrderService.publishWaitlistReleaseEvent` 发布 `waitlist.released`。
2. `grab-service` 的 `WaitlistMqConsumer` 消费释放消息。
3. `WaitlistAllocatorService.allocate` 按候补顺序选人。
4. 抢票服务调用订单服务创建候补待支付订单。
5. 再调用通知服务提醒用户支付。
6. 用户支付成功后，订单服务发布 `waitlist.order-paid`，候补服务标记候补记录已支付。

答辩话术：

> 我负责 MQ 异步链路。通知和候补都不适合放在主交易链路里同步执行，所以用 RabbitMQ 解耦。消息拓扑在 `java-common` 统一声明，生产者在业务服务里，消费者分别在通知服务和抢票服务里。失败时通过 TTL 重试队列自动重试，超过 3 次进入死信队列，保证问题可追踪。

## 8.2 Elasticsearch 如何说明

### 当前状态

项目架构图中有 Elasticsearch，定位是“检索扩展层”，适合承载活动全文搜索、艺人搜索、城市/场馆搜索和热门推荐召回。当前仓库中没有看到正式的 ES Java Client 或 Spring Data Elasticsearch 调用，演示版搜索主链路仍然走 `java-ticket` 的数据库查询和内存过滤：

| 搜索链路 | 位置 |
|:---|:---|
| 前端搜索页 | `frontend/src/app/search/page.tsx` |
| 前端请求封装 | `frontend/src/lib/api.ts` 的 `listActivities` |
| 后端搜索入口 | `java/java-ticket/src/main/java/com/omni/ticket/controller/ActivityController.java` |
| 后端过滤逻辑 | `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityService.java` 的 `searchActivities` |
| 本机 ES 运行目录痕迹 | `/opt/omni/apps/elasticsearch` |

答辩建议说法：

> ES 在我们的架构里是检索增强层，用来解决活动名称、艺人、城市、场馆等多字段全文检索问题。当前演示版为了保证主流程稳定，搜索主链路先由票务服务和 PostgreSQL 完成；生产化扩展时，会把活动、场次、场馆、艺人等数据同步到 ES 索引，由 ES 做全文召回和排序，详情仍回源到票务服务。

### 如果老师问：什么是倒排索引

20 秒回答：

> 倒排索引就是从“关键词”反查“文档”的索引。普通正排是文档 ID 到文档内容，比如活动 1 是“周杰伦演唱会”；倒排是把“周杰伦”这个词映射到包含它的活动 ID 列表。用户搜“周杰伦”时，ES 不需要逐条扫描所有活动，只要查关键词对应的文档列表，所以搜索更快。

1 分钟展开：

> 举例说，系统里有三条活动：活动 1 是“周杰伦上海演唱会”，活动 2 是“五月天北京演唱会”，活动 3 是“周杰伦深圳演唱会”。正排索引是 `1 -> 周杰伦上海演唱会`、`2 -> 五月天北京演唱会`。倒排索引会变成 `周杰伦 -> [1,3]`、`演唱会 -> [1,2,3]`、`北京 -> [2]`。所以用户搜索“周杰伦 演唱会”时，ES 可以快速取两个词的 posting list 做交集或相关性打分，再按 BM25、热度、时间等规则排序返回。

### 如果老师问：为什么不用数据库 like

回答：

> 数据库 `like '%关键词%'` 在数据量小的时候可以用，但数据量上来后会比较难利用普通 B-tree 索引，容易变成大量扫描。ES 会先分词并建立倒排索引，适合多字段全文检索、相关性排序、高亮、同义词和拼音扩展。数据库更适合事务和精确查询，ES 更适合搜索。

### 如果老师问：ES 数据怎么和数据库保持一致

回答：

> 数据库仍然是主数据源，ES 是查询索引。活动创建、修改、上下架时，可以通过 MQ 或定时任务把活动数据同步到 ES。同步失败不影响交易主链路，最多影响搜索新鲜度；可以通过补偿任务按更新时间重新构建索引。

## 9. 关键业务流程对应代码

### 用户登录

| 步骤 | 代码 |
|:---|:---|
| 前端登录页 | `frontend/src/app/login/page.tsx`、`frontend/src/components/LoginForm.tsx` |
| API 请求 | `frontend/src/lib/api.ts` 的 `login` |
| 后端入口 | `java/java-user/src/main/java/com/omni/user/controller/UserController.java` |
| 业务逻辑 | `java/java-user/src/main/java/com/omni/user/service/UserService.java` |
| JWT 工具 | `java/java-common/src/main/java/com/omni/common/util/JwtUtil.java` |

### 活动搜索和详情

| 步骤 | 代码 |
|:---|:---|
| 搜索页 | `frontend/src/app/search/page.tsx` |
| 活动列表请求 | `frontend/src/lib/api.ts` 的 `listActivities` |
| 活动列表接口 | `java/java-ticket/src/main/java/com/omni/ticket/controller/ActivityController.java` |
| 搜索过滤 | `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityService.java` |
| 活动详情页 | `frontend/src/app/activity/[id]/page.tsx` |

### 下单和支付

| 步骤 | 代码 |
|:---|:---|
| 活动详情购票 | `frontend/src/app/activity/[id]/page.tsx` |
| 创建订单 | `java/java-order/src/main/java/com/omni/order/service/OrderService.java` |
| 票务报价和锁座 | `java/java-ticket/src/main/java/com/omni/ticket/service/TicketSalesInternalService.java` |
| 支付接口 | `java/java-payment/src/main/java/com/omni/payment/controller/AlipayController.java` |
| 支付宝逻辑 | `java/java-payment/src/main/java/com/omni/payment/service/AlipayService.java` |
| 支付确认事务 | `java/java-payment/src/main/java/com/omni/payment/service/PaymentConfirmationService.java` |

### 通知

| 步骤 | 代码 |
|:---|:---|
| 消息生产 | `java/java-ticket/src/main/java/com/omni/ticket/mq/NotificationMqProducer.java`、`java/java-user/src/main/java/com/omni/user/mq/NotificationMqProducer.java` |
| MQ 消费 | `java/java-notification/src/main/java/com/omni/notification/mq/NotificationMessageListener.java` |
| 通知落库 | `java/java-notification/src/main/java/com/omni/notification/service/NotificationService.java` |
| 前端通知页 | `frontend/src/app/notifications/page.tsx` |

### 候补

| 步骤 | 代码 |
|:---|:---|
| 加入候补 | `frontend/src/app/activity/[id]/page.tsx`、`nestjs/grab-service/src/waitlist/waitlist.controller.ts` |
| 候补记录 | `nestjs/grab-service/src/waitlist/waitlist.repository.ts` |
| 库存释放事件 | `java/java-order/src/main/java/com/omni/order/service/OrderService.java` |
| 候补 MQ 生产者 | `java/java-order/src/main/java/com/omni/order/mq/WaitlistMqProducer.java` |
| 候补 MQ 消费者 | `nestjs/grab-service/src/waitlist/waitlist-mq.consumer.ts` |
| 候补分配 | `nestjs/grab-service/src/waitlist/waitlist-allocator.service.ts` |

## 10. 评审老师可能提问和回答

### Q1：为什么要拆成这么多微服务

答：

> 票务平台的用户、票务、订单、支付、通知职责差异明显。拆分后每个服务只维护自己的数据和业务规则，降低耦合。比如订单服务不直接操作票务表，而是通过票务 internal API 锁库存和确认售出，这样库存规则只在票务服务维护。

### Q2：服务之间怎么调用

答：

> 外部请求统一走 Gateway；服务间通过 OpenFeign 调用。比如订单服务调用 `java-ticket` 的 `TicketSalesInternalClient` 进行报价、锁库存、锁座、确认售出。内部接口都要求 `X-Internal-Token`，避免外部绕过权限直接访问。

### Q3：Redis 为什么能防止超卖

答：

> Redis 层用 Lua 脚本保证库存检查和扣减是原子操作。脚本会一次性检查库存、用户 hold、座位 hold 和幂等 key，成功后才扣减库存。Lua 执行过程中不会被其他命令插入，所以不会出现两个请求同时扣到同一份库存。

### Q4：最终库存以 Redis 为准还是数据库为准

答：

> 数据库是最终事实源，Redis 是高并发入口的缓冲层。Redis 负责快速接收请求、排队、预扣和幂等，真正生成订单和确认售出仍会调用订单服务和票务服务落库。

### Q5：RabbitMQ 在项目里解决什么问题

答：

> RabbitMQ 主要解决异步解耦和削峰。通知、候补递补这类逻辑不应该阻塞下单、退款主链路，所以通过 MQ 异步执行。失败时进入重试队列，超过次数进入死信队列，方便后续排查和补偿。

### Q6：MQ 消息会不会在事务回滚后误发送

答：

> 项目里用 `MqPublishSupport.afterCommitOrNow`。如果当前有 Spring 事务，就注册 `afterCommit` 回调，等数据库事务提交成功后再发送 MQ；如果没有事务，则立即发送。这样可以避免业务回滚但消息已经发出去的问题。

### Q7：如何处理 MQ 消费失败

答：

> 主队列配置了 dead-letter 到 retry exchange，retry queue 设置了 10 秒 TTL，超时后再回主队列重试。消费者会读取 `x-death` 统计重试次数，超过 3 次转发到 DLQ 死信队列。

### Q8：Seata 在哪里用，解决什么问题

答：

> Seata 用在订单、票务、支付这类跨服务写链路上。比如支付确认时，支付服务更新支付流水，同时调用订单服务标记订单已支付，订单服务再确认票务售出。`PaymentConfirmationService.confirmPayment` 和 `OrderService.createOrder` 等方法上有 `@GlobalTransactional`，失败时通过 undo_log 回滚。

### Q9：Nacos 起什么作用

答：

> Nacos 是服务注册和发现中心。每个 Spring 服务启动后注册到 Nacos，Gateway 和 Feign 通过服务名找到目标服务实例，例如 `lb://java-ticket`。这样服务地址变化时不用改调用方代码。

### Q10：Sentinel 起什么作用

答：

> Sentinel 做限流和降级。Gateway 层保护抢票、候补、下单、支付回调等热点路径；服务内部也对登录、锁库存、锁座、支付回调等接口配置资源规则。流量超过阈值时返回友好提示，避免服务被瞬时高并发打垮。

### Q11：为什么图里有 Elasticsearch，代码里搜索还是数据库

答：

> ES 是检索扩展层，适合活动名称、艺人、城市、场馆等全文搜索。当前演示版为了保证交易链路稳定，搜索主链路先使用票务服务和 PostgreSQL 完成；如果进入生产扩展，会把活动数据同步到 ES，用 ES 做全文召回和排序，详情和交易仍回源到票务服务。

### Q12：什么是倒排索引

答：

> 倒排索引是从关键词到文档列表的映射。比如“周杰伦”对应 `[活动1, 活动3]`，“演唱会”对应 `[活动1, 活动2, 活动3]`。用户搜索时，ES 直接查关键词对应的列表，再做交集和相关性排序，而不是逐条扫描活动表。

### Q13：为什么 ES 搜索更快

答：

> 因为 ES 提前对文本分词并建立倒排索引。搜索时查词典和 posting list，不需要对每条活动记录做字符串匹配。同时 ES 支持相关性打分、高亮、同义词、拼音等搜索能力。

### Q14：ES 数据同步失败怎么办

答：

> 数据库是主库，ES 是查询索引。同步失败不会影响下单支付主流程，只会影响搜索新鲜度。可以用 MQ 重试或定时补偿任务，根据更新时间重新同步活动索引。

### Q15：支付回调为什么不能直接相信前端

答：

> 支付状态必须以后端调用支付宝接口或支付宝服务端回调为准。前端支付结果页面只能展示状态，不能决定订单是否已支付。后端 `AlipayService` 和 `PaymentConfirmationService` 会校验支付流水并更新订单。

### Q16：订单为什么要保存快照

答：

> 订单列表和详情不能依赖活动名称、票价、座位标签实时变化。下单时把活动、场次、票档、座位等展示字段写入订单快照，后续即使活动信息修改，用户历史订单仍然保持下单时的内容。

### Q17：如何防止用户重复下单或重复抢票

答：

> 抢票入口使用 `idempotencyKey` 和 Redis 幂等 key，同一用户同一购票意图会复用已有请求。订单服务也会根据 `grabRequestId` 等字段检查已有订单，避免重试导致重复创建。

### Q18：如果某个服务挂了怎么办

答：

> Gateway 层和服务内部通过 Sentinel 做限流降级，服务调用失败会返回中文错误提示。异步任务通过 MQ 重试和死信队列兜底。交易类写操作通过 Seata 和数据库事务保证失败回滚。

## 11. 每个人答辩时的简短开场

| 成员 | 30 秒开场话术 |
|:---|:---|
| 成员 A | 我负责需求拆分和数据库设计，把平台拆成用户、票务、订单、支付、通知、抢票几个边界，并整理了每个服务拥有的数据表，避免跨服务直接查库。 |
| 成员 B | 我负责 Redis 抢票层，用 Redis 队列、Lua 原子脚本、幂等 key 和用户/座位 hold 解决高并发下的排队和预扣库存问题。 |
| 成员 C | 我负责微服务治理，主要是 Gateway 路由、Nacos 服务发现、Feign 内部调用和 Sentinel 限流降级，保证服务之间可发现、可调用、可保护。 |
| 成员 D | 我负责订单支付主链路，订单创建会调用票务锁库存，支付成功后更新订单和支付流水，核心写链路用 Seata 保证跨服务一致性。 |
| 成员 E | 我负责前端页面和演示联调，包括首页、搜索、活动详情、订单、通知和管理后台，并通过统一 API 封装和 Next.js 代理接入网关。 |
| 成员 F | 我负责 RabbitMQ 异步通知和候补联动，也负责 ES 检索扩展说明。MQ 用重试和死信队列保证异步任务可靠，ES 用倒排索引提升全文搜索效率。 |

