# Activity Artist Governance Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and superpowers:test-driven-development. Implement task-by-task. Do not write production behavior before a failing test.

**Goal:** Implement Phase 2 artist governance: artist submissions, admin review, risk marking, and activity publish blocking for unapproved or risky lineups.

**Architecture:** Keep all Phase 2 data and behavior inside `java-ticket`. Extend `artist` with review metadata, add an `ArtistGovernanceService` for submission/review/risk operations, and inject lineup validation into `ActivityAdminService.validatePublishable()`. Frontend adds minimal activity-form submission and admin review affordances without building a full artist CMS.

**Tech Stack:** Java Spring Boot, MyBatis-Plus, PostgreSQL, Next.js 16, React 19, TypeScript, Maven, pnpm.

---

## File Map

Backend files:

- Modify `java/java-ticket/src/main/java/com/omni/ticket/entity/Artist.java`: add review fields and `updateTime`.
- Create `java/java-ticket/src/main/java/com/omni/ticket/dto/ArtistSubmissionRequest.java`.
- Create `java/java-ticket/src/main/java/com/omni/ticket/dto/ArtistReviewRequest.java`.
- Create `java/java-ticket/src/main/java/com/omni/ticket/dto/ArtistRiskRequest.java`.
- Modify `java/java-ticket/src/main/java/com/omni/ticket/dto/ArtistSearchResponse.java`: expose review and risk status.
- Create `java/java-ticket/src/main/java/com/omni/ticket/service/ArtistGovernanceService.java`.
- Modify `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityAdminService.java`: inject activity lineup and artist mappers, block publish on invalid lineup.
- Modify `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`: add artist submission/review/risk endpoints.
- Create `java/java-ticket/src/test/java/com/omni/ticket/service/ArtistGovernanceServiceTest.java`.
- Modify `java/java-ticket/src/test/java/com/omni/ticket/service/ActivityAdminServiceTest.java`.
- Modify `java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java`.

SQL files:

- Create `sql/migrations/shared/20260522_activity_artist_governance_phase2.sql`.
- Create `sql/production-split/ticket/20260522_activity_artist_governance_phase2.sql`.
- Update `sql/seed.sql` only if needed to set explicit `review_status='approved'`.

Frontend files:

- Modify `frontend/src/types/api.ts`: add artist review fields and request types.
- Modify `frontend/src/lib/api.ts`: add submit/review/risk wrappers.
- Modify `frontend/src/components/activity-artist/ActivityArtistSelector.tsx`: show review/risk status and submission affordance.
- Create or modify minimal admin page for pending artist review.

Verification:

- `mvn -pl java-ticket "-Dtest=ArtistGovernanceServiceTest,ActivityAdminServiceTest,AdminControllerTest" test`
- `mvn test -pl java-ticket -am`
- `pnpm typecheck`
- `powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1`
- `powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1`
- `git diff --check`

---

## Task 1: Add Artist Governance Schema

- [ ] Write shared and prod-split migrations adding `review_status`, `review_note`, `submitted_by`, `reviewed_by`, `reviewed_at`, and `update_time` to `artist`.
- [ ] Make migration idempotent with `ADD COLUMN IF NOT EXISTS`.
- [ ] Backfill null `review_status` to `approved`, null `risk_status` to `normal`, and null `status` to `1` where appropriate.
- [ ] Extend `Artist` entity with matching fields.
- [ ] Run `powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1`.

## Task 2: TDD Artist Governance Service

- [ ] RED: add tests for organizer/admin submission creating `pending` artist.
- [ ] RED: add tests for admin approve/reject writing review metadata.
- [ ] RED: add tests for admin risk mark/clear writing risk metadata.
- [ ] Run focused tests and confirm they fail for missing service/API.
- [ ] GREEN: implement DTOs and `ArtistGovernanceService` minimally.
- [ ] Run focused tests and confirm pass.

## Task 3: TDD Publish Blocking

- [ ] RED: add `ActivityAdminServiceTest` cases for no lineup, pending artist, risky artist, and approved normal artist.
- [ ] Run focused tests and confirm failures.
- [ ] GREEN: inject `ActivityArtistMapper` and `ArtistMapper` into `ActivityAdminService` and extend `validatePublishable()`.
- [ ] Preserve existing session and ticket type publish checks.
- [ ] Run focused tests and confirm pass.

## Task 4: TDD Admin Controller Endpoints

- [ ] RED: add `AdminControllerTest` cases for submission, pending list, review, and risk update endpoints.
- [ ] Run focused tests and confirm failures.
- [ ] GREEN: add endpoints delegating to `ArtistGovernanceService`.
- [ ] Run focused tests and confirm pass.

## Task 5: Frontend Minimal Integration

- [ ] Extend API types for artist review/risk fields and governance requests.
- [ ] Add API wrappers for artist submission, pending list, review, and risk update.
- [ ] Update artist selector to show review/risk badges and allow submitting a missing artist for review.
- [ ] Add a minimal admin pending artist review page or section.
- [ ] Run `pnpm typecheck`.

## Task 6: Full Verification And Commit

- [ ] Run focused backend tests.
- [ ] Run `mvn test -pl java-ticket -am`.
- [ ] Run `pnpm typecheck`.
- [ ] Run production split SQL check.
- [ ] Run microservice boundary verification.
- [ ] Run `git diff --check`.
- [ ] Commit Phase 2 changes with a concise message.
