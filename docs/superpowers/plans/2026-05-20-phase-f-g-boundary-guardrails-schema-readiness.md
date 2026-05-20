# Phase F-G Boundary Guardrails And Schema Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock in the completed logical microservice boundaries with repeatable guardrails, then prepare the shared PostgreSQL database for future schema/database isolation.

**Architecture:** Phase F adds executable boundary checks and updates service ownership documentation so completed decoupling cannot silently regress. Phase G inventories cross-service foreign keys and creates a safe migration plan for replacing DB-level cross-service constraints with application/service-level validation before any physical split.

**Tech Stack:** Java 17, Spring Boot, Spring Cloud OpenFeign, MyBatis-Plus, PostgreSQL, Maven, PowerShell, ripgrep (`rg`), Markdown docs.

---

## Context

Phase E is complete and freshly verified:

- `java-payment` reviewer role lookup now calls `java-user` internal API.
- `java-ticket` exposes refund-review permission internal API.
- `java-payment` organizer refund-review permission now calls `java-ticket` internal API.
- `java-payment` ref entities/mappers have been deleted: `UserRef`, `SessionRef`, `ActivityRef`, `UserRefMapper`, `SessionRefMapper`, `ActivityRefMapper`.
- Verification run: `mvn test -pl java-payment,java-ticket,java-order -am --% -Dsurefire.failIfNoSpecifiedTests=false` succeeded with `java-ticket 130`, `java-order 24`, `java-payment 8` tests passing.
- Boundary grep for deleted payment ref mappers/entities returned no files.

Current code-level direction is good. The next reasonable move is not physical DB split yet. The next move is to make the boundary rules executable, documented, and visible in CI/local verification, then map DB-level constraints that would block schema isolation.

## Scope

In scope:

- Add a repo-local boundary verification script for service ownership rules.
- Update `docs/microservices/service-boundaries.md` with current Phase A-E reality.
- Add a migration/constraint inventory document for cross-service foreign keys.
- Add an owner map for tables and cross-service references.
- Define the next safe path for replacing cross-service database constraints.

Out of scope:

- Physical database split.
- Dropping foreign keys in production.
- Introducing MQ/outbox.
- Frontend changes.
- Runtime behavior changes.
- Committing code.

## Target Boundary After Phase F-G

- `java-ticket` must not directly read user-owned tables through mapper/entity references.
- `java-order` must not directly read ticket-owned tables through mapper/entity references or SQL joins for runtime order logic/display.
- `java-payment` must not directly read user/ticket/order-owned tables except through its own payment/refund tables and internal clients.
- Boundary checks are executable with one command and documented.
- Cross-service foreign keys are inventoried before any schema split decisions.
- Future schema split can be planned from evidence rather than guesses.

## File Structure

Create:

- `scripts/check-service-boundaries.ps1`
  PowerShell guard script that runs grep-based boundary checks and exits non-zero on forbidden references.
- `docs/microservices/cross-service-db-constraints.md`
  Inventory of cross-service DB constraints and recommended treatment for schema isolation.
- `docs/microservices/table-ownership.md`
  Table owner map used by humans and future guardrails.
- `docs/superpowers/plans/2026-05-20-phase-f-g-boundary-guardrails-schema-readiness.md`
  This plan.

Modify:

- `docs/microservices/service-boundaries.md`
  Update ownership, remove stale exceptions, add current verification commands.
- `docs/superpowers/plans/2026-05-20-phase-e-f-payment-boundary-and-guardrails.md`
  Optional only if marking F1 as superseded by this more concrete plan; otherwise leave unchanged.

Do not modify:

- Java production code.
- Java tests.
- Frontend.
- SQL migrations in this phase, except docs inventory.

## Task F1: Boundary Guard Script

**Files:**
- Create: `scripts/check-service-boundaries.ps1`

- [ ] **Step 1: Create script parent directory**

Run from repo root:

```powershell
Test-Path -LiteralPath "scripts"
```

If output is `False`, create directory:

```powershell
New-Item -ItemType Directory -Path "scripts"
```

- [ ] **Step 2: Add boundary script**

Create `scripts/check-service-boundaries.ps1` with this content:

```powershell
$ErrorActionPreference = "Stop"

function Invoke-BoundaryCheck {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Pattern,
        [string[]]$Allowed = @()
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Boundary check path not found: $Path"
    }

    $matches = rg --line-number --glob "*.java" $Pattern $Path 2>$null
    if ($LASTEXITCODE -eq 1) {
        Write-Host "PASS $Name"
        return
    }
    if ($LASTEXITCODE -ne 0) {
        throw "rg failed for boundary check: $Name"
    }

    $violations = @($matches | Where-Object {
        $line = $_
        -not ($Allowed | Where-Object { $line -match $_ })
    })

    if ($violations.Count -gt 0) {
        Write-Host "FAIL $Name"
        $violations | ForEach-Object { Write-Host $_ }
        exit 1
    }

    Write-Host "PASS $Name"
}

Invoke-BoundaryCheck `
    -Name "ticket must not use user table refs" `
    -Path "java/java-ticket/src/main/java" `
    -Pattern "UserRefMapper|@TableName\(\"\\\"user\\\"\"\)|FROM\s+\\\"?user\\\"?|JOIN\s+\\\"?user\\\"?" `
    -Allowed @("InternalUserRefResponse", "UserInternalClient", "UserAccessService")

Invoke-BoundaryCheck `
    -Name "order must not use ticket table refs" `
    -Path "java/java-order/src/main/java" `
    -Pattern "TicketTypeMapper|SessionSeatMapper|ActivityMapper|SessionMapper|VenueMapper|JOIN\s+activity|JOIN\s+session|JOIN\s+venue|JOIN\s+ticket_type|JOIN\s+session_seat|FROM\s+activity|FROM\s+session|FROM\s+venue|FROM\s+ticket_type|FROM\s+session_seat"

