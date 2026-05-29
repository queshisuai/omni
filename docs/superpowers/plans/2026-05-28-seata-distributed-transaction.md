# Seata Distributed Transaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Omni Java 微服务中以固定 Seata 1.6.1、Docker Compose 和 PostgreSQL AT 模式分阶段接入分布式事务，先覆盖下单/锁票，再覆盖支付确认、取消和退款内部状态更新。

**Architecture:** 使用 Seata AT 模式，Seata Server 通过 Docker Compose 自动拉取固定版本 `seataio/seata-server:1.6.1` 并接入 Nacos。order、ticket、payment 三个服务接入 Seata 客户端、PostgreSQL `undo_log` 和 XID 传播验证；gateway、user、notification 暂不接入。

**Tech Stack:** Java 11, Spring Boot 2.7.18, Spring Cloud 2021.0.8, Spring Cloud Alibaba 2021.0.5.0, Seata 1.6.1, PostgreSQL, Druid, MyBatis-Plus, Docker Compose, Nacos, Sentinel.

---

## 前置约束

- 不使用 `latest` 镜像。
- 不要求本机预先下载 Seata Server 二进制包。
- 不使用本地安装路径、绝对路径或手动解压包作为默认方案。
- 不升级 Spring Cloud Alibaba；如依赖树显示冲突，停下并单独评估。
- 不整体给 `RefundService.approve` 或 `RefundService.directRefund` 加 `@GlobalTransactional`。
- 支付宝真实支付/退款、Redis、通知、外部接口不由 Seata AT 保证。
- PowerShell 下 Maven 参数必须加引号，例如 `mvn dependency:tree "-Dincludes=io.seata"`。
- 当前 Docker Desktop 已正常运行，Registry Mirrors 已配置为 `https://docker.1ms.run/` 和 `https://docker.m.daocloud.io/`，`docker pull hello-world` 已验证成功。

## 文件结构

### 第一阶段：基础设施和依赖接入

- Modify: `docker-compose.yml`
  - 新增固定版本 `seataio/seata-server:1.6.1` 服务。
  - 可选新增一次性 `seata-config-init` 服务，将仓库内 Seata 配置发布到 Nacos。
- Create: `docker/seata/application.yml`
  - Seata Server registry/config 使用 Nacos。
  - 本地开发使用 file store。
- Create: `docker/seata/seataServer.properties`
  - Seata Server 运行配置，包含 `service.vgroupMapping.omni_tx_group=default`、store mode 等。
- Create: `docker/seata/import-config.sh`
  - 通过 Nacos OpenAPI 导入 `seataServer.properties`，由固定版本 `curlimages/curl:8.8.0` 容器执行。
- Modify: `java/pom.xml`
  - 增加 `seata.version=1.6.1`。
  - 管理 `com.alibaba.cloud:spring-cloud-starter-alibaba-seata:2021.0.5.0` 或必要时管理 `io.seata:seata-spring-boot-starter:1.6.1`。
- Modify: `java/java-order/pom.xml`
  - 增加 Seata starter。
- Modify: `java/java-ticket/pom.xml`
  - 增加 Seata starter。
- Modify: `java/java-payment/pom.xml`
  - 增加 Seata starter。
- Modify: `java/java-order/src/main/resources/application-prod-split.yml`
  - 增加 Seata 客户端配置。
- Modify: `java/java-ticket/src/main/resources/application-prod-split.yml`
  - 增加 Seata 客户端配置。
- Modify: `java/java-payment/src/main/resources/application-prod-split.yml`
  - 增加 Seata 客户端配置。
- Modify: `java/java-order/src/main/resources/application-local-schema.yml`
  - 增加本地 schema 场景 Seata 配置。
- Modify: `java/java-ticket/src/main/resources/application-local-schema.yml`
  - 增加本地 schema 场景 Seata 配置。
- Modify: `java/java-payment/src/main/resources/application-local-schema.yml`
  - 增加本地 schema 场景 Seata 配置。
- Create: `sql/production-split/order/20260528_seata_undo_log.sql`
  - PostgreSQL 版本 `undo_log`。
- Create: `sql/production-split/ticket/20260528_seata_undo_log.sql`
  - PostgreSQL 版本 `undo_log`。
- Create: `sql/production-split/payment/20260528_seata_undo_log.sql`
  - PostgreSQL 版本 `undo_log`。
- Create: `sql/docker-init/010-seata-undo-log.sql`
  - 本地 Docker 首次初始化时为 `omni_order`、`omni_ticket_split`、`omni_payment` 建 `undo_log`。
- Create: `sql/local/20260528_seata_undo_log.sql`
  - local-schema disposable 场景在 `order_service`、`ticket_service`、`payment_service` schema 建 `undo_log`。
- Modify: `docs/operations/production-db-split-cutover-checklist.md` 或创建/修改现有运维文档
  - 增加 Seata Server 启动、undo_log 手工执行和验证步骤。

### 第二阶段：下单/锁票

- Modify: `java/java-order/src/main/java/com/omni/order/service/OrderService.java`
  - `createOrder` 增加 `@GlobalTransactional` 与本地事务边界。
  - `createOrderWithSeats` 增加 `@GlobalTransactional` 与本地事务边界。
  - 增加仅测试可用的失败注入点，或通过测试替身 mapper/client 构造失败。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/TicketSalesInternalService.java`
  - `lockStock` 增加 `@Transactional(rollbackFor = Exception.class)`。
  - `lockSeats` 增加 `@Transactional(rollbackFor = Exception.class)`。
- Create: `java/java-order/src/main/java/com/omni/order/config/SeataXidFeignConfig.java` 或 `java/java-common/src/main/java/com/omni/common/config/SeataXidFeignConfig.java`
  - 仅当依赖验证显示默认 starter 未传播 XID 时新增 Feign `RequestInterceptor`。
- Test: `java/java-order/src/test/java/com/omni/order/service/OrderSeataCreateOrderTest.java`
  - 单元/切片测试验证注解和失败传播。
- Test: 可选新增集成验证脚本 `scripts/verify-seata-create-order.ps1`
  - 通过真实服务验证库存回滚。

### 第三阶段：支付确认、取消、退款内部状态更新

- Modify: `java/java-payment/src/main/java/com/omni/payment/service/AlipayService.java`
  - 不在发起支付宝支付/退款的入口上加全局事务。
  - 将支付结果落库内部链路调整为可被 Spring AOP 代理的 public 方法，或拆出内部服务。
- Create: `java/java-payment/src/main/java/com/omni/payment/service/PaymentConfirmationService.java`
  - 如果采用拆分方案，在该服务中包裹 payment 流水成功 + order 标记已支付。
- Modify: `java/java-order/src/main/java/com/omni/order/service/OrderService.java`
  - `cancelOrder`、`markRefunded`、`markPartialRefunded` 分别审慎增加全局事务。
  - 对已纳入全局事务的 ticket 远程失败路径改为抛异常，不吞掉失败。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/TicketSalesInternalService.java`
  - `confirmSold`、`release`、`refund` 增加 `@Transactional(rollbackFor = Exception.class)`。
