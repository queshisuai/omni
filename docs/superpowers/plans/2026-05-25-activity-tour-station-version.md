# Activity Tour Station Version Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified station configuration version workflow for normal activities and tour stations, including drafts, history, venue applications, template reuse, and admin review.

**Architecture:** Keep all business logic inside `java-ticket`. Add `station.activity_id` and a new `station_config_version` table, then layer a focused service and controller endpoints over existing `Activity`, `Station`, `Tour`, `Session`, `VenueApplication`, and SeatCraft services. Frontend flows call draft/version APIs instead of putting venue proof fields on the activity base-information step.

**Tech Stack:** Java Spring Boot, MyBatis-Plus, PostgreSQL, JUnit 5/Mockito, Next.js 16, React 19, TypeScript, pnpm.

---

## File Structure

Backend files to create:

- `java/java-ticket/src/main/java/com/omni/ticket/entity/StationConfigVersion.java`：站点配置版本实体。
- `java/java-ticket/src/main/java/com/omni/ticket/mapper/StationConfigVersionMapper.java`：MyBatis-Plus mapper。
- `java/java-ticket/src/main/java/com/omni/ticket/dto/ActivityDraftResponse.java`：普通活动草稿创建响应。
- `java/java-ticket/src/main/java/com/omni/ticket/dto/StationConfigVersionRequest.java`：版本草稿创建/编辑请求。
- `java/java-ticket/src/main/java/com/omni/ticket/dto/StationConfigVersionReviewRequest.java`：审核请求。
- `java/java-ticket/src/main/java/com/omni/ticket/dto/StationConfigVersionResponse.java`：版本、审核、历史展示响应。
- `java/java-ticket/src/main/java/com/omni/ticket/dto/StationConfigVersionDetailResponse.java`：站点当前配置 + 版本历史响应。
- `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityDraftService.java`：普通活动草稿和默认站点创建。
- `java/java-ticket/src/main/java/com/omni/ticket/service/StationConfigVersionService.java`：版本草稿、审核、应用规则。
- `java/java-ticket/src/test/java/com/omni/ticket/service/ActivityDraftServiceTest.java`：普通活动默认站点测试。
- `java/java-ticket/src/test/java/com/omni/ticket/service/StationConfigVersionServiceTest.java`：版本生命周期测试。
- `sql/production-split/ticket/20260525_station_config_version.sql`：prod-split ticket 迁移。
- `sql/migrations/shared/20260525_station_config_version.sql`：shared 历史库迁移。

Backend files to modify:

- `java/java-ticket/src/main/java/com/omni/ticket/entity/Station.java`：新增 `activityId` 字段。
- `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`：注入新服务并新增草稿/版本/审核 API。
- `java/java-ticket/src/main/java/com/omni/ticket/service/TourStationService.java`：`createTourDraft` 支持城市数组，`createStationDraft` 支持站点名默认值。
- `java/java-ticket/src/test/java/com/omni/ticket/service/TourStationServiceTest.java`：覆盖批量城市和默认站点名。
- `java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java`：覆盖新 API 委托和权限。

Frontend files to modify:

- `frontend/src/types/api.ts`：新增站点配置版本类型，`StationEntity.activityId` 可选。
- `frontend/src/lib/api.ts`：新增 activity draft、station config version、review API client。
- `frontend/src/app/console/activities/new/page.tsx`：移除基础信息场地凭证，改为活动草稿 + 站点配置版本流程。
- `frontend/src/app/console/tours/new/page.tsx`：新增城市清单步骤。
- `frontend/src/app/console/tours/[id]/page.tsx`：展示站点配置版本和历史入口。
- `frontend/src/app/console/tours/[id]/stations/new/page.tsx`：站点名可空，新增城市草稿不强制场馆。
- `frontend/src/app/console/station-config-reviews/page.tsx`：新增站点变更审核页。
- `frontend/src/app/console/layout.tsx`：新增审核入口。

---

### Task 1: Database And Entity Foundation

**Files:**
- Create: `sql/production-split/ticket/20260525_station_config_version.sql`
- Create: `sql/migrations/shared/20260525_station_config_version.sql`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/entity/StationConfigVersion.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/mapper/StationConfigVersionMapper.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/entity/Station.java`

- [ ] **Step 1: Add the prod-split migration**

Create `sql/production-split/ticket/20260525_station_config_version.sql` with:

```sql
-- owner: java-ticket

ALTER TABLE station
    ADD COLUMN IF NOT EXISTS activity_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_station_activity_id ON station(activity_id);

CREATE TABLE IF NOT EXISTS station_config_version (
    id BIGSERIAL PRIMARY KEY,
    station_id BIGINT NOT NULL,
    activity_id BIGINT,
    tour_id BIGINT,
    version_no INTEGER NOT NULL,
    change_type VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    city VARCHAR(100),
    station_name VARCHAR(200),
    venue_id BIGINT,
    venue_application_id BIGINT,
    venue_name VARCHAR(200),
    venue_address VARCHAR(500),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    schedule_tba BOOLEAN NOT NULL DEFAULT FALSE,
    seat_template_source_type VARCHAR(64),
    seat_template_source_id BIGINT,
    reason TEXT,
    reviewer_id BIGINT,
    review_note TEXT,
    review_time TIMESTAMP,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    applied_at TIMESTAMP,
    CONSTRAINT uk_station_config_version_no UNIQUE (station_id, version_no),
    CONSTRAINT ck_station_config_version_change_type CHECK (change_type IN (
        'create', 'update_city', 'set_venue', 'change_venue', 'set_schedule', 'change_schedule', 'delete_station'
    )),
    CONSTRAINT ck_station_config_version_status CHECK (status IN (
        'draft', 'submitted', 'approved', 'rejected', 'applied', 'withdrawn'
    ))
);

CREATE INDEX IF NOT EXISTS idx_station_config_version_station_status
    ON station_config_version(station_id, status);