Invoke-BoundaryCheck `
    -Name "payment must not use user ticket ref mappers" `
    -Path "java/java-payment/src/main/java" `
    -Pattern "UserRefMapper|SessionRefMapper|ActivityRefMapper|import com\.omni\.payment\.entity\.(UserRef|SessionRef|ActivityRef)|\bUserRef\b|\bSessionRef\b|\bActivityRef\b|FROM\s+\\\"?user\\\"?|FROM\s+session|FROM\s+activity|JOIN\s+\\\"?user\\\"?|JOIN\s+session|JOIN\s+activity" `
    -Allowed @("InternalUserRefResponse")

Write-Host "All service boundary checks passed."
```

- [ ] **Step 3: Run boundary script**

Run from repo root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-service-boundaries.ps1
```

Expected output includes:

```text
PASS ticket must not use user table refs
PASS order must not use ticket table refs
PASS payment must not use user ticket ref mappers
All service boundary checks passed.
```

## Task F2: Update Service Boundary Docs

**Files:**
- Modify: `docs/microservices/service-boundaries.md`

- [ ] **Step 1: Replace stale current exceptions**

Current stale exceptions say `java-order` still reads ticket tables. Replace `## Current Exceptions` with:

```markdown
## Current Exceptions

- 服务仍共用同一个 PostgreSQL 数据库实例；这是部署拓扑例外，不是代码访问边界例外。
- 历史 SQL 迁移中仍存在跨服务外键；这些约束将在 schema isolation readiness 阶段清点并分批处理。
- 运行时代码不允许新增跨服务 Mapper、Entity 或 SQL join 访问。
```

- [ ] **Step 2: Update rules**

Replace `## Rules` with:

```markdown
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
```

- [ ] **Step 3: Update verification section**

Replace `## Verification` with:

```markdown
## Verification

Run from repository root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-service-boundaries.ps1
```

Run from `java/`:

```powershell
mvn test -pl java-user -am --% -Dsurefire.failIfNoSpecifiedTests=false
mvn test -pl java-ticket -am --% -Dsurefire.failIfNoSpecifiedTests=false
mvn test -pl java-order -am --% -Dsurefire.failIfNoSpecifiedTests=false
mvn test -pl java-payment -am --% -Dsurefire.failIfNoSpecifiedTests=false
```
```

- [ ] **Step 4: Run script and affected tests**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-service-boundaries.ps1
```

Run from `java/`:

```powershell
mvn test -pl java-payment,java-ticket,java-order -am --% -Dsurefire.failIfNoSpecifiedTests=false
```

Expected: boundary script passes and Maven shows `BUILD SUCCESS`.

## Task G1: Table Ownership Document

**Files:**
- Create: `docs/microservices/table-ownership.md`

- [ ] **Step 1: Create ownership map**

Create `docs/microservices/table-ownership.md`:

```markdown
# Table Ownership

This project is still deployed on one PostgreSQL database, but table ownership follows service boundaries.

| Table / Group | Owner | Notes |
|:---|:---|:---|
| `"user"` | `java-user` | User identity, role, account status |
| `organizer_application` | `java-user` | Organizer application workflow |
| `category`, `artist` | `java-ticket` | Ticket catalog metadata |
| `tour`, `station` | `java-ticket` | Tour/station catalog |
| `activity`, `session`, `ticket_type`, `session_seat` | `java-ticket` | Activity, schedule, inventory, seats |
| `venue`, `venue_area`, `venue_seat`, `venue_application` | `java-ticket` | Venue and organizer venue requests |
| SeatCraft tables | `java-ticket` | Layout templates, blocks, overrides |
| `"order"`, `order_seat`, `seat_lock` | `java-order` | Orders, seat selections, temporary locks |
| `order_snapshot` | `java-order` | Immutable order display snapshot copied from ticket quote |
| `payment`, `refund_request`, payment log tables | `java-payment` | Payment and refund transaction records |
| notification tables | `java-notification` | Notifications only |
```

- [ ] **Step 2: Validate owner map against SQL**

Run from repo root:

```powershell
rg "CREATE TABLE|CREATE TABLE IF NOT EXISTS|ALTER TABLE" sql
```

Expected: any table not represented in `table-ownership.md` is added before continuing.

## Task G2: Cross-Service Constraint Inventory

**Files:**
- Create: `docs/microservices/cross-service-db-constraints.md`