- Test: `java/java-payment/src/test/java/com/omni/payment/service/PaymentSeataConfirmationTest.java`
  - 验证 ticket confirmSold 失败时 payment/order/ticket 状态一致。
- Test: `java/java-order/src/test/java/com/omni/order/service/OrderSeataCancelRefundTest.java`
  - 验证取消、全额退款、部分退款内部 DB 链路失败时回滚。
- Create: 可选新增集成验证脚本 `scripts/verify-seata-payment-confirmation.ps1`
  - 通过真实服务验证 XID 和回滚。

---

## Task 1: 第一阶段版本门禁与依赖策略确认

**Files:**
- Modify: `java/pom.xml:25-86`
- Modify: `java/java-order/pom.xml:19-66`
- Modify: `java/java-ticket/pom.xml:19-66`
- Modify: `java/java-payment/pom.xml:19-72`

- [ ] **Step 1: 确认当前依赖基线**

Run:

```bash
cd java && mvn dependency:tree "-Dincludes=org.springframework.boot,org.springframework.cloud,com.alibaba.cloud" > ../seata-dependency-baseline.txt
```

Expected:

- 命令成功。
- 输出中 Spring Boot 仍为 `2.7.18` 管理版本。
- Spring Cloud 仍为 `2021.0.8` 管理版本。
- Spring Cloud Alibaba 仍为 `2021.0.5.0` 管理版本。

- [ ] **Step 2: 在父 POM 增加 Seata 版本属性和依赖管理**

Modify `java/pom.xml` properties:

```xml
        <seata.version>1.6.1</seata.version>
```

Add to `dependencyManagement.dependencies`:

```xml
            <dependency>
                <groupId>com.alibaba.cloud</groupId>
                <artifactId>spring-cloud-starter-alibaba-seata</artifactId>
                <version>${spring-cloud-alibaba.version}</version>
            </dependency>
```

Rationale:

- 先使用与当前 SCA 版本一致的 starter。
- 已预研确认该 starter 直接依赖 `io.seata:seata-spring-boot-starter:1.6.1`。

- [ ] **Step 3: 给三个参与服务增加 Seata starter**

Add this dependency to `java/java-order/pom.xml`, `java/java-ticket/pom.xml`, `java/java-payment/pom.xml` inside `<dependencies>`:

```xml
        <dependency>
            <groupId>com.alibaba.cloud</groupId>
            <artifactId>spring-cloud-starter-alibaba-seata</artifactId>
        </dependency>
```

- [ ] **Step 4: 运行 Seata 依赖树验证**

Run:

```bash
cd java && mvn dependency:tree "-Dincludes=io.seata"
```

Expected:

- 能看到 `io.seata:seata-spring-boot-starter:1.6.1`。
- 能看到 `io.seata:seata-all:1.6.1` 或相关 Seata 1.6.1 依赖。
- 未出现多个不一致的 Seata 主版本。

- [ ] **Step 5: 运行 Spring 依赖树回归验证**

Run:

```bash
cd java && mvn dependency:tree "-Dincludes=org.springframework.boot,org.springframework.cloud"
```

Expected:

- 项目实际解析不应被 Seata starter 降级到 Spring Boot `2.6.13`。
- 项目实际解析不应破坏 Spring Cloud `2021.0.8`。
- 如果出现 Boot/Cloud 版本漂移，停止执行后续任务，改用 `io.seata:seata-spring-boot-starter:1.6.1` 方案并记录原因。

- [ ] **Step 6: 阶段提交**

Run:

```bash
git add java/pom.xml java/java-order/pom.xml java/java-ticket/pom.xml java/java-payment/pom.xml
git commit -m "build: add Seata client dependency management"
```

Expected:

- 仅提交 POM 相关改动。

---

## Task 2: 第一阶段 Docker Compose 与 Seata Server 配置

**Files:**
- Modify: `docker-compose.yml:1-60`
- Create: `docker/seata/application.yml`
- Create: `docker/seata/seataServer.properties`
- Create: `docker/seata/import-config.sh`

- [ ] **Step 1: 新建 Seata Server application.yml**

Create `docker/seata/application.yml`:

```yaml
server:
  port: 7091

spring:
  application:
    name: seata-server

console:
  user:
    username: seata
    password: seata

logging:
  config: classpath:logback-spring.xml

seata:
  config:
    type: nacos
    nacos:
      server-addr: nacos:8848
      namespace:
      group: SEATA_GROUP
      data-id: seataServer.properties
      username:
      password:
  registry:
    type: nacos
    nacos:
      application: seata-server
      server-addr: nacos:8848
      group: SEATA_GROUP
      namespace:
      cluster: default
      username:
      password:
  store:
    mode: file
  security:
    secretKey: SeataSecretKey0c382ef121d778043159209298fd40bf3850a017
    tokenValidityInMilliseconds: 1800000
    ignore:
      urls: /,/**/*.css,/**/*.js,/**/*.html,/**/*.map,/**/*.svg,/**/*.png,/**/*.ico,/console-fe/public/**,/api/v1/auth/login
```

- [ ] **Step 2: 新建 Seata Server Nacos 配置**

Create `docker/seata/seataServer.properties`:

