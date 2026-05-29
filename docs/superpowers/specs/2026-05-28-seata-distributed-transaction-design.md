# Seata 分布式事务设计说明

**日期：** 2026-05-28  
**项目：** Omni 万象抢票平台  
**范围：** Java 多模块微服务中以最小、安全、可验证方式引入 Seata，优先覆盖下单/锁票，随后分阶段覆盖支付确认、取消和退款内部状态更新。  
**状态：** 方案 A 已通过，本文为实施前设计说明；当前阶段不实现代码。

---

## 1. 背景与目标

当前 Omni 后端采用 Spring Cloud Alibaba 微服务架构，服务包括 `java-user`、`java-ticket`、`java-order`、`java-payment`、`java-notification` 和 `java-gateway`。项目已使用 Nacos discovery/config 和 Sentinel，但尚未接入 Seata。

当前核心写链路存在多个服务之间的数据库更新，例如订单创建会调用票务服务锁库存或锁座，支付确认会更新订单与票务状态，退款会更新订单、票务和支付侧退款记录。现有代码主要依赖本地 `@Transactional`，跨服务调用失败时没有分布式事务协调。

本次目标是在不大规模重构业务逻辑的前提下，引入 Seata AT 模式，优先让 order、ticket、payment 三个核心服务在内部数据库写链路上具备可验证的回滚能力。实施必须分阶段推进，每个阶段独立验证，不一次性大改。

---

## 2. 现状调研结论

### 2.1 依赖与版本

父 POM 位于 `java/pom.xml`，当前关键版本为：

- Spring Boot `2.7.18`
- Spring Cloud `2021.0.8`
- Spring Cloud Alibaba `2021.0.5.0`
- MyBatis-Plus `3.5.3.1`
- Druid `1.2.18`

各子模块 POM 未发现 `io.seata` 相关依赖。

### 2.2 Seata 版本兼容性预研

不允许盲目引入最新版 Seata。本次默认选择：

- Seata 客户端 starter：`com.alibaba.cloud:spring-cloud-starter-alibaba-seata:2021.0.5.0`
- 该 starter 直接声明的 Seata 客户端：`io.seata:seata-spring-boot-starter:1.6.1`
- Seata Server 镜像：`seataio/seata-server:1.6.1`

兼容理由：

1. 项目当前已经使用 Spring Cloud Alibaba `2021.0.5.0` BOM；选择同版本的 `spring-cloud-starter-alibaba-seata:2021.0.5.0`，避免跨 Spring Cloud Alibaba 代际引入不确定 starter。
2. 已通过 Maven 解析确认 `spring-cloud-starter-alibaba-seata:2021.0.5.0` 的 POM 直接依赖 `io.seata:seata-spring-boot-starter:1.6.1`。
3. Seata Server 使用 `seataio/seata-server:1.6.1`，与客户端 `1.6.1` 保持一致，避免客户端/服务端协议版本漂移。
4. Spring Boot `2.7.18` 与 Spring Cloud `2021.0.8` 仍属于 Spring Boot 2.x / Spring Cloud 2021.x 体系；不升级 Spring Cloud Alibaba，先在当前体系内做依赖树和启动验证。

风险与门禁：

- `spring-cloud-starter-alibaba-seata:2021.0.5.0` 的 POM 中还能观察到若干 Spring Boot `2.6.13` / Spring Cloud `3.1.5` 相关依赖声明。因此第一阶段必须运行依赖树确认它没有导致项目实际 Spring Boot / Spring Cloud 版本被降级或冲突。
- 如依赖树显示 Boot/Cloud 版本漂移，不能顺手升级 Spring Cloud Alibaba；应改为显式使用 `io.seata:seata-spring-boot-starter:1.6.1` 并补充 Feign XID 传播验证，或单独提交升级影响评估后再决定。
- 不采用 Seata 最新版，也不使用 `latest` 镜像。

### 2.3 配置现状

已检查各服务 `application.yml`、`application-prod-split.yml`、`application-local-schema.yml`，当前未发现 Seata 配置。

默认 `application.yml` 多数仍指向历史共享库 `omni_ticket`，这是历史兼容配置，不代表当前推荐运行方式。当前本机联调和目标运行方式是 `prod-split`，由 profile 与启动脚本显式覆盖到拆分后的业务库。

因此 Seata 接入应优先覆盖 `prod-split` 运行路径，不能只修改默认 `application.yml`。

### 2.4 Docker 与 SQL 现状

`docker-compose.yml` 当前包含：

- PostgreSQL
- Redis
- Nacos

未包含 `seata-server`。

