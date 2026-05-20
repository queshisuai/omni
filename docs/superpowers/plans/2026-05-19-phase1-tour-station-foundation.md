# Phase 1 Tour/Station Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the database and Java model foundation for Tour/Station, venue application validity/proof fields, and SeatCraft block/ticket group storage without changing user-facing workflows yet.

**Architecture:** Additive migration only: new tables and nullable columns are introduced while keeping existing Activity/Session flows compiling. Java entities and mappers mirror the new schema, but business services remain mostly untouched until Phase 2.

**Tech Stack:** PostgreSQL, Spring Boot, MyBatis-Plus, Maven.

---

## Task 1: Database Migration

**Files:**
- Create: `sql/20260519_tour_station_foundation.sql`

- [ ] **Step 1: Write migration SQL**

```sql
CREATE TABLE IF NOT EXISTS tour (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(160) NOT NULL,
    artist_id BIGINT,
    category_id BIGINT,
    poster VARCHAR(500),
    description TEXT,
    organizer_id BIGINT NOT NULL,
    review_status VARCHAR(30) NOT NULL DEFAULT 'draft',
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS station (
    id BIGSERIAL PRIMARY KEY,
    tour_id BIGINT NOT NULL REFERENCES tour(id),
    city VARCHAR(80) NOT NULL,
    station_name VARCHAR(120) NOT NULL,
    poster VARCHAR(500),
    description TEXT,
    venue_application_id BIGINT,
    publish_status VARCHAR(30) NOT NULL DEFAULT 'draft',
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE activity ADD COLUMN IF NOT EXISTS tour_id BIGINT;
ALTER TABLE activity ADD COLUMN IF NOT EXISTS station_id BIGINT;
ALTER TABLE activity ADD COLUMN IF NOT EXISTS venue_application_id BIGINT;
ALTER TABLE activity ADD COLUMN IF NOT EXISTS publish_status VARCHAR(30) NOT NULL DEFAULT 'published';

ALTER TABLE venue_application ADD COLUMN IF NOT EXISTS valid_from TIMESTAMP;
ALTER TABLE venue_application ADD COLUMN IF NOT EXISTS valid_to TIMESTAMP;
ALTER TABLE venue_application ADD COLUMN IF NOT EXISTS proof_note TEXT;
ALTER TABLE venue_application ADD COLUMN IF NOT EXISTS proof_file_url VARCHAR(500);
ALTER TABLE venue_application ADD COLUMN IF NOT EXISTS layout_snapshot JSONB;
ALTER TABLE venue_application ADD COLUMN IF NOT EXISTS set_as_recommended_layout BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS seat_block (
    id BIGSERIAL PRIMARY KEY,
    owner_type VARCHAR(30) NOT NULL,
    owner_id BIGINT NOT NULL,
    block_key VARCHAR(80) NOT NULL,
    name VARCHAR(120) NOT NULL,
    block_type VARCHAR(30) NOT NULL,
    ticket_group_key VARCHAR(80) NOT NULL,
    x NUMERIC(10,2) NOT NULL DEFAULT 0,
    y NUMERIC(10,2) NOT NULL DEFAULT 0,
    rotation NUMERIC(8,2) NOT NULL DEFAULT 0,
    scale NUMERIC(8,3) NOT NULL DEFAULT 1,
    rows INTEGER,
    cols INTEGER,
    seats_per_row INTEGER,
    row_spacing NUMERIC(10,2),
    seat_spacing NUMERIC(10,2),
    inner_radius NUMERIC(10,2),
    arc_start_angle NUMERIC(8,2),
    arc_end_angle NUMERIC(8,2),
    width NUMERIC(10,2),
    height NUMERIC(10,2),
    capacity INTEGER,
    color VARCHAR(20) NOT NULL DEFAULT '#ff1268',
    sort INTEGER NOT NULL DEFAULT 0,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_seat_block_owner CHECK (owner_type IN ('venue', 'venue_application', 'station', 'activity', 'session')),
    CONSTRAINT chk_seat_block_type CHECK (block_type IN ('gridBlock', 'arcBlock', 'standingBlock')),
    CONSTRAINT uq_seat_block_key UNIQUE (owner_type, owner_id, block_key)
);

CREATE TABLE IF NOT EXISTS seat_override (
    id BIGSERIAL PRIMARY KEY,
    block_id BIGINT NOT NULL REFERENCES seat_block(id) ON DELETE CASCADE,
    row_no INTEGER NOT NULL,
    seat_no INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'visible',
    dx NUMERIC(10,2) NOT NULL DEFAULT 0,
    dy NUMERIC(10,2) NOT NULL DEFAULT 0,
    custom_label VARCHAR(80),
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_seat_override_status CHECK (status IN ('visible', 'hidden', 'deleted')),
    CONSTRAINT uq_seat_override_position UNIQUE (block_id, row_no, seat_no)
);

CREATE TABLE IF NOT EXISTS ticket_group (
    id BIGSERIAL PRIMARY KEY,
    owner_type VARCHAR(30) NOT NULL,
    owner_id BIGINT NOT NULL,
    group_key VARCHAR(80) NOT NULL,
    name VARCHAR(120) NOT NULL,
    default_price NUMERIC(10,2),
    activity_price NUMERIC(10,2),
    source_block_ids TEXT,
    sort INTEGER NOT NULL DEFAULT 0,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_ticket_group_owner CHECK (owner_type IN ('venue', 'venue_application', 'station', 'activity', 'session')),
    CONSTRAINT uq_ticket_group_key UNIQUE (owner_type, owner_id, group_key)
);

ALTER TABLE session_seat ADD COLUMN IF NOT EXISTS seat_block_id BIGINT;
ALTER TABLE session_seat ADD COLUMN IF NOT EXISTS ticket_group_key VARCHAR(80);
ALTER TABLE session_seat ADD COLUMN IF NOT EXISTS generated_row_no INTEGER;
ALTER TABLE session_seat ADD COLUMN IF NOT EXISTS generated_seat_no INTEGER;

CREATE INDEX IF NOT EXISTS idx_station_tour ON station(tour_id);
CREATE INDEX IF NOT EXISTS idx_activity_tour ON activity(tour_id);
CREATE INDEX IF NOT EXISTS idx_activity_station ON activity(station_id);
CREATE INDEX IF NOT EXISTS idx_activity_publish_status ON activity(publish_status);
CREATE INDEX IF NOT EXISTS idx_seat_block_owner ON seat_block(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_ticket_group_owner ON ticket_group(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_session_seat_block ON session_seat(seat_block_id);
```

