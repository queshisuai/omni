# Phase H-K True Microservice Decoupling Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Omni from code-level service boundary discipline toward independently evolvable microservices without breaking the current ticket purchase flow.

**Architecture:** Continue the safe sequence: runtime validation, cross-owner FK removal readiness, local schema isolation, resilience hardening, then optional physical database split. Do not split databases until service tests and local schema isolation prove that runtime code no longer depends on cross-owner joins or database-enforced cross-owner integrity.

**Tech Stack:** Java 17, Spring Boot, Spring Cloud OpenFeign, MyBatis-Plus, PostgreSQL, Maven, PowerShell, Markdown docs.

---

## Current Baseline

Phase F-G is complete and verified:

- `scripts/check-service-boundaries.ps1` verifies production code boundary rules.
- `docs/microservices/service-boundaries.md` documents current service rules and next milestones.
- `docs/microservices/table-ownership.md` maps SQL tables to owning services.
- `docs/microservices/cross-service-db-constraints.md` inventories cross-owner foreign keys and readiness criteria.
- Boundary verification passed: `powershell -ExecutionPolicy Bypass -File scripts/check-service-boundaries.ps1`.
- Maven verification passed: `mvn test -pl java-payment,java-ticket,java-order -am --% -Dsurefire.failIfNoSpecifiedTests=false`.

## Guiding Principles

- Runtime correctness comes before physical database split.
- Shared database is now a deployment exception, not permission to add cross-service SQL dependencies.
- Every cross-owner FK must have explicit runtime validation through the owning service before removal.
- Data copied across service boundaries must be treated as snapshots, not a second source of truth.
- New internal APIs must require `X-Internal-Token`; empty token config is invalid.
- Prefer local-only experiments before staging or production changes.

## Target End State

- `java-user` owns identity, roles, authentication support data, and organizer applications.
- `java-ticket` owns catalog, venue, session, ticket type, inventory, seats, and SeatCraft data.
- `java-order` owns order lifecycle, order seats, and order snapshots.
- `java-payment` owns payment and refund transaction state.
- `java-notification` owns notification delivery records and stores copied identifiers only.
- Services communicate through internal APIs or future events, not cross-owner Mapper, Entity, SQL join, or database FK dependencies.
- Local development can run with service-owned schemas and no cross-owner FKs.

## Phase H: Runtime Validation Before FK Removal

**Goal:** Prove important cross-owner identifiers are validated by the owning service at runtime instead of relying only on PostgreSQL FKs.

### Task H1: Order User Validation

**Files:**
- Modify or create: `java/java-order/src/main/java/com/omni/order/client/UserInternalClient.java`
- Modify: `java/java-order/src/main/java/com/omni/order/service/OrderService.java`
- Test: `java/java-order/src/test/java/com/omni/order/service/OrderSeatServiceTest.java`

- [ ] Add a failing test proving order creation rejects a nonexistent or disabled user before writing an order.
- [ ] Implement minimal internal user validation in `OrderService` using `java-user` internal API.
- [ ] Run `mvn test -pl java-order -am --% -Dsurefire.failIfNoSpecifiedTests=false`.
- [ ] Run `powershell -ExecutionPolicy Bypass -File scripts/check-service-boundaries.ps1`.

### Task H2: Payment Order Validation

**Files:**
- Modify: `java/java-payment/src/main/java/com/omni/payment/client/OrderInternalClient.java` if present, otherwise create the minimal client.
- Modify payment creation or payment status service classes under `java/java-payment/src/main/java/com/omni/payment/service/`.
- Test: `java/java-payment/src/test/java/com/omni/payment/service/AlipayServiceTest.java` or a new focused service test.

- [ ] Add a failing test proving payment creation or payment callback handling rejects missing or invalid orders through `java-order` internal API.
- [ ] Implement minimal order validation before payment state changes.
- [ ] Run `mvn test -pl java-payment -am --% -Dsurefire.failIfNoSpecifiedTests=false`.
- [ ] Run boundary guard script.

### Task H3: Notification Copied Id Policy

**Files:**
- Modify or create docs only first: `docs/microservices/notification-boundary.md`
- Later code files only if current notification service directly joins user/order tables.

- [ ] Search notification production code for user/order Mapper, Entity, and SQL joins.
- [ ] If violations exist, add failing tests before changing code.
- [ ] Convert notification runtime to accept copied `userId` and `orderId` from callers/events, without direct cross-owner DB validation.
- [ ] Extend `scripts/check-service-boundaries.ps1` to include notification checks.

## Phase I: Guardrails For Cross-Owner FKs

**Goal:** Make database boundary risks executable, not only documented.

### Task I1: Add Cross-Owner FK Check Script

**Files:**
- Create: `scripts/check-cross-owner-fks.ps1`
- Modify: `docs/microservices/cross-service-db-constraints.md`