当前 Docker 前置条件已通过：Docker Desktop 正常运行，`docker info` 正常返回 Server 信息，Registry Mirrors 已配置为 `https://docker.1ms.run/` 和 `https://docker.m.daocloud.io/`，且 `docker pull hello-world` 已成功。后续实现可通过 Docker Compose 自动拉取固定版本 `seataio/seata-server:1.6.1`，但仍禁止使用 `latest`。

`sql/` 目录未发现 Seata `undo_log` 表。当前生产拆分 SQL 资产位于 `sql/production-split/`，本地 Docker 初始化 SQL 位于 `sql/docker-init/`。

### 2.5 事务边界与风险

当前事务边界以单服务本地事务为主：

- `java-order` 中 `markPaid`、`cancelOrder`、`markPartialRefunded` 等方法有本地 `@Transactional`。
- `java-payment` 中 `applyRefund` 有本地 `@Transactional`。
- `java-ticket` 的票务内部写方法目前缺少显式本地事务注解。

关键跨服务风险：

1. 订单创建：ticket 已扣库存或锁座，但 order 插入订单/快照失败时无法自动回滚 ticket。
2. 支付确认：order 标记已支付、ticket 确认售出、payment 流水成功可能部分成功。
3. 取消订单：order 取消成功但 ticket 资源释放失败可能导致资源占用。
4. 退款内部更新：order 退款状态、ticket 库存/座位恢复、payment 退款记录可能部分成功。
5. 支付宝支付和退款是外部系统副作用，不属于 Seata AT 可回滚资源。

---

## 3. 推荐方案

采用 Seata AT 模式。

理由：

- 当前核心资源是 PostgreSQL 业务库，适合 AT 模式通过数据源代理和 `undo_log` 提供回滚能力。
- 项目已有本地事务和 MyBatis-Plus，AT 模式接入成本低。
- 本次要求最小、安全、可验证，不进行 TCC/Saga 状态机重构。
- 外部支付渠道不可回滚，AT 模式应只覆盖内部数据库一致性。

---

## 4. Seata Server 部署设计

### 4.1 本地开发默认方式

本机不要求预先下载 Seata Server 二进制包，也不要求手动解压安装。默认通过 Docker Compose 自动拉取并启动固定版本镜像：

- 镜像：`seataio/seata-server:1.6.1`

在 `docker-compose.yml` 中新增 `seata-server` 服务：

- 与现有 `postgres`、`redis`、`nacos` 位于同一 compose 网络。
- 依赖 `nacos` 启动。
- 使用 Nacos 作为注册中心。
- 使用 Nacos 作为配置中心。
- 本地默认 Java 服务运行在宿主机，因此 Seata Server 注册到 Nacos 的地址必须是宿主机可访问地址。Seata 1.6.1 不接受 `127.0.0.1` 作为注册 IP，本机应使用默认路由对应的非回环 IPv4，例如当前环境的 `172.20.10.2:8091`，不能注册为容器网络名 `seata-server:8091`。
- 如果未来 Java 服务也容器化运行，再把注册地址调整为容器网络内可访问的服务名或容器 IP。
- 暴露 Seata 默认通信端口 `8091`。
- 如镜像版本提供控制台，则暴露控制台端口 `7091`。

`docker compose up` 应能自动拉取镜像。可选预拉取命令仅作为优化步骤写入文档：

```bash
docker compose pull seata-server
```

### 4.2 Seata Server 配置文件

Seata Server 启动配置必须放在仓库内，不能依赖本机绝对路径或手动安装目录。建议新增：

- `docker/seata/application.yml`
- `docker/seata/seataServer.properties`

配置内容用于声明：

- registry 使用 Nacos，地址为容器网络内 `nacos:8848`。
- config 使用 Nacos，地址为容器网络内 `nacos:8848`。
- 事务分组 `omni_tx_group` 映射到集群 `default`。
- 本地开发可使用 `file` 存储。

为了让 `docker compose up` 后 Nacos 配置中心中存在 Seata 配置，实施时应采用固定版本的配置导入方式，例如新增一次性 `seata-config-init` compose 服务，或在现有启动脚本中调用仓库内脚本发布 `docker/seata/seataServer.properties` 到 Nacos。默认方案不依赖本机 Seata 安装包、绝对路径或手动解压目录。

### 4.3 存储模式边界

本地开发允许 Seata Server 使用 `file` 存储，降低首次接入门槛。

生产环境不建议使用 `file` 存储。生产应使用固定版本 Seata Server 镜像和持久化 DB 存储；如采用 DB 模式，Seata Server 元数据库必须与业务库分离。

禁止把 Seata Server 元数据表混入以下业务库：

