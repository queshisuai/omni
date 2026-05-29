# Seata 本地启动与验证

## 环境状态

- Docker Desktop：已验证正常运行
- Registry Mirrors：
  - `https://docker.1ms.run/`
  - `https://docker.m.daocloud.io/`
- Seata Server 镜像：`seataio/seata-server:1.6.1`
- 本地 Java 服务运行位置：宿主机
- 本地 Seata Server 注册地址：`172.20.10.2:8091`

## 启动

```bash
docker compose up -d postgres redis nacos seata-config-init seata-server
powershell -ExecutionPolicy Bypass -File start-project.ps1
```

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

- `docker compose ps`: PASS，`postgres`、`redis`、`nacos`、`seata-server`、`grab-service`、`frontend` 均运行，`seata-server` 为 healthy。
- Seata image: PASS，使用 `seataio/seata-server:1.6.1`，未使用 `latest`。
- Nacos Seata 配置: PASS，`SEATA_GROUP/seataServer.properties` 存在，包含 `service.vgroupMapping.omni_tx_group=default`。
- Seata Server Nacos 注册: PASS，`SEATA_GROUP@@seata-server` 健康实例 `172.20.10.2:8091`。
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
