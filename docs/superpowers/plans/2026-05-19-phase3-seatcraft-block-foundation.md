# Phase 3 SeatCraft Block Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce the SeatCraft free block DTO and backend seat geometry generator for grid, arc, and standing blocks without replacing the existing frontend editor yet.

**Architecture:** Backend first. Add DTOs and a focused geometry service with tests. Existing section-based endpoints remain untouched until the frontend block editor and migration services are ready.

**Tech Stack:** Java, Spring Boot, JUnit 5, Maven.

---

## Task 1: SeatCraftBlockDtos

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/SeatCraftBlockDtos.java`

- [ ] **Step 1: Create DTO classes**

Define:

- `LayoutRequest`
- `BlockRequest`
- `OverrideRequest`
- `TicketGroupRequest`

Use `BigDecimal` for coordinate and price fields.

## Task 2: Geometry Service

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/SeatBlockGeometryService.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/SeatBlockGeometryServiceTest.java`

- [ ] **Step 1: Write tests**

Required tests:

- grid block generates rows * cols seats.
- hidden/deleted overrides are excluded.
- custom label override replaces generated label.
- dx/dy override changes generated x/y.
- arc block generates rows * seatsPerRow seats with non-zero curved x/y distribution.
- standing block generates no individual seats but count uses capacity.

- [ ] **Step 2: Implement geometry service**

Public API:

```java
public List<GeneratedSeat> generateSeats(SeatBlock block, List<SeatOverride> overrides)
public int countSellableSeats(SeatBlock block, List<SeatOverride> overrides)
```

Nested generated seat fields:

- rowNo
- seatNo
- label
- x
- y
- blockId
- blockKey
- ticketGroupKey

Rules:

- `gridBlock`: x = block.x + (seatNo - 1) * seatSpacing, y = block.y + (rowNo - 1) * rowSpacing.
- `arcBlock`: each row radius = innerRadius + (rowNo - 1) * rowSpacing; angle interpolates from arcStartAngle to arcEndAngle.
- `standingBlock`: generateSeats returns empty list; countSellableSeats returns capacity.
- `hidden` and `deleted` overrides exclude seats.
- `visible` override may set dx/dy/customLabel.

## Task 3: Verification

- [ ] **Step 1: Run tests**

```powershell
cd C:\Users\Administrator\Desktop\omni\java
mvn test -pl java-ticket -am
```

Expected: BUILD SUCCESS.