- `omni_order`
- `omni_ticket_split`
- `omni_payment`
- `omni_user`
- `omni_notification`
- `omni_grab`

---

## 5. Nacos 与客户端配置设计

参与服务增加 Seata 客户端配置：

- `seata.enabled=true`
- `seata.application-id=${spring.application.name}`
- `seata.tx-service-group=omni_tx_group`
- `seata.registry.type=nacos`
- `seata.registry.nacos.server-addr=${NACOS_HOST:localhost}:${NACOS_PORT:8848}`
- `seata.registry.nacos.group=SEATA_GROUP`
- `seata.registry.nacos.application=seata-server`
- 本地宿主机运行 Java 服务时，Seata Server 在 Nacos 中的可访问地址应为宿主机默认路由对应的非回环 IPv4，例如当前环境的 `172.20.10.2:8091`。
- 全容器化运行时，再将 Seata Server 注册地址调整为容器网络可访问地址。
- `seata.config.type=nacos`
- `seata.config.nacos.server-addr=${NACOS_HOST:localhost}:${NACOS_PORT:8848}`
- `seata.config.nacos.group=SEATA_GROUP`
- `seata.service.vgroup-mapping.omni_tx_group=default`
- `seata.enable-auto-data-source-proxy=true`

事务分组统一为 `omni_tx_group`。这样 order、ticket、payment 可加入同一全局事务域。

配置优先落到各参与服务的 `application-prod-split.yml`。如需要保留 local-schema disposable 验证能力，再同步加入 `application-local-schema.yml`。

默认 `application.yml` 不改成拆库专用配置，避免破坏项目现有运行纪律。

---

## 6. 模块接入范围

### 6.1 本次接入

- `java-order`
- `java-ticket`
- `java-payment`

这些服务直接参与订单、票务、支付数据库写链路。

### 6.2 本次不接入

- `java-gateway`：网关无业务数据库，不参与 AT 事务。
- `java-user`：本次核心链路中主要作为用户校验查询方，不参与写事务。
- `java-notification`：通知不是库存/资金一致性的强事务核心，不纳入首批。

如果未来 user 或 notification 参与跨服务写事务，再单独补 Seata starter、配置和 `undo_log`。

---

## 7. PostgreSQL AT 模式设计

Seata AT 模式必须按 PostgreSQL 验证，不能照搬 MySQL 示例。

要求：

1. `undo_log` 使用 PostgreSQL 版本 DDL。
2. 每个参与本地事务分支的业务库都要建 `undo_log`。
3. 必须验证 Druid + MyBatis-Plus + PostgreSQL + Seata DataSourceProxy 能正常工作。
4. 必须确认 Seata 自动数据源代理没有破坏现有 Druid datasource、MyBatis-Plus mapper、Spring 本地事务管理器。

首批需要添加 `undo_log` 的库：

- `omni_order`
- `omni_ticket_split`
- `omni_payment`

脚本放置建议：

- `sql/production-split/order/`：order 库 `undo_log`
- `sql/production-split/ticket/`：ticket 库 `undo_log`
- `sql/production-split/payment/`：payment 库 `undo_log`
- `sql/docker-init/`：本地 Docker 首次初始化用脚本
- `sql/local/`：local-schema disposable 场景脚本

PostgreSQL 已存在 Docker volume 时，`sql/docker-init` 不会自动重跑，因此文档必须提供手工执行步骤。

---

## 8. XID 传播设计

验收必须证明 Seata XID 在 Feign/HTTP 调用中传递，而不是只有入口服务运行了本地事务。

必须验证的调用链：

- `order -> ticket`
- `payment -> order -> ticket`

验证方式：

1. 在服务日志中观察全局事务 XID。
2. 在参与服务分支事务日志中确认 branch register / branch report。
3. 在失败用例中确认入口服务和下游服务都被同一个全局事务回滚。
4. 如默认 starter 未自动传播 XID，则实施最小 Feign `RequestInterceptor`，把 `RootContext.KEY_XID` 对应 header 传到下游。

不允许只验证入口服务 `@GlobalTransactional` 生效。

---

## 9. 全局事务入口设计

首批入口以最小覆盖为原则，并分阶段启用。

### 9.1 第二阶段：下单/锁票

- `OrderService.createOrder`
  - 覆盖 ticket 锁库存 + order 插入订单/快照。
  - 远程调用 ticket 只涉及内部 DB 可回滚操作。
- `OrderService.createOrderWithSeats`
  - 覆盖 ticket 锁座或扣站区票库存 + order 插入订单/座位。
  - 远程调用 ticket 只涉及内部 DB 可回滚操作。

