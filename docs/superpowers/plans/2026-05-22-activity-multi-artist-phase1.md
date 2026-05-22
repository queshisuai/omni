# Activity Multi-Artist Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Phase 1 of activity multi-artist support so activities can store, edit, seed, and display ordered artist lineups without exposing artist IDs to operators.

**Architecture:** Ticket service owns artists and activity lineups. Add an `activity_artist` same-owner table and DTO/service layer for lineup validation, persistence, and read models. Frontend uses a reusable tag-style selector backed by artist search, while C端 only receives public lineup entries.

**Tech Stack:** Java Spring Boot, MyBatis-Plus, PostgreSQL, Next.js 16, React 19, TypeScript, Maven, pnpm.

---

## File Map

Backend files:

- Modify `java/java-ticket/src/main/java/com/omni/ticket/entity/Artist.java`: add expanded artist profile fields and risk placeholders.
- Create `java/java-ticket/src/main/java/com/omni/ticket/entity/ActivityArtist.java`: map `activity_artist` join table.
- Create `java/java-ticket/src/main/java/com/omni/ticket/mapper/ActivityArtistMapper.java`: MyBatis-Plus mapper.
- Create `java/java-ticket/src/main/java/com/omni/ticket/dto/ActivityArtistDto.java`: request/response DTO for admin and C端 lineups.
- Create `java/java-ticket/src/main/java/com/omni/ticket/dto/ArtistSearchResponse.java`: search result DTO with identity context.
- Create `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityArtistService.java`: validate, normalize, save, and read lineups.
- Create `java/java-ticket/src/main/java/com/omni/ticket/service/ArtistAdminService.java`: artist search/detail for admin forms.
- Modify `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`: expose artist search/detail and accept/return `artists[]` on activity create/update/detail.
- Modify `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityService.java`: include public lineup in C端 list/detail and hide hidden guests.
- Modify `java/java-ticket/src/main/java/com/omni/ticket/dto/ActivityVO.java`: add public artist list and keep `artistName` summary.
- Modify `java/java-ticket/src/main/java/com/omni/ticket/dto/ActivityDetailVO.java`: add public artist list.
- Modify `java/java-ticket/src/main/java/com/omni/ticket/entity/Activity.java`: keep transient `artistName`, add transient `artists` for admin response.
- Modify `java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java`: cover create/update/detail lineup flows.
- Create `java/java-ticket/src/test/java/com/omni/ticket/service/ActivityArtistServiceTest.java`: cover validation and ordering.
- Modify `java/java-ticket/src/test/java/com/omni/ticket/service/ActivityServiceTest.java` if present; otherwise add tests to existing appropriate service test file.

SQL files:

- Create `sql/migrations/shared/20260522_activity_multi_artist_phase1.sql`: shared schema migration.
- Create `sql/production-split/ticket/20260522_activity_multi_artist_phase1.sql`: ticket prod-split migration.
- Modify `sql/seed.sql`: expanded real-style artist seeds, activity seeds, and `activity_artist` rows.

Frontend files:

- Modify `frontend/src/types/api.ts`: artist profile, activity artist DTOs, activity response fields.
- Modify `frontend/src/lib/api.ts`: artist search/detail API wrappers.
- Create `frontend/src/components/activity-artist/ActivityArtistSelector.tsx`: tag selector with search, roles, visibility, primary, and simple reorder controls.
- Modify `frontend/src/app/console/activities/new/page.tsx`: use selector and submit `artists[]`.
- Modify `frontend/src/app/console/activities/[id]/edit/page.tsx`: load selector from `artists[]` and save `artists[]`.
- Modify `frontend/src/app/console/activities/page.tsx`: display artist summary when present.
- Modify `frontend/src/app/activity/[id]/page.tsx`: display public lineup list.
- Modify `frontend/src/app/page.tsx` and `frontend/src/components/TicketCard.tsx` only if existing card data needs artist summary.

Verification:

- `mvn -pl java-ticket "-Dtest=ActivityArtistServiceTest,AdminControllerTest" test`
- `mvn test -pl java-ticket -am`
- `pnpm typecheck`
- `powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1`
- `powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1`
- `git diff --check`

---

### Task 1: Finish Single-Name Edit Cleanup Already In Progress

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/entity/Activity.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java`
- Modify: `frontend/src/app/console/activities/[id]/edit/page.tsx`
- Modify: `frontend/src/types/api.ts`

- [ ] **Step 1: Keep the existing failing tests for artist name edit behavior**

Ensure `AdminControllerTest` contains these two tests:

```java
@Test
void getAdminActivityReturnsArtistName() {
    AdminController controller = controller();
    when(userAccessService.requireAdminOrOrganizerRole(2003L)).thenReturn("organizer");
    Activity activity = new Activity();
    activity.setId(10L);
    activity.setOrganizerId(2003L);
    activity.setArtistId(88L);
    when(activityMapper.selectById(10L)).thenReturn(activity);
    Artist artist = new Artist();
    artist.setId(88L);
    artist.setName("新乐队");
    when(artistMapper.selectById(88L)).thenReturn(artist);

    Result<Activity> result = controller.getAdminActivity(10L, 2003L);

    assertEquals(200, result.getCode());
    assertEquals("新乐队", result.getData().getArtistName());
}

@Test
void updateActivityUpdatesArtistFromName() {
    AdminController controller = controller();
    when(userAccessService.requireAdminOrOrganizerRole(2003L)).thenReturn("organizer");
    Activity activity = new Activity();
    activity.setId(10L);
    activity.setOrganizerId(2003L);
    activity.setArtistId(1L);
    when(activityMapper.selectById(10L)).thenReturn(activity);
    when(artistMapper.insert(any())).thenAnswer(invocation -> {
        Artist artist = invocation.getArgument(0);
        artist.setId(89L);
        return 1;
    });

    Result<Activity> result = controller.updateActivity(10L, Map.of(
            "userId", 2003L,
            "artistName", "新组合"
    ));

    ArgumentCaptor<Activity> activityCaptor = ArgumentCaptor.forClass(Activity.class);
    verify(activityMapper).updateById(activityCaptor.capture());
    assertEquals(200, result.getCode());
    assertEquals(89L, activityCaptor.getValue().getArtistId());
}
```

- [ ] **Step 2: Run tests to confirm current behavior is covered**

Run:

```powershell
mvn -pl java-ticket "-Dtest=AdminControllerTest#getAdminActivityReturnsArtistName+updateActivityUpdatesArtistFromName" test
```

Expected: PASS if the current working tree already has the cleanup; otherwise FAIL because `Activity.getArtistName()` or update-by-name support is missing.

- [ ] **Step 3: Implement minimal cleanup if not already present**

In `Activity.java`, add transient fields:

```java
@TableField(exist = false)
private String artistName;