- [ ] **Step 2: Execute migration**

Run:

```powershell
$env:PGPASSWORD="123456"
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -h localhost -U postgres -d omni_ticket -f sql/20260519_tour_station_foundation.sql
```

Expected: migration succeeds without errors.

## Task 2: Java Entities and Mappers

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/entity/Tour.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/entity/Station.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/entity/SeatBlock.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/entity/SeatOverride.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/entity/TicketGroup.java`
- Create mapper files for each entity under `java/java-ticket/src/main/java/com/omni/ticket/mapper/`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/entity/Activity.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/entity/VenueApplication.java`

- [ ] **Step 1: Create entities**

Each entity uses `@TableName`, `@TableId(type = IdType.AUTO)`, Java bean getters/setters, `LocalDateTime` for timestamps, and `BigDecimal` for numeric coordinate/price fields.

- [ ] **Step 2: Create mappers**

Each mapper uses:

```java
@Mapper
public interface TourMapper extends BaseMapper<Tour> {
}
```

Repeat for `StationMapper`, `SeatBlockMapper`, `SeatOverrideMapper`, `TicketGroupMapper`.

- [ ] **Step 3: Extend Activity**

Add fields and getters/setters:

```java
private Long tourId;
private Long stationId;
private Long venueApplicationId;
private String publishStatus;
```

- [ ] **Step 4: Extend VenueApplication**

Add fields and getters/setters:

```java
private LocalDateTime validFrom;
private LocalDateTime validTo;
private String proofNote;
private String proofFileUrl;
private String layoutSnapshot;
private Boolean setAsRecommendedLayout;
```

Use `String layoutSnapshot` for JSONB storage in this phase to keep MyBatis mapping simple.

## Task 3: DTO Compatibility

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/dto/VenueApplicationRequest.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/dto/VenueApplicationResponse.java`

- [ ] **Step 1: Extend request**

Add fields:

```java
private LocalDateTime validFrom;
private LocalDateTime validTo;
private String proofNote;
private String proofFileUrl;
private String layoutSnapshot;
private Boolean setAsRecommendedLayout;
```

- [ ] **Step 2: Extend response**

Add same fields and map them in `from(VenueApplication application)`.

## Task 4: Verification

- [ ] **Step 1: Compile java-ticket**

Run:

```powershell
cd C:\Users\Administrator\Desktop\omni\java
mvn compile -pl java-ticket -am -DskipTests
```

Expected: `BUILD SUCCESS`.

- [ ] **Step 2: Run java-ticket tests**

Run:

```powershell
cd C:\Users\Administrator\Desktop\omni\java
mvn test -pl java-ticket -am
```

Expected: all tests pass.

## Self-Review

This phase intentionally does not change user-facing behavior. It only prepares schema and Java model compatibility required by later phases. It covers the master plan Phase 1 and leaves service behavior for Phase 2.
