# Service Boundaries

## Goal

当前代码已完成逻辑边界收敛，并支持 `prod-split` profile 连接服务拆分库。默认 `application.yml` 仍保留历史共享库配置用于兼容旧阶段，但当前本机拆分联调不应再连接 `omni_ticket`。

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

- 历史默认 profile 仍指向共享库 `omni_ticket`；当前拆分联调必须使用 `prod-split` profile 或等价 datasource 覆盖。
- 本机物理拆分预演使用同一个 PostgreSQL 实例内的五个 database；这是本机拓扑限制，不是代码访问边界例外。
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

## Production Physical Split Assets

生产物理拆库只能在 Production Migration Safety Gate 通过后执行，并以以下已批准资产为准。当前资产已准备且可用于受控预演，但这不等于允许 staging / production cutover；实际 cutover 仍必须完成门禁清单并获得明确批准。

- 设计规格：`docs/superpowers/specs/2026-05-20-production-physical-db-split-design.md`。
- 实施计划：`docs/superpowers/plans/2026-05-20-production-physical-db-split-implementation.md`。
- 迁移清单：`sql/production-split/manifest.json`。
- 生产拆库 SQL：`sql/production-split/user/`、`sql/production-split/ticket/`、`sql/production-split/order/`、`sql/production-split/payment/`、`sql/production-split/notification/`。
- SQL 检查脚本：`scripts/check-production-split-sql.ps1`。
- 数据导出脚本：`scripts/export-production-split.ps1`。
- 数据导入脚本：`scripts/import-production-split.ps1`。
- 运行时验证脚本：`scripts/verify-production-split-runtime.ps1`。
- 切换清单：`docs/operations/production-db-split-cutover-checklist.md`。

生产迁移 SQL 禁止复用 `sql/local/*`；本地 schema isolation SQL 只服务 disposable local database，不是 staging / production migration 的输入。五个业务服务切换生产物理拆库时，必须统一使用 `prod-split` profile 或等价环境变量配置，确保 user/ticket/order/payment/notification 同时指向拆分后的服务数据库。禁止共享库和拆分库混用，也禁止仅切换部分服务后开放业务流量。

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