CREATE INDEX IF NOT EXISTS idx_station_config_version_review
    ON station_config_version(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_station_config_version_activity
    ON station_config_version(activity_id);

CREATE INDEX IF NOT EXISTS idx_station_config_version_tour
    ON station_config_version(tour_id);
```

- [ ] **Step 2: Add the shared migration**

Create `sql/migrations/shared/20260525_station_config_version.sql` with the exact same SQL from Step 1.

- [ ] **Step 3: Add `activityId` to `Station`**

Modify `java/java-ticket/src/main/java/com/omni/ticket/entity/Station.java`:

```java
private Long activityId;

public Long getActivityId() { return activityId; }
public void setActivityId(Long activityId) { this.activityId = activityId; }
```

Place the field after `private Long tourId;` and the getter/setter after `getTourId/setTourId`.

- [ ] **Step 4: Create `StationConfigVersion` entity**

Create `java/java-ticket/src/main/java/com/omni/ticket/entity/StationConfigVersion.java`:

```java
package com.omni.ticket.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

@TableName("station_config_version")
public class StationConfigVersion {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long stationId;
    private Long activityId;
    private Long tourId;
    private Integer versionNo;
    private String changeType;
    private String status;
    private String city;
    private String stationName;
    private Long venueId;
    private Long venueApplicationId;
    private String venueName;
    private String venueAddress;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Boolean scheduleTba;
    private String seatTemplateSourceType;
    private Long seatTemplateSourceId;
    private String reason;
    private Long reviewerId;
    private String reviewNote;
    private LocalDateTime reviewTime;
    private Long createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime appliedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getStationId() { return stationId; }
    public void setStationId(Long stationId) { this.stationId = stationId; }
    public Long getActivityId() { return activityId; }
    public void setActivityId(Long activityId) { this.activityId = activityId; }
    public Long getTourId() { return tourId; }
    public void setTourId(Long tourId) { this.tourId = tourId; }
    public Integer getVersionNo() { return versionNo; }
    public void setVersionNo(Integer versionNo) { this.versionNo = versionNo; }
    public String getChangeType() { return changeType; }
    public void setChangeType(String changeType) { this.changeType = changeType; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getStationName() { return stationName; }
    public void setStationName(String stationName) { this.stationName = stationName; }
    public Long getVenueId() { return venueId; }
    public void setVenueId(Long venueId) { this.venueId = venueId; }
    public Long getVenueApplicationId() { return venueApplicationId; }
    public void setVenueApplicationId(Long venueApplicationId) { this.venueApplicationId = venueApplicationId; }
    public String getVenueName() { return venueName; }
    public void setVenueName(String venueName) { this.venueName = venueName; }
    public String getVenueAddress() { return venueAddress; }
    public void setVenueAddress(String venueAddress) { this.venueAddress = venueAddress; }
    public LocalDateTime getStartTime() { return startTime; }
    public void setStartTime(LocalDateTime startTime) { this.startTime = startTime; }
    public LocalDateTime getEndTime() { return endTime; }
    public void setEndTime(LocalDateTime endTime) { this.endTime = endTime; }
    public Boolean getScheduleTba() { return scheduleTba; }
    public void setScheduleTba(Boolean scheduleTba) { this.scheduleTba = scheduleTba; }
    public String getSeatTemplateSourceType() { return seatTemplateSourceType; }
    public void setSeatTemplateSourceType(String seatTemplateSourceType) { this.seatTemplateSourceType = seatTemplateSourceType; }
    public Long getSeatTemplateSourceId() { return seatTemplateSourceId; }
    public void setSeatTemplateSourceId(Long seatTemplateSourceId) { this.seatTemplateSourceId = seatTemplateSourceId; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public Long getReviewerId() { return reviewerId; }
    public void setReviewerId(Long reviewerId) { this.reviewerId = reviewerId; }
    public String getReviewNote() { return reviewNote; }
    public void setReviewNote(String reviewNote) { this.reviewNote = reviewNote; }
    public LocalDateTime getReviewTime() { return reviewTime; }
    public void setReviewTime(LocalDateTime reviewTime) { this.reviewTime = reviewTime; }
    public Long getCreatedBy() { return createdBy; }
    public void setCreatedBy(Long createdBy) { this.createdBy = createdBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public LocalDateTime getAppliedAt() { return appliedAt; }
    public void setAppliedAt(LocalDateTime appliedAt) { this.appliedAt = appliedAt; }
}
```

- [ ] **Step 5: Create mapper**

Create `java/java-ticket/src/main/java/com/omni/ticket/mapper/StationConfigVersionMapper.java`:

```java
package com.omni.ticket.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.omni.ticket.entity.StationConfigVersion;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface StationConfigVersionMapper extends BaseMapper<StationConfigVersion> {
}
```

- [ ] **Step 6: Run SQL checker**

Run from repo root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1
```

Expected: PASS. If it fails for owner comments, confirm the prod-split SQL starts with `-- owner: java-ticket`.

- [ ] **Step 7: Commit foundation**

```powershell
git add -- sql/production-split/ticket/20260525_station_config_version.sql sql/migrations/shared/20260525_station_config_version.sql java/java-ticket/src/main/java/com/omni/ticket/entity/Station.java java/java-ticket/src/main/java/com/omni/ticket/entity/StationConfigVersion.java java/java-ticket/src/main/java/com/omni/ticket/mapper/StationConfigVersionMapper.java
git commit -m "feat: add station config version model"
```

---

### Task 2: Station Config Version Service Lifecycle

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/StationConfigVersionRequest.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/StationConfigVersionReviewRequest.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/StationConfigVersionResponse.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/StationConfigVersionDetailResponse.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/StationConfigVersionService.java`
- Create: `java/java-ticket/src/test/java/com/omni/ticket/service/StationConfigVersionServiceTest.java`

- [ ] **Step 1: Write failing lifecycle tests**

Create `java/java-ticket/src/test/java/com/omni/ticket/service/StationConfigVersionServiceTest.java`:

```java
package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.InternalUserRefResponse;
import com.omni.ticket.dto.StationConfigVersionRequest;
import com.omni.ticket.dto.StationConfigVersionReviewRequest;
import com.omni.ticket.entity.Station;
import com.omni.ticket.entity.StationConfigVersion;
import com.omni.ticket.entity.VenueApplication;
import com.omni.ticket.mapper.StationConfigVersionMapper;
import com.omni.ticket.mapper.StationMapper;
import com.omni.ticket.mapper.VenueApplicationMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StationConfigVersionServiceTest {
    @Mock private StationConfigVersionMapper versionMapper;
    @Mock private StationMapper stationMapper;
    @Mock private VenueApplicationMapper venueApplicationMapper;
    @Mock private UserAccessService userAccessService;

    private StationConfigVersionService service;

    @BeforeEach
    void setUp() {
        service = new StationConfigVersionService(versionMapper, stationMapper, venueApplicationMapper, userAccessService);
    }

    @Test
    void createDraftUsesNextVersionNumberAndDoesNotChangeStation() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        when(stationMapper.selectById(10L)).thenReturn(station(10L, 2003L, "draft"));
        when(versionMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(existingVersion(1)));
        StationConfigVersionRequest request = new StationConfigVersionRequest();
        request.setChangeType("set_venue");
        request.setCity("北京");
        request.setStationName("北京站");
        request.setVenueApplicationId(88L);

        service.createDraft(2003L, 10L, request);

        ArgumentCaptor<StationConfigVersion> captor = ArgumentCaptor.forClass(StationConfigVersion.class);
        verify(versionMapper).insert(captor.capture());
        StationConfigVersion version = captor.getValue();
        assertEquals(10L, version.getStationId());
        assertEquals(2, version.getVersionNo());
        assertEquals("draft", version.getStatus());
        assertEquals("set_venue", version.getChangeType());
        assertEquals("北京", version.getCity());
        assertEquals(88L, version.getVenueApplicationId());
        verify(stationMapper, never()).updateById(any());
    }

    @Test
    void deleteDraftAllowsOnlyDraftStatus() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        StationConfigVersion draft = existingVersion(1);
        draft.setId(99L);
        draft.setStatus("draft");
        when(versionMapper.selectById(99L)).thenReturn(draft);
        when(stationMapper.selectById(10L)).thenReturn(station(10L, 2003L, "draft"));

        service.deleteDraft(2003L, 99L);

        verify(versionMapper).deleteById(99L);
    }

    @Test
    void deleteDraftRejectsSubmittedVersion() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        StationConfigVersion submitted = existingVersion(1);
        submitted.setId(99L);
        submitted.setStatus("submitted");
        when(versionMapper.selectById(99L)).thenReturn(submitted);
        when(stationMapper.selectById(10L)).thenReturn(station(10L, 2003L, "city_announced"));

        BusinessException error = assertThrows(BusinessException.class, () -> service.deleteDraft(2003L, 99L));

        assertEquals(400, error.getCode());
        verify(versionMapper, never()).deleteById(99L);
    }

    @Test
    void submitDraftRequiresVenueApplicationForNewVenueChange() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        StationConfigVersion version = existingVersion(1);
        version.setId(99L);
        version.setStatus("draft");
        version.setChangeType("set_venue");
        version.setVenueApplicationId(null);
        when(versionMapper.selectById(99L)).thenReturn(version);
        when(stationMapper.selectById(10L)).thenReturn(station(10L, 2003L, "draft"));

        BusinessException error = assertThrows(BusinessException.class, () -> service.submit(2003L, 99L));

        assertEquals(400, error.getCode());
        verify(versionMapper, never()).updateById(any());
    }

    @Test
    void approveAppliesVersionAndKeepsHistory() {
        when(userAccessService.requireAdmin(2002L)).thenReturn(user(2002L, "admin"));
        Station station = station(10L, 2003L, "city_announced");
        StationConfigVersion version = existingVersion(1);
        version.setId(99L);
        version.setStatus("submitted");
        version.setCity("上海");
        version.setStationName("上海站");
        version.setVenueApplicationId(88L);
        VenueApplication application = new VenueApplication();
        application.setId(88L);
        application.setVenueId(66L);
        application.setVenueName("上海体育馆");
        application.setCity("上海");
        application.setStatus(1);
        when(versionMapper.selectById(99L)).thenReturn(version);
        when(stationMapper.selectById(10L)).thenReturn(station);
        when(venueApplicationMapper.selectById(88L)).thenReturn(application);
        StationConfigVersionReviewRequest request = new StationConfigVersionReviewRequest();
        request.setReviewNote("资料齐全");

        service.approve(2002L, 99L, request);

        ArgumentCaptor<Station> stationCaptor = ArgumentCaptor.forClass(Station.class);
        verify(stationMapper).updateById(stationCaptor.capture());
        assertEquals("上海", stationCaptor.getValue().getCity());
        assertEquals("上海站", stationCaptor.getValue().getStationName());
        assertEquals(88L, stationCaptor.getValue().getVenueApplicationId());

        ArgumentCaptor<StationConfigVersion> versionCaptor = ArgumentCaptor.forClass(StationConfigVersion.class);
        verify(versionMapper).updateById(versionCaptor.capture());
        assertEquals("applied", versionCaptor.getValue().getStatus());
        assertEquals(2002L, versionCaptor.getValue().getReviewerId());
        assertNotNull(versionCaptor.getValue().getAppliedAt());
    }

    private Station station(Long id, Long ownerId, String publishStatus) {
        Station station = new Station();
        station.setId(id);
        station.setTourId(20L);
        station.setCity("北京");
        station.setStationName("北京站");
        station.setPublishStatus(publishStatus);
        station.setStatus(1);
        return station;
    }

    private StationConfigVersion existingVersion(int versionNo) {
        StationConfigVersion version = new StationConfigVersion();
        version.setStationId(10L);
        version.setTourId(20L);
        version.setVersionNo(versionNo);
        version.setChangeType("set_venue");
        version.setStatus("draft");
        version.setCreatedBy(2003L);
        return version;
    }

    private InternalUserRefResponse user(Long id, String role) {
        InternalUserRefResponse user = new InternalUserRefResponse();
        user.setUserId(id);
        user.setRole(role);
        return user;
    }
}
```

- [ ] **Step 2: Run tests and verify failure**

Run from `java`:

```powershell
mvn test -pl java-ticket "-Dtest=StationConfigVersionServiceTest"
```

Expected: compilation fails because DTOs and service do not exist.

- [ ] **Step 3: Add request DTOs**

Create `java/java-ticket/src/main/java/com/omni/ticket/dto/StationConfigVersionRequest.java`:

```java
package com.omni.ticket.dto;