- [ ] **Step 1: Generate raw reference list**

Run from repo root:

```powershell
rg "REFERENCES|FOREIGN KEY" sql
```

Use the output to classify constraints.

- [ ] **Step 2: Create constraint inventory doc**

Create `docs/microservices/cross-service-db-constraints.md` with this structure:

```markdown
# Cross-Service Database Constraint Inventory

The system still uses one PostgreSQL database. This document identifies constraints that will block future schema/database isolation.

## Classification

- `same-owner`: both tables are owned by the same service; safe to keep when splitting by schema/database inside that service.
- `cross-owner`: child and parent tables are owned by different services; must be replaced before physical split.
- `legacy-unused`: table belongs to removed feature or dead path; candidate for later cleanup.

## Known Cross-Owner Constraints

| SQL File | Child Table / Column | References | Current Runtime Replacement | Proposed Treatment |
|:---|:---|:---|:---|:---|
| `sql/init.sql` | `activity.organizer_id` | `"user"(id)` | `java-ticket -> java-user` internal API for role/status | Keep during shared DB; replace with application validation before schema split |
| `sql/init.sql` | `"order".user_id` | `"user"(id)` | JWT user id and order service validation | Keep during shared DB; remove before physical split after user existence validation is explicit |
| `sql/init.sql` | `"order".session_id` | `session(id)` | `java-order -> java-ticket` quote API and `order_snapshot` | Candidate to drop before schema split after order create tests cover missing session |
| `sql/init.sql` | `"order".ticket_type_id` | `ticket_type(id)` | `java-order -> java-ticket` quote API | Candidate to drop before schema split after order create tests cover missing ticket type |
| `sql/init.sql` | `order_seat.session_seat_id` | `session_seat(id)` | `java-order -> java-ticket` seat lock/confirm APIs | Candidate to replace with copied seat id only before schema split |
| `sql/init.sql` | `payment.order_id` | `"order"(id)` | `java-payment -> java-order` internal API | Candidate to drop before schema split after payment create validates order through API |
| `sql/init.sql` | `refund_request.user_id` | `"user"(id)` | `java-payment -> java-user` internal API for reviewer only; applicant comes from order | Review before split; likely store copied user id without FK |
| `sql/init.sql` | `refund_request.payment_id` | `payment(id)` | same owner | `same-owner`, keep |
```

## Next Migration Strategy

1. Do not drop constraints in the current phase.
2. Add tests proving services reject invalid cross-owner ids via internal APIs.
3. Add optional local profile that disables cross-owner FKs only after tests exist.
4. Move services to separate schemas after constraints are either same-owner or removed.
```

- [ ] **Step 3: Re-run raw reference list and update doc**

Run:

```powershell
rg "REFERENCES|FOREIGN KEY" sql
```

Expected: any high-risk cross-owner constraint not represented in the doc is added.

## Task G3: Schema Isolation Readiness Decision Point

**Files:**
- Modify: `docs/microservices/cross-service-db-constraints.md`
- Modify: `docs/microservices/service-boundaries.md`

- [ ] **Step 1: Add readiness checklist**

Append to `docs/microservices/cross-service-db-constraints.md`:

```markdown
## Schema Isolation Readiness Checklist

- [ ] Boundary script passes with no production code violations.
- [ ] `java-user`, `java-ticket`, `java-order`, and `java-payment` tests pass independently.
- [ ] Every cross-owner FK has a documented runtime API validation path.
- [ ] No production service depends on database joins across owner boundaries.
- [ ] A local-only schema split profile is planned before any staging/production split.
```

- [ ] **Step 2: Add roadmap to service boundaries doc**

Append to `docs/microservices/service-boundaries.md`:

```markdown
## Next Boundary Milestones

1. Boundary guard script must be run after any service integration change.
2. Cross-service foreign keys must be inventoried before schema split work.
3. Schema isolation should start with local development schemas, not production databases.
4. Physical database split is allowed only after service tests pass without cross-owner DB constraints.
```

- [ ] **Step 3: Final verification**

Run from repo root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-service-boundaries.ps1
```

Run from `java/`:

```powershell
mvn test -pl java-payment,java-ticket,java-order -am --% -Dsurefire.failIfNoSpecifiedTests=false
```

Expected: all pass.

## DeepSeek Task Split

- DeepSeek F1: Add `scripts/check-service-boundaries.ps1` and verify it passes.
- DeepSeek F2: Update `docs/microservices/service-boundaries.md` to reflect Phase A-E completion and new guard script.
- DeepSeek G1: Create `docs/microservices/table-ownership.md`.
- DeepSeek G2: Create `docs/microservices/cross-service-db-constraints.md` from SQL FK inventory.
- DeepSeek G3: Add readiness checklist and final verification.

Each task should be reviewed before moving to the next. Do not execute F1-G3 in one batch unless explicitly requested.

## Self-Review

- Spec coverage: continues toward true microservice low coupling by preventing code boundary regressions and preparing DB-level isolation.
- Placeholder scan: no TBD/TODO placeholders.
- Scope control: does not drop DB constraints or attempt physical split prematurely.
- Type consistency: no Java API shape changes in this plan.