```properties
transport.type=TCP
transport.server=NIO
transport.heartbeat=true
transport.enableTmClientBatchSendRequest=false
transport.enableRmClientBatchSendRequest=true
transport.rpcRmRequestTimeout=30000
transport.rpcTmRequestTimeout=30000
transport.rpcTcRequestTimeout=30000
transport.threadFactory.bossThreadPrefix=NettyBoss
transport.threadFactory.workerThreadPrefix=NettyServerNIOWorker
transport.threadFactory.serverExecutorThreadPrefix=NettyServerBizHandler
transport.threadFactory.shareBossWorker=false
transport.threadFactory.clientSelectorThreadPrefix=NettyClientSelector
transport.threadFactory.clientSelectorThreadSize=1
transport.threadFactory.clientWorkerThreadPrefix=NettyClientWorkerThread
transport.threadFactory.bossThreadSize=1
transport.threadFactory.workerThreadSize=default
transport.shutdown.wait=3
service.vgroupMapping.omni_tx_group=default
service.default.grouplist=172.20.10.2:8091
service.enableDegrade=false
service.disableGlobalTransaction=false
client.rm.asyncCommitBufferLimit=10000
client.rm.lock.retryInterval=10
client.rm.lock.retryTimes=30
client.rm.lock.retryPolicyBranchRollbackOnConflict=true
client.rm.reportRetryCount=5
client.rm.tableMetaCheckEnable=false
client.rm.tableMetaCheckerInterval=60000
client.rm.sqlParserType=druid
client.rm.reportSuccessEnable=false
client.rm.sagaBranchRegisterEnable=false
client.tm.commitRetryCount=5
client.tm.rollbackRetryCount=5
client.undo.dataValidation=true
client.undo.logSerialization=jackson
client.undo.onlyCareUpdateColumns=true
client.undo.logTable=undo_log
client.undo.compress.enable=true
client.undo.compress.type=zip
client.undo.compress.threshold=64k
store.mode=file
server.recovery.committingRetryPeriod=1000
server.recovery.asynCommittingRetryPeriod=1000
server.recovery.rollbackingRetryPeriod=1000
server.recovery.timeoutRetryPeriod=1000
server.maxCommitRetryTimeout=-1
server.maxRollbackRetryTimeout=-1
server.rollbackRetryTimeoutUnlockEnable=false
server.distributedLockExpireTime=10000
metrics.enabled=false
```

- [ ] **Step 3: 新建 Nacos 配置导入脚本**

Create `docker/seata/import-config.sh`:

```sh
#!/bin/sh
set -eu

NACOS_ADDR="${NACOS_ADDR:-nacos:8848}"
DATA_ID="${SEATA_CONFIG_DATA_ID:-seataServer.properties}"
GROUP="${SEATA_CONFIG_GROUP:-SEATA_GROUP}"
CONFIG_FILE="/seata-config/seataServer.properties"

until curl -fsS "http://${NACOS_ADDR}/nacos/" >/dev/null; do
  echo "waiting for nacos at ${NACOS_ADDR}"
  sleep 2
done

curl -fsS -X POST "http://${NACOS_ADDR}/nacos/v1/cs/configs" \
  --data-urlencode "dataId=${DATA_ID}" \
  --data-urlencode "group=${GROUP}" \
  --data-urlencode "type=properties" \
  --data-urlencode "content@${CONFIG_FILE}"

echo "published ${DATA_ID} to ${GROUP}"
```

- [ ] **Step 4: 修改 docker-compose.yml**

Add services after `nacos`:

```yaml
  seata-config-init:
    image: curlimages/curl:8.8.0
    container_name: omni-seata-config-init
    depends_on:
      nacos:
        condition: service_healthy
    volumes:
      - ./docker/seata:/seata-config:ro
    environment:
      NACOS_ADDR: nacos:8848
      SEATA_CONFIG_DATA_ID: seataServer.properties
      SEATA_CONFIG_GROUP: SEATA_GROUP
    command: ["/bin/sh", "/seata-config/import-config.sh"]
    restart: "no"

  seata-server:
    image: seataio/seata-server:1.6.1
    container_name: omni-seata
    depends_on:
      nacos:
        condition: service_healthy
      seata-config-init:
        condition: service_completed_successfully
    environment:
      SEATA_IP: 172.20.10.2
      SEATA_PORT: 8091
    command: ["-h", "172.20.10.2", "-p", "8091"]
    # 本地 Java 服务运行在宿主机时，Seata 注册地址必须对宿主机可达。
    # Seata 1.6.1 不接受 127.0.0.1 作为注册 IP，使用宿主机默认路由对应的非回环 IPv4。
    # 如果未来 Java 服务也容器化运行，再改为容器网络可访问地址。
    ports:
      - "8091:8091"
      - "7091:7091"
    volumes:
      - ./docker/seata/application.yml:/seata-server/resources/application.yml:ro
    healthcheck:
      test: ["CMD-SHELL", "timeout 3 bash -c '</dev/tcp/localhost/8091' || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 30
```

If Docker Compose does not support `service_completed_successfully`, replace the dependency with `depends_on: [nacos, seata-config-init]` and verify manually.

- [ ] **Step 5: 拉取并启动 Seata Server**

Run:

```bash
docker compose pull seata-server
docker compose up -d nacos seata-config-init seata-server
```

Expected:

- Docker 自动从 mirror 拉取 `seataio/seata-server:1.6.1`。
- `seata-config-init` 成功退出。
- `seata-server` 容器运行中。

- [ ] **Step 6: 检查容器状态与日志**

Run:

```bash
docker compose ps
docker compose logs --tail=100 seata-server
```

Expected:

- `omni-seata` 运行。
- 日志显示 Seata Server 启动并连接 Nacos。
- 未出现使用 `latest` 或本地安装路径。

- [ ] **Step 7: 阶段提交**

Run:

```bash
git add docker-compose.yml docker/seata/application.yml docker/seata/seataServer.properties docker/seata/import-config.sh
git commit -m "chore: add Dockerized Seata server"
```

---

## Task 3: 第一阶段客户端配置与 PostgreSQL undo_log

**Files:**
- Modify: `java/java-order/src/main/resources/application-prod-split.yml`
- Modify: `java/java-ticket/src/main/resources/application-prod-split.yml`
- Modify: `java/java-payment/src/main/resources/application-prod-split.yml`
- Modify: `java/java-order/src/main/resources/application-local-schema.yml`
- Modify: `java/java-ticket/src/main/resources/application-local-schema.yml`
- Modify: `java/java-payment/src/main/resources/application-local-schema.yml`
- Create: `sql/production-split/order/20260528_seata_undo_log.sql`
- Create: `sql/production-split/ticket/20260528_seata_undo_log.sql`
- Create: `sql/production-split/payment/20260528_seata_undo_log.sql`
- Create: `sql/docker-init/010-seata-undo-log.sql`
- Create: `sql/local/20260528_seata_undo_log.sql`

- [ ] **Step 1: 增加 Seata 客户端配置片段**

Append to each of the three `application-prod-split.yml` files:

```yaml

seata:
  enabled: true
  application-id: ${spring.application.name}
  tx-service-group: omni_tx_group
  enable-auto-data-source-proxy: true
  registry:
    type: nacos
    nacos:
      application: seata-server
      server-addr: ${NACOS_HOST:localhost}:${NACOS_PORT:8848}
      group: SEATA_GROUP
      cluster: default
  config:
    type: nacos
    nacos:
      server-addr: ${NACOS_HOST:localhost}:${NACOS_PORT:8848}
      group: SEATA_GROUP
      data-id: seataServer.properties
  service:
    vgroup-mapping:
      omni_tx_group: default
```

Apply the same block to the three `application-local-schema.yml` files.

