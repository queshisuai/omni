# Seata 本地启动与验证

## 环境状态

- Docker Desktop：已验证正常运行
- Registry Mirrors：
  - `https://docker.1ms.run/`
  - `https://docker.m.daocloud.io/`
- Seata Server 镜像：`seataio/seata-server:1.6.1`
- 本地 Java 服务运行位置：宿主机
- 本地 Seata Server 注册地址：通过 `SEATA_ADVERTISE_HOST` 设置为宿主机可达的非回环 IPv4，本次验证为 `10.142.195.38:8091`

## 启动

```bash
powershell -ExecutionPolicy Bypass -File scripts/start-seata-docker.ps1
powershell -ExecutionPolicy Bypass -File start-project.ps1
```

宿主机运行 Java 服务、Docker 运行 Nacos/Seata 时，不要手工维护 `.env` 里的 `SEATA_ADVERTISE_HOST`。统一使用脚本自动探测当前宿主机非回环 IPv4，并同步更新 Nacos 配置中心和 Seata 服务注册表：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-seata-docker.ps1
```

注意：Seata Server 1.6.1 不接受 `127.0.0.1` 作为注册 IP。若未设置 `SEATA_ADVERTISE_HOST` 或设置为回环地址，`seata-config-init` 会失败，避免向 Nacos 写入宿主机 Java 不可达的地址。

本地 Docker Compose 不再启动 PostgreSQL 容器；Java 服务和 grab-service 均连接本机 PostgreSQL。不要恢复 `postgres` / `omni-postgres` Docker 服务，否则容易出现某个服务误连旧 Docker 数据库的运行错误。

可选预拉取：

```bash
docker compose pull seata-server
```

## 验证

```bash
cd java && mvn dependency:tree "-Dincludes=io.seata"
cd java && mvn dependency:tree "-Dincludes=org.springframework.boot,org.springframework.cloud"
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
```

## 回滚验证

1. ticket 锁库存成功后 order 抛异常，确认 ticket 库存回滚。
2. order markPaid 成功后 ticket confirmSold 抛异常，确认 order/payment/ticket 状态一致。
3. 检查日志中 `order -> ticket` 和 `payment -> order -> ticket` 使用同一 XID。

## 不覆盖范围

- 支付宝真实支付/退款不可由 Seata AT 回滚。
- Redis、通知和外部接口不由 Seata AT 保证。
- 外部副作用成功但内部落库失败时继续走补偿/人工处理。

## 2026-05-29 第一阶段验证记录

- `docker compose ps`: PASS，`redis`、`nacos`、`seata-server`、`grab-service`、`frontend` 均运行，`seata-server` 为 healthy；PostgreSQL 使用本机服务。
- Seata image: PASS，使用 `seataio/seata-server:1.6.1`，未使用 `latest`。
- Nacos Seata 配置: PASS，`SEATA_GROUP/seataServer.properties` 存在，包含 `service.vgroupMapping.omni_tx_group=default`。
- Seata Server Nacos 注册: PASS，`SEATA_GROUP@@seata-server` 健康实例为宿主机可达的非回环 IPv4。
- `undo_log` SQL 资产: PASS，已新增 production-split、docker-init、local-schema 脚本。
- `powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1`: PASS。
- `powershell -ExecutionPolicy Bypass -File scripts/check-local-schema-sql.ps1`: PASS。
- 本机 `omni_order.public.undo_log`: PASS。
- 本机 `omni_ticket_split.public.undo_log`: PASS。
- 本机 `omni_payment.public.undo_log`: PASS。
- `mvn -f java/pom.xml -pl java-order,java-ticket,java-payment -am -DskipTests compile`: PASS。
- `mvn -f java/pom.xml dependency:tree "-Dincludes=io.seata"`: PASS，`java-order`、`java-ticket`、`java-payment` 解析到 `spring-cloud-starter-alibaba-seata:2021.0.5.0` 和 `seata-spring-boot-starter:1.6.1`。
- Spring dependency drift check: PASS，`mvn -f java/pom.xml dependency:tree "-Dincludes=org.springframework.boot,org.springframework.cloud"` 显示 Spring Boot 仍为 `2.7.18`，Spring Cloud 仍为 `3.1.7/3.1.8` 系列，未被 Seata starter 降级。
- Seata 客户端启动日志: PASS，通过临时备用端口启动 `java-order:18083`、`java-ticket:18082`、`java-payment:18084`，三者均完成 TM/RM 注册。
- `java-order` 客户端证据: PASS，日志包含 `RegisterTMRequest{applicationId='java-order', transactionServiceGroup='omni_tx_group'}`、`register TM success`、`RM will register :jdbc:postgresql://localhost:5432/omni_order`、`register RM success`。
- `java-ticket` 客户端证据: PASS，日志包含 `RegisterTMRequest{applicationId='java-ticket', transactionServiceGroup='omni_tx_group'}`、`register TM success`、`RM will register :jdbc:postgresql://localhost:5432/omni_ticket_split`、`register RM success`。
- `java-payment` 客户端证据: PASS，日志包含 `RegisterTMRequest{applicationId='java-payment', transactionServiceGroup='omni_tx_group'}`、`register TM success`、`RM will register :jdbc:postgresql://localhost:5432/omni_payment`、`register RM success`。
- 当前 IDE 中早先启动的 `order/ticket/payment` 进程: 需要重启后才会加载本次新编译的 Seata 配置和依赖；本记录的客户端验收基于临时启动副本。