public String getArtistName() { return artistName; }
public void setArtistName(String artistName) { this.artistName = artistName; }
```

In `AdminController.updateActivity(...)`, allow `artistName` when `artistId` is absent:

```java
if (body.containsKey("artistId")) {
    Long artistId = parsePositiveLong(body.get("artistId"));
    if (artistId == null) return Result.fail(400, "艺人/团队名称不能为空");
    activity.setArtistId(artistId);
} else if (body.containsKey("artistName")) {
    Long artistId = resolveArtistId(body);
    if (artistId == null) return Result.fail(400, "艺人/团队名称不能为空");
    activity.setArtistId(artistId);
}
```

In `AdminController.getAdminActivity(...)`, attach artist name before returning:

```java
attachArtistName(activity);
return Result.success(activity);
```

Add helper:

```java
private void attachArtistName(Activity activity) {
    if (activity == null || activity.getArtistId() == null || artistMapper == null) return;
    Artist artist = artistMapper.selectById(activity.getArtistId());
    if (artist != null) activity.setArtistName(artist.getName());
}
```

In `frontend/src/app/console/activities/[id]/edit/page.tsx`, remove `artistId` form state and use `artistName` text input only.

- [ ] **Step 4: Verify cleanup**

Run:

```powershell
mvn -pl java-ticket "-Dtest=AdminControllerTest" test
```

Expected: 16+ tests, 0 failures.

Run:

```powershell
pnpm typecheck
```

Expected: `tsc --noEmit` exits 0.

- [ ] **Step 5: Commit cleanup separately**

```powershell
git add java/java-ticket/src/main/java/com/omni/ticket/entity/Activity.java java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java frontend/src/app/console/activities/[id]/edit/page.tsx frontend/src/types/api.ts
git commit -m "fix: edit activities by artist name"
```

---

### Task 2: Add Database Schema For Artist Profiles And Activity Lineups

**Files:**
- Create: `sql/migrations/shared/20260522_activity_multi_artist_phase1.sql`
- Create: `sql/production-split/ticket/20260522_activity_multi_artist_phase1.sql`

- [ ] **Step 1: Write shared migration**

Create `sql/migrations/shared/20260522_activity_multi_artist_phase1.sql`:

```sql
ALTER TABLE artist ADD COLUMN IF NOT EXISTS alias VARCHAR(255);
ALTER TABLE artist ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE artist ADD COLUMN IF NOT EXISTS birth_year INTEGER;
ALTER TABLE artist ADD COLUMN IF NOT EXISTS gender VARCHAR(30);
ALTER TABLE artist ADD COLUMN IF NOT EXISTS artist_type VARCHAR(60);
ALTER TABLE artist ADD COLUMN IF NOT EXISTS country_or_region VARCHAR(120);
ALTER TABLE artist ADD COLUMN IF NOT EXISTS agency VARCHAR(255);
ALTER TABLE artist ADD COLUMN IF NOT EXISTS representative_works TEXT;
ALTER TABLE artist ADD COLUMN IF NOT EXISTS category_tags VARCHAR(500);
ALTER TABLE artist ADD COLUMN IF NOT EXISTS external_links TEXT;
ALTER TABLE artist ADD COLUMN IF NOT EXISTS source_note TEXT;
ALTER TABLE artist ADD COLUMN IF NOT EXISTS risk_status VARCHAR(30) NOT NULL DEFAULT 'normal';
ALTER TABLE artist ADD COLUMN IF NOT EXISTS risk_reason TEXT;
ALTER TABLE artist ADD COLUMN IF NOT EXISTS risk_marked_by BIGINT;
ALTER TABLE artist ADD COLUMN IF NOT EXISTS risk_marked_at TIMESTAMP;
ALTER TABLE artist ADD COLUMN IF NOT EXISTS risk_cleared_by BIGINT;
ALTER TABLE artist ADD COLUMN IF NOT EXISTS risk_cleared_at TIMESTAMP;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_artist_risk_status'
          AND conrelid = 'artist'::regclass
    ) THEN
        ALTER TABLE artist ADD CONSTRAINT chk_artist_risk_status CHECK (risk_status IN ('normal', 'risk', 'blocked', 'disabled'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_artist_name ON artist(name);
CREATE INDEX IF NOT EXISTS idx_artist_alias ON artist(alias);
CREATE INDEX IF NOT EXISTS idx_artist_tags ON artist(category_tags);
CREATE INDEX IF NOT EXISTS idx_artist_risk_status ON artist(risk_status);

CREATE TABLE IF NOT EXISTS activity_artist (
    id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT NOT NULL REFERENCES activity(id) ON DELETE CASCADE,
    artist_id BIGINT NOT NULL REFERENCES artist(id),
    sort INTEGER NOT NULL DEFAULT 1,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    role_type VARCHAR(60) NOT NULL DEFAULT 'performer',
    role_name VARCHAR(120),
    visibility VARCHAR(20) NOT NULL DEFAULT 'public',
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_activity_artist_visibility CHECK (visibility IN ('public', 'hidden')),
    CONSTRAINT chk_activity_artist_status CHECK (status IN (0, 1))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_activity_artist_active_artist
    ON activity_artist(activity_id, artist_id)
    WHERE status = 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_activity_artist_primary
    ON activity_artist(activity_id)
    WHERE status = 1 AND is_primary = TRUE;

CREATE INDEX IF NOT EXISTS idx_activity_artist_activity ON activity_artist(activity_id, sort, id);
CREATE INDEX IF NOT EXISTS idx_activity_artist_artist ON activity_artist(artist_id);

INSERT INTO activity_artist (activity_id, artist_id, sort, is_primary, role_type, role_name, visibility, status)
SELECT a.id, a.artist_id, 1, TRUE, 'primary', '主艺人', 'public', 1
FROM activity a
WHERE a.artist_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM activity_artist aa
      WHERE aa.activity_id = a.id
        AND aa.artist_id = a.artist_id
        AND aa.status = 1
  );
```

- [ ] **Step 2: Write prod-split ticket migration**

Create `sql/production-split/ticket/20260522_activity_multi_artist_phase1.sql` with the same SQL content as the shared migration.

- [ ] **Step 3: Run SQL safety checks**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1
```

Expected: `PASS production split SQL safety check`.

- [ ] **Step 4: Commit migrations**

```powershell
git add sql/migrations/shared/20260522_activity_multi_artist_phase1.sql sql/production-split/ticket/20260522_activity_multi_artist_phase1.sql
git commit -m "feat: add activity artist schema"
```

---

### Task 3: Add Backend Entity, DTO, Mapper, And Lineup Service

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/entity/Artist.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/entity/ActivityArtist.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/mapper/ActivityArtistMapper.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/ActivityArtistDto.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityArtistService.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/ActivityArtistServiceTest.java`

- [ ] **Step 1: Write failing service tests**

Create `ActivityArtistServiceTest.java` with tests for primary sorting, duplicate rejection, hidden public filtering, and empty lineup behavior:

```java
package com.omni.ticket.service;

import com.omni.ticket.dto.ActivityArtistDto;
import com.omni.ticket.entity.ActivityArtist;
import com.omni.ticket.entity.Artist;
import com.omni.ticket.mapper.ActivityArtistMapper;
import com.omni.ticket.mapper.ArtistMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ActivityArtistServiceTest {
    @Mock ActivityArtistMapper activityArtistMapper;
    @Mock ArtistMapper artistMapper;

    @Test
    void saveLineupMovesPrimaryToFirstAndPersistsRows() {
        ActivityArtistService service = new ActivityArtistService(activityArtistMapper, artistMapper);
        Artist a1 = artist(1L, "五月天");
        Artist a2 = artist(2L, "周杰伦");
        when(artistMapper.selectBatchIds(List.of(1L, 2L))).thenReturn(List.of(a1, a2));

        ActivityArtistDto first = new ActivityArtistDto();
        first.setArtistId(1L);
        first.setRoleType("co_headliner");
        first.setRoleName("联合主演");
        first.setVisibility("public");
        first.setSort(1);
        ActivityArtistDto second = new ActivityArtistDto();
        second.setArtistId(2L);
        second.setPrimary(true);
        second.setRoleType("primary");
        second.setRoleName("主艺人");
        second.setVisibility("public");
        second.setSort(2);

        service.saveLineup(10L, List.of(first, second));

        ArgumentCaptor<ActivityArtist> captor = ArgumentCaptor.forClass(ActivityArtist.class);
        verify(activityArtistMapper, times(2)).insert(captor.capture());
        assertEquals(2L, captor.getAllValues().get(0).getArtistId());
        assertTrue(captor.getAllValues().get(0).getPrimary());
        assertEquals(1, captor.getAllValues().get(0).getSort());
        assertEquals(1L, captor.getAllValues().get(1).getArtistId());
        assertFalse(captor.getAllValues().get(1).getPrimary());
        assertEquals(2, captor.getAllValues().get(1).getSort());
    }

    @Test
    void saveLineupRejectsDuplicateArtist() {
        ActivityArtistService service = new ActivityArtistService(activityArtistMapper, artistMapper);
        ActivityArtistDto one = new ActivityArtistDto();
        one.setArtistId(1L);
        ActivityArtistDto two = new ActivityArtistDto();
        two.setArtistId(1L);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.saveLineup(10L, List.of(one, two)));

        assertEquals("同一活动不能重复选择同一艺人", ex.getMessage());
        verify(activityArtistMapper, never()).insert(any());
    }

    @Test
    void listPublicLineupFiltersHiddenArtists() {
        ActivityArtistService service = new ActivityArtistService(activityArtistMapper, artistMapper);
        ActivityArtist publicArtist = row(10L, 1L, 1, true, "public");
        ActivityArtist hiddenArtist = row(10L, 2L, 2, false, "hidden");
        when(activityArtistMapper.selectList(any())).thenReturn(List.of(publicArtist, hiddenArtist));
        when(artistMapper.selectBatchIds(List.of(1L, 2L))).thenReturn(List.of(artist(1L, "周杰伦"), artist(2L, "保密嘉宾")));

        List<ActivityArtistDto> result = service.listPublicLineup(10L);

        assertEquals(1, result.size());
        assertEquals("周杰伦", result.get(0).getName());
    }

    private Artist artist(Long id, String name) {
        Artist artist = new Artist();
        artist.setId(id);
        artist.setName(name);
        artist.setStatus(1);
        return artist;
    }

    private ActivityArtist row(Long activityId, Long artistId, int sort, boolean primary, String visibility) {
        ActivityArtist row = new ActivityArtist();
        row.setActivityId(activityId);
        row.setArtistId(artistId);
        row.setSort(sort);
        row.setPrimary(primary);
        row.setRoleType(primary ? "primary" : "special_guest");
        row.setRoleName(primary ? "主艺人" : "特邀嘉宾");
        row.setVisibility(visibility);
        row.setStatus(1);
        return row;
    }
}
```

- [ ] **Step 2: Run tests to verify red**

Run:

```powershell
mvn -pl java-ticket "-Dtest=ActivityArtistServiceTest" test
```

Expected: FAIL because `ActivityArtistService`, `ActivityArtist`, and `ActivityArtistDto` do not exist.

- [ ] **Step 3: Implement entity and mapper**

Create `ActivityArtist.java`:

```java
package com.omni.ticket.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

@TableName("activity_artist")
public class ActivityArtist {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long activityId;
    private Long artistId;
    private Integer sort;
    private Boolean isPrimary;
    private String roleType;
    private String roleName;
    private String visibility;
    private Integer status;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getActivityId() { return activityId; }
    public void setActivityId(Long activityId) { this.activityId = activityId; }
    public Long getArtistId() { return artistId; }
    public void setArtistId(Long artistId) { this.artistId = artistId; }
    public Integer getSort() { return sort; }
    public void setSort(Integer sort) { this.sort = sort; }
    public Boolean getPrimary() { return isPrimary; }
    public void setPrimary(Boolean primary) { isPrimary = primary; }
    public String getRoleType() { return roleType; }
    public void setRoleType(String roleType) { this.roleType = roleType; }
    public String getRoleName() { return roleName; }
    public void setRoleName(String roleName) { this.roleName = roleName; }
    public String getVisibility() { return visibility; }
    public void setVisibility(String visibility) { this.visibility = visibility; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public LocalDateTime getUpdateTime() { return updateTime; }
    public void setUpdateTime(LocalDateTime updateTime) { this.updateTime = updateTime; }
}
```

Create `ActivityArtistMapper.java`:

```java
package com.omni.ticket.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.omni.ticket.entity.ActivityArtist;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface ActivityArtistMapper extends BaseMapper<ActivityArtist> {
}
```

- [ ] **Step 4: Implement DTO**

Create `ActivityArtistDto.java`:

```java
package com.omni.ticket.dto;

public class ActivityArtistDto {
    private Long artistId;
    private String name;
    private String alias;
    private String artistType;
    private String countryOrRegion;
    private String categoryTags;
    private String avatar;
    private Boolean isPrimary;
    private String roleType;
    private String roleName;
    private String visibility;
    private Integer sort;

    public Long getArtistId() { return artistId; }
    public void setArtistId(Long artistId) { this.artistId = artistId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getAlias() { return alias; }
    public void setAlias(String alias) { this.alias = alias; }
    public String getArtistType() { return artistType; }
    public void setArtistType(String artistType) { this.artistType = artistType; }
    public String getCountryOrRegion() { return countryOrRegion; }
    public void setCountryOrRegion(String countryOrRegion) { this.countryOrRegion = countryOrRegion; }
    public String getCategoryTags() { return categoryTags; }
    public void setCategoryTags(String categoryTags) { this.categoryTags = categoryTags; }
    public String getAvatar() { return avatar; }
    public void setAvatar(String avatar) { this.avatar = avatar; }
    public Boolean getPrimary() { return isPrimary; }
    public void setPrimary(Boolean primary) { isPrimary = primary; }
    public String getRoleType() { return roleType; }
    public void setRoleType(String roleType) { this.roleType = roleType; }
    public String getRoleName() { return roleName; }
    public void setRoleName(String roleName) { this.roleName = roleName; }
    public String getVisibility() { return visibility; }
    public void setVisibility(String visibility) { this.visibility = visibility; }
    public Integer getSort() { return sort; }
    public void setSort(Integer sort) { this.sort = sort; }
}
```

- [ ] **Step 5: Expand Artist entity fields**

Add these fields and getters/setters to `Artist.java`:

```java
private String alias;
private java.time.LocalDate birthDate;
private Integer birthYear;
private String gender;
private String artistType;
private String countryOrRegion;
private String agency;
private String representativeWorks;
private String categoryTags;
private String externalLinks;
private String sourceNote;
private String riskStatus;
private String riskReason;
private Long riskMarkedBy;
private java.time.LocalDateTime riskMarkedAt;
private Long riskClearedBy;
private java.time.LocalDateTime riskClearedAt;
```

- [ ] **Step 6: Implement ActivityArtistService**

Create `ActivityArtistService.java`:

```java
package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.ticket.dto.ActivityArtistDto;
import com.omni.ticket.entity.ActivityArtist;
import com.omni.ticket.entity.Artist;
import com.omni.ticket.mapper.ActivityArtistMapper;
import com.omni.ticket.mapper.ArtistMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class ActivityArtistService {
    private static final String VISIBILITY_PUBLIC = "public";
    private static final String VISIBILITY_HIDDEN = "hidden";

    private final ActivityArtistMapper activityArtistMapper;
    private final ArtistMapper artistMapper;

    public ActivityArtistService(ActivityArtistMapper activityArtistMapper, ArtistMapper artistMapper) {
        this.activityArtistMapper = activityArtistMapper;
        this.artistMapper = artistMapper;
    }

    @Transactional
    public void saveLineup(Long activityId, List<ActivityArtistDto> artists) {
        if (activityId == null || activityId <= 0) throw new IllegalArgumentException("活动ID不正确");
        activityArtistMapper.delete(new LambdaQueryWrapper<ActivityArtist>().eq(ActivityArtist::getActivityId, activityId));
        List<ActivityArtistDto> normalized = normalize(artists);
        LocalDateTime now = LocalDateTime.now();
        for (ActivityArtistDto dto : normalized) {
            ActivityArtist row = new ActivityArtist();
            row.setActivityId(activityId);
            row.setArtistId(dto.getArtistId());
            row.setSort(dto.getSort());
            row.setPrimary(Boolean.TRUE.equals(dto.getPrimary()));
            row.setRoleType(defaultText(dto.getRoleType(), row.getPrimary() ? "primary" : "performer"));
            row.setRoleName(defaultText(dto.getRoleName(), row.getPrimary() ? "主艺人" : "参演艺人"));
            row.setVisibility(defaultText(dto.getVisibility(), VISIBILITY_PUBLIC));
            row.setStatus(1);
            row.setCreateTime(now);
            row.setUpdateTime(now);
            activityArtistMapper.insert(row);
        }
    }

    public List<ActivityArtistDto> listAdminLineup(Long activityId) {
        return listLineup(activityId, false);
    }

    public List<ActivityArtistDto> listPublicLineup(Long activityId) {
        return listLineup(activityId, true);
    }

    public String buildPublicSummary(Long activityId) {
        return listPublicLineup(activityId).stream()
                .map(ActivityArtistDto::getName)
                .filter(StringUtils::hasText)
                .collect(Collectors.joining("、"));
    }

    private List<ActivityArtistDto> normalize(List<ActivityArtistDto> artists) {
        if (artists == null || artists.isEmpty()) return List.of();
        Set<Long> seen = new HashSet<>();
        List<Long> ids = new ArrayList<>();
        int primaryCount = 0;
        for (ActivityArtistDto dto : artists) {
            if (dto == null || dto.getArtistId() == null || dto.getArtistId() <= 0) {
                throw new IllegalArgumentException("艺人信息不正确");
            }
            if (!seen.add(dto.getArtistId())) throw new IllegalArgumentException("同一活动不能重复选择同一艺人");
            ids.add(dto.getArtistId());
            if (Boolean.TRUE.equals(dto.getPrimary())) primaryCount++;
            String visibility = defaultText(dto.getVisibility(), VISIBILITY_PUBLIC);
            if (!VISIBILITY_PUBLIC.equals(visibility) && !VISIBILITY_HIDDEN.equals(visibility)) {
                throw new IllegalArgumentException("艺人展示状态不正确");
            }
        }
        if (primaryCount > 1) throw new IllegalArgumentException("主艺人只能设置一个");
        Map<Long, Artist> artistMap = artistMapper.selectBatchIds(ids).stream()
                .filter(artist -> artist.getStatus() == null || artist.getStatus() == 1)
                .collect(Collectors.toMap(Artist::getId, Function.identity()));
        if (artistMap.size() != ids.size()) throw new IllegalArgumentException("艺人不存在或已停用");

        List<ActivityArtistDto> copy = artists.stream()
                .map(this::copy)
                .sorted(Comparator.comparing((ActivityArtistDto dto) -> Boolean.TRUE.equals(dto.getPrimary()) ? 0 : 1)
                        .thenComparing(dto -> dto.getSort() == null ? Integer.MAX_VALUE : dto.getSort()))
                .collect(Collectors.toList());
        for (int i = 0; i < copy.size(); i++) copy.get(i).setSort(i + 1);
        return copy;
    }

    private List<ActivityArtistDto> listLineup(Long activityId, boolean publicOnly) {
        if (activityId == null || activityId <= 0) return List.of();
        List<ActivityArtist> rows = activityArtistMapper.selectList(new LambdaQueryWrapper<ActivityArtist>()
                .eq(ActivityArtist::getActivityId, activityId)
                .eq(ActivityArtist::getStatus, 1)
                .orderByAsc(ActivityArtist::getSort)
                .orderByAsc(ActivityArtist::getId));
        if (rows.isEmpty()) return List.of();
        List<Long> ids = rows.stream().map(ActivityArtist::getArtistId).distinct().collect(Collectors.toList());
        Map<Long, Artist> artistMap = artistMapper.selectBatchIds(ids).stream()
                .collect(Collectors.toMap(Artist::getId, Function.identity()));
        return rows.stream()
                .filter(row -> !publicOnly || VISIBILITY_PUBLIC.equals(row.getVisibility()))
                .map(row -> toDto(row, artistMap.get(row.getArtistId())))
                .collect(Collectors.toList());
    }

    private ActivityArtistDto toDto(ActivityArtist row, Artist artist) {
        ActivityArtistDto dto = new ActivityArtistDto();
        dto.setArtistId(row.getArtistId());
        dto.setPrimary(Boolean.TRUE.equals(row.getPrimary()));
        dto.setRoleType(row.getRoleType());
        dto.setRoleName(row.getRoleName());
        dto.setVisibility(row.getVisibility());
        dto.setSort(row.getSort());
        if (artist != null) {
            dto.setName(artist.getName());
            dto.setAlias(artist.getAlias());
            dto.setArtistType(artist.getArtistType());
            dto.setCountryOrRegion(artist.getCountryOrRegion());
            dto.setCategoryTags(artist.getCategoryTags());
            dto.setAvatar(artist.getAvatar());
        }
        return dto;
    }

    private ActivityArtistDto copy(ActivityArtistDto source) {
        ActivityArtistDto dto = new ActivityArtistDto();
        dto.setArtistId(source.getArtistId());
        dto.setPrimary(Boolean.TRUE.equals(source.getPrimary()));
        dto.setRoleType(source.getRoleType());
        dto.setRoleName(source.getRoleName());
        dto.setVisibility(defaultText(source.getVisibility(), VISIBILITY_PUBLIC));
        dto.setSort(source.getSort());
        return dto;
    }

    private String defaultText(String value, String defaultValue) {
        return StringUtils.hasText(value) ? value.trim() : defaultValue;
    }
}
```

- [ ] **Step 7: Run service tests**

Run:

```powershell
mvn -pl java-ticket "-Dtest=ActivityArtistServiceTest" test
```

Expected: PASS.

- [ ] **Step 8: Commit backend model/service**

```powershell
git add java/java-ticket/src/main/java/com/omni/ticket/entity/Artist.java java/java-ticket/src/main/java/com/omni/ticket/entity/ActivityArtist.java java/java-ticket/src/main/java/com/omni/ticket/mapper/ActivityArtistMapper.java java/java-ticket/src/main/java/com/omni/ticket/dto/ActivityArtistDto.java java/java-ticket/src/main/java/com/omni/ticket/service/ActivityArtistService.java java/java-ticket/src/test/java/com/omni/ticket/service/ActivityArtistServiceTest.java
git commit -m "feat: add activity artist lineup service"
```

---

### Task 4: Add Artist Search API And Admin Activity Lineup API

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/ArtistSearchResponse.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/ArtistAdminService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/entity/Activity.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java`

- [ ] **Step 1: Write failing controller tests**

Add tests to `AdminControllerTest`:

```java
@Test
void createActivityStoresLineupAndSyncsPrimaryArtist() {
    AdminController controller = controller();
    when(userAccessService.requireAdminOrOrganizerRole(2003L)).thenReturn("organizer");

    Result<Activity> result = controller.createActivity(Map.of(
            "userId", 2003L,
            "categoryId", 1L,
            "name", "多艺人活动",
            "artists", List.of(
                    Map.of("artistId", 1L, "isPrimary", false, "sort", 1, "visibility", "public"),
                    Map.of("artistId", 2L, "isPrimary", true, "sort", 2, "visibility", "public")
            )
    ));

    ArgumentCaptor<Activity> activityCaptor = ArgumentCaptor.forClass(Activity.class);
    verify(activityMapper).insert(activityCaptor.capture());
    verify(activityArtistService).saveLineup(any(), any());
    assertEquals(200, result.getCode());
    assertEquals(2L, activityCaptor.getValue().getArtistId());
}

@Test
void getAdminActivityReturnsFullLineupIncludingHiddenGuest() {
    AdminController controller = controller();
    when(userAccessService.requireAdminOrOrganizerRole(2003L)).thenReturn("organizer");
    Activity activity = new Activity();
    activity.setId(10L);
    activity.setOrganizerId(2003L);
    when(activityMapper.selectById(10L)).thenReturn(activity);
    ActivityArtistDto visible = new ActivityArtistDto();
    visible.setArtistId(1L);
    visible.setName("周杰伦");
    visible.setVisibility("public");
    ActivityArtistDto hidden = new ActivityArtistDto();
    hidden.setArtistId(2L);
    hidden.setName("保密嘉宾");
    hidden.setVisibility("hidden");
    when(activityArtistService.listAdminLineup(10L)).thenReturn(List.of(visible, hidden));

    Result<Activity> result = controller.getAdminActivity(10L, 2003L);

    assertEquals(200, result.getCode());
    assertEquals(2, result.getData().getArtists().size());
    assertEquals("周杰伦", result.getData().getArtistName());
}
```

Add mocks and constructor parameters for `ActivityArtistService` and `ArtistAdminService`.

- [ ] **Step 2: Run tests to verify red**

Run:

```powershell
mvn -pl java-ticket "-Dtest=AdminControllerTest#createActivityStoresLineupAndSyncsPrimaryArtist+getAdminActivityReturnsFullLineupIncludingHiddenGuest" test
```

Expected: FAIL because controller does not accept `artists[]` and `Activity.getArtists()` is missing.

- [ ] **Step 3: Add transient artists field to Activity**

In `Activity.java`:

```java
@TableField(exist = false)
private java.util.List<com.omni.ticket.dto.ActivityArtistDto> artists;

public java.util.List<com.omni.ticket.dto.ActivityArtistDto> getArtists() { return artists; }
public void setArtists(java.util.List<com.omni.ticket.dto.ActivityArtistDto> artists) { this.artists = artists; }
```

- [ ] **Step 4: Implement ArtistSearchResponse and ArtistAdminService**

Create `ArtistSearchResponse.java`:

```java
package com.omni.ticket.dto;

public class ArtistSearchResponse {
    private Long id;
    private String name;
    private String alias;
    private String artistType;
    private String countryOrRegion;
    private String categoryTags;
    private String avatar;
    private String representativeWorks;
    private String riskStatus;
    // getters and setters for all fields
}
```

Create `ArtistAdminService.java`:

```java
package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.ticket.dto.ArtistSearchResponse;
import com.omni.ticket.entity.Artist;
import com.omni.ticket.mapper.ArtistMapper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ArtistAdminService {
    private final ArtistMapper artistMapper;

    public ArtistAdminService(ArtistMapper artistMapper) {
        this.artistMapper = artistMapper;
    }

    public List<ArtistSearchResponse> search(String keyword) {
        String term = keyword == null ? "" : keyword.trim();
        LambdaQueryWrapper<Artist> wrapper = new LambdaQueryWrapper<Artist>()
                .eq(Artist::getStatus, 1)
                .orderByAsc(Artist::getName)
                .last("LIMIT 20");
        if (StringUtils.hasText(term)) {
            wrapper.and(w -> w.like(Artist::getName, term)
                    .or().like(Artist::getAlias, term)
                    .or().like(Artist::getCategoryTags, term)
                    .or().like(Artist::getRepresentativeWorks, term));
        }
        return artistMapper.selectList(wrapper).stream().map(this::toResponse).collect(Collectors.toList());
    }

    public Artist getById(Long id) {
        return id == null || id <= 0 ? null : artistMapper.selectById(id);
    }

    private ArtistSearchResponse toResponse(Artist artist) {
        ArtistSearchResponse response = new ArtistSearchResponse();
        response.setId(artist.getId());
        response.setName(artist.getName());
        response.setAlias(artist.getAlias());
        response.setArtistType(artist.getArtistType());
        response.setCountryOrRegion(artist.getCountryOrRegion());
        response.setCategoryTags(artist.getCategoryTags());
        response.setAvatar(artist.getAvatar());
        response.setRepresentativeWorks(artist.getRepresentativeWorks());
        response.setRiskStatus(artist.getRiskStatus());
        return response;
    }
}
```

- [ ] **Step 5: Update AdminController constructor and endpoints**

Inject `ActivityArtistService` and `ArtistAdminService`.

Add endpoints:

```java
@GetMapping("/artists/search")
public Result<List<ArtistSearchResponse>> searchArtists(@RequestParam(required = false) String keyword) {
    return Result.success(artistAdminService.search(keyword));
}

@GetMapping("/artists/{id}")
public Result<Artist> getArtist(@PathVariable Long id) {
    Artist artist = artistAdminService.getById(id);
    if (artist == null) return Result.fail(404, "艺人不存在");
    return Result.success(artist);
}
```

Add helper to parse `artists[]` from request body:

```java
@SuppressWarnings("unchecked")
private List<ActivityArtistDto> parseArtists(Object value) {
    if (!(value instanceof List<?> list)) return List.of();
    List<ActivityArtistDto> artists = new ArrayList<>();
    for (Object item : list) {
        if (!(item instanceof Map<?, ?> map)) continue;
        ActivityArtistDto dto = new ActivityArtistDto();
        dto.setArtistId(parsePositiveLong(map.get("artistId")));
        dto.setPrimary(Boolean.TRUE.equals(map.get("isPrimary")) || Boolean.TRUE.equals(map.get("primary")));
        dto.setRoleType(parseNonBlankString(map.get("roleType")));
        dto.setRoleName(parseNonBlankString(map.get("roleName")));
        dto.setVisibility(parseNonBlankString(map.get("visibility")));
        Long sort = parsePositiveLong(map.get("sort"));
        dto.setSort(sort == null ? null : sort.intValue());
        artists.add(dto);
    }
    return artists;
}
```

In `createActivity(...)`, before insert, set primary artist ID from `artists[]` when present:

```java
List<ActivityArtistDto> artists = parseArtists(body.get("artists"));
Long artistId = artists.stream()
        .filter(a -> Boolean.TRUE.equals(a.getPrimary()))
        .map(ActivityArtistDto::getArtistId)
        .findFirst()
        .orElseGet(() -> resolveArtistId(body));
if (artistId == null && !artists.isEmpty()) artistId = artists.get(0).getArtistId();
activity.setArtistId(artistId);
```

After insert:

```java
if (!artists.isEmpty()) activityArtistService.saveLineup(activity.getId(), artists);
```

In `updateActivity(...)`, when `artists` exists:

```java
if (body.containsKey("artists")) {
    List<ActivityArtistDto> artists = parseArtists(body.get("artists"));
    activityArtistService.saveLineup(id, artists);
    artists.stream()
            .filter(a -> Boolean.TRUE.equals(a.getPrimary()))
            .findFirst()
            .map(ActivityArtistDto::getArtistId)
            .ifPresent(activity::setArtistId);
}
```

In `getAdminActivity(...)`, prefer lineup summary:

```java
List<ActivityArtistDto> lineup = activityArtistService.listAdminLineup(id);
activity.setArtists(lineup);
String summary = lineup.stream()
        .filter(a -> "public".equals(a.getVisibility()))
        .map(ActivityArtistDto::getName)
        .filter(StringUtils::hasText)
        .collect(Collectors.joining("、"));
activity.setArtistName(summary);
if (!StringUtils.hasText(summary)) attachArtistName(activity);
```

- [ ] **Step 6: Run controller tests**

Run:

```powershell
mvn -pl java-ticket "-Dtest=AdminControllerTest" test
```

Expected: PASS.

- [ ] **Step 7: Commit admin APIs**

```powershell
git add java/java-ticket/src/main/java/com/omni/ticket/dto/ArtistSearchResponse.java java/java-ticket/src/main/java/com/omni/ticket/service/ArtistAdminService.java java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java java/java-ticket/src/main/java/com/omni/ticket/entity/Activity.java java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java
git commit -m "feat: expose activity artist lineups"
```

---

### Task 5: Add C端 Public Artist Lineup Responses

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/dto/ActivityVO.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/dto/ActivityDetailVO.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityService.java`
- Test: existing `ActivityService` test or create `java/java-ticket/src/test/java/com/omni/ticket/service/ActivityServiceArtistLineupTest.java`

- [ ] **Step 1: Write failing C端 service test**

Create a focused test that stubs `ActivityArtistService.listPublicLineup(activityId)` and asserts hidden artists are not exposed through service DTOs. If constructor setup for `ActivityService` is large, add the assertion to the existing `ActivityService` test setup.

The expected assertion is:

```java
assertEquals("周杰伦、五月天", vo.getArtistName());
assertEquals(2, vo.getArtists().size());
```

- [ ] **Step 2: Run test to verify red**

Run the specific service test.

Expected: FAIL because `ActivityVO.getArtists()` or `ActivityDetailVO.getArtists()` is missing.

- [ ] **Step 3: Add fields to DTOs**

In `ActivityVO.java`:

```java
private java.util.List<ActivityArtistDto> artists;
public java.util.List<ActivityArtistDto> getArtists() { return artists; }
public void setArtists(java.util.List<ActivityArtistDto> artists) { this.artists = artists; }
```

In `ActivityDetailVO.java`:

```java
private java.util.List<ActivityArtistDto> artists;
public java.util.List<ActivityArtistDto> getArtists() { return artists; }
public void setArtists(java.util.List<ActivityArtistDto> artists) { this.artists = artists; }
```

- [ ] **Step 4: Update ActivityService**

Inject `ActivityArtistService`.

In list mapping for each activity:

```java
List<ActivityArtistDto> publicArtists = activityArtistService.listPublicLineup(activity.getId());
vo.setArtists(publicArtists);
if (!publicArtists.isEmpty()) {
    vo.setArtistName(publicArtists.stream()
            .map(ActivityArtistDto::getName)
            .filter(StringUtils::hasText)
            .collect(Collectors.joining("、")));
} else {
    Artist artist = artistMap.get(activity.getArtistId());
    if (artist != null) vo.setArtistName(artist.getName());
}
```

In `getActivityDetail(...)`:

```java
List<ActivityArtistDto> publicArtists = activityArtistService.listPublicLineup(id);
detail.setArtists(publicArtists);
```

- [ ] **Step 5: Run C端 service tests**

Run:

```powershell
mvn -pl java-ticket "-Dtest=ActivityService*Test" test
```

Expected: PASS.

- [ ] **Step 6: Commit public lineup responses**

```powershell
git add java/java-ticket/src/main/java/com/omni/ticket/dto/ActivityVO.java java/java-ticket/src/main/java/com/omni/ticket/dto/ActivityDetailVO.java java/java-ticket/src/main/java/com/omni/ticket/service/ActivityService.java java/java-ticket/src/test/java/com/omni/ticket/service/
git commit -m "feat: return public activity lineups"
```

---

### Task 6: Update Frontend Types And API Wrappers

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add TypeScript types**

In `api.ts` types file, add:

```ts
export type ActivityArtistVisibility = 'public' | 'hidden'

export interface ActivityArtistVO {
  artistId: number
  name?: string | null
  alias?: string | null
  artistType?: string | null
  countryOrRegion?: string | null
  categoryTags?: string | null
  avatar?: string | null
  isPrimary?: boolean | null
  primary?: boolean | null
  roleType?: string | null
  roleName?: string | null
  visibility: ActivityArtistVisibility
  sort: number
}

export interface ArtistSearchVO {
  id: number
  name: string
  alias?: string | null
  artistType?: string | null
  countryOrRegion?: string | null
  categoryTags?: string | null
  avatar?: string | null
  representativeWorks?: string | null
  riskStatus?: string | null
}
```

Extend `ActivityEntity`, `ActivityVO`, and `ActivityDetailVO` with `artists?: ActivityArtistVO[]`.

- [ ] **Step 2: Add API wrappers**

In `frontend/src/lib/api.ts`:

```ts
export async function searchAdminArtists(keyword: string) {
  const params = new URLSearchParams()
  if (keyword.trim()) params.set('keyword', keyword.trim())
  return request<import('@/types/api').ArtistSearchVO[]>(`/api/ticket/admin/artists/search?${params.toString()}`)
}

export async function getAdminArtist(id: number) {
  ensurePositiveInteger(id, 'artistId')
  return request<import('@/types/api').ArtistEntity>(`/api/ticket/admin/artists/${id}`)
}
```

- [ ] **Step 3: Run typecheck**

Run:

```powershell
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit types and APIs**

```powershell
git add frontend/src/types/api.ts frontend/src/lib/api.ts
git commit -m "feat: add frontend artist lineup types"
```

---

### Task 7: Build ActivityArtistSelector Component

**Files:**
- Create: `frontend/src/components/activity-artist/ActivityArtistSelector.tsx`

- [ ] **Step 1: Implement selector component**

Create the component with search, add/remove, role, visibility, primary, and reorder buttons. Use up/down buttons for Phase 1 instead of adding a drag-and-drop dependency; this satisfies ordering without adding packages.

```tsx
'use client'

import { useEffect, useState, startTransition } from 'react'
import { searchAdminArtists } from '@/lib/api'
import type { ActivityArtistVO, ArtistSearchVO, ActivityArtistVisibility } from '@/types/api'

const ROLE_OPTIONS = [
  { value: 'primary', label: '主艺人' },
  { value: 'co_headliner', label: '联合主艺人' },
  { value: 'performer', label: '参演艺人' },
  { value: 'special_guest', label: '特邀嘉宾' },
  { value: 'flying_guest', label: '飞行嘉宾' },
  { value: 'host', label: '主持人' },
  { value: 'band', label: '乐队/伴奏' },
  { value: 'production_team', label: '制作团队' },
  { value: 'custom', label: '自定义' },
]

type Props = {
  value: ActivityArtistVO[]
  onChange: (value: ActivityArtistVO[]) => void
}

export function ActivityArtistSelector({ value, onChange }: Props) {
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<ArtistSearchVO[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!keyword.trim()) {
      setResults([])
      return
    }
    let cancelled = false
    setSearching(true)
    const timer = window.setTimeout(() => {
      searchAdminArtists(keyword)
        .then(items => { if (!cancelled) setResults(items) })
        .catch(() => { if (!cancelled) setResults([]) })
        .finally(() => { if (!cancelled) setSearching(false) })
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [keyword])

  const normalize = (items: ActivityArtistVO[]) => {
    const primary = items.find(item => item.isPrimary || item.primary)
    const ordered = primary ? [primary, ...items.filter(item => item.artistId !== primary.artistId)] : [...items]
    return ordered.map((item, index) => ({ ...item, isPrimary: primary?.artistId === item.artistId, sort: index + 1 }))
  }

  const addArtist = (artist: ArtistSearchVO) => {
    if (value.some(item => item.artistId === artist.id)) return
    const next: ActivityArtistVO = {
      artistId: artist.id,
      name: artist.name,
      alias: artist.alias,
      artistType: artist.artistType,
      countryOrRegion: artist.countryOrRegion,
      categoryTags: artist.categoryTags,
      avatar: artist.avatar,
      isPrimary: value.length === 0,
      roleType: value.length === 0 ? 'primary' : 'performer',
      roleName: value.length === 0 ? '主艺人' : '参演艺人',
      visibility: 'public',
      sort: value.length + 1,
    }
    onChange(normalize([...value, next]))
    setKeyword('')
    setResults([])
  }

  const update = (artistId: number, patch: Partial<ActivityArtistVO>) => {
    onChange(normalize(value.map(item => item.artistId === artistId ? { ...item, ...patch } : item)))
  }

  const remove = (artistId: number) => {
    onChange(normalize(value.filter(item => item.artistId !== artistId)))
  }

  const move = (artistId: number, direction: -1 | 1) => {
    const index = value.findIndex(item => item.artistId === artistId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= value.length) return
    const next = [...value]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    onChange(normalize(next))
  }

  const setPrimary = (artistId: number) => {
    startTransition(() => {
      onChange(normalize(value.map(item => ({ ...item, isPrimary: item.artistId === artistId, roleType: item.artistId === artistId ? 'primary' : item.roleType, roleName: item.artistId === artistId ? '主艺人' : item.roleName }))))
    })
  }

  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-4">
      <div className="mb-3 text-[14px] font-semibold text-[#1a1a2e]">活动艺人阵容 *</div>
      <input value={keyword} onChange={event => setKeyword(event.target.value)} className="h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="搜索艺人/团队名称、别名、代表作品" />
      {keyword.trim() && (
        <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-[#e5e5e5] bg-white">
          {searching ? <div className="p-3 text-[13px] text-[#999]">搜索中...</div> : results.length === 0 ? <div className="p-3 text-[13px] text-[#999]">未找到艺人，请联系平台补充艺人档案。</div> : results.map(artist => (
            <button key={artist.id} type="button" onClick={() => addArtist(artist)} className="block w-full border-b border-[#f5f5f5] bg-white px-3 py-2 text-left hover:bg-[#fff7fa]">
              <div className="text-[14px] font-medium text-[#333]">{artist.name}{artist.alias ? ` / ${artist.alias}` : ''}</div>
              <div className="mt-0.5 text-[12px] text-[#999]">{[artist.countryOrRegion, artist.artistType, artist.categoryTags].filter(Boolean).join(' · ') || '暂无身份信息'}</div>
            </button>
          ))}
        </div>
      )}
      <div className="mt-4 space-y-3">
        {value.map((item, index) => (
          <div key={item.artistId} className="rounded-lg border border-[#e5e5e5] bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#fff0f3] px-3 py-1 text-[13px] font-medium text-[#ff1268]">{item.name || `艺人 ${item.artistId}`}</span>
              {(item.isPrimary || item.primary) && <span className="rounded-full bg-[#1a1a2e] px-2 py-0.5 text-[12px] text-white">主艺人</span>}
              <button type="button" onClick={() => setPrimary(item.artistId)} className="text-[12px] text-[#3b82f6]">设为主艺人</button>
              <button type="button" disabled={index === 0} onClick={() => move(item.artistId, -1)} className="text-[12px] text-[#666] disabled:text-[#bbb]">上移</button>
              <button type="button" disabled={index === value.length - 1} onClick={() => move(item.artistId, 1)} className="text-[12px] text-[#666] disabled:text-[#bbb]">下移</button>
              <button type="button" onClick={() => remove(item.artistId)} className="ml-auto text-[12px] text-[#ef4444]">移除</button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <select value={item.roleType || 'performer'} onChange={event => update(item.artistId, { roleType: event.target.value, roleName: ROLE_OPTIONS.find(role => role.value === event.target.value)?.label || item.roleName })} className="h-9 rounded-lg border border-[#ddd] px-2 text-[13px]">
                {ROLE_OPTIONS.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
              </select>
              <input value={item.roleName || ''} onChange={event => update(item.artistId, { roleName: event.target.value })} className="h-9 rounded-lg border border-[#ddd] px-2 text-[13px]" placeholder="展示角色名" />
              <select value={item.visibility || 'public'} onChange={event => update(item.artistId, { visibility: event.target.value as ActivityArtistVisibility })} className="h-9 rounded-lg border border-[#ddd] px-2 text-[13px]">
                <option value="public">C端公开展示</option>
                <option value="hidden">后台保密嘉宾</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

Run:

```powershell
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit selector**

```powershell
git add frontend/src/components/activity-artist/ActivityArtistSelector.tsx
git commit -m "feat: add activity artist selector"
```

---

### Task 8: Wire Selector Into New/Edit Activity Pages

**Files:**
- Modify: `frontend/src/app/console/activities/new/page.tsx`
- Modify: `frontend/src/app/console/activities/[id]/edit/page.tsx`

- [ ] **Step 1: Update new activity page**

Replace `artistName` state with:

```ts
const [artists, setArtists] = useState<ActivityArtistVO[]>([])
```

Import selector and type:

```ts
import { ActivityArtistSelector } from '@/components/activity-artist/ActivityArtistSelector'
import type { ActivityArtistVO } from '@/types/api'
```

Change submit guard:

```ts
if (!u || !categoryId || !name.trim() || artists.length === 0) return
```

Submit payload:

```ts
artists: artists.map((artist, index) => ({
  artistId: artist.artistId,
  isPrimary: Boolean(artist.isPrimary || artist.primary),
  roleType: artist.roleType || 'performer',
  roleName: artist.roleName || '参演艺人',
  visibility: artist.visibility || 'public',
  sort: index + 1,
})),
```

Render selector where the old artist input was:

```tsx
<ActivityArtistSelector value={artists} onChange={setArtists} />
```

- [ ] **Step 2: Update edit activity page**

Use `artists` in form state instead of single `artistName`.

On load:

```ts
artists: activity.artists || [],
```

Validate:

```ts
if (form.artists.length === 0) {
  setError('请至少选择一个活动艺人')
  return
}
```

Submit `artists[]` with the same payload mapping as new page.

Render `ActivityArtistSelector`.

- [ ] **Step 3: Run frontend typecheck**

Run:

```powershell
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit page wiring**

```powershell
git add frontend/src/app/console/activities/new/page.tsx frontend/src/app/console/activities/[id]/edit/page.tsx
git commit -m "feat: edit activity artists with tags"
```

---

### Task 9: Display Public Lineups On C端 And Console Lists

**Files:**
- Modify: `frontend/src/app/activity/[id]/page.tsx`
- Modify: `frontend/src/app/console/activities/page.tsx`
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/components/TicketCard.tsx` if needed

- [ ] **Step 1: Update C端 detail display**

In `activity/[id]/page.tsx`, prefer `detail.artists` over single `artist`:

```tsx
const artistSummary = detail.artists?.length
  ? detail.artists.map(item => item.roleName ? `${item.name}（${item.roleName}）` : item.name).join('、')
  : artist?.name
```

Render:

```tsx
{artistSummary && (
  <div className="text-[15px] text-[#666]">
    艺人：<span className="text-[#ff1268]">{artistSummary}</span>
  </div>
)}
```

- [ ] **Step 2: Update console activity list**

In `console/activities/page.tsx`, display `a.artistName` or `a.artists` below activity name:

```tsx
<div className="p-3">
  <div className="font-medium text-[#333]">{a.name}</div>
  {a.artistName ? <div className="mt-1 text-[12px] text-[#999]">阵容：{a.artistName}</div> : null}
</div>
```

- [ ] **Step 3: Update home activity mapping if ActivityVO includes artistName**

If `TicketCard` or `SectionRow` supports a subtitle, pass `artistName`. If not, skip UI changes and keep existing card layout to avoid unrelated redesign.

- [ ] **Step 4: Run typecheck**

Run:

```powershell
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit display changes**

```powershell
git add frontend/src/app/activity/[id]/page.tsx frontend/src/app/console/activities/page.tsx frontend/src/app/page.tsx frontend/src/components/TicketCard.tsx
git commit -m "feat: display activity artist lineups"
```

---

### Task 10: Update Seed Data To Real-Style Multi-Artist Demo

**Files:**
- Modify: `sql/seed.sql`

- [ ] **Step 1: Update artist seed rows**

Replace the current 30 artist rows with real public artist/team style rows. Keep IDs 1-30 stable for existing activities. Example rows:

```sql
(1, '周杰伦', '华语流行音乐人、创作歌手。', NULL, 1, 'Jay Chou', '1979-01-18', 1979, 'male', '个人', '中国台湾', '杰威尔音乐', '七里香,青花瓷,稻香', '歌手,创作人,流行', 'https://zh.wikipedia.org/wiki/周杰伦', '公开百科资料整理', 'normal'),
(2, '五月天', '华语摇滚乐团。', NULL, 1, 'Mayday', NULL, NULL, NULL, '乐队', '中国台湾', '相信音乐', '突然好想你,倔强,知足', '乐队,摇滚,流行', 'https://zh.wikipedia.org/wiki/五月天', '公开百科资料整理', 'normal'),
(3, '林俊杰', '华语流行创作歌手。', NULL, 1, 'JJ Lin', '1981-03-27', 1981, 'male', '个人', '新加坡', NULL, '江南,修炼爱情,可惜没如果', '歌手,创作人,流行', 'https://zh.wikipedia.org/wiki/林俊杰', '公开百科资料整理', 'normal')
```

Update insert column list to include expanded columns:

```sql
INSERT INTO artist (id, name, description, avatar, status, alias, birth_date, birth_year, gender, artist_type, country_or_region, agency, representative_works, category_tags, external_links, source_note, risk_status) VALUES
```

- [ ] **Step 2: Update activity rows**

Use real巡演/剧目风格 names with simulated future cities/dates. Keep IDs stable. Examples:

```sql
(1, 1, 1, 2003, '周杰伦「嘉年华」世界巡回演唱会 北京站', '模拟档期演示数据，非真实售票。', 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a', 1),
(2, 1, 2, 2003, '五月天「回到那一天」巡回演唱会 上海站', '模拟档期演示数据，非真实售票。', 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f', 1),
(4, 2, 4, 2005, '开心麻花爆笑舞台剧《乌龙山伯爵》北京站', '模拟档期演示数据，非真实售票。', 'https://images.unsplash.com/photo-1503095396549-807759245b35', 1)
```

- [ ] **Step 3: Add activity_artist seed rows**

After activity insert and visibility update, add:

```sql
INSERT INTO activity_artist (activity_id, artist_id, sort, is_primary, role_type, role_name, visibility, status) VALUES
(1, 1, 1, TRUE, 'primary', '主艺人', 'public', 1),
(1, 3, 2, FALSE, 'special_guest', '特邀嘉宾', 'hidden', 1),
(2, 2, 1, TRUE, 'primary', '主艺人', 'public', 1),
(3, 1, 1, FALSE, 'co_headliner', '联合主艺人', 'public', 1),
(3, 2, 2, FALSE, 'co_headliner', '联合主艺人', 'public', 1),
(3, 3, 3, FALSE, 'co_headliner', '联合主艺人', 'public', 1);
```

Add rows for all 30 activities so every existing activity has at least one lineup row.

- [ ] **Step 4: Ensure truncate includes activity_artist**

Add `activity_artist` before `activity` in the `TRUNCATE TABLE` list.

- [ ] **Step 5: Verify seed SQL syntax minimally**

Run production SQL check:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1
```

Expected: PASS.

- [ ] **Step 6: Commit seed update**

```powershell
git add sql/seed.sql
git commit -m "chore: seed multi-artist demo data"
```

---

### Task 11: Apply Local Migration And Verify Runtime Data Shape

**Files:**
- No source changes.

- [ ] **Step 1: Apply ticket migration locally**

Only if local `omni_ticket_split` should be updated now, run:

```powershell
$env:PGPASSWORD='123456'
psql -h localhost -p 5432 -U postgres -d omni_ticket_split -f sql/production-split/ticket/20260522_activity_multi_artist_phase1.sql
```

Expected: `ALTER TABLE`, `CREATE TABLE`, `INSERT 0 <n>` or notices that objects already exist.

- [ ] **Step 2: Verify existing activities have lineup rows**

Run:

```powershell
$env:PGPASSWORD='123456'
@'
SELECT a.id, a.name, COUNT(aa.id) AS artist_count
FROM activity a
LEFT JOIN activity_artist aa ON aa.activity_id = a.id AND aa.status = 1
GROUP BY a.id, a.name
ORDER BY a.id;
'@ | psql -h localhost -p 5432 -U postgres -d omni_ticket_split -t -A
```

Expected: every seeded activity has `artist_count >= 1`.

---

### Task 12: Final Verification

**Files:**
- No source changes.

- [ ] **Step 1: Run ticket tests**

```powershell
mvn test -pl java-ticket -am
```

Expected: all tests pass, including new `ActivityArtistServiceTest`.

- [ ] **Step 2: Run frontend typecheck**

```powershell
pnpm typecheck
```

Expected: `tsc --noEmit` exits 0.

- [ ] **Step 3: Run boundary checks**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
```

Expected: `All microservice boundary checks passed.`

- [ ] **Step 4: Run production split SQL checks**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1
```

Expected: `PASS production split SQL safety check`.

- [ ] **Step 5: Check whitespace**

```powershell
git diff --check
```

Expected: no whitespace errors. LF/CRLF warnings are acceptable.

- [ ] **Step 6: Final status**

```powershell
git status --short
git log --oneline -10
```

Expected: clean working tree except intentionally uncommitted local runtime artifacts, and recent commits correspond to this plan.

---

## Self-Review

Spec coverage:

- Multi-artist model: Tasks 2-5.
- Artist profile fields: Tasks 2-3 and Task 10.
- Admin search/detail: Task 4 and Task 6.
- New/edit tag selector: Tasks 7-8.
- C端 public-only display: Tasks 5 and 9.
- Seed update: Task 10.
- Existing activity edit no longer asks for artist name: Tasks 1, 2, 4, 8, 10.
- Microservice boundaries: Task 12.

Scope intentionally deferred:

- Artist review, risk blocking, notifications, todos, stopped sales, and cast-change refunds are excluded by the Phase 1 spec.

Placeholder scan:

- No `TBD` or `TODO` items remain. All tasks have concrete file paths and verification commands.

Type consistency:

- Backend uses `ActivityArtistDto` with `artistId`, `isPrimary` JavaBean property exposed by `getPrimary()/setPrimary`, `roleType`, `roleName`, `visibility`, and `sort`.
- Frontend uses `ActivityArtistVO` with `artistId`, `isPrimary`/`primary` compatibility, `roleType`, `roleName`, `visibility`, and `sort`.