Ticket 侧本地事务参与者：

- `TicketSalesInternalService.lockStock`
- `TicketSalesInternalService.lockSeats`

### 9.2 第三阶段：支付确认、取消、退款内部状态更新

- `AlipayService.completePayment` 对应的支付结果落库链路
  - 仅当该事务范围不直接发起外部支付/退款副作用时纳入。
  - 当前 `completePayment` 只处理支付结果落库、远程标记订单已支付和 ticket 确认售出，可作为内部状态更新链路纳入。
  - 由于当前 `completePayment` 是私有方法，不能直接依赖私有方法上的 AOP 注解；实施时应将全局事务放到 public 入口，或拆出一个受 Spring 代理管理的内部支付确认服务。
  - 拆分内部支付确认服务时，必须保留 `AlipayService.markOrderPaid` 现有 `callOrderClient`/Sentinel 行为，不允许绕过 Sentinel 直接调用 `OrderClient`。
- `OrderService.cancelOrder`
  - 覆盖 order 取消 + ticket 释放锁定资源。
  - 远程调用 ticket `release` 是内部 DB 可回滚操作。
- `OrderService.markRefunded`
  - 覆盖 order 全额退款状态 + ticket 退款资源恢复。
  - 远程调用 ticket `refund` 是内部 DB 可回滚操作。
- `OrderService.markPartialRefunded`
  - 覆盖 order 部分退款座位/数量记录 + ticket 部分退款资源恢复。
  - 远程调用 ticket `refund` 是内部 DB 可回滚操作。

Ticket 侧本地事务参与者：

- `TicketSalesInternalService.confirmSold`
- `TicketSalesInternalService.release`
- `TicketSalesInternalService.refund`

这些方法应补充本地 `@Transactional(rollbackFor = Exception.class)`，用于成为 Seata 分支事务中的明确本地事务边界。

### 9.3 禁止纳入整体全局事务的入口

- `RefundService.approve`
- `RefundService.directRefund`

原因：这两个入口会发起支付宝退款外部副作用。支付宝真实退款不可由 Seata AT 回滚，因此不允许整体加 `@GlobalTransactional`。

---

## 10. 退款与外部支付边界

支付宝支付、退款不是 Seata AT 可回滚资源。

设计原则：

- 不把支付宝真实支付或退款调用本身视为可回滚事务资源。
- `RefundService.approve` 和 `RefundService.directRefund` 不整体纳入全局事务。
- 支付宝退款成功后，内部 order/ticket/payment 状态更新失败时，保留现有“需人工补偿”语义。
- 可以把支付宝成功后的内部状态更新封装为独立全局事务，但不能让调用者误以为外部退款可被 Seata 回滚。

---

## 11. 回滚策略

Seata AT 自动回滚范围：

- order 数据库更新
- ticket 数据库更新
- payment 数据库更新

不自动回滚：

- 支付宝真实支付结果
- 支付宝真实退款结果
- Redis 状态
- Nacos/Sentinel 状态
- 通知发送
- 外部接口副作用
- 日志

异常策略：

- 全局事务入口遇到业务异常或运行时异常时回滚内部 DB 分支。
- Feign 调用失败应继续抛出异常，不吞掉导致误提交。
- 当前代码中仅记录 warning 的票务释放/退款恢复失败路径，在纳入全局事务时必须逐个评估是否改为抛异常，否则 Seata 无法触发回滚。
- 出现外部副作用成功但内部落库失败时，继续走补偿/人工处理，不用 Seata 掩盖外部不可回滚事实。

---

## 12. 分阶段实施设计

### 第一阶段：基础设施和依赖接入

只做基础设施与接入能力，不改核心业务事务入口。

内容：

- `docker-compose.yml` 增加 `seata-server`。
- 新增仓库内 Seata Server 配置文件。
- order/ticket/payment 增加 Seata starter 与客户端配置。
- 新增 PostgreSQL `undo_log` SQL。
- 验证 Seata Server 可通过 Docker Compose 自动拉取并启动。
- 验证客户端启动并连接 Seata Server。
- 验证依赖树中出现 `io.seata`，且没有破坏 Spring Boot / Spring Cloud 版本。

### 第二阶段：下单/锁票

只覆盖：

- `OrderService.createOrder`
- `OrderService.createOrderWithSeats`
- `TicketSalesInternalService.lockStock`
- `TicketSalesInternalService.lockSeats`

验证：

- 成功创建普通库存订单。
- 成功创建座位订单。
- ticket 锁库存成功后，order 插入订单前/后抛异常，ticket 库存可回滚。
- XID 从 order 传到 ticket，ticket 分支事务注册成功。

