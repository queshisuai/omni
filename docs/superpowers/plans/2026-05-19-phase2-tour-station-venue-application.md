# Phase 2 Tour/Station Venue Application Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add backend draft Tour/Station APIs and enforce VenueApplication validity/proof snapshot fields while preserving existing admin endpoints.

**Architecture:** Keep Phase 2 focused on java-ticket backend only. Add `TourStationService` and controller endpoints, extend `VenueApplicationService.submit()` validation and persistence, and update tests.

**Tech Stack:** Spring Boot, MyBatis-Plus, PostgreSQL, JUnit 5, Mockito, Maven.

---

## Task 1: TourStationService

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/TourStationService.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/TourStationServiceTest.java`

- [ ] **Step 1: Create tests**

Test cases:

- organizer can create tour draft.
- admin can create tour draft for provided organizerId.
- non admin/organizer rejected.
- organizer can create station draft for own tour.
- organizer cannot create station draft for other organizer tour.

- [ ] **Step 2: Implement service**

`createTourDraft(Long userId, Map<String,Object> body)`:

- require admin or organizer.
- require nonblank `title`.
- organizerId = body.organizerId only for admin; organizer uses own userId.
- status = 1.
- reviewStatus = `draft`.

`createStationDraft(Long userId, Long tourId, Map<String,Object> body)`:

- require admin or owner organizer.
- require city and stationName.
- status = 1.
- publishStatus = `draft`.

## Task 2: Controller endpoints

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Modify test: `java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java`

- [ ] **Step 1: Inject TourStationService**

Add field and constructor parameter.

- [ ] **Step 2: Add endpoints**

```java
@PostMapping("/tours/draft")
public Result<Tour> createTourDraft(@RequestBody Map<String, Object> body) {
    Long userId = parsePositiveLong(body == null ? null : body.get("userId"));
    return Result.success(tourStationService.createTourDraft(userId, body));
}

@PostMapping("/tours/{tourId}/stations/draft")
public Result<Station> createStationDraft(@PathVariable Long tourId, @RequestBody Map<String, Object> body) {
    Long userId = parsePositiveLong(body == null ? null : body.get("userId"));
    return Result.success(tourStationService.createStationDraft(userId, tourId, body));
}
```

## Task 3: VenueApplication validation and persistence

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/VenueApplicationService.java`
- Modify test: `java/java-ticket/src/test/java/com/omni/ticket/service/VenueApplicationServiceTest.java`

- [ ] **Step 1: Submit persists new fields**

Persist:

- validFrom
- validTo
- proofNote
- proofFileUrl
- layoutSnapshot
- setAsRecommendedLayout

- [ ] **Step 2: Submit validates required fields**

Validation:

- validFrom required.
- validTo required and after validFrom.
- proofNote or proofFileUrl required.
- layoutSnapshot required and nonblank for now.

## Task 4: Verification

- [ ] **Step 1: Run compile**

```powershell
cd C:\Users\Administrator\Desktop\omni\java
mvn compile -pl java-ticket -am -DskipTests
```

- [ ] **Step 2: Run tests**

```powershell
cd C:\Users\Administrator\Desktop\omni\java
mvn test -pl java-ticket -am
```

Expected: BUILD SUCCESS, all tests pass.
