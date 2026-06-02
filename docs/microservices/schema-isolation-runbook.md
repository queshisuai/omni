# Schema Isolation Runbook

## 目标

本 runbook 用于本地验证 Omni 是否可以逐步走向服务级 schema isolation。当前阶段只验证运行时代码是否已经不依赖跨服务 Mapper、Entity、SQL join 或数据库强制跨 owner FK。

## Local-Only 警告

- 只允许在本地 disposable database 或临时重建的 `omni_ticket` 上执行。
- 禁止用于 staging / production。
- 禁止把 `sql/local/20260520_drop_cross_owner_fks_local_only.sql` 接入生产迁移流程。
- 禁止在本阶段物理拆库、删除生产 FK、修改默认 `application.yml` 或引入 MQ/outbox。

## 生产迁移安全声明

本 runbook 不是生产迁移指南。它只用于本地 schema isolation 试验。任何生产级 schema 切换或物理拆库必须先通过 `docs/microservices/service-boundaries.md` 中的 Production Migration Safety Gate。

在 gate 通过前，以下行为一律禁止：

- 在 staging / production 执行 `sql/local/20260520_drop_cross_owner_fks_local_only.sql`。
- 删除 staging / production 中的 cross-owner FK。
- 修改默认 `application.yml` 的 datasource URL 或 schema。
- 将服务连接到不同生产数据库。
- 为迁移便利临时恢复跨服务 Mapper、Entity、XML mapper 或 SQL join。
- 在没有独立设计和回滚计划时引入 MQ/outbox。

进入生产迁移设计前，至少需要补齐：

1. local schema isolation 环境中五个业务服务可启动。
2. 关键业务流在 local schema isolation 环境下通过。
3. 所有跨 owner FK 的替代 runtime validation 或 copied-id 策略已记录。
4. 数据迁移、停机/双写、回滚、补偿策略已形成单独文档。

## 表归属到目标 Schema

| Target Schema | Tables |
|:---|:---|
| `user_service` | `user`, `user_auth`, `sms_code`, `organizer_application` |
| `ticket_service` | `category`, `artist`, `tour`, `station`, `activity`, `venue`, `venue_application`, `session`, `ticket_type`, `ticket_type_area`, `session_seat`, `venue_area`, `venue_seat`, `reservation`, `seat`, `stock_log`, `venue_seat_layout_template`, `venue_seat_layout_template_section`, `venue_default_layout`, `venue_default_layout_section`, `activity_seat_layout`, `activity_seat_layout_section`, `session_seat_layout`, `session_seat_layout_section`, `seat_block`, `seat_override`, `ticket_group`, `layout_section` |
| `order_service` | `order`, `order_seat`, `order_snapshot` |
| `payment_service` | `payment`, `refund_request` |
| `notification_service` | `notification` |

Legacy removed feature tables (`review`, `moment`, old `reservation`) remain inventoried until a cleanup migration explicitly removes or reassigns them.

## 服务 Search Path 设计

| Service | Local Schema Search Path | Default Profile Impact |
|:---|:---|:---|
| `java-user` | `user_service,public` | 不改默认配置 |
| `java-ticket` | `ticket_service,public` | 不改默认配置 |
| `java-order` | `order_service,public` | 仅 `local-schema` profile |
| `java-payment` | `payment_service,public` | 仅 `local-schema` profile |
| `java-notification` | `notification_service,public` | 不改默认配置 |

试点顺序：先 `java-order`，再 `java-payment`。这两个服务已经移除主要跨 owner Mapper/Entity 依赖，且关键路径有测试覆盖。`java-user`、`java-ticket`、`java-notification` 的 search-path 配置等试点成功后再补，不在当前 J2 范围内改默认行为。

## 本地 Schema 准备草案

当前阶段不提供自动搬表脚本，避免误用到生产。若要手动做 local schema isolation，建议在 disposable database 中：

```sql
CREATE SCHEMA IF NOT EXISTS user_service;
CREATE SCHEMA IF NOT EXISTS ticket_service;
CREATE SCHEMA IF NOT EXISTS order_service;
CREATE SCHEMA IF NOT EXISTS payment_service;
CREATE SCHEMA IF NOT EXISTS notification_service;
```

然后按上表移动或重建表。移动前必须先完成本地跨 owner FK 删除候选验证，否则 PostgreSQL 会因跨 schema FK 和依赖关系阻塞实验。

示例，仅限本地 disposable database：

```sql
ALTER TABLE "order" SET SCHEMA order_service;
ALTER TABLE order_seat SET SCHEMA order_service;
ALTER TABLE order_snapshot SET SCHEMA order_service;
```

如果只验证 JDBC `currentSchema` 配置是否可加载，可以不移动表，仅运行 Maven 测试；多数单元测试不连接真实数据库。

## 本地自动执行脚本

当前提供受保护脚本用于 disposable local database：

```powershell
$env:OMNI_ALLOW_LOCAL_SCHEMA_ISOLATION="true"
powershell -ExecutionPolicy Bypass -File scripts/apply-local-schema-isolation.ps1 -IUnderstandThisIsLocalOnly
```

该脚本会：