- [ ] Create a script that scans `sql/*.sql` for `REFERENCES` and classifies known cross-owner patterns.
- [ ] Script must print each known cross-owner constraint category.
- [ ] Script must exit non-zero when it finds a new unclassified cross-owner reference.
- [ ] Add the script command to `docs/microservices/cross-service-db-constraints.md`.
- [ ] Run the new FK script and existing boundary script.

### Task I2: Local-Only FK Drop Candidate

**Files:**
- Create: `sql/local/20260520_drop_cross_owner_fks_local_only.sql`
- Modify: `docs/microservices/schema-isolation-runbook.md`

- [ ] Create a local-only SQL candidate that drops only inventoried cross-owner FKs.
- [ ] Do not wire this migration into production startup.
- [ ] Document how to restore or recreate the local database before applying it.
- [ ] Run service tests after applying it on a disposable local database.

## Phase J: Local Schema Isolation Trial

**Goal:** Prove services can run when tables are grouped by service-owned schemas in local development.

### Task J1: Schema Mapping Runbook

**Files:**
- Create: `docs/microservices/schema-isolation-runbook.md`

- [ ] Map each table from `docs/microservices/table-ownership.md` to a target schema: `user_service`, `ticket_service`, `order_service`, `payment_service`, `notification_service`.
- [ ] Document required datasource/search-path changes per service.
- [ ] Document rollback steps for local development.
- [ ] Explicitly mark the runbook as local-only until Phase H and I are complete.

### Task J2: Local Profile Experiment

**Files:**
- Modify service `application-local.yml` files only if they already exist; otherwise create local profile files with explicit naming.
- Do not change default `application.yml` production behavior.

- [ ] Add local schema search-path configuration for one pilot service, preferably `java-order`.
- [ ] Run `mvn test -pl java-order -am --% -Dsurefire.failIfNoSpecifiedTests=false`.
- [ ] If order passes, repeat for `java-payment`.
- [ ] Stop before changing staging or production configuration.

## Phase K: Runtime Resilience For Service Calls

**Goal:** Make internal API dependencies observable and predictable before physical split.

### Task K1: Internal Client Timeout And Error Mapping

**Files:**
- Modify Feign client configuration files under each Java service as needed.
- Modify service tests for order/payment/ticket boundary clients.

- [ ] Add tests for downstream timeout/error mapping in order and payment services.
- [ ] Ensure internal API failures return deterministic business errors instead of raw 500s where practical.
- [ ] Keep retry behavior conservative; do not retry non-idempotent stock or payment state transitions by default.
- [ ] Run `mvn test -pl java-payment,java-ticket,java-order -am --% -Dsurefire.failIfNoSpecifiedTests=false`.

### Task K2: Integration Verification Script

**Files:**
- Create: `scripts/verify-microservice-boundaries.ps1`

- [ ] Compose existing checks into one local command: boundary script, FK script, key Maven tests.
- [ ] Print a clear summary of each check.
- [ ] Exit non-zero on the first failed check.
- [ ] Document the command in `docs/microservices/service-boundaries.md`.

## Recommended Execution Order

1. H1: Order user validation.
2. H2: Payment order validation.
3. H3: Notification boundary check and copied id policy.
4. I1: Cross-owner FK script.
5. K1: Internal client error mapping for the paths touched so far.
6. I2: Local-only FK drop candidate.
7. J1: Schema isolation runbook.
8. J2: Local schema pilot.
9. K2: One-command verification script.

## Do Not Do Yet

- Do not physically split databases.
- Do not remove production FKs.
- Do not introduce MQ/outbox before the synchronous boundary is stable.
- Do not rewrite services or introduce a new persistence framework.
- Do not change frontend flows unless backend error contracts require visible handling.

## Acceptance Criteria

- Existing purchase, payment, refund, and order list unit tests continue passing.
- Boundary script remains green.
- Cross-owner FK script exists and reports known risks.
- Every cross-owner FK either has runtime validation or is marked legacy cleanup.
- A local-only schema isolation runbook exists.
- At least one service has been proven against a local schema isolation profile before any production split proposal.

## Verification Commands

Run from repository root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-service-boundaries.ps1
```

Run from `java/`:

```powershell
mvn test -pl java-payment,java-ticket,java-order -am --% -Dsurefire.failIfNoSpecifiedTests=false
```

After Phase I1 exists, also run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-cross-owner-fks.ps1
```

## Self-Review

- Spec coverage: advances true low coupling through runtime validation, executable FK guardrails, local schema isolation, and service-call resilience.
- Placeholder scan: no TODO/TBD placeholders.
- Scope control: avoids physical split, production FK removal, MQ/outbox, and frontend churn until current boundaries are proven.
- Type consistency: phase names and commands match existing Maven and PowerShell usage.
