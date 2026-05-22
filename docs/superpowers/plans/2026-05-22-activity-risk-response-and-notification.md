# Activity Risk Response And Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Phase 3 and Phase 4 by handling risky artists on published activities, organizer restoration requests, admin restoration review, internal notifications, cast-change notices, and cast-change refund reasons.

**Architecture:** Keep ticket-owned risk workflow in `java-ticket`, notification records in `java-notification`, and refund persistence in `java-payment`. Services communicate via internal HTTP clients with `X-Internal-Token`; no cross-service database access or MQ is introduced.

**Tech Stack:** Java Spring Boot, OpenFeign, MyBatis-Plus, PostgreSQL, Next.js 16, React 19, Maven, pnpm.

---

## File Map

Backend ticket:

- Create `java/java-ticket/src/main/java/com/omni/ticket/entity/ActivityRiskResolution.java`.
- Create `java/java-ticket/src/main/java/com/omni/ticket/mapper/ActivityRiskResolutionMapper.java`.
- Create DTOs under `java/java-ticket/src/main/java/com/omni/ticket/dto/`: `ActivityRiskResolutionRequest`, `ActivityRiskResolutionReviewRequest`, `ActivityRiskResolutionResponse`, `NotificationMessageRequest`.
- Create `java/java-ticket/src/main/java/com/omni/ticket/client/NotificationInternalClient.java`.
- Modify `java/java-ticket/src/main/java/com/omni/ticket/entity/Activity.java` to add risk suspension fields.
- Modify `java/java-ticket/src/main/java/com/omni/ticket/service/ArtistGovernanceService.java` to invoke published-activity risk suspension after marking an artist risky.
- Create `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityRiskResponseService.java`.
- Modify `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityArtistService.java` to notify on lineup changes.
- Modify `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java` to expose risk resolution endpoints.

Backend notification:

- Create `java/java-notification/src/main/java/com/omni/notification/dto/InternalNotificationRequest.java`.
- Modify `java/java-notification/src/main/java/com/omni/notification/controller/NotificationController.java` for internal endpoint.
- Modify `java/java-notification/src/main/java/com/omni/notification/service/NotificationService.java` for in-app/todo creation.

Backend payment:

- Modify `java/java-payment/src/main/java/com/omni/payment/dto/ApplyRefundRequest.java` to add `reasonType`.
- Modify `java/java-payment/src/main/java/com/omni/payment/controller/RefundController.java` to pass reason type.
- Modify `java/java-payment/src/main/java/com/omni/payment/service/RefundService.java` to prefix cast-change refund reasons.

SQL:

- Create shared and production-split ticket migrations for `activity_risk_resolution` and activity risk fields.

Frontend:

- Add types and API wrappers for risk resolutions and cast-change refund reason.
- Add minimal organizer/admin risk resolution UI in existing console activity surfaces.

Verification:

- `mvn -pl java-ticket "-Dtest=ActivityRiskResponseServiceTest,ArtistGovernanceServiceTest,AdminControllerTest" test`
- `mvn -pl java-notification test`
- `mvn -pl java-payment test`
- `mvn test -pl java-ticket -am`
- `pnpm typecheck`
- `powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1`
- `powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1`
- `git diff --check`

## Task 1: Schema And Entities

- [ ] Add failing mapper/entity compile tests for `ActivityRiskResolution`.
- [ ] Create ticket migrations and Java entity/mapper.
- [ ] Extend `Activity` risk suspension fields.
- [ ] Run SQL safety check.

## Task 2: Notification Internal API

- [ ] RED: controller/service tests for invalid token and successful internal message insert.
- [ ] GREEN: add DTO, service method, and `/api/notification/internal/messages` endpoint.

## Task 3: Risk Suspension Workflow

- [ ] RED: tests that marking an artist risky suspends published activities containing that artist.
- [ ] RED: tests that affected sessions and ticket types are disabled.
- [ ] GREEN: implement `ActivityRiskResponseService.suspendPublishedActivitiesForRiskArtist()`.
- [ ] GREEN: call it from `ArtistGovernanceService.updateRisk()` when risk becomes `risky`.

## Task 4: Recovery Request And Review

- [ ] RED: tests for organizer submit, admin list, admin approve, admin reject.
- [ ] GREEN: implement risk resolution service and controller endpoints.
- [ ] GREEN: approve path reruns publishable artist/session/ticket validation before restoring sales.

## Task 5: Cast Change Notification And Refund Reason

- [ ] RED: activity lineup update test expects notification call for paid users when lineup changes.
- [ ] GREEN: notify paid users via notification internal client after lineup changes.
- [ ] RED: payment refund test expects `reasonType=cast_change` to prefix reason.
- [ ] GREEN: implement refund reason prefix.

## Task 6: Frontend Minimal UI

- [ ] Add API types/wrappers.
- [ ] Add organizer submit recovery action on activity list/detail where `publishStatus='risk_suspended'`.
- [ ] Add admin review page/section for pending risk resolutions.
- [ ] Add cast-change refund reason option on refund apply path if present.
- [ ] Run `pnpm typecheck`.

## Task 7: Final Verification And Single Commit

- [ ] Run all focused tests.
- [ ] Run full java-ticket tests.
- [ ] Run notification/payment tests.
- [ ] Run frontend typecheck.
- [ ] Run SQL and boundary checks.
- [ ] Run `git diff --check`.
- [ ] Commit all Phase 3/4 changes once after every task is complete.