1. 要求显式传入 `-IUnderstandThisIsLocalOnly`。
2. 要求环境变量 `OMNI_ALLOW_LOCAL_SCHEMA_ISOLATION=true`。
3. 拒绝连接非 `localhost` / `127.0.0.1` 主机。
4. 先运行 `scripts/check-local-schema-sql.ps1`。
5. 执行 `sql/local/20260520_drop_cross_owner_fks_local_only.sql`。
6. 执行 `sql/local/20260520_move_tables_to_service_schemas_local_only.sql`。

`scripts/check-local-schema-sql.ps1` 会静态检查搬表 SQL，禁止出现 `DROP TABLE`、`DROP COLUMN`、`TRUNCATE`、`DELETE FROM`、`UPDATE`、`INSERT INTO`、`DROP CONSTRAINT` 等破坏性或数据修改语句。

本脚本仍然不是生产迁移工具。

## 执行前准备

1. 停止依赖本地数据库的后端服务，避免实验期间写入数据。
2. 备份当前本地 `omni_ticket`，或确认可以通过 `sql/migrations/shared/` 和 `sql/seed.sql` 重建。
3. 确认本地库不是 staging / production 连接。
4. 先运行只读检查：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-service-boundaries.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-cross-owner-fks.ps1
```

## 应用本地 FK 删除候选

在仓库根目录确认 SQL 文件：

```powershell
sql/local/20260520_drop_cross_owner_fks_local_only.sql
```

执行前先在本地 PostgreSQL 中确认实际约束名。由于历史建表语句多数未显式命名 FK，候选 SQL 使用 PostgreSQL 默认命名规则 `<table>_<column>_fkey`。可以使用：

```sql
\d venue_application
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE contype = 'f'
ORDER BY conrelid::regclass::text, conname;
```

确认无误后，仅在本地库执行：

```powershell
psql -U postgres -d omni_ticket -f sql/local/20260520_drop_cross_owner_fks_local_only.sql
```

## 应用后验证

从仓库根目录运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-service-boundaries.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-cross-owner-fks.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-local-schema-sql.ps1
```

从 `java/` 目录运行：

```powershell
mvn test -pl java-payment,java-ticket,java-order -am --% -Dsurefire.failIfNoSpecifiedTests=false
```

如果后续执行 local schema search-path 实验，还需要分别验证试点服务的本地 profile 配置，不得影响默认配置。

## 启用 Local Schema Profile

当前提供五个本地 schema profile：

- `java/java-user/src/main/resources/application-local-schema.yml`
- `java/java-ticket/src/main/resources/application-local-schema.yml`
- `java/java-order/src/main/resources/application-local-schema.yml`
- `java/java-payment/src/main/resources/application-local-schema.yml`
- `java/java-notification/src/main/resources/application-local-schema.yml`

显式启用方式：

```powershell
mvn spring-boot:run -Dspring-boot.run.profiles=local-schema
```

或设置环境变量：

```powershell
$env:SPRING_PROFILES_ACTIVE="local-schema"
```

该 profile 会将 JDBC URL 加上 `currentSchema=<service_schema>,public`。默认 `application.yml` 不变。

Profile 对应关系：

| Service | Profile File | `currentSchema` |
|:---|:---|:---|
| `java-user` | `application-local-schema.yml` | `user_service,public` |
| `java-ticket` | `application-local-schema.yml` | `ticket_service,public` |
| `java-order` | `application-local-schema.yml` | `order_service,public` |
| `java-payment` | `application-local-schema.yml` | `payment_service,public` |
| `java-notification` | `application-local-schema.yml` | `notification_service,public` |

## 试点验证顺序

1. 不启用 profile，运行默认关键测试，确认没有回归。
2. 启用 `java-order` 的 `local-schema` profile，在 disposable database 上启动服务。
3. 验证下单路径仍通过内部 API 获取 ticket/user 数据，而不是本地查 ticket/user 表。
4. 启用 `java-payment` 的 `local-schema` profile，在 disposable database 上启动服务。
5. 验证支付/退款路径仍通过 order/user/ticket internal API。
6. 只有两个试点都通过后，才考虑给 `java-user`、`java-ticket`、`java-notification` 增加同类 profile。

## 回滚方式

本地实验的回滚方式是重建本地数据库：

1. 删除本地 `omni_ticket`。
2. 重新执行 `sql/migrations/shared/` 下的增量 SQL。
3. 重新执行 `sql/seed.sql`。
4. 重新运行边界脚本、FK 脚本和关键 Maven 测试。

不要试图在生产环境“补回”本地实验变更；该 SQL 从一开始就不允许进入生产。

## 当前仍不允许做的事

- 不允许删除生产 FK。
- 不允许物理拆分数据库。
- 不允许修改默认服务配置指向不同 schema。
- 不允许引入 MQ/outbox 替代当前同步内部 API。
- 不允许新增跨服务 Mapper、Entity、SQL join 或数据库 FK。

## 进入下一阶段的条件

- 服务边界脚本通过。
- 跨 owner FK 脚本通过，并且任何新增 FK 都已分类。
- `java-payment`、`java-ticket`、`java-order` 关键测试通过。
- 本地 FK 删除候选只在 disposable database 验证过，没有进入生产迁移链路。
- 五个业务服务 local schema profile 检查通过。
- 生产迁移安全门禁未满足前，不进入物理拆库。
