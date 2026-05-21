# 真正微服务低耦合推进计划

## 目标

将 Omni 从“共享数据库里的逻辑边界”推进到“可本地验证 schema isolation、代码边界可执行守护、服务通过内部 API 协作”的低耦合微服务形态。当前阶段不做生产物理拆库，不移除生产外键，不引入 MQ/outbox。

## 当前状态

- H1/H2/H3/I1/I2/J1/J2/K1/K2 已完成。
- `java-order` 已不直接依赖 ticket-owned `TicketType`/`SessionSeat` Entity/Mapper。
- `java-payment` 已不直接依赖 user/ticket ref mapper。
- `java-notification` 已纳入 copied id 边界策略。
- `scripts/check-service-boundaries.ps1` 可检查服务代码边界。
- `scripts/check-cross-owner-fks.ps1` 可盘点跨 owner FK。
- `scripts/verify-microservice-boundaries.ps1` 可一键运行边界守护、FK 清单与关键 Java 测试。
- `sql/local/20260520_drop_cross_owner_fks_local_only.sql` 是本地 disposable database 用 FK 删除候选。
- `java-order`、`java-payment` 已有 `application-local-schema.yml` 试点配置。

## 已完成阶段

### H1：Order User Validation

状态：完成

- 订单创建通过 `java-user` internal API 校验用户存在与状态。
- 覆盖用户不存在、禁用、用户服务异常映射测试。

### H2：Payment Order Validation

状态：完成

- 支付创建通过 `java-order` internal API 加载/校验订单。
- 覆盖订单不存在、已支付、服务异常映射测试。

### H3：Notification Copied Id Policy

状态：完成

- 新增 `docs/microservices/notification-boundary.md`。
- 边界脚本检查 notification 不直接访问 user/order 表。

### I1：Cross-Owner FK Check Script

状态：完成

- 新增 `scripts/check-cross-owner-fks.ps1`。
- 当前识别：22 cross-owner、76 same-owner、7 legacy。

### I2：Local-Only FK Drop Candidate

状态：完成

- 新增 `sql/local/20260520_drop_cross_owner_fks_local_only.sql`。
- 只用于本地 disposable database，不进入生产迁移。

### J1：Schema Isolation Runbook

状态：完成

- 新增/完善 `docs/microservices/schema-isolation-runbook.md`。
- 记录 schema 映射、search-path 设计、回滚与验证步骤。

### J2：Local Schema Pilot

状态：完成

- 新增 `java/java-order/src/main/resources/application-local-schema.yml`。
- 新增 `java/java-payment/src/main/resources/application-local-schema.yml`。
- 默认 `application.yml` 不变。

### K1：Internal Client Error Mapping

状态：完成

- order/payment 内部 API 失败映射为确定性业务异常。
- 关键测试通过。

### K2：Integration Verification Script

状态：完成

- 新增 `scripts/verify-microservice-boundaries.ps1`。
- 更新 `docs/microservices/service-boundaries.md`。

## 下一阶段计划

### L1：全业务服务 Local Schema Profile 扩展

状态：完成

- 给 `java-user`、`java-ticket`、`java-notification` 增加 `application-local-schema.yml`。
- 继续不改默认配置。
- 在 runbook 中记录全部服务 profile 启用命令。

### L2：Local Schema Profile 配置验收

状态：完成

- 编译并测试所有业务服务资源加载。
- 用一键脚本验证默认行为不回归。
- 增加 `scripts/check-local-schema-profiles.ps1`，确认 local schema profile 文件存在且 currentSchema 正确。

### M1：跨服务数据库访问守护增强

状态：完成

- 扩展 `check-service-boundaries.ps1`，覆盖更多常见 SQL 访问形态：XML mapper、注解 SQL、字符串拼接中的 FROM/JOIN。
- 检查新增 Java Entity/Mapper 是否越过 service ownership。
- 保持 allowlist 最小化。

完成记录：

- `check-service-boundaries.ps1` 已从只扫描 `src/main/java/*.java` 扩展为扫描服务 `src` 下的 `*.java` 与 `*.xml`。
- 已用临时 `BoundaryViolationFixture.xml` 验证 RED：旧脚本漏抓 `FROM session_seat`，增强后能失败并指出文件行号。
- 临时测试文件已删除，最终一键验证通过。

### M2：生产迁移安全声明

状态：完成

- 在 `docs/microservices/service-boundaries.md` 与 runbook 中加入明确生产禁令。
- 明确什么时候才允许进入物理拆库：本地 schema isolation 实测通过、所有服务 local profile 可启动、无跨 owner Mapper/SQL、关键集成流通过。

完成记录：

- `docs/microservices/service-boundaries.md` 已新增 Production Migration Safety Gate 和 Explicitly Forbidden Until Gate Passes。
- `docs/microservices/schema-isolation-runbook.md` 已新增生产迁移安全声明。
- `docs/microservices/cross-service-db-constraints.md` 已引用生产门禁。

### N1：Disposable Local Schema Isolation SQL 准备

状态：完成

- 新增 `sql/local/20260520_move_tables_to_service_schemas_local_only.sql`。
- 新增 `scripts/apply-local-schema-isolation.ps1`，要求显式本地确认和环境变量确认。
- 新增 `scripts/check-local-schema-sql.ps1`，静态检查本地 schema SQL 不含破坏性或数据修改语句。
- 一键验证脚本已纳入 local schema SQL safety 检查。

### N2：Disposable Local Schema Isolation 实测

状态：完成

- 已确认本地 `omni_ticket` 可丢弃，并在执行前生成备份：`backups/omni_ticket_before_schema_isolation_20260520-184757.dump`，大小 `250006` 字节。
- 已执行 `scripts/apply-local-schema-isolation.ps1`，完成本地 cross-owner FK drop 候选和 service schema 搬表候选。
- 执行过程中 `IF EXISTS` 安全忽略当前本地库不存在的表：`venue_seat_layout_template`、`venue_seat_layout_template_section`、`layout_section`、`order_snapshot`。
- 当前本地 service schema 表数量：`user_service=4`、`ticket_service=27`、`order_service=2`、`payment_service=2`、`notification_service=1`。
- 重新运行一键边界验收通过，输出 `All microservice boundary checks passed.`。

## 验证命令

从仓库根目录：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
```

单独运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-service-boundaries.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-cross-owner-fks.ps1
```

从 `java/` 目录：

```powershell
mvn test -pl java-payment,java-ticket,java-order -am --% -Dsurefire.failIfNoSpecifiedTests=false
```

## 当前验收标准

- 一键边界验证脚本通过：已于 2026-05-20 18:55 重新验证，`BUILD SUCCESS`，`All microservice boundary checks passed.`。
- 所有新增 local-schema profile 不影响默认配置。
- 不新增跨 owner FK。
- 不新增跨服务 Entity/Mapper/SQL 依赖。
- 不修改生产迁移链路。
- 下一验收重点是启动五个服务的 `local-schema` profile，并验证登录、票务查询、下单、支付、退款、通知关键链路。