public class StationConfigVersionRequest {
    private String changeType;
    private String city;
    private String stationName;
    private Long venueId;
    private Long venueApplicationId;
    private String venueName;
    private String venueAddress;
    private String startTime;
    private String endTime;
    private Boolean scheduleTba;
    private String seatTemplateSourceType;
    private Long seatTemplateSourceId;
    private String reason;

    public String getChangeType() { return changeType; }
    public void setChangeType(String changeType) { this.changeType = changeType; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getStationName() { return stationName; }
    public void setStationName(String stationName) { this.stationName = stationName; }
    public Long getVenueId() { return venueId; }
    public void setVenueId(Long venueId) { this.venueId = venueId; }
    public Long getVenueApplicationId() { return venueApplicationId; }
    public void setVenueApplicationId(Long venueApplicationId) { this.venueApplicationId = venueApplicationId; }
    public String getVenueName() { return venueName; }
    public void setVenueName(String venueName) { this.venueName = venueName; }
    public String getVenueAddress() { return venueAddress; }
    public void setVenueAddress(String venueAddress) { this.venueAddress = venueAddress; }
    public String getStartTime() { return startTime; }
    public void setStartTime(String startTime) { this.startTime = startTime; }
    public String getEndTime() { return endTime; }
    public void setEndTime(String endTime) { this.endTime = endTime; }
    public Boolean getScheduleTba() { return scheduleTba; }
    public void setScheduleTba(Boolean scheduleTba) { this.scheduleTba = scheduleTba; }
    public String getSeatTemplateSourceType() { return seatTemplateSourceType; }
    public void setSeatTemplateSourceType(String seatTemplateSourceType) { this.seatTemplateSourceType = seatTemplateSourceType; }
    public Long getSeatTemplateSourceId() { return seatTemplateSourceId; }
    public void setSeatTemplateSourceId(Long seatTemplateSourceId) { this.seatTemplateSourceId = seatTemplateSourceId; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
```

Create `java/java-ticket/src/main/java/com/omni/ticket/dto/StationConfigVersionReviewRequest.java`:

```java
package com.omni.ticket.dto;

public class StationConfigVersionReviewRequest {
    private Long userId;
    private String reviewNote;

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getReviewNote() { return reviewNote; }
    public void setReviewNote(String reviewNote) { this.reviewNote = reviewNote; }
}
```

- [ ] **Step 4: Add response DTOs**

Create `java/java-ticket/src/main/java/com/omni/ticket/dto/StationConfigVersionResponse.java`:

```java
package com.omni.ticket.dto;

import com.omni.ticket.entity.StationConfigVersion;

import java.time.LocalDateTime;

public class StationConfigVersionResponse {
    private Long id;
    private Long stationId;
    private Long activityId;
    private Long tourId;
    private Integer versionNo;
    private String changeType;
    private String status;
    private String city;
    private String stationName;
    private Long venueId;
    private Long venueApplicationId;
    private String venueName;
    private String venueAddress;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Boolean scheduleTba;
    private String seatTemplateSourceType;
    private Long seatTemplateSourceId;
    private String reason;
    private Long reviewerId;
    private String reviewNote;
    private LocalDateTime reviewTime;
    private Long createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime appliedAt;

    public static StationConfigVersionResponse from(StationConfigVersion version) {
        StationConfigVersionResponse response = new StationConfigVersionResponse();
        response.id = version.getId();
        response.stationId = version.getStationId();
        response.activityId = version.getActivityId();
        response.tourId = version.getTourId();
        response.versionNo = version.getVersionNo();
        response.changeType = version.getChangeType();
        response.status = version.getStatus();
        response.city = version.getCity();
        response.stationName = version.getStationName();
        response.venueId = version.getVenueId();
        response.venueApplicationId = version.getVenueApplicationId();
        response.venueName = version.getVenueName();
        response.venueAddress = version.getVenueAddress();
        response.startTime = version.getStartTime();
        response.endTime = version.getEndTime();
        response.scheduleTba = version.getScheduleTba();
        response.seatTemplateSourceType = version.getSeatTemplateSourceType();
        response.seatTemplateSourceId = version.getSeatTemplateSourceId();
        response.reason = version.getReason();
        response.reviewerId = version.getReviewerId();
        response.reviewNote = version.getReviewNote();
        response.reviewTime = version.getReviewTime();
        response.createdBy = version.getCreatedBy();
        response.createdAt = version.getCreatedAt();
        response.updatedAt = version.getUpdatedAt();
        response.appliedAt = version.getAppliedAt();
        return response;
    }

    public Long getId() { return id; }
    public Long getStationId() { return stationId; }
    public Long getActivityId() { return activityId; }
    public Long getTourId() { return tourId; }
    public Integer getVersionNo() { return versionNo; }
    public String getChangeType() { return changeType; }
    public String getStatus() { return status; }
    public String getCity() { return city; }
    public String getStationName() { return stationName; }
    public Long getVenueId() { return venueId; }
    public Long getVenueApplicationId() { return venueApplicationId; }
    public String getVenueName() { return venueName; }
    public String getVenueAddress() { return venueAddress; }
    public LocalDateTime getStartTime() { return startTime; }
    public LocalDateTime getEndTime() { return endTime; }
    public Boolean getScheduleTba() { return scheduleTba; }
    public String getSeatTemplateSourceType() { return seatTemplateSourceType; }
    public Long getSeatTemplateSourceId() { return seatTemplateSourceId; }
    public String getReason() { return reason; }
    public Long getReviewerId() { return reviewerId; }
    public String getReviewNote() { return reviewNote; }
    public LocalDateTime getReviewTime() { return reviewTime; }
    public Long getCreatedBy() { return createdBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public LocalDateTime getAppliedAt() { return appliedAt; }
}
```

Create `java/java-ticket/src/main/java/com/omni/ticket/dto/StationConfigVersionDetailResponse.java`:

```java
package com.omni.ticket.dto;

import com.omni.ticket.entity.Station;

import java.util.List;

public class StationConfigVersionDetailResponse {
    private Station station;
    private List<StationConfigVersionResponse> versions;

    public StationConfigVersionDetailResponse(Station station, List<StationConfigVersionResponse> versions) {
        this.station = station;
        this.versions = versions;
    }

    public Station getStation() { return station; }
    public List<StationConfigVersionResponse> getVersions() { return versions; }
}
```

- [ ] **Step 5: Implement `StationConfigVersionService`**

Create `java/java-ticket/src/main/java/com/omni/ticket/service/StationConfigVersionService.java`:

```java
package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.InternalUserRefResponse;
import com.omni.ticket.dto.StationConfigVersionDetailResponse;
import com.omni.ticket.dto.StationConfigVersionRequest;
import com.omni.ticket.dto.StationConfigVersionResponse;
import com.omni.ticket.dto.StationConfigVersionReviewRequest;
import com.omni.ticket.entity.Station;
import com.omni.ticket.entity.StationConfigVersion;
import com.omni.ticket.entity.VenueApplication;
import com.omni.ticket.mapper.StationConfigVersionMapper;
import com.omni.ticket.mapper.StationMapper;
import com.omni.ticket.mapper.VenueApplicationMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class StationConfigVersionService {
    private static final String STATUS_DRAFT = "draft";
    private static final String STATUS_SUBMITTED = "submitted";
    private static final String STATUS_REJECTED = "rejected";
    private static final String STATUS_APPLIED = "applied";
    private static final String STATUS_WITHDRAWN = "withdrawn";
    private static final Set<String> CHANGE_TYPES_REQUIRING_VENUE_APPLICATION = Set.of("set_venue", "change_venue");
    private static final Set<String> VALID_CHANGE_TYPES = Set.of(
            "create", "update_city", "set_venue", "change_venue", "set_schedule", "change_schedule", "delete_station");

    private final StationConfigVersionMapper versionMapper;
    private final StationMapper stationMapper;
    private final VenueApplicationMapper venueApplicationMapper;
    private final UserAccessService userAccessService;

    public StationConfigVersionService(StationConfigVersionMapper versionMapper,
                                       StationMapper stationMapper,
                                       VenueApplicationMapper venueApplicationMapper,
                                       UserAccessService userAccessService) {
        this.versionMapper = versionMapper;
        this.stationMapper = stationMapper;
        this.venueApplicationMapper = venueApplicationMapper;
        this.userAccessService = userAccessService;
    }

    @Transactional
    public StationConfigVersionResponse createDraft(Long userId, Long stationId, StationConfigVersionRequest request) {
        InternalUserRefResponse user = userAccessService.requireAdminOrOrganizer(userId);
        Station station = requireManageableStation(user, stationId);
        String changeType = requireChangeType(request == null ? null : request.getChangeType());
        LocalDateTime now = LocalDateTime.now();
        StationConfigVersion version = new StationConfigVersion();
        version.setStationId(station.getId());
        version.setActivityId(station.getActivityId());
        version.setTourId(station.getTourId());
        version.setVersionNo(nextVersionNo(station.getId()));
        version.setChangeType(changeType);
        version.setStatus(STATUS_DRAFT);
        applyRequest(version, request);
        version.setCreatedBy(userId);
        version.setCreatedAt(now);
        version.setUpdatedAt(now);
        versionMapper.insert(version);
        return StationConfigVersionResponse.from(version);
    }

    @Transactional
    public StationConfigVersionResponse updateDraft(Long userId, Long versionId, StationConfigVersionRequest request) {
        InternalUserRefResponse user = userAccessService.requireAdminOrOrganizer(userId);
        StationConfigVersion version = requireVersion(versionId);
        requireManageableStation(user, version.getStationId());
        requireStatus(version, STATUS_DRAFT, "只能编辑草稿版本");
        applyRequest(version, request);
        version.setUpdatedAt(LocalDateTime.now());
        versionMapper.updateById(version);
        return StationConfigVersionResponse.from(version);
    }

    @Transactional
    public void deleteDraft(Long userId, Long versionId) {
        InternalUserRefResponse user = userAccessService.requireAdminOrOrganizer(userId);
        StationConfigVersion version = requireVersion(versionId);
        requireManageableStation(user, version.getStationId());
        requireStatus(version, STATUS_DRAFT, "只能删除草稿版本");
        versionMapper.deleteById(versionId);
    }

    @Transactional
    public StationConfigVersionResponse submit(Long userId, Long versionId) {
        InternalUserRefResponse user = userAccessService.requireAdminOrOrganizer(userId);
        StationConfigVersion version = requireVersion(versionId);
        requireManageableStation(user, version.getStationId());
        requireStatus(version, STATUS_DRAFT, "只能提交草稿版本");
        validateBeforeSubmit(version);
        version.setStatus(STATUS_SUBMITTED);
        version.setUpdatedAt(LocalDateTime.now());
        versionMapper.updateById(version);
        return StationConfigVersionResponse.from(version);
    }

    @Transactional
    public StationConfigVersionResponse withdraw(Long userId, Long versionId) {
        InternalUserRefResponse user = userAccessService.requireAdminOrOrganizer(userId);
        StationConfigVersion version = requireVersion(versionId);
        requireManageableStation(user, version.getStationId());
        requireStatus(version, STATUS_SUBMITTED, "只能撤回审核中的版本");
        version.setStatus(STATUS_WITHDRAWN);
        version.setUpdatedAt(LocalDateTime.now());
        versionMapper.updateById(version);
        return StationConfigVersionResponse.from(version);
    }

    @Transactional
    public StationConfigVersionResponse approve(Long adminUserId, Long versionId, StationConfigVersionReviewRequest request) {
        userAccessService.requireAdmin(adminUserId);
        StationConfigVersion version = requireVersion(versionId);
        requireStatus(version, STATUS_SUBMITTED, "只能审核已提交版本");
        Station station = requireStation(version.getStationId());
        applyVersionToStation(station, version);
        station.setUpdateTime(LocalDateTime.now());
        stationMapper.updateById(station);
        LocalDateTime now = LocalDateTime.now();
        version.setStatus(STATUS_APPLIED);
        version.setReviewerId(adminUserId);
        version.setReviewNote(trim(request == null ? null : request.getReviewNote()));
        version.setReviewTime(now);
        version.setAppliedAt(now);
        version.setUpdatedAt(now);
        versionMapper.updateById(version);
        return StationConfigVersionResponse.from(version);
    }

    @Transactional
    public StationConfigVersionResponse reject(Long adminUserId, Long versionId, StationConfigVersionReviewRequest request) {
        userAccessService.requireAdmin(adminUserId);
        StationConfigVersion version = requireVersion(versionId);
        requireStatus(version, STATUS_SUBMITTED, "只能审核已提交版本");
        LocalDateTime now = LocalDateTime.now();
        version.setStatus(STATUS_REJECTED);
        version.setReviewerId(adminUserId);
        version.setReviewNote(trim(request == null ? null : request.getReviewNote()));
        version.setReviewTime(now);
        version.setUpdatedAt(now);
        versionMapper.updateById(version);
        return StationConfigVersionResponse.from(version);
    }

    public StationConfigVersionDetailResponse getStationDetail(Long userId, Long stationId) {
        InternalUserRefResponse user = userAccessService.requireAdminOrOrganizer(userId);
        Station station = requireManageableStation(user, stationId);
        List<StationConfigVersionResponse> versions = listVersions(stationId).stream()
                .map(StationConfigVersionResponse::from)
                .collect(Collectors.toList());
        return new StationConfigVersionDetailResponse(station, versions);
    }

    public List<StationConfigVersionResponse> listReviews(Long adminUserId) {
        userAccessService.requireAdmin(adminUserId);
        return versionMapper.selectList(new LambdaQueryWrapper<StationConfigVersion>()
                        .eq(StationConfigVersion::getStatus, STATUS_SUBMITTED)
                        .orderByDesc(StationConfigVersion::getUpdatedAt))
                .stream()
                .map(StationConfigVersionResponse::from)
                .collect(Collectors.toList());
    }

    private void applyRequest(StationConfigVersion version, StationConfigVersionRequest request) {
        if (request == null) return;
        version.setChangeType(requireChangeType(request.getChangeType()));
        version.setCity(trim(request.getCity()));
        version.setStationName(trim(request.getStationName()));
        version.setVenueId(request.getVenueId());
        version.setVenueApplicationId(request.getVenueApplicationId());
        version.setVenueName(trim(request.getVenueName()));
        version.setVenueAddress(trim(request.getVenueAddress()));
        version.setStartTime(parseTime(request.getStartTime()));
        version.setEndTime(parseTime(request.getEndTime()));
        version.setScheduleTba(Boolean.TRUE.equals(request.getScheduleTba()));
        version.setSeatTemplateSourceType(trim(request.getSeatTemplateSourceType()));
        version.setSeatTemplateSourceId(request.getSeatTemplateSourceId());
        version.setReason(trim(request.getReason()));
    }

    private void validateBeforeSubmit(StationConfigVersion version) {
        if (CHANGE_TYPES_REQUIRING_VENUE_APPLICATION.contains(version.getChangeType())
                && version.getVenueApplicationId() == null
                && version.getVenueId() == null) {
            throw new BusinessException(400, "新增或更换场馆必须选择已有场馆或提交场地申请");
        }
        if (version.getStartTime() != null && version.getEndTime() != null && !version.getEndTime().isAfter(version.getStartTime())) {
            throw new BusinessException(400, "结束时间必须晚于开始时间");
        }
    }

    private void applyVersionToStation(Station station, StationConfigVersion version) {
        if ("delete_station".equals(version.getChangeType())) {
            station.setStatus(0);
            station.setPublishStatus("cancelled");
            return;
        }
        if (version.getCity() != null) station.setCity(version.getCity());
        if (version.getStationName() != null) station.setStationName(version.getStationName());
        if (version.getVenueApplicationId() != null) {
            VenueApplication application = venueApplicationMapper.selectById(version.getVenueApplicationId());
            if (application == null || !Integer.valueOf(1).equals(application.getStatus())) {
                throw new BusinessException(400, "场地申请未审核通过");
            }
            station.setVenueApplicationId(application.getId());
            station.setPublishStatus("venue_confirmed");
        }
        if ("update_city".equals(version.getChangeType()) && "draft".equals(station.getPublishStatus())) {
            station.setPublishStatus("city_announced");
        }
    }

    private int nextVersionNo(Long stationId) {
        return listVersions(stationId).stream()
                .map(StationConfigVersion::getVersionNo)
                .filter(no -> no != null)
                .max(Integer::compareTo)
                .orElse(0) + 1;
    }

    private List<StationConfigVersion> listVersions(Long stationId) {
        return versionMapper.selectList(new LambdaQueryWrapper<StationConfigVersion>()
                .eq(StationConfigVersion::getStationId, stationId)
                .orderByDesc(StationConfigVersion::getVersionNo));
    }

    private StationConfigVersion requireVersion(Long versionId) {
        if (versionId == null || versionId <= 0) throw new BusinessException(400, "版本ID不正确");
        StationConfigVersion version = versionMapper.selectById(versionId);
        if (version == null) throw new BusinessException(404, "站点配置版本不存在");
        return version;
    }

    private Station requireManageableStation(InternalUserRefResponse user, Long stationId) {
        Station station = requireStation(stationId);
        if (userAccessService.isOrganizer(user) && !user.getUserId().equals(station.getActivityId()) && station.getTourId() == null) {
            throw new BusinessException(403, "只能管理自己的站点");
        }
        return station;
    }

    private Station requireStation(Long stationId) {
        if (stationId == null || stationId <= 0) throw new BusinessException(400, "站点ID不正确");
        Station station = stationMapper.selectById(stationId);
        if (station == null || !Integer.valueOf(1).equals(station.getStatus())) {
            throw new BusinessException(404, "站点不存在");
        }
        return station;
    }

    private void requireStatus(StationConfigVersion version, String status, String message) {
        if (!status.equals(version.getStatus())) throw new BusinessException(400, message);
    }

    private String requireChangeType(String changeType) {
        String value = trim(changeType);
        if (value == null || !VALID_CHANGE_TYPES.contains(value)) {
            throw new BusinessException(400, "变更类型不正确");
        }
        return value;
    }

    private LocalDateTime parseTime(String value) {
        String text = trim(value);
        if (text == null) return null;
        return LocalDateTime.parse(text.replace(" ", "T"));
    }

    private String trim(String value) {
        return value == null ? null : value.trim().isEmpty() ? null : value.trim();
    }
}
```

- [ ] **Step 6: Fix organizer ownership before relying on service in production**

The minimal `requireManageableStation` above is intentionally too weak for tour ownership. Before shipping, replace it with this implementation and add tests once `TourMapper` is injected:

```java
private final TourMapper tourMapper;

private Station requireManageableStation(InternalUserRefResponse user, Long stationId) {
    Station station = requireStation(stationId);
    if (userAccessService.isAdmin(user)) return station;
    if (station.getTourId() != null) {
        Tour tour = tourMapper.selectById(station.getTourId());
        if (tour == null || !user.getUserId().equals(tour.getOrganizerId())) {
            throw new BusinessException(403, "只能管理自己的站点");
        }
        return station;
    }
    Activity activity = activityMapper.selectById(station.getActivityId());
    if (activity == null || !user.getUserId().equals(activity.getOrganizerId())) {
        throw new BusinessException(403, "只能管理自己的站点");
    }
    return station;
}
```

This requires adding `TourMapper` and `ActivityMapper` constructor dependencies and updating tests. Do not expose controller endpoints until this ownership check is complete.

- [ ] **Step 7: Run lifecycle tests**

Run from `java`:

```powershell
mvn test -pl java-ticket "-Dtest=StationConfigVersionServiceTest"
```

Expected: PASS after completing ownership dependencies and test setup.

- [ ] **Step 8: Commit service lifecycle**

```powershell
git add -- java/java-ticket/src/main/java/com/omni/ticket/dto/StationConfigVersionRequest.java java/java-ticket/src/main/java/com/omni/ticket/dto/StationConfigVersionReviewRequest.java java/java-ticket/src/main/java/com/omni/ticket/dto/StationConfigVersionResponse.java java/java-ticket/src/main/java/com/omni/ticket/dto/StationConfigVersionDetailResponse.java java/java-ticket/src/main/java/com/omni/ticket/service/StationConfigVersionService.java java/java-ticket/src/test/java/com/omni/ticket/service/StationConfigVersionServiceTest.java
git commit -m "feat: add station config version lifecycle"
```

---

### Task 3: Activity Draft And Tour City Draft APIs

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/ActivityDraftResponse.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityDraftService.java`
- Create: `java/java-ticket/src/test/java/com/omni/ticket/service/ActivityDraftServiceTest.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/TourStationService.java`
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/TourStationServiceTest.java`

- [ ] **Step 1: Add failing activity draft test**

Create `java/java-ticket/src/test/java/com/omni/ticket/service/ActivityDraftServiceTest.java` with tests that call `createDraft` and assert:

```java
assertEquals("draft", activityCaptor.getValue().getPublishStatus());
assertEquals(activityCaptor.getValue().getId(), stationCaptor.getValue().getActivityId());
assertNull(stationCaptor.getValue().getTourId());
assertEquals("draft", stationCaptor.getValue().getPublishStatus());
```

Use `doAnswer` to assign `activity.setId(501L)` when `activityMapper.insert(activity)` is called.

- [ ] **Step 2: Add response DTO**

Create `java/java-ticket/src/main/java/com/omni/ticket/dto/ActivityDraftResponse.java`:

```java
package com.omni.ticket.dto;

import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Station;

public class ActivityDraftResponse {
    private Activity activity;
    private Station station;

    public ActivityDraftResponse(Activity activity, Station station) {
        this.activity = activity;
        this.station = station;
    }

    public Activity getActivity() { return activity; }
    public Station getStation() { return station; }
}
```

- [ ] **Step 3: Implement `ActivityDraftService`**

Create `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityDraftService.java`. It should mirror `AdminController.createActivity` validation for `categoryId`, artists, name, `perUserLimit`, `seatMapVisibility`, then insert an `Activity` with `publishStatus="draft"`, `status=1`, and a `Station` with `activityId=activity.id`, `tourId=null`, `publishStatus="draft"`, `status=1`.

Use the existing `ActivityArtistService.saveLineup(activity.getId(), artists)` after insert.

- [ ] **Step 4: Extend tour draft tests for city list**

Add tests to `TourStationServiceTest`:

```java
@Test
void createTourDraftCreatesCityDrafts() {
    when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
    doAnswer(invocation -> { Tour tour = invocation.getArgument(0); tour.setId(10L); return 1; }).when(tourMapper).insert(any(Tour.class));

    service.createTourDraft(2003L, Map.of("title", "巡演", "cities", List.of("北京", "上海")));

    ArgumentCaptor<Station> captor = ArgumentCaptor.forClass(Station.class);
    verify(stationMapper, times(2)).insert(captor.capture());
    assertEquals("北京", captor.getAllValues().get(0).getCity());
    assertEquals("北京站", captor.getAllValues().get(0).getStationName());
    assertEquals("上海", captor.getAllValues().get(1).getCity());
    assertEquals("上海站", captor.getAllValues().get(1).getStationName());
}
```

Add static import `times`.

- [ ] **Step 5: Modify `TourStationService`**

In `createTourDraft`, after `tourMapper.insert(tour)`, parse `cities` from body. For each non-blank city, insert a `Station` with:

```java
station.setTourId(tour.getId());
station.setCity(city);
station.setStationName(city + "站");
station.setPublishStatus(PUBLISH_STATUS_DRAFT);
station.setStatus(1);
station.setCreateTime(now);
station.setUpdateTime(now);
```

In `createStationDraft`, change station name parsing from required to default:

```java
String city = requireText(body == null ? null : body.get("city"), "城市不能为空");
String stationName = defaultText(optionalText(body == null ? null : body.get("stationName")), city + "站");
station.setCity(city);
station.setStationName(stationName);
```

- [ ] **Step 6: Run service tests**

```powershell
mvn test -pl java-ticket "-Dtest=ActivityDraftServiceTest,TourStationServiceTest"
```

Expected: PASS.

- [ ] **Step 7: Commit draft APIs service layer**

```powershell
git add -- java/java-ticket/src/main/java/com/omni/ticket/dto/ActivityDraftResponse.java java/java-ticket/src/main/java/com/omni/ticket/service/ActivityDraftService.java java/java-ticket/src/test/java/com/omni/ticket/service/ActivityDraftServiceTest.java java/java-ticket/src/main/java/com/omni/ticket/service/TourStationService.java java/java-ticket/src/test/java/com/omni/ticket/service/TourStationServiceTest.java
git commit -m "feat: add activity and tour station drafts"
```

---

### Task 4: Admin Controller Endpoints

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java`

- [ ] **Step 1: Add failing controller delegation tests**

In `AdminControllerTest`, add mocks for `ActivityDraftService` and `StationConfigVersionService`, pass them into `controller()`, and add tests:

```java
@Test
void createActivityDraftDelegatesToService() {
    AdminController controller = controller();
    ActivityDraftResponse response = new ActivityDraftResponse(new Activity(), new Station());
    when(activityDraftService.createDraft(eq(2003L), any())).thenReturn(response);

    Result<ActivityDraftResponse> result = controller.createActivityDraft(Map.of("userId", 2003L, "name", "测试活动"));

    assertEquals(200, result.getCode());
    verify(activityDraftService).createDraft(eq(2003L), any());
}

@Test
void submitStationConfigVersionDelegatesToService() {
    AdminController controller = controller();
    StationConfigVersionResponse response = new StationConfigVersionResponse();
    when(stationConfigVersionService.submit(2003L, 99L)).thenReturn(response);

    Result<StationConfigVersionResponse> result = controller.submitStationConfigVersion(99L, Map.of("userId", 2003L));

    assertEquals(200, result.getCode());
    verify(stationConfigVersionService).submit(2003L, 99L);
}
```

If `StationConfigVersionResponse` has no public empty constructor because Task 2 used only static factory and getters, add a public no-arg constructor to that DTO for test and serialization compatibility.

- [ ] **Step 2: Modify controller constructor**

Add final fields:

```java
private final ActivityDraftService activityDraftService;
private final StationConfigVersionService stationConfigVersionService;
```

Update all overloaded constructors so Spring constructor injection remains unambiguous. If there are multiple constructors, annotate the production all-args constructor with `@Autowired`.

- [ ] **Step 3: Add endpoints**

Add methods under admin activity/tour endpoints:

```java
@PostMapping("/activities/draft")
public Result<ActivityDraftResponse> createActivityDraft(@RequestBody Map<String, Object> body) {
    Long userId = parsePositiveLong(body == null ? null : body.get("userId"));
    return Result.success(activityDraftService.createDraft(userId, body));
}

@GetMapping("/activities/{activityId}/station")
public Result<StationConfigVersionDetailResponse> getActivityStation(@PathVariable Long activityId, @RequestParam Long userId) {
    return Result.success(stationConfigVersionService.getActivityStationDetail(userId, activityId));
}

@PostMapping("/stations/{stationId}/config-versions")
public Result<StationConfigVersionResponse> createStationConfigVersion(@PathVariable Long stationId,
                                                                       @RequestBody StationConfigVersionRequest request) {
    return Result.success(stationConfigVersionService.createDraft(request.getUserId(), stationId, request));
}
```

Because `StationConfigVersionRequest` in Task 2 does not include `userId`, either add `private Long userId` with getter/setter to the request DTO or keep body as `Map<String,Object>` and parse `userId`. Prefer adding `userId` to the DTO for consistency.

Also add:

```java
@PutMapping("/station-config-versions/{versionId}")
@DeleteMapping("/station-config-versions/{versionId}")
@PostMapping("/station-config-versions/{versionId}/submit")
@PostMapping("/station-config-versions/{versionId}/withdraw")
@GetMapping("/station-config-versions/reviews")
@PostMapping("/station-config-versions/{versionId}/approve")
@PostMapping("/station-config-versions/{versionId}/reject")
```

Each endpoint should parse `userId` from request/query and delegate to `StationConfigVersionService`.

- [ ] **Step 4: Run controller tests**

```powershell
mvn test -pl java-ticket "-Dtest=AdminControllerTest"
```

Expected: PASS.

- [ ] **Step 5: Commit controller endpoints**

```powershell
git add -- java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java java/java-ticket/src/main/java/com/omni/ticket/dto/StationConfigVersionRequest.java java/java-ticket/src/main/java/com/omni/ticket/dto/StationConfigVersionResponse.java
git commit -m "feat: expose station config version admin APIs"
```

---

### Task 5: Frontend API Types And Clients

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add TypeScript types**

In `frontend/src/types/api.ts`, add:

```ts
export type StationConfigChangeType =
  | 'create'
  | 'update_city'
  | 'set_venue'
  | 'change_venue'
  | 'set_schedule'
  | 'change_schedule'
  | 'delete_station'

export type StationConfigVersionStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'applied'
  | 'withdrawn'

export interface StationConfigVersionVO {
  id: number
  stationId: number
  activityId?: number | null
  tourId?: number | null
  versionNo: number
  changeType: StationConfigChangeType
  status: StationConfigVersionStatus
  city?: string | null
  stationName?: string | null
  venueId?: number | null
  venueApplicationId?: number | null
  venueName?: string | null
  venueAddress?: string | null
  startTime?: string | null
  endTime?: string | null
  scheduleTba?: boolean | null
  seatTemplateSourceType?: string | null
  seatTemplateSourceId?: number | null
  reason?: string | null
  reviewerId?: number | null
  reviewNote?: string | null
  reviewTime?: string | null
  createdBy: number
  createdAt: string
  updatedAt: string
  appliedAt?: string | null
}

export interface ActivityDraftResponseVO {
  activity: ActivityEntity
  station: StationEntity
}

export interface StationConfigVersionDetailVO {
  station: StationEntity
  versions: StationConfigVersionVO[]
}
```

Update `StationEntity`:

```ts
activityId?: number | null
tourId?: number | null
```

- [ ] **Step 2: Add API client methods**

In `frontend/src/lib/api.ts`, add near admin APIs:

```ts
export async function createActivityDraft(body: Record<string, unknown> & { perUserLimit?: number | null }) {
  return request<import('@/types/api').ActivityDraftResponseVO>('/api/ticket/admin/activities/draft', {
    method: 'POST', body: JSON.stringify(body),
  })
}

export async function getActivityStation(activityId: number, userId: number) {
  return request<import('@/types/api').StationConfigVersionDetailVO>(`/api/ticket/admin/activities/${activityId}/station?userId=${userId}`)
}

export async function createStationConfigVersion(stationId: number, body: Record<string, unknown>) {
  return request<import('@/types/api').StationConfigVersionVO>(`/api/ticket/admin/stations/${stationId}/config-versions`, {
    method: 'POST', body: JSON.stringify(body),
  })
}

export async function updateStationConfigVersion(versionId: number, body: Record<string, unknown>) {
  return request<import('@/types/api').StationConfigVersionVO>(`/api/ticket/admin/station-config-versions/${versionId}`, {
    method: 'PUT', body: JSON.stringify(body),
  })
}

export async function deleteStationConfigVersion(versionId: number, userId: number) {
  return request<void>(`/api/ticket/admin/station-config-versions/${versionId}`, {
    method: 'DELETE', body: JSON.stringify({ userId }),
  })
}

export async function submitStationConfigVersion(versionId: number, userId: number) {
  return request<import('@/types/api').StationConfigVersionVO>(`/api/ticket/admin/station-config-versions/${versionId}/submit`, {
    method: 'POST', body: JSON.stringify({ userId }),
  })
}

export async function listStationConfigReviews(userId: number) {
  return request<import('@/types/api').StationConfigVersionVO[]>(`/api/ticket/admin/station-config-versions/reviews?userId=${userId}`)
}

export async function approveStationConfigVersion(versionId: number, body: { userId: number; reviewNote?: string }) {
  return request<import('@/types/api').StationConfigVersionVO>(`/api/ticket/admin/station-config-versions/${versionId}/approve`, {
    method: 'POST', body: JSON.stringify(body),
  })
}

export async function rejectStationConfigVersion(versionId: number, body: { userId: number; reviewNote?: string }) {
  return request<import('@/types/api').StationConfigVersionVO>(`/api/ticket/admin/station-config-versions/${versionId}/reject`, {
    method: 'POST', body: JSON.stringify(body),
  })
}
```

- [ ] **Step 3: Run typecheck**

```powershell
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit frontend API layer**

```powershell
git add -- frontend/src/types/api.ts frontend/src/lib/api.ts
git commit -m "feat: add station config frontend API types"
```

---

### Task 6: Frontend Activity And Tour Flow Updates

**Files:**
- Modify: `frontend/src/app/console/activities/new/page.tsx`
- Modify: `frontend/src/app/console/tours/new/page.tsx`
- Modify: `frontend/src/app/console/tours/[id]/stations/new/page.tsx`
- Modify: `frontend/src/app/console/tours/[id]/page.tsx`
- Create: `frontend/src/app/console/station-config-reviews/page.tsx`
- Modify: `frontend/src/app/console/layout.tsx`

- [ ] **Step 1: Remove venue proof from activity base step**

In `frontend/src/app/console/activities/new/page.tsx`:

- Remove `PrivateFileUpload` import.
- Remove `uploadPrivateAsset` import if no longer used.
- Remove state variables `venueApprovalNo`, `venueApprovalFileUrl`, `venueApprovalAsset`, `venueApprovalNote`, `uploadingVenueApproval`.
- Remove `handleVenueApprovalUpload`.
- Remove the JSX block headed `场地审批凭证`.

- [ ] **Step 2: Switch activity submit to draft + station config version**

Replace `createAdminActivity` import with `createActivityDraft` and `createStationConfigVersion`.

In `handleSubmit`, after validation, call:

```ts
const draft = await createActivityDraft({
  userId: u.userId,
  categoryId,
  artists: artists.map((artist, index) => ({
    artistId: artist.artistId,
    isPrimary: Boolean(artist.isPrimary || artist.primary),
    roleType: artist.roleType || 'performer',
    roleName: artist.roleName || '参演艺人',
    visibility: artist.visibility || 'public',
    sort: index + 1,
  })),
  name: name.trim(),
  description,
  poster,
  seatMapVisibility,
  perUserLimit: limitText ? Number(limitText) : null,
})

await createStationConfigVersion(draft.station.id, {
  userId: u.userId,
  changeType: 'set_venue',
  city: selectedCity,
  stationName: `${selectedCity}站`,
  venueId: primaryVenueId,
  venueApplicationId: sessions.find(s => s.venueApplicationId)?.venueApplicationId ?? null,
  startTime: sessions[0]?.startTime || null,
  endTime: sessions[0]?.endTime || null,
  scheduleTba: !sessions[0]?.startTime,
  seatTemplateSourceType: selectedTemplate?.sourceType ?? null,
  seatTemplateSourceId: selectedTemplate?.sourceId ?? null,
})
```

If `selectedCity` does not exist yet, add a `city` field to `SessionDraft` and UI. For existing platform venue selection, derive city from selected venue/application and still allow manual city input for new venues.

- [ ] **Step 3: Update tour new page with city list**

In `frontend/src/app/console/tours/new/page.tsx`, add state:

```ts
const [citiesText, setCitiesText] = useState('')
```

Add textarea under description:

```tsx
<label className="block">
  <span className="mb-1 block text-[13px] text-[#666]">首批城市</span>
  <textarea value={citiesText} onChange={e => setCitiesText(e.target.value)} rows={3} className="w-full resize-none rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]" placeholder="每行一个城市，例如：北京\n上海\n广州" />
  <span className="mt-1 block text-[12px] text-[#999]">城市可先官宣，场馆和时间后续补齐。</span>
</label>
```

Pass cities:

```ts
cities: citiesText.split(/\r?\n|,|，/).map(item => item.trim()).filter(Boolean),
```

- [ ] **Step 4: Make station name optional**

In `frontend/src/app/console/tours/[id]/stations/new/page.tsx`, remove the validation block requiring `stationName.trim()`. Send:

```ts
stationName: stationName.trim() || null,
```

Update label to `城市站点名` without `*`, and placeholder to `留空自动生成：城市 + 站`.

- [ ] **Step 5: Add basic review page**

Create `frontend/src/app/console/station-config-reviews/page.tsx` with a client component that:

- Reads `getUser()`.
- Calls `listStationConfigReviews(user.userId)`.
- Renders version number, change type, city, station name, venue name, reason.
- Has approve/reject buttons calling `approveStationConfigVersion` and `rejectStationConfigVersion`.

- [ ] **Step 6: Add console navigation link**

In `frontend/src/app/console/layout.tsx`, add link:

```ts
{ href: '/console/station-config-reviews', label: '站点变更审核', icon: ShieldCheck },
```

Import `ShieldCheck` from `lucide-react`.

- [ ] **Step 7: Run typecheck**

```powershell
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit frontend flows**

```powershell
git add -- frontend/src/app/console/activities/new/page.tsx frontend/src/app/console/tours/new/page.tsx frontend/src/app/console/tours/[id]/stations/new/page.tsx frontend/src/app/console/tours/[id]/page.tsx frontend/src/app/console/station-config-reviews/page.tsx frontend/src/app/console/layout.tsx
git commit -m "feat: update activity and tour station flows"
```

---

### Task 7: Migration Backfill And Final Verification

**Files:**
- Modify: `sql/production-split/ticket/20260525_station_config_version.sql`
- Modify: `sql/migrations/shared/20260525_station_config_version.sql`

- [ ] **Step 1: Add historical backfill SQL**

Append to both migration files:

```sql
INSERT INTO station_config_version (
    station_id, activity_id, tour_id, version_no, change_type, status,
    city, station_name, venue_application_id, schedule_tba,
    created_by, created_at, updated_at, applied_at
)
SELECT
    s.id, s.activity_id, s.tour_id, 1, 'create', 'applied',
    s.city, s.station_name, s.venue_application_id, FALSE,
    COALESCE(t.organizer_id, a.organizer_id, 0),
    COALESCE(s.create_time, CURRENT_TIMESTAMP),
    COALESCE(s.update_time, CURRENT_TIMESTAMP),
    COALESCE(s.update_time, CURRENT_TIMESTAMP)
FROM station s
LEFT JOIN tour t ON t.id = s.tour_id
LEFT JOIN activity a ON a.id = s.activity_id
WHERE NOT EXISTS (
    SELECT 1 FROM station_config_version v WHERE v.station_id = s.id
);
```

Do not add cross-service references. These tables are all ticket-owned.

- [ ] **Step 2: Run targeted backend tests**

From `java`:

```powershell
mvn test -pl java-ticket "-Dtest=StationConfigVersionServiceTest,ActivityDraftServiceTest,TourStationServiceTest,AdminControllerTest"
```

Expected: PASS.

- [ ] **Step 3: Run frontend typecheck**

From `frontend`:

```powershell
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Run boundary checks**

From repo root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1
git diff --check
```

Expected: all pass. `git diff --check` may show LF/CRLF warnings but must not show whitespace errors.

- [ ] **Step 5: Commit backfill and verification fixes**

```powershell
git add -- sql/production-split/ticket/20260525_station_config_version.sql sql/migrations/shared/20260525_station_config_version.sql
git commit -m "feat: backfill station config version history"
```

---

## Plan Self-Review

- Spec coverage: covers unified normal-activity/tour station model, station config versions, draft deletion, historical records, venue application reuse, city list creation, station review page, and migration/backfill.
- Known implementation risk: `StationConfigVersionService` ownership requires `TourMapper` and `ActivityMapper` injection before controller exposure; Task 2 explicitly blocks shipping endpoints until completed.
- Placeholder scan: no `TBD` or vague “handle later” steps; the only intentionally staged area is marked with exact replacement code and required tests.
- Type consistency: frontend `StationConfigVersionVO`, backend `StationConfigVersionResponse`, and status/change type names use the same string values.
- Verification: includes Maven targeted tests, `pnpm typecheck`, boundary verifier, production SQL checker, and `git diff --check`.