- [ ] **Step 2: 创建 PostgreSQL undo_log DDL 模板**

Use this PostgreSQL DDL for each split database script:

```sql
CREATE TABLE IF NOT EXISTS undo_log (
    id BIGSERIAL NOT NULL,
    branch_id BIGINT NOT NULL,
    xid VARCHAR(128) NOT NULL,
    context VARCHAR(128) NOT NULL,
    rollback_info BYTEA NOT NULL,
    log_status INTEGER NOT NULL,
    log_created TIMESTAMP NOT NULL,
    log_modified TIMESTAMP NOT NULL,
    CONSTRAINT pk_undo_log PRIMARY KEY (id),
    CONSTRAINT ux_undo_log UNIQUE (xid, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_undo_log_log_created ON undo_log (log_created);
```

- [ ] **Step 3: 创建 production-split 脚本**

Create the same DDL in:

- `sql/production-split/order/20260528_seata_undo_log.sql`
- `sql/production-split/ticket/20260528_seata_undo_log.sql`
- `sql/production-split/payment/20260528_seata_undo_log.sql`

- [ ] **Step 4: 创建 Docker 初始化脚本**

Create `sql/docker-init/010-seata-undo-log.sql`:

```sql
\connect omni_order

CREATE TABLE IF NOT EXISTS undo_log (
    id BIGSERIAL NOT NULL,
    branch_id BIGINT NOT NULL,
    xid VARCHAR(128) NOT NULL,
    context VARCHAR(128) NOT NULL,
    rollback_info BYTEA NOT NULL,
    log_status INTEGER NOT NULL,
    log_created TIMESTAMP NOT NULL,
    log_modified TIMESTAMP NOT NULL,
    CONSTRAINT pk_undo_log PRIMARY KEY (id),
    CONSTRAINT ux_undo_log UNIQUE (xid, branch_id)
);
CREATE INDEX IF NOT EXISTS idx_undo_log_log_created ON undo_log (log_created);

\connect omni_ticket_split

CREATE TABLE IF NOT EXISTS undo_log (
    id BIGSERIAL NOT NULL,
    branch_id BIGINT NOT NULL,
    xid VARCHAR(128) NOT NULL,
    context VARCHAR(128) NOT NULL,
    rollback_info BYTEA NOT NULL,
    log_status INTEGER NOT NULL,
    log_created TIMESTAMP NOT NULL,
    log_modified TIMESTAMP NOT NULL,
    CONSTRAINT pk_undo_log PRIMARY KEY (id),
    CONSTRAINT ux_undo_log UNIQUE (xid, branch_id)
);
CREATE INDEX IF NOT EXISTS idx_undo_log_log_created ON undo_log (log_created);

\connect omni_payment

CREATE TABLE IF NOT EXISTS undo_log (
    id BIGSERIAL NOT NULL,
    branch_id BIGINT NOT NULL,
    xid VARCHAR(128) NOT NULL,
    context VARCHAR(128) NOT NULL,
    rollback_info BYTEA NOT NULL,
    log_status INTEGER NOT NULL,
    log_created TIMESTAMP NOT NULL,
    log_modified TIMESTAMP NOT NULL,
    CONSTRAINT pk_undo_log PRIMARY KEY (id),
    CONSTRAINT ux_undo_log UNIQUE (xid, branch_id)
);
CREATE INDEX IF NOT EXISTS idx_undo_log_log_created ON undo_log (log_created);
```

- [ ] **Step 5: 创建 local-schema 脚本**

Create `sql/local/20260528_seata_undo_log.sql`:

```sql
CREATE SCHEMA IF NOT EXISTS order_service;
CREATE SCHEMA IF NOT EXISTS ticket_service;
CREATE SCHEMA IF NOT EXISTS payment_service;

CREATE TABLE IF NOT EXISTS order_service.undo_log (
    id BIGSERIAL NOT NULL,
    branch_id BIGINT NOT NULL,
    xid VARCHAR(128) NOT NULL,
    context VARCHAR(128) NOT NULL,
    rollback_info BYTEA NOT NULL,
    log_status INTEGER NOT NULL,
    log_created TIMESTAMP NOT NULL,
    log_modified TIMESTAMP NOT NULL,
    CONSTRAINT pk_order_service_undo_log PRIMARY KEY (id),
    CONSTRAINT ux_order_service_undo_log UNIQUE (xid, branch_id)
);
CREATE INDEX IF NOT EXISTS idx_order_service_undo_log_log_created ON order_service.undo_log (log_created);

CREATE TABLE IF NOT EXISTS ticket_service.undo_log (
    id BIGSERIAL NOT NULL,
    branch_id BIGINT NOT NULL,
    xid VARCHAR(128) NOT NULL,
    context VARCHAR(128) NOT NULL,
    rollback_info BYTEA NOT NULL,
    log_status INTEGER NOT NULL,
    log_created TIMESTAMP NOT NULL,
    log_modified TIMESTAMP NOT NULL,
    CONSTRAINT pk_ticket_service_undo_log PRIMARY KEY (id),
    CONSTRAINT ux_ticket_service_undo_log UNIQUE (xid, branch_id)
);
CREATE INDEX IF NOT EXISTS idx_ticket_service_undo_log_log_created ON ticket_service.undo_log (log_created);

CREATE TABLE IF NOT EXISTS payment_service.undo_log (
    id BIGSERIAL NOT NULL,
    branch_id BIGINT NOT NULL,
    xid VARCHAR(128) NOT NULL,
    context VARCHAR(128) NOT NULL,
    rollback_info BYTEA NOT NULL,
    log_status INTEGER NOT NULL,
    log_created TIMESTAMP NOT NULL,
    log_modified TIMESTAMP NOT NULL,
    CONSTRAINT pk_payment_service_undo_log PRIMARY KEY (id),
    CONSTRAINT ux_payment_service_undo_log UNIQUE (xid, branch_id)
);
CREATE INDEX IF NOT EXISTS idx_payment_service_undo_log_log_created ON payment_service.undo_log (log_created);
```

- [ ] **Step 6: 对已有本机数据库手工应用 undo_log**

Run:

```bash
PGPASSWORD=123456 psql -h localhost -p 5432 -U postgres -d omni_order -f sql/production-split/order/20260528_seata_undo_log.sql
PGPASSWORD=123456 psql -h localhost -p 5432 -U postgres -d omni_ticket_split -f sql/production-split/ticket/20260528_seata_undo_log.sql
PGPASSWORD=123456 psql -h localhost -p 5432 -U postgres -d omni_payment -f sql/production-split/payment/20260528_seata_undo_log.sql
```

Expected:

- 三个库都创建或确认已有 `undo_log`。

- [ ] **Step 7: 验证 undo_log 存在**

Run:

```bash
PGPASSWORD=123456 psql -h localhost -p 5432 -U postgres -d omni_order -t -A -c "SELECT to_regclass('public.undo_log');"
PGPASSWORD=123456 psql -h localhost -p 5432 -U postgres -d omni_ticket_split -t -A -c "SELECT to_regclass('public.undo_log');"
PGPASSWORD=123456 psql -h localhost -p 5432 -U postgres -d omni_payment -t -A -c "SELECT to_regclass('public.undo_log');"
```

Expected:

```text
undo_log
undo_log
undo_log
```

- [ ] **Step 8: 阶段提交**

Run:

```bash
git add java/java-order/src/main/resources/application-prod-split.yml java/java-ticket/src/main/resources/application-prod-split.yml java/java-payment/src/main/resources/application-prod-split.yml java/java-order/src/main/resources/application-local-schema.yml java/java-ticket/src/main/resources/application-local-schema.yml java/java-payment/src/main/resources/application-local-schema.yml sql/production-split/order/20260528_seata_undo_log.sql sql/production-split/ticket/20260528_seata_undo_log.sql sql/production-split/payment/20260528_seata_undo_log.sql sql/docker-init/010-seata-undo-log.sql sql/local/20260528_seata_undo_log.sql
git commit -m "chore: configure Seata clients and undo logs"
```

---

## Task 4: 第一阶段基础设施验收

**Files:**
- Create: `docs/operations/seata-local-verification.md`
- No code changes unless verification exposes a defect in Tasks 1-3.

- [ ] **Step 1: 创建本地验证文档**

Create `docs/operations/seata-local-verification.md`:

```markdown
# Seata 本地启动与验证

## 环境状态

- Docker Desktop：已验证正常运行
- Registry Mirrors：
  - https://docker.1ms.run/
  - https://docker.m.daocloud.io/
- 镜像验证：`docker pull hello-world` 已成功
- Seata Server 镜像：`seataio/seata-server:1.6.1`
- 本地 Java 服务运行位置：宿主机
- 本地 Seata Server 注册地址：`172.20.10.2:8091`，应使用宿主机默认路由对应的非回环 IPv4。

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
cd java && mvn test
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
```

- [ ] **Step 2: 启动基础设施**

Run:

```bash
docker compose up -d postgres redis nacos seata-config-init seata-server
```

Expected:

- `postgres`、`redis`、`nacos`、`seata-server` 运行。
- `seata-config-init` 成功退出。

- [ ] **Step 3: 验证 Seata Server 日志**

Run:

```bash
docker compose logs --tail=200 seata-server
```

Expected:

- 日志显示 Seata Server 使用 Nacos registry/config。
- 日志显示 `omni_tx_group` 可映射到 `default`。
- 无 `latest`、本机安装路径或解压包路径。

- [ ] **Step 4: 运行 Maven 测试**

Run:

```bash
cd java && mvn test
```

Expected:

- 原有测试通过。
- 如果失败，先判断是否为 Seata 依赖引起；不得跳过测试。

- [ ] **Step 5: 启动 order/ticket/payment 服务验证 Seata client 初始化**

Run via existing project startup flow or manual Maven commands with `prod-split` profile.

Expected:

- 三个服务启动日志出现 Seata client 初始化。
- 服务仍注册到 Nacos。
- Druid + MyBatis-Plus + PostgreSQL 正常启动。

- [ ] **Step 6: 阶段验收记录**

Append to `docs/operations/seata-local-verification.md`:

```markdown
### 第一阶段验证记录

- Docker mirror: `https://docker.1ms.run/`, `https://docker.m.daocloud.io/`
- Seata image: `seataio/seata-server:1.6.1`
- `docker compose ps`: PASS/FAIL
- `mvn test`: PASS/FAIL
- `mvn dependency:tree "-Dincludes=io.seata"`: PASS/FAIL
- Spring dependency drift check: PASS/FAIL
- Seata client startup logs: PASS/FAIL
```

- [ ] **Step 7: 阶段提交**

Run:

```bash
git add docs/operations/seata-local-verification.md
git commit -m "docs: add Seata local verification guide"
```

---

## Task 5: 第二阶段下单/锁票事务入口

**Files:**
- Modify: `java/java-order/src/main/java/com/omni/order/service/OrderService.java:140-225`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/TicketSalesInternalService.java:95-133`
- Test: `java/java-order/src/test/java/com/omni/order/service/OrderSeataCreateOrderTest.java`

- [ ] **Step 1: 编写失败测试，验证 createOrder 有全局事务注解**

Create `java/java-order/src/test/java/com/omni/order/service/OrderSeataCreateOrderTest.java`:

```java
package com.omni.order.service;

import io.seata.spring.annotation.GlobalTransactional;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertNotNull;

class OrderSeataCreateOrderTest {

    @Test
    void createOrderHasGlobalTransactional() throws Exception {
        Method method = OrderService.class.getMethod("createOrder", com.omni.order.dto.CreateOrderRequest.class);
        assertNotNull(method.getAnnotation(GlobalTransactional.class));
    }

    @Test
    void createOrderWithSeatsHasGlobalTransactional() throws Exception {
        Method method = OrderService.class.getMethod("createOrderWithSeats", com.omni.order.dto.LockSeatsRequest.class);
        assertNotNull(method.getAnnotation(GlobalTransactional.class));
    }
}
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
cd java && mvn test "-pl=java-order" "-Dtest=OrderSeataCreateOrderTest"
```

Expected:

- FAIL，因为方法还没有 `@GlobalTransactional`。

- [ ] **Step 3: 给 order 下单入口增加全局事务**

Modify imports in `OrderService.java`:

```java
import io.seata.spring.annotation.GlobalTransactional;
```

Annotate methods:

```java
    @GlobalTransactional(name = "omni-create-order", rollbackFor = Exception.class)
    @Transactional(rollbackFor = Exception.class)
    public Order createOrder(CreateOrderRequest request) {
```

```java
    @GlobalTransactional(name = "omni-create-order-with-seats", rollbackFor = Exception.class)
    @Transactional(rollbackFor = Exception.class)
    public Order createOrderWithSeats(LockSeatsRequest request) {
```

Keep existing business logic unchanged.

- [ ] **Step 4: 给 ticket 锁库存/锁座增加本地事务**

Modify imports in `TicketSalesInternalService.java`:

```java
import org.springframework.transaction.annotation.Transactional;
```

Annotate methods:

```java
    @Transactional(rollbackFor = Exception.class)
    public void lockStock(TicketSalesLockRequest request) {
```