### 第三阶段：支付确认、取消、退款内部状态更新

覆盖：

- 支付确认内部落库链路。
- `OrderService.cancelOrder`。
- `OrderService.markRefunded`。
- `OrderService.markPartialRefunded`。
- `TicketSalesInternalService.confirmSold/release/refund`。

验证：

- 支付确认成功时 payment/order/ticket 状态一致。
- order markPaid 成功后，ticket confirmSold 抛异常时，order/payment/ticket 状态一致回滚。
- 取消订单成功释放 ticket 资源。
- 内部退款状态更新成功恢复 ticket 资源。
- 不把支付宝退款入口整体纳入全局事务。

---

## 13. 失败验证设计

至少提供两个可控失败点。

### 13.1 下单失败点

目标：验证 ticket 锁库存成功后，order 侧失败能回滚 ticket。

设计：

- 在测试环境中对 `OrderService.createOrder` 增加最小测试钩子，允许在 `lockStockForOrder(order)` 之后、`orderMapper.insert(order)` 之前或之后抛出运行时异常。
- 测试前读取 `ticket_type.remain_stock`。
- 调用创建订单并触发失败。
- 测试后再次读取 `ticket_type.remain_stock`，应与测试前一致。
- 同时确认 `omni_order` 未留下成功订单。

测试钩子必须只在测试 profile 或测试替身中生效，不允许影响生产路径。

### 13.2 支付确认失败点

目标：验证 order 标记支付成功后，ticket confirmSold 失败能让 order/payment/ticket 状态一致。

设计：

- 在测试环境中让 ticket internal `confirmSold` 抛出运行时异常。
- 调用支付确认内部落库链路。
- 验证 order 状态仍为待支付或回滚前状态。
- 验证 payment 流水没有误标记为成功。
- 验证 ticket 座位/库存没有误确认售出。
- 验证日志中同一 XID 下存在 order、ticket、payment 分支事务注册和回滚。

如果当前代码不方便直接注入失败点，最小方案是引入测试 profile 专用配置或测试替身 bean，不在生产配置中启用。

---

## 14. 测试与验收设计

必须执行：

1. Maven 测试：
   - `mvn test`
2. Seata 依赖树：
   - `mvn dependency:tree "-Dincludes=io.seata"`
3. Spring 版本依赖树：
   - `mvn dependency:tree "-Dincludes=org.springframework.boot,org.springframework.cloud"`
4. Docker 启动验证：
   - `docker compose up -d nacos postgres redis seata-server`
5. 成功链路：
   - 创建普通库存订单成功，ticket 库存锁定，order 订单写入。
   - 创建座位订单成功，ticket 座位锁定，order 订单/座位写入。
   - 支付确认成功，order 已支付，ticket 座位售出，payment 流水成功。
6. 异常回滚链路：
   - ticket 锁库存成功后 order 抛异常，ticket 库存回滚。
   - order markPaid 成功后 ticket confirmSold 抛异常，order/payment/ticket 状态一致。
7. XID 验证：
   - `order -> ticket` 能看到同一个 XID。
   - `payment -> order -> ticket` 能看到同一个 XID。
   - Seata Server 日志或客户端日志能看到分支事务注册与回滚/提交。
8. PostgreSQL AT 验证：
   - `undo_log` 使用 PostgreSQL DDL。
   - Druid + MyBatis-Plus + PostgreSQL + DataSourceProxy 正常启动和执行。

如果本机无法启动完整环境，必须记录阻塞原因，并提供手工 SQL 与接口验证步骤。

---

## 15. 不纳入本次范围

- TCC 模式。
- Saga 模式。
- 全链路状态机重构。
- 支付宝真实支付回滚。
- 支付宝真实退款回滚。
- Redis 状态一致性保证。
- 通知发送一致性保证。
- 外部接口副作用回滚。
- user/notification 首批接入。
- 大规模 Feign 客户端重构。
- 改变当前微服务边界。
- 将默认 `application.yml` 改为拆库专用配置。
- 使用本机 Seata Server 安装路径、绝对路径或手动解压包作为默认方案。

---

## 16. 交付物

本设计对应后续交付物：

- Seata 设计说明文件。
- 分阶段实施计划文件。
- 父 POM / 模块 POM 改动。
- Seata 客户端配置。
- `docker-compose.yml` 中固定版本 `seata-server` 服务。
- 仓库内 `docker/seata/*` 配置。
- PostgreSQL `undo_log` SQL。
- 核心入口 `@GlobalTransactional` 与参与者本地事务注解。
- XID 传播验证记录。
- 启动与回滚验证文档。
- 每阶段验证记录。