## 2026-05-29 Task 6 XID 传播验证记录

- `docker compose ps`: PASS，`redis`、`nacos`、`seata-server`、`grab-service`、`frontend` 均运行，`seata-server` 为 healthy；PostgreSQL 使用本机服务。
- Nacos Seata 注册查询: PASS，`SEATA_GROUP@@seata-server` 返回 `10.142.195.38:8091`，宿主机 Java 客户端可达。
- `java-order` 与 `java-ticket` 端口: PASS，`8083` 和 `8082` 处于监听状态。
- `POST http://localhost:8083/api/order/internal/create`: PASS，返回成功订单 `DM2026052915461620D5E7`。
- XID 传播: PASS，Seata Server 日志显示全局事务 `omni-create-order` 使用同一 XID `10.142.195.38:8091:5179924382839844869`。
- ticket AT 分支: PASS，日志包含 `resourceId=jdbc:postgresql://localhost:5432/omni_ticket_split`，并成功注册分支。
- order AT 分支: PASS，日志包含 `resourceId=jdbc:postgresql://localhost:5432/omni_order`，并成功注册分支。
- 全局提交: PASS，ticket/order 分支均 commit 成功，日志包含 `Committing global transaction is successfully done`。
- Feign XID 拦截器: 未新增。默认 `spring-cloud-starter-alibaba-seata` XID 传播已通过本次真实链路验证。

## 2026-05-29 Task 9 全量验证记录

### 自动验证结果

- compile: PASS，`mvn -f "java\pom.xml" -pl java-order,java-ticket,java-payment -am -DskipTests compile` 构建成功。
- `dependency:tree` io.seata: PASS，`java-order`、`java-ticket`、`java-payment` 均包含 `spring-cloud-starter-alibaba-seata`，并解析到 `seata-spring-boot-starter:1.6.1`。
- `dependency:tree` Spring Boot / Spring Cloud: PASS，依赖树检查成功。
- Maven 回归: PASS，`PaymentSeataConfirmationTest`、`OrderSeataCancelRefundTest`、`RefundServiceBoundaryTest`、`AlipayServiceTest`、`OrderSeatServiceTest`、`OrderSeataCreateOrderTest`、`OrderSeataPostgresqlIdStrategyTest`、`TicketSalesInternalSeataTest`、`TicketSalesInternalControllerTest` 共 `39 tests, 0 failures, 0 errors`。
- microservice boundary: PASS，`scripts/verify-microservice-boundaries.ps1` 通过，`45 tests, 0 failures, 0 errors`，并输出 `All microservice boundary checks passed.`。

### Docker / Nacos / Seata 状态

- Docker Compose: PASS，`redis`、`nacos`、`seata-server` 均为 healthy；PostgreSQL 使用本机服务，不使用 Docker 容器。
- Seata image: PASS，`seata-server` 使用 `seataio/seata-server:1.6.1`。
- Nacos Seata 注册: PASS，`SEATA_GROUP@@seata-server = 10.142.195.38:8091`，`healthy:true`。

### Seata Client 注册证据

- `java-order` TM/RM: PASS，Seata Server 日志显示 `TM register success` 与 `RM register success`，RM `resourceId` 为 `jdbc:postgresql://localhost:5432/omni_order`。
- `java-ticket` TM/RM: PASS，Seata Server 日志显示 `TM register success` 与 `RM register success`，RM `resourceId` 为 `jdbc:postgresql://localhost:5432/omni_ticket_split`。
- `java-payment` TM/RM: PASS，临时启动验证期间 Seata Server 日志显示 `TM register success` 与 `RM register success`，RM `resourceId` 为 `jdbc:postgresql://localhost:5432/omni_payment`。

### XID / AT 分支证据

- `order -> ticket` 真实链路已有 XID，Seata Server 日志显示 `Begin new global transaction applicationId: java-order`，事务名为 `omni-create-order`。
- ticket/order 两个 `resourceId` 都注册 AT 分支，日志包含 `jdbc:postgresql://localhost:5432/omni_ticket_split` 与 `jdbc:postgresql://localhost:5432/omni_order` 的 `Register branch successfully`。
- 全局提交成功证据: PASS，日志包含 ticket/order 分支提交成功以及 `Committing global transaction is successfully done`。
- 全局回滚样例: PASS，日志包含 `Rollback branch transaction successfully` 与 `Rollback global transaction successfully`。

### 保守边界

- `payment -> order -> ticket` 未调用真实支付宝外部渠道；Task 9 仅验证内部事务代码路径、测试与 Seata client 注册证据。
- 取消/退款未盲调真实接口，避免破坏业务数据。
- 取消/退款通过 `OrderSeataCancelRefundTest`、`TicketSalesInternalSeataTest`、`RefundServiceBoundaryTest` 和 `scripts/verify-microservice-boundaries.ps1` 验证。
- `RefundService.approve` / `RefundService.directRefund` 仍保持支付宝外部退款补偿边界，不由 Seata AT 回滚。