```java
    @Transactional(rollbackFor = Exception.class)
    public TicketSalesSeatLockResponse lockSeats(TicketSalesLockRequest request) {
```

- [ ] **Step 5: 运行单元测试**

Run:

```bash
cd java && mvn test "-pl=java-order,java-ticket" "-Dtest=OrderSeataCreateOrderTest,TicketSalesInternalControllerTest,OrderSeatServiceTest,OrderSnapshotServiceTest"
```

Expected:

- PASS。

- [ ] **Step 6: 验证下单成功链路**

Start services with `prod-split`, then run a normal order creation through gateway or direct service endpoint using known test account.

Expected:

- order 写入成功。
- ticket 库存或座位锁定成功。
- Seata 日志出现 `order -> ticket` 同一 XID 和分支注册。

- [ ] **Step 7: 设计并执行下单失败回滚验证**

Preferred minimal integration approach:

- 使用测试 profile 或测试替身让 `orderMapper.insert(order)` 抛出运行时异常。
- 在异常前确保 `lockStockForOrder(order)` 已调用成功。

Expected:

- 创建订单接口返回失败。
- `omni_order` 未留下成功订单。
- `omni_ticket_split.ticket_type.remain_stock` 回滚到调用前。
- Seata Server 或客户端日志显示全局事务 rollback。

If production code cannot safely add test hook, use an integration test with mocked mapper/client to prove exception propagation, and record manual DB rollback test as pending until test hook is approved.

- [ ] **Step 8: 阶段提交**

Run:

```bash
git add java/java-order/src/main/java/com/omni/order/service/OrderService.java java/java-ticket/src/main/java/com/omni/ticket/service/TicketSalesInternalService.java java/java-order/src/test/java/com/omni/order/service/OrderSeataCreateOrderTest.java
git commit -m "feat: protect order creation with Seata"
```

---

## Task 6: 第二阶段 XID 传播验收

**Files:**
- Create only if needed: `java/java-common/src/main/java/com/omni/common/config/SeataXidFeignConfig.java`
- Modify only if needed: Feign client configuration references in order/payment modules.

- [ ] **Step 1: 先验证 starter 默认 XID 传播**

Run create-order success and failure scenarios from Task 5.

Expected:

- order 日志中存在 XID。
- ticket 日志中存在同一 XID。
- Seata 分支事务注册包含 ticket 分支。

- [ ] **Step 2: 如默认未传播，新增 Feign 拦截器**

Create `java/java-common/src/main/java/com/omni/common/config/SeataXidFeignConfig.java`:

```java
package com.omni.common.config;

import feign.RequestInterceptor;
import io.seata.core.context.RootContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

@Configuration
public class SeataXidFeignConfig {

    @Bean
    public RequestInterceptor seataXidRequestInterceptor() {
        return template -> {
            String xid = RootContext.getXID();
            if (StringUtils.hasText(xid)) {
                template.header(RootContext.KEY_XID, xid);
            }
        };
    }
}
```

- [ ] **Step 3: 运行编译和测试**

Run:

```bash
cd java && mvn test
```

Expected:

- PASS。
- 无重复 Bean 冲突。

- [ ] **Step 4: 再次验证 XID 传播**

Repeat Task 5 success and failure scenarios.

Expected:

- `order -> ticket` 同一 XID。
- ticket 分支事务注册成功。

- [ ] **Step 5: 阶段提交**

If interceptor was needed:

```bash
git add java/java-common/src/main/java/com/omni/common/config/SeataXidFeignConfig.java
git commit -m "feat: propagate Seata XID through Feign"
```

If interceptor was not needed, append the XID evidence to `docs/operations/seata-local-verification.md` and commit that exact file:

```bash
git add docs/operations/seata-local-verification.md
git commit -m "test: record Seata XID propagation evidence"
```

---

## Task 7: 第三阶段支付确认内部事务

**Files:**
- Modify: `java/java-payment/src/main/java/com/omni/payment/service/AlipayService.java:426-453`
- Create: `java/java-payment/src/main/java/com/omni/payment/service/PaymentConfirmationService.java`
- Test: `java/java-payment/src/test/java/com/omni/payment/service/PaymentSeataConfirmationTest.java`

- [ ] **Step 1: 编写支付确认服务骨架测试**

Create `java/java-payment/src/test/java/com/omni/payment/service/PaymentSeataConfirmationTest.java`:

```java
package com.omni.payment.service;

import io.seata.spring.annotation.GlobalTransactional;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertNotNull;

class PaymentSeataConfirmationTest {

    @Test
    void confirmPaymentHasGlobalTransactional() throws Exception {
        Method method = PaymentConfirmationService.class.getMethod(
                "confirmPayment",
                com.omni.payment.entity.Payment.class,
                String.class,
                String.class,
                String.class,
                String.class,
                PaymentConfirmationService.OrderPaymentMarker.class
        );
        assertNotNull(method.getAnnotation(GlobalTransactional.class));
    }
}
```

Expected initially:

- Compilation fails because `PaymentConfirmationService` does not exist.

- [ ] **Step 2: 创建 PaymentConfirmationService**

Create `java/java-payment/src/main/java/com/omni/payment/service/PaymentConfirmationService.java`:

```java
package com.omni.payment.service;

import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.payment.entity.Payment;
import com.omni.payment.mapper.PaymentMapper;
import io.seata.spring.annotation.GlobalTransactional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;

@Service
public class PaymentConfirmationService {

    private final PaymentMapper paymentMapper;

    public PaymentConfirmationService(PaymentMapper paymentMapper) {
        this.paymentMapper = paymentMapper;
    }

    @GlobalTransactional(name = "omni-payment-confirm", rollbackFor = Exception.class)
    @Transactional(rollbackFor = Exception.class)
    public void confirmPayment(Payment payment,
                               String tradeNo,
                               String buyerId,
                               String rawNotify,
                               String callbackData,
                               OrderPaymentMarker orderPaymentMarker) {
        if (PaymentService.STATUS_SUCCESS == payment.getStatus()) {
            if (!StringUtils.hasText(tradeNo) || !tradeNo.equals(payment.getTradeNo())) {
                throw new BusinessException(ResultCode.CONFLICT, "支付流水交易号不一致");
            }
            orderPaymentMarker.markPaid(payment.getOrderId());
            return;
        }

        orderPaymentMarker.markPaid(payment.getOrderId());

        payment.setStatus(PaymentService.STATUS_SUCCESS);
        payment.setTradeNo(tradeNo);
        payment.setBuyerId(buyerId);
        payment.setNotifyTime(LocalDateTime.now());
        payment.setRawNotify(rawNotify);
        payment.setCallbackData(callbackData);
        payment.setPayTime(LocalDateTime.now());
        paymentMapper.updateById(payment);
    }

    @FunctionalInterface
    public interface OrderPaymentMarker {
        void markPaid(Long orderId);
    }
}
```

