# Prod Split Real Demo Seed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Project rule override: do not commit.

**Goal:** Build a local-only real demo seed package for `prod-split` databases.

**Architecture:** Keep seed SQL outside production migrations, split files by service-owned database, and reference downloaded local poster assets. Use a verifier script to check coverage without writing to databases.

**Tech Stack:** PostgreSQL SQL, PowerShell, Next.js public assets.

---

### Task 1: Coverage Verifier

**Files:**
- Create: `scripts/verify-prod-split-real-demo-seed.ps1`

- [ ] Add a read-only verifier that checks generated files exist, poster count is at least 120, SQL files are present for each service, and the ticket seed contains 120 activity rows.
- [ ] Run the verifier before seed files exist and confirm it reports missing files.

### Task 2: Poster Assets

**Files:**
- Create: `frontend/public/seed-posters-real/*`
- Create: `sql/seeds/prod-split-real-demo/posters.json`

- [ ] Download matched public poster images for real activity titles.
- [ ] Store source URL and local path in `posters.json`.
- [ ] Keep files under the demo asset folder only.

### Task 3: Service Seed SQL

**Files:**
- Create: `sql/seeds/prod-split-real-demo/README.md`
- Create: `sql/seeds/prod-split-real-demo/01-ticket.sql`
- Create: `sql/seeds/prod-split-real-demo/02-order.sql`
- Create: `sql/seeds/prod-split-real-demo/03-payment.sql`
- Create: `sql/seeds/prod-split-real-demo/04-user-ops.sql`
- Create: `sql/seeds/prod-split-real-demo/05-notification.sql`
- Create: `sql/seeds/prod-split-real-demo/06-grab.sql`

- [ ] Generate idempotent inserts in a reserved seed id range.
- [ ] Ensure copied ids line up across order/payment/notification/grab records.
- [ ] Use Chinese user-visible seed text.

### Task 4: Optional Apply Script

**Files:**
- Create: `scripts/apply-prod-split-real-demo-seed.ps1`

- [ ] Add a script that applies each SQL file to the correct local database.
- [ ] Require an explicit `-ConfirmApply` switch before any database write.
- [ ] Do not run this script during implementation.

### Task 5: Verification

**Files:**
- Modify only if verifier finds a real seed defect.

- [ ] Run `scripts/verify-prod-split-real-demo-seed.ps1`.
- [ ] Run `powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1`.
- [ ] Run `git diff --check`.
