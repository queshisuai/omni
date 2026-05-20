# Service Boundaries

## Goal

当前阶段采用逻辑解耦优先策略：服务仍共用同一个 PostgreSQL 实例，但生产代码必须遵守服务数据所有权，不能通过 Mapper 或 SQL 直接读取其他服务拥有的表。

## Ownership

| Service | Owns |
|:---|:---|
| java-user | `user`, `organizer_application` |
| java-ticket | `tour`, `station`, `activity`, `venue`, `venue_application`, `session`, `ticket_type`, `session_seat`, SeatCraft tables |
| java-order | `order`, `order_seat` |
| java-payment | payment and refund transaction tables |
| java-notification | notification tables |
| java-gateway | no business tables |

## Rules

- `java-ticket` must call `java-user` internal API for user role and status.
- `java-order` must call `java-ticket` internal API for ticket price, stock, seat lock, sold confirmation, release, and refund stock changes.
- `java-order` must use `order_snapshot` for order list/detail display fields that originate from ticket-owned data.
- `java-payment` must call `java-order` internal API for order status changes and order detail.
- `java-payment` must call `java-user` internal API for refund reviewer role checks.
- `java-payment` must call `java-ticket` internal API for organizer refund-review ownership checks.
- New internal endpoints must require `X-Internal-Token`.
- Empty internal token configuration is invalid for cross-service calls.
- New SQL migration files must include an owner comment at the top.

## Current Exceptions

- 服务仍共用同一个 PostgreSQL 数据库实例；这是部署拓扑例外，不是代码访问边界例外。
- 历史 SQL 迁移中仍存在跨服务外键；这些约束将在 schema isolation readiness 阶段清点并分批处理。
- 运行时代码不允许新增跨服务 Mapper、Entity 或 SQL join 访问。

## Production Migration Safety Gate

当前阶段禁止生产物理拆库。任何 staging / production 数据库拆分、生产 FK 删除、默认数据源 schema 切换，都必须先满足以下硬门禁：

1. `scripts/verify-microservice-boundaries.ps1` 在干净工作区通过。
2. `scripts/check-service-boundaries.ps1` 覆盖 `*.java` 与 `*.xml` 后仍无生产代码边界违规。
3. `scripts/check-cross-owner-fks.ps1` 无未知 cross-owner FK，且所有已知 cross-owner FK 都有 runtime replacement 记录。
4. 所有业务服务均有 `application-local-schema.yml`，且 `scripts/check-local-schema-profiles.ps1` 通过。
5. 在 disposable local database 上执行本地 schema isolation 验证，确认 order/payment/ticket/user/notification 服务均可使用各自 schema 启动。
6. 购票、支付、退款、订单列表、商户入驻审核等关键流在 local schema isolation 环境下通过手动或自动验收。
7. 已准备回滚方案：可恢复原共享库、原 FK、原默认配置。
8. 已明确数据迁移顺序、停机/双写策略、兼容窗口和失败补偿策略。

在以上条件满足前，`sql/local/*` 文件只能用于本地 disposable database，不得进入生产迁移链路。

## Explicitly Forbidden Until Gate Passes

- 不允许删除 staging / production FK。
- 不允许把 `sql/local/20260520_drop_cross_owner_fks_local_only.sql` 加入正式 migration。
- 不允许修改默认 `application.yml` 指向 service schema。
- 不允许直接拆成多个生产数据库。
- 不允许为绕过边界而新增跨服务 Mapper、Entity、XML mapper 或 SQL join。
- 不允许以 MQ/outbox 替代当前同步 internal API，除非另有独立设计、测试和回滚计划。

## Verification

Run from repository root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
```

The one-command verification runs the service boundary guard, the cross-owner FK inventory, local schema profile checks, local schema SQL safety checks, and key Java boundary tests. It exits non-zero on the first failed check.

Individual checks can still be run from repository root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-service-boundaries.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-cross-owner-fks.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-local-schema-profiles.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-local-schema-sql.ps1
```

Run from `java/`:

```powershell
mvn test -pl java-user -am --% -Dsurefire.failIfNoSpecifiedTests=false
mvn test -pl java-ticket -am --% -Dsurefire.failIfNoSpecifiedTests=false
mvn test -pl java-order -am --% -Dsurefire.failIfNoSpecifiedTests=false
mvn test -pl java-payment -am --% -Dsurefire.failIfNoSpecifiedTests=false
```

## Next Boundary Milestones

1. Boundary guard script must be run after any service integration change.
2. Cross-service foreign keys must be inventoried before schema split work.
3. Schema isolation should start with local development schemas, not production databases.
4. Physical database split is allowed only after the Production Migration Safety Gate passes.