This design keeps the order-service call in `AlipayService.markOrderPaid`, so the existing `callOrderClient` Sentinel wrapper remains the only path for payment -> order calls.

- [ ] **Step 3: 改造 AlipayService 使用 PaymentConfirmationService**

Inject `PaymentConfirmationService` into `AlipayService` constructor and replace `completePayment` body with:

```java
    private void completePayment(Payment payment, String tradeNo, String buyerId, String rawNotify, String callbackData) {
        paymentConfirmationService.confirmPayment(payment, tradeNo, buyerId, rawNotify, callbackData, this::markOrderPaid);
    }
```

Keep external Alipay calls outside global transaction. This also keeps `markOrderPaid` inside `AlipayService`, so it continues using `callOrderClient(() -> orderClient.markPaid(...))` and preserves the existing Sentinel resource behavior.

- [ ] **Step 4: 给 order markPaid 参与链路确认现有本地事务**

`OrderService.markPaid` already has `@Transactional`; do not remove it. If needed, add `rollbackFor = Exception.class`:

```java
    @Transactional(rollbackFor = Exception.class)
    public Order markPaid(Long id) {
```

Do not add `@GlobalTransactional` here if payment confirmation is the root transaction for `payment -> order -> ticket`; otherwise nested roots may make logs harder to reason about.

- [ ] **Step 5: 给 ticket confirmSold 增加本地事务**

Modify `TicketSalesInternalService.confirmSold`:

```java
    @Transactional(rollbackFor = Exception.class)
    public void confirmSold(TicketSalesOrderRequest request) {
```

- [ ] **Step 6: 运行测试**

Run:

```bash
cd java && mvn test "-pl=java-payment,java-order,java-ticket" "-Dtest=PaymentSeataConfirmationTest,OrderSeatServiceTest,TicketSalesInternalControllerTest"
```

Expected:

- PASS。

- [ ] **Step 7: 执行支付确认失败回滚验证**

Use a test double or test profile to make ticket `confirmSold` throw after order status update.

Expected:

- payment 流水未误标记成功。
- order 状态回滚为待支付或原状态。
- ticket 未确认售出。
- `payment -> order -> ticket` 同一 XID。

- [ ] **Step 8: 阶段提交**

Run:

```bash
git add java/java-payment/src/main/java/com/omni/payment/service/AlipayService.java java/java-payment/src/main/java/com/omni/payment/service/PaymentConfirmationService.java java/java-payment/src/test/java/com/omni/payment/service/PaymentSeataConfirmationTest.java java/java-order/src/main/java/com/omni/order/service/OrderService.java java/java-ticket/src/main/java/com/omni/ticket/service/TicketSalesInternalService.java
git commit -m "feat: protect payment confirmation with Seata"
```

---

## Task 8: 第三阶段取消和退款内部状态更新

**Files:**
- Modify: `java/java-order/src/main/java/com/omni/order/service/OrderService.java:227-310,525-537,751-831`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/TicketSalesInternalService.java:164-191`
- Test: `java/java-order/src/test/java/com/omni/order/service/OrderSeataCancelRefundTest.java`

- [ ] **Step 1: 编写注解测试**

Create `java/java-order/src/test/java/com/omni/order/service/OrderSeataCancelRefundTest.java`:

```java
package com.omni.order.service;

import com.omni.order.dto.MarkPartialRefundedRequest;
import io.seata.spring.annotation.GlobalTransactional;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertNotNull;

class OrderSeataCancelRefundTest {

    @Test
    void cancelOrderHasGlobalTransactional() throws Exception {
        Method method = OrderService.class.getMethod("cancelOrder", Long.class);
        assertNotNull(method.getAnnotation(GlobalTransactional.class));
    }

    @Test
    void markRefundedHasGlobalTransactional() throws Exception {
        Method method = OrderService.class.getMethod("markRefunded", Long.class);
        assertNotNull(method.getAnnotation(GlobalTransactional.class));
    }

    @Test
    void markPartialRefundedHasGlobalTransactional() throws Exception {
        Method method = OrderService.class.getMethod("markPartialRefunded", Long.class, MarkPartialRefundedRequest.class);
        assertNotNull(method.getAnnotation(GlobalTransactional.class));
    }
}
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
cd java && mvn test "-pl=java-order" "-Dtest=OrderSeataCancelRefundTest"
```

Expected:

- FAIL，因为注解还未添加。

- [ ] **Step 3: 给 order 内部 DB 链路入口增加全局事务**

Modify `OrderService.java`:

```java
    @GlobalTransactional(name = "omni-cancel-order", rollbackFor = Exception.class)
    @Transactional(rollbackFor = Exception.class)
    public void cancelOrder(Long id) {
```

```java
    @GlobalTransactional(name = "omni-mark-refunded", rollbackFor = Exception.class)
    @Transactional(rollbackFor = Exception.class)
    public Order markRefunded(Long id) {
```

```java
    @GlobalTransactional(name = "omni-mark-partial-refunded", rollbackFor = Exception.class)
    @Transactional(rollbackFor = Exception.class)
    public Order markPartialRefunded(Long orderId, MarkPartialRefundedRequest request) {
```

- [ ] **Step 4: 将纳入全局事务的远程失败改为抛异常**

For `releaseLockedResources` when called by `cancelOrder`, replace warning-only behavior with exception in the global transaction path. Do not change the existing warning-only scheduler path unless it is explicitly part of the global transaction.

Minimal pattern:

```java
    private void releaseLockedResourcesOrThrow(Order order) {
        ReleaseResult result = releaseLockedResourcesInternal(order);
        if (!result.success()) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "释放票务资源失败");
        }
    }

    private void releaseLockedResources(Order order) {
        ReleaseResult result = releaseLockedResourcesInternal(order);
        if (!result.success()) {
            log.warn("释放票务资源失败: orderId={}", order != null ? order.getId() : null);
        }
    }

    private ReleaseResult releaseLockedResourcesInternal(Order order) {
        // 复用当前 releaseLockedResources 的主体逻辑，把远程调用结果转换为 ReleaseResult。
    }

    private record ReleaseResult(boolean success) {
    }
```

Then `cancelOrder` calls `releaseLockedResourcesOrThrow(order)`. The scheduler and best-effort cleanup paths can keep calling `releaseLockedResources(order)`.

For refund paths, ensure ticket `refund` failure throws inside `markRefunded` and `markPartialRefunded` so Seata can roll back.

- [ ] **Step 5: 给 ticket release/refund 增加本地事务**

Modify `TicketSalesInternalService.java`:

```java
    @Transactional(rollbackFor = Exception.class)
    public void release(TicketSalesOrderRequest request) {
```

```java
    @Transactional(rollbackFor = Exception.class)
    public void refund(TicketSalesOrderRequest request) {
```

- [ ] **Step 6: 明确 RefundService 禁止整体全局事务**

Do not add `@GlobalTransactional` to:

- `RefundService.approve`
- `RefundService.directRefund`

If internal post-Alipay success update needs global protection, call order internal global transaction endpoint after the external Alipay success, preserving compensation logic on failure.

- [ ] **Step 7: 运行测试**

Run:

```bash
cd java && mvn test "-pl=java-order,java-ticket,java-payment" "-Dtest=OrderSeataCancelRefundTest,RefundServiceBoundaryTest,ActivityAdminServiceTest,OrderSeatServiceTest,TicketSalesInternalControllerTest"
```

Expected:

- PASS。
- 退款边界测试仍保持补偿语义。

- [ ] **Step 8: 执行第三阶段集成验证**

Verify:

- 取消订单成功释放 ticket 资源。
- ticket release 故障时 order 取消回滚。
- 全额退款内部状态成功恢复 ticket 资源。
- ticket refund 故障时 order 退款状态回滚。
- `RefundService.approve/directRefund` 中支付宝外部调用未被包入全局事务。

- [ ] **Step 9: 阶段提交**

Run:

```bash
git add java/java-order/src/main/java/com/omni/order/service/OrderService.java java/java-ticket/src/main/java/com/omni/ticket/service/TicketSalesInternalService.java java/java-order/src/test/java/com/omni/order/service/OrderSeataCancelRefundTest.java
git commit -m "feat: protect internal cancel and refund updates with Seata"
```

---

## Task 9: 全量验证

**Files:**
- No code changes unless verification exposes a defect.

- [ ] **Step 1: 运行全量 Maven 测试**

Run:

```bash
cd java && mvn test
```

Expected:

- PASS。

- [ ] **Step 2: 运行依赖树验收**

Run:

```bash
cd java && mvn dependency:tree "-Dincludes=io.seata"
cd java && mvn dependency:tree "-Dincludes=org.springframework.boot,org.springframework.cloud"
```

Expected:

- io.seata 相关依赖存在且为 `1.6.1` 主线。
- Spring Boot / Spring Cloud 没有意外降级或冲突。

- [ ] **Step 3: 运行微服务边界验收**

Run:

```bash
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
```

Expected:

- PASS。
- 未新增跨服务 Mapper、Entity、XML mapper 或 SQL join。

- [ ] **Step 4: 启动完整本地环境**

Run:

```bash
docker compose up -d postgres redis nacos seata-config-init seata-server
powershell -ExecutionPolicy Bypass -File start-project.ps1
```

Expected:

- Seata Server 启动。
- order/ticket/payment Seata client 初始化。
- Nacos 服务注册不被破坏。
- 不出现业务 JDBC 连接到历史共享库 `omni_ticket`。

- [ ] **Step 5: 成功链路手工验证**

Verify through gateway or direct endpoints:

- 登录测试账号。
- 创建普通库存订单。
- 创建座位订单。
- 支付确认或支付同步成功。
- 取消待支付订单。
- 内部退款状态更新。

Expected:

- DB 状态一致。
- Seata 日志显示分支事务提交。

- [ ] **Step 6: 异常回滚手工验证**

Verify controlled failures:

- ticket 锁库存成功后 order 抛异常，ticket 库存回滚。
- order markPaid 成功后 ticket confirmSold 抛异常，order/payment/ticket 状态一致。

Expected:

- Seata 日志显示 rollback。
- XID 在 `order -> ticket` 和 `payment -> order -> ticket` 传播。

---

## Task 10: 文档与验证记录

**Files:**
- Modify: `docs/operations/production-db-split-cutover-checklist.md`
- Modify: `docs/operations/seata-local-verification.md`

- [ ] **Step 1: 确认本地验证文档已存在**

Verify `docs/operations/seata-local-verification.md` was created in Task 4. If it is missing, stop and complete Task 4 before continuing.

- [ ] **Step 2: 更新生产 cutover checklist**

Add to `docs/operations/production-db-split-cutover-checklist.md`:

```markdown
## Seata 检查

- [ ] Seata Server 使用固定版本镜像，不使用 latest。
- [ ] 生产 Seata Server 不使用 file store。
- [ ] Seata Server 元数据库与业务库分离。
- [ ] `omni_order`、`omni_ticket_split`、`omni_payment` 已执行 PostgreSQL undo_log DDL。
- [ ] order/ticket/payment 已使用同一 `omni_tx_group`。
- [ ] 已验证 XID 在 `order -> ticket` 和 `payment -> order -> ticket` 传播。
- [ ] 已验证失败回滚链路。
```

- [ ] **Step 3: 记录最终验证结果**

Append to `docs/operations/seata-local-verification.md`:

```markdown
## 2026-05-28 验证记录

- `docker compose up -d postgres redis nacos seata-config-init seata-server`: PASS/FAIL
- `mvn test`: PASS/FAIL
- `mvn dependency:tree "-Dincludes=io.seata"`: PASS/FAIL
- Spring dependency drift check: PASS/FAIL
- `scripts/verify-microservice-boundaries.ps1`: PASS/FAIL
- 下单成功链路: PASS/FAIL
- 下单失败回滚: PASS/FAIL
- 支付确认成功链路: PASS/FAIL
- 支付确认失败回滚: PASS/FAIL
- XID `order -> ticket`: PASS/FAIL
- XID `payment -> order -> ticket`: PASS/FAIL
```

- [ ] **Step 4: 阶段提交**

Run:

```bash
git add docs/operations/seata-local-verification.md docs/operations/production-db-split-cutover-checklist.md
git commit -m "docs: document Seata verification steps"
```

---

## Self-Review Checklist

- Spec coverage: 覆盖版本兼容、Docker Compose、固定镜像、Nacos、PostgreSQL undo_log、XID 传播、三阶段实施、失败验证、不覆盖范围。
- Placeholder scan: 本计划没有未完成占位项，也没有把 `latest` 作为默认方案。
- Type consistency: 使用 `OrderService.createOrder`、`OrderService.createOrderWithSeats`、`PaymentConfirmationService.confirmPayment`、`TicketSalesInternalService.lockStock/lockSeats/confirmSold/release/refund`，与设计一致。
- Scope control: 第一阶段不改业务入口，第二阶段只下单/锁票，第三阶段才支付确认、取消、退款内部状态更新。
