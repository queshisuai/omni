# SeatCraft 场馆-座位图流程重构 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 废除"公共场馆模板库"概念，改为场馆默认座位图 + 活动独立副本模型

**Architecture:**
- 新增 `venue_default_layout` + `venue_default_layout_section` 两张表，替代 `venue_seat_layout_template` 体系
- 移除 `layout_mode` 字段，一个活动一张座位图，所有场次共用
- 活动创建时从场馆默认布局复制为独立副本，互不影响
- 创建场馆/申请场馆时必须画好座位图才能保存

**Tech Stack:** PostgreSQL, MyBatis-Plus, Spring Boot, Next.js, SeatCraft

---

### Task 1: 数据库迁移 — 创建新表 + 删除旧表

**Files:**
- Create: `sql/migrations/shared/20260519_seatcraft_redesign.sql`

- [ ] **Step 1: 编写迁移脚本**

```sql
CREATE TABLE venue_default_layout (
    id BIGSERIAL PRIMARY KEY,
    venue_id BIGINT NOT NULL UNIQUE REFERENCES venue(id),
    name VARCHAR(80) NOT NULL,
    template_type VARCHAR(20) NOT NULL DEFAULT 'custom',
    stage_title VARCHAR(80) NOT NULL DEFAULT '演出舞台 / STAGE',
    stage_x INTEGER NOT NULL DEFAULT 500,
    stage_y INTEGER NOT NULL DEFAULT 50,
    canvas_width INTEGER NOT NULL DEFAULT 1000,
    canvas_height INTEGER NOT NULL DEFAULT 800,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_venue_default_layout_type CHECK (template_type IN ('concert', 'cinema', 'custom'))
);

CREATE TABLE venue_default_layout_section (
    id BIGSERIAL PRIMARY KEY,
    layout_id BIGINT NOT NULL REFERENCES venue_default_layout(id) ON DELETE CASCADE,
    section_key VARCHAR(80) NOT NULL,
    name VARCHAR(80) NOT NULL,
    rows INTEGER NOT NULL,
    cols INTEGER NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    color VARCHAR(20) NOT NULL,
    type VARCHAR(20) NOT NULL,
    layout VARCHAR(20) NOT NULL DEFAULT 'grid',
    radius INTEGER,
    arc_span INTEGER,
    rotation INTEGER DEFAULT 0,
    prime_row_start INTEGER,
    prime_row_end INTEGER,
    prime_col_start INTEGER,
    prime_col_end INTEGER,
    sort INTEGER NOT NULL DEFAULT 0,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_venue_default_section_type CHECK (type IN ('core', 'stand', 'zone')),
    CONSTRAINT chk_venue_default_section_layout CHECK (layout IN ('grid', 'curved')),
    CONSTRAINT chk_venue_default_section_size CHECK (rows > 0 AND cols > 0),
    CONSTRAINT uq_venue_default_section_key UNIQUE (layout_id, section_key)
);

CREATE INDEX idx_venue_default_layout ON venue_default_layout(venue_id);
CREATE INDEX idx_venue_default_section_layout ON venue_default_layout_section(layout_id);

ALTER TABLE activity_seat_layout DROP CONSTRAINT IF EXISTS activity_seat_layout_source_template_id_fkey;
ALTER TABLE activity_seat_layout DROP COLUMN IF EXISTS source_template_id;
ALTER TABLE activity_seat_layout DROP COLUMN IF EXISTS layout_mode;
ALTER TABLE activity_seat_layout ADD COLUMN source_venue_layout_id BIGINT REFERENCES venue_default_layout(id);

ALTER TABLE session_seat_layout DROP CONSTRAINT IF EXISTS session_seat_layout_source_template_id_fkey;
ALTER TABLE session_seat_layout DROP COLUMN IF EXISTS source_template_id;

DROP INDEX IF EXISTS idx_venue_seat_layout_template_venue;
DROP INDEX IF EXISTS idx_template_section_template;
DROP TABLE IF EXISTS venue_seat_layout_template_section;
DROP TABLE IF EXISTS venue_seat_layout_template;
```

- [ ] **Step 2: 执行迁移**

```bash
cd C:\Users\Administrator\Desktop\omni
$env:PGPASSWORD="123456"
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -h localhost -U postgres -d omni_ticket -f sql/migrations/shared/20260519_seatcraft_redesign.sql
```

---

### Task 2: 新增实体 + Mapper

**Files:**
- Create: `java-ticket/src/main/java/com/omni/ticket/entity/VenueDefaultLayout.java`
- Create: `java-ticket/src/main/java/com/omni/ticket/entity/VenueDefaultLayoutSection.java`
- Create: `java-ticket/src/main/java/com/omni/ticket/mapper/VenueDefaultLayoutMapper.java`
- Create: `java-ticket/src/main/java/com/omni/ticket/mapper/VenueDefaultLayoutSectionMapper.java`

- [ ] **Step 1: 创建 `VenueDefaultLayout.java`**

```java
package com.omni.ticket.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("venue_default_layout")
public class VenueDefaultLayout {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long venueId;
    private String name;
    private String templateType;
    private String stageTitle;
    private Integer stageX;
    private Integer stageY;
    private Integer canvasWidth;
    private Integer canvasHeight;
    private Integer status;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getVenueId() { return venueId; }
    public void setVenueId(Long venueId) { this.venueId = venueId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getTemplateType() { return templateType; }
    public void setTemplateType(String templateType) { this.templateType = templateType; }
    public String getStageTitle() { return stageTitle; }
    public void setStageTitle(String stageTitle) { this.stageTitle = stageTitle; }
    public Integer getStageX() { return stageX; }
    public void setStageX(Integer stageX) { this.stageX = stageX; }
    public Integer getStageY() { return stageY; }
    public void setStageY(Integer stageY) { this.stageY = stageY; }
    public Integer getCanvasWidth() { return canvasWidth; }
    public void setCanvasWidth(Integer canvasWidth) { this.canvasWidth = canvasWidth; }
    public Integer getCanvasHeight() { return canvasHeight; }
    public void setCanvasHeight(Integer canvasHeight) { this.canvasHeight = canvasHeight; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public LocalDateTime getUpdateTime() { return updateTime; }
    public void setUpdateTime(LocalDateTime updateTime) { this.updateTime = updateTime; }
}
```

- [ ] **Step 2: 创建 `VenueDefaultLayoutSection.java`**

```java
package com.omni.ticket.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("venue_default_layout_section")
public class VenueDefaultLayoutSection {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long layoutId;
    private String sectionKey;
    private String name;
    private Integer rows;
    private Integer cols;
    private Integer x;
    private Integer y;
    private String color;
    private String type;
    private String layout;
    private Integer radius;
    private Integer arcSpan;
    private Integer rotation;
    private Integer primeRowStart;
    private Integer primeRowEnd;
    private Integer primeColStart;
    private Integer primeColEnd;
    private Integer sort;
    private Integer status;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getLayoutId() { return layoutId; }
    public void setLayoutId(Long layoutId) { this.layoutId = layoutId; }
    public String getSectionKey() { return sectionKey; }
    public void setSectionKey(String sectionKey) { this.sectionKey = sectionKey; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Integer getRows() { return rows; }
    public void setRows(Integer rows) { this.rows = rows; }
    public Integer getCols() { return cols; }
    public void setCols(Integer cols) { this.cols = cols; }
    public Integer getX() { return x; }
    public void setX(Integer x) { this.x = x; }
    public Integer getY() { return y; }
    public void setY(Integer y) { this.y = y; }
    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getLayout() { return layout; }
    public void setLayout(String layout) { this.layout = layout; }
    public Integer getRadius() { return radius; }
    public void setRadius(Integer radius) { this.radius = radius; }
    public Integer getArcSpan() { return arcSpan; }
    public void setArcSpan(Integer arcSpan) { this.arcSpan = arcSpan; }
    public Integer getRotation() { return rotation; }
    public void setRotation(Integer rotation) { this.rotation = rotation; }
    public Integer getPrimeRowStart() { return primeRowStart; }
    public void setPrimeRowStart(Integer primeRowStart) { this.primeRowStart = primeRowStart; }
    public Integer getPrimeRowEnd() { return primeRowEnd; }
    public void setPrimeRowEnd(Integer primeRowEnd) { this.primeRowEnd = primeRowEnd; }
    public Integer getPrimeColStart() { return primeColStart; }
    public void setPrimeColStart(Integer primeColStart) { this.primeColStart = primeColStart; }
    public Integer getPrimeColEnd() { return primeColEnd; }
    public void setPrimeColEnd(Integer primeColEnd) { this.primeColEnd = primeColEnd; }
    public Integer getSort() { return sort; }
    public void setSort(Integer sort) { this.sort = sort; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public LocalDateTime getUpdateTime() { return updateTime; }
    public void setUpdateTime(LocalDateTime updateTime) { this.updateTime = updateTime; }
}
```

- [ ] **Step 3: 创建 `VenueDefaultLayoutMapper.java`**

```java
package com.omni.ticket.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.omni.ticket.entity.VenueDefaultLayout;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface VenueDefaultLayoutMapper extends BaseMapper<VenueDefaultLayout> {
}
```

- [ ] **Step 4: 创建 `VenueDefaultLayoutSectionMapper.java`**

```java
package com.omni.ticket.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.omni.ticket.entity.VenueDefaultLayoutSection;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface VenueDefaultLayoutSectionMapper extends BaseMapper<VenueDefaultLayoutSection> {
}
```

---

### Task 3: 修改 ActivitySeatLayout 实体

**Files:**
- Modify: `java-ticket/src/main/java/com/omni/ticket/entity/ActivitySeatLayout.java`

- [ ] **Step 1: 替换字段**

```java
// 删除：
private Long sourceTemplateId;
private String layoutMode;

// 新增：
private Long sourceVenueLayoutId;
```

同时替换 getter/setter：删除 `getSourceTemplateId/setSourceTemplateId`、`getLayoutMode/setLayoutMode`，新增 `getSourceVenueLayoutId/setSourceVenueLayoutId`。

---

### Task 4: 修改 SessionSeatLayout 实体

**Files:**
- Modify: `java-ticket/src/main/java/com/omni/ticket/entity/SessionSeatLayout.java`

- [ ] **Step 1: 删除字段**

```java
// 删除：
private Long sourceTemplateId;
```

删除 `getSourceTemplateId/setSourceTemplateId`。

---

### Task 5: 删除旧实体和 Mapper

**Files:**
- Delete: `java-ticket/src/main/java/com/omni/ticket/entity/VenueSeatLayoutTemplate.java`
- Delete: `java-ticket/src/main/java/com/omni/ticket/entity/VenueSeatLayoutTemplateSection.java`
- Delete: `java-ticket/src/main/java/com/omni/ticket/mapper/VenueSeatLayoutTemplateMapper.java`
- Delete: `java-ticket/src/main/java/com/omni/ticket/mapper/VenueSeatLayoutTemplateSectionMapper.java`
- Delete: `java-ticket/src/main/java/com/omni/ticket/service/SeatCraftTemplateService.java`

- [ ] **Step 1: 删除 5 个文件**

---

### Task 6: 修改 ActivitySeatLayoutService

**Files:**
- Modify: `java-ticket/src/main/java/com/omni/ticket/service/ActivitySeatLayoutService.java`

- [ ] **Step 1: 替换 `copyFromTemplate` 为 `createFromVenueDefault`**

```java
@Transactional
public SeatCraftLayoutDtos.LayoutResponse createFromVenueDefault(Long userId, Long activityId, Long venueLayoutId) {
    Activity activity = requireManageableActivity(userId, activityId);
    VenueDefaultLayout venueLayout = venueDefaultLayoutMapper.selectById(venueLayoutId);
    if (venueLayout == null || !Integer.valueOf(1).equals(venueLayout.getStatus())) {
        throw new BusinessException(404, "场馆默认座位图不存在");
    }
    List<VenueDefaultLayoutSection> venueSections = venueSectionMapper.selectList(new LambdaQueryWrapper<VenueDefaultLayoutSection>()
            .eq(VenueDefaultLayoutSection::getLayoutId, venueLayoutId)
            .eq(VenueDefaultLayoutSection::getStatus, 1)
            .orderByAsc(VenueDefaultLayoutSection::getSort)
            .orderByAsc(VenueDefaultLayoutSection::getId));

    LocalDateTime now = LocalDateTime.now();
    disableActiveLayouts(activity.getId(), now);

    ActivitySeatLayout layout = new ActivitySeatLayout();
    layout.setActivityId(activity.getId());
    layout.setSourceVenueLayoutId(venueLayout.getId());
    layout.setName(venueLayout.getName());
    layout.setTemplateType(venueLayout.getTemplateType());
    layout.setStageTitle(venueLayout.getStageTitle());
    layout.setStageX(venueLayout.getStageX());
    layout.setStageY(venueLayout.getStageY());
    layout.setCanvasWidth(venueLayout.getCanvasWidth());
    layout.setCanvasHeight(venueLayout.getCanvasHeight());
    layout.setStatus(1);
    layout.setCreateTime(now);
    layout.setUpdateTime(now);
    activityLayoutMapper.insert(layout);

    List<ActivitySeatLayoutSection> sections = venueSections.stream()
            .map(section -> copySection(layout.getId(), section, now))
            .collect(Collectors.toList());
    sections.forEach(activitySectionMapper::insert);

    return toLayoutResponse(layout, sections);
}
```

- [ ] **Step 2: 添加 `copySection` 重载（从 `VenueDefaultLayoutSection`）**

```java
private ActivitySeatLayoutSection copySection(Long activityLayoutId, VenueDefaultLayoutSection source, LocalDateTime now) {
    ActivitySeatLayoutSection section = new ActivitySeatLayoutSection();
    section.setActivityLayoutId(activityLayoutId);
    section.setSourceTemplateSectionId(null);
    section.setSectionKey(source.getSectionKey());
    section.setName(source.getName());
    section.setRows(source.getRows());
    section.setCols(source.getCols());
    section.setX(source.getX());
    section.setY(source.getY());
    section.setColor(source.getColor());
    section.setType(source.getType());
    section.setLayout(source.getLayout());
    section.setRadius(source.getRadius());
    section.setArcSpan(source.getArcSpan());
    section.setRotation(source.getRotation());
    section.setPrimeRowStart(source.getPrimeRowStart());
    section.setPrimeRowEnd(source.getPrimeRowEnd());
    section.setPrimeColStart(source.getPrimeColStart());
    section.setPrimeColEnd(source.getPrimeColEnd());
    section.setSort(source.getSort());
    section.setStatus(1);
    section.setCreateTime(now);
    section.setUpdateTime(now);
    return section;
}
```

- [ ] **Step 3: 删除不需要的方法**

删除：`normalizeLayoutMode`、`requireTemplate`、常量 `MODE_UNIFIED`、`MODE_PER_SESSION`

- [ ] **Step 4: 添加构造器注入 `VenueDefaultLayoutMapper` + `VenueDefaultLayoutSectionMapper`**

在 `ActivitySeatLayoutService` 构造器中增加两个 Mapper 参数。

---

### Task 7: 修改 SessionSeatLayoutService

**Files:**
- Modify: `java-ticket/src/main/java/com/omni/ticket/service/SessionSeatLayoutService.java`

- [ ] **Step 1: 删除 `copyFromTemplate` 方法**

- [ ] **Step 2: 删除 `copyFromActivityLayout` 方法中引用 `sourceTemplateId` 的地方**

`upsertLayout` 方法参数中移除 `sourceTemplateId`，`layout.setSourceTemplateId(null)` 改为 `layout.setActivityLayoutId(activityLayoutId)` 方式。

---

### Task 8: 新增 VenueDefaultLayoutService

**Files:**
- Create: `java-ticket/src/main/java/com/omni/ticket/service/VenueDefaultLayoutService.java`

```java
package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.SeatCraftLayoutDtos;
import com.omni.ticket.entity.*;
import com.omni.ticket.mapper.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class VenueDefaultLayoutService {

    private final VenueDefaultLayoutMapper layoutMapper;
    private final VenueDefaultLayoutSectionMapper sectionMapper;
    private final VenueMapper venueMapper;
    private final UserRefMapper userRefMapper;

    public VenueDefaultLayoutService(VenueDefaultLayoutMapper layoutMapper,
                                      VenueDefaultLayoutSectionMapper sectionMapper,
                                      VenueMapper venueMapper,
                                      UserRefMapper userRefMapper) {
        this.layoutMapper = layoutMapper;
        this.sectionMapper = sectionMapper;
        this.venueMapper = venueMapper;
        this.userRefMapper = userRefMapper;
    }

    @Transactional
    public SeatCraftLayoutDtos.LayoutResponse saveLayout(Long userId, Long venueId, SeatCraftLayoutDtos.LayoutResponse request) {
        requireAdminOrOrganizer(userId, venueId);
        if (request == null || request.getSections() == null || request.getSections().isEmpty()) {
            throw new BusinessException(400, "请至少添加一个座位分区");
        }

        LocalDateTime now = LocalDateTime.now();

        // 删除旧的默认布局
        List<VenueDefaultLayout> oldLayouts = layoutMapper.selectList(
                new LambdaQueryWrapper<VenueDefaultLayout>().eq(VenueDefaultLayout::getVenueId, venueId));
        for (VenueDefaultLayout old : oldLayouts) {
            old.setStatus(0);
            old.setUpdateTime(now);
            layoutMapper.updateById(old);
        }

        // 创建新布局
        VenueDefaultLayout layout = new VenueDefaultLayout();
        layout.setVenueId(venueId);
        layout.setName(request.getName() != null ? request.getName() : "默认布局");
        layout.setTemplateType(request.getTemplateType() != null ? request.getTemplateType() : "custom");
        layout.setStageTitle(request.getStageTitle());
        layout.setStageX(request.getStageX());
        layout.setStageY(request.getStageY());
        layout.setCanvasWidth(request.getCanvasWidth());
        layout.setCanvasHeight(request.getCanvasHeight());
        layout.setStatus(1);
        layout.setCreateTime(now);
        layout.setUpdateTime(now);
        layoutMapper.insert(layout);

        // 创建分区
        for (int i = 0; i < request.getSections().size(); i++) {
            SeatCraftLayoutDtos.SectionResponse s = request.getSections().get(i);
            VenueDefaultLayoutSection section = new VenueDefaultLayoutSection();
            section.setLayoutId(layout.getId());
            section.setSectionKey(s.getSectionKey());
            section.setName(s.getName());
            section.setRows(s.getRows());
            section.setCols(s.getCols());
            section.setX(s.getX());
            section.setY(s.getY());
            section.setColor(s.getColor());
            section.setType(s.getType());
            section.setLayout(s.getLayout());
            section.setRadius(s.getRadius());
            section.setArcSpan(s.getArcSpan());
            section.setRotation(s.getRotation());
            section.setPrimeRowStart(s.getPrimeRowStart());
            section.setPrimeRowEnd(s.getPrimeRowEnd());
            section.setPrimeColStart(s.getPrimeColStart());
            section.setPrimeColEnd(s.getPrimeColEnd());
            section.setSort(s.getSort() != null ? s.getSort() : i);
            section.setStatus(1);
            section.setCreateTime(now);
            section.setUpdateTime(now);
            sectionMapper.insert(section);
        }

        return getLayout(venueId);
    }

    public SeatCraftLayoutDtos.LayoutResponse getLayout(Long venueId) {
        VenueDefaultLayout layout = layoutMapper.selectOne(
                new LambdaQueryWrapper<VenueDefaultLayout>()
                        .eq(VenueDefaultLayout::getVenueId, venueId)
                        .eq(VenueDefaultLayout::getStatus, 1));
        if (layout == null) return null;

        List<VenueDefaultLayoutSection> sections = sectionMapper.selectList(
                new LambdaQueryWrapper<VenueDefaultLayoutSection>()
                        .eq(VenueDefaultLayoutSection::getLayoutId, layout.getId())
                        .eq(VenueDefaultLayoutSection::getStatus, 1)
                        .orderByAsc(VenueDefaultLayoutSection::getSort));
        return toLayoutResponse(layout, sections);
    }

    private SeatCraftLayoutDtos.LayoutResponse toLayoutResponse(VenueDefaultLayout layout, List<VenueDefaultLayoutSection> sections) {
        SeatCraftLayoutDtos.LayoutResponse response = new SeatCraftLayoutDtos.LayoutResponse();
        response.setId(layout.getId());
        response.setVenueId(layout.getVenueId());
        response.setName(layout.getName());
        response.setTemplateType(layout.getTemplateType());
        response.setStageTitle(layout.getStageTitle());
        response.setStageX(layout.getStageX());
        response.setStageY(layout.getStageY());
        response.setCanvasWidth(layout.getCanvasWidth());
        response.setCanvasHeight(layout.getCanvasHeight());
        response.setSections(sections.stream().map(this::toSectionResponse).collect(Collectors.toList()));
        return response;
    }

    private SeatCraftLayoutDtos.SectionResponse toSectionResponse(VenueDefaultLayoutSection section) {
        SeatCraftLayoutDtos.SectionResponse response = new SeatCraftLayoutDtos.SectionResponse();
        response.setId(section.getId());
        response.setSectionKey(section.getSectionKey());
        response.setName(section.getName());
        response.setRows(section.getRows());
        response.setCols(section.getCols());
        response.setX(section.getX());
        response.setY(section.getY());
        response.setColor(section.getColor());
        response.setType(section.getType());
        response.setLayout(section.getLayout());
        response.setRadius(section.getRadius());
        response.setArcSpan(section.getArcSpan());
        response.setRotation(section.getRotation());
        response.setPrimeRowStart(section.getPrimeRowStart());
        response.setPrimeRowEnd(section.getPrimeRowEnd());
        response.setPrimeColStart(section.getPrimeColStart());
        response.setPrimeColEnd(section.getPrimeColEnd());
        response.setSeatCount(section.getRows() * section.getCols());
        return response;
    }

    private void requireAdminOrOrganizer(Long userId, Long venueId) {
        UserRef user = userRefMapper.selectById(userId);
        if (user == null || (!"admin".equals(user.getRole()) && !"organizer".equals(user.getRole()))) {
            throw new BusinessException(403, "无权限");
        }
        venueMapper.selectById(venueId);
    }
}
```

---

### Task 9: 修改 AdminController

**Files:**
- Modify: `java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`

- [ ] **Step 1: 注入 `VenueDefaultLayoutService`**

```java
private final VenueDefaultLayoutService venueDefaultLayoutService;

// 在两处构造器中添加该参数
```

- [ ] **Step 2: 修改场馆创建端点，接受 `layout` 字段**

```java
@PostMapping("/venues")
public Result<Venue> createVenue(@RequestBody Map<String, Object> body) {
    Long userId = parsePositiveLong(body.get("userId"));
    String role = checkRole(userId);
    if (role == null) return Result.fail(403, "无权限");
    if ("organizer".equals(role)) return Result.fail(403, "仅平台管理员可创建场馆");

    Venue venue = new Venue();
    venue.setName(parseNonBlankString(body.get("name")));
    venue.setCity(body.get("city") != null ? body.get("city").toString() : null);
    venue.setAddress(body.get("address") != null ? body.get("address").toString() : null);
    venue.setCapacity(body.get("capacity") != null ? Integer.valueOf(body.get("capacity").toString()) : null);
    venue.setStatus(1);
    venueMapper.insert(venue);

    // 保存默认座位图
    if (body.containsKey("layout")) {
        // 反序列化 layout JSON 为 SeatCraftLayoutDtos.LayoutResponse
        // 调用 venueDefaultLayoutService.saveLayout(userId, venue.getId(), layout)
    }

    return Result.success(venue);
}
```

- [ ] **Step 3: 新增场馆默认布局端点**

```java
@GetMapping("/venues/{venueId}/default-layout")
public Result<SeatCraftLayoutDtos.LayoutResponse> getVenueDefaultLayout(@PathVariable Long venueId) {
    SeatCraftLayoutDtos.LayoutResponse layout = venueDefaultLayoutService.getLayout(venueId);
    return Result.success(layout);
}

@PutMapping("/venues/{venueId}/default-layout")
public Result<SeatCraftLayoutDtos.LayoutResponse> updateVenueDefaultLayout(@PathVariable Long venueId,
                                                                            @RequestBody SeatCraftLayoutDtos.LayoutSaveRequest request) {
    return Result.success(venueDefaultLayoutService.saveLayout(request.getUserId(), venueId, request.getLayout()));
}
```

- [ ] **Step 4: 删除旧端点**

删除以下端点：
- `POST /venues/{venueId}/seat-layout-templates/defaults`
- `GET /venues/{venueId}/seat-layout-templates`
- `POST /activities/{activityId}/seat-layout/from-template`
- `POST /sessions/{sessionId}/seat-layout/from-template`
- `POST /sessions/{sessionId}/seat-layout/from-activity`

- [ ] **Step 5: 修改活动创建端点**

`createActivity` 端点 body 增加接收 `seatLayout` 字段，保存活动后调用 `activitySeatLayoutService.createFromVenueDefault()` 或直接保存。

---

### Task 10: 修改 SessionAdminService

**Files:**
- Modify: `java-ticket/src/main/java/com/omni/ticket/service/SessionAdminService.java`

- [ ] **Step 1: 删除 `ensureSeatLayoutTemplates` 引用**

在 `SessionAdminService.java:101` 删除 `sessionSeatLayoutService.copyFromTemplate` 调用。

---

### Task 11: 修改 DTO — 移除 LayoutResponse.layoutMode

**Files:**
- Modify: `java-ticket/src/main/java/com/omni/ticket/dto/SeatCraftLayoutDtos.java`

- [ ] **Step 1: 删除 `layoutMode` 字段和 getter/setter**

---

### Task 12: 删除旧测试 + 更新测试

**Files:**
- Delete: `java-ticket/src/test/java/com/omni/ticket/service/SeatCraftTemplateServiceTest.java`
- Modify: `java-ticket/src/test/java/com/omni/ticket/service/ActivitySeatLayoutServiceTest.java`
- Modify: `java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java`

- [ ] **Step 1: 删除 SeatCraftTemplateServiceTest.java**

- [ ] **Step 2: 更新 ActivitySeatLayoutServiceTest.java** 替换 `copyFromTemplate` 测试为 `createFromVenueDefault`

- [ ] **Step 3: 更新 AdminControllerTest.java** 移除旧端点测试

---

### Task 13: 前端 API 层更新

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: 删除旧 API 函数**

```typescript
// 删除：
ensureSeatLayoutTemplates(venueId, userId)
listSeatLayoutTemplates(venueId, userId)
createActivitySeatLayoutFromTemplate(activityId, body)
createSessionSeatLayoutFromTemplate(sessionId, body)
createSessionSeatLayoutFromActivity(sessionId, body)
```

- [ ] **Step 2: 新增 API 函数**

```typescript
export async function getVenueDefaultLayout(venueId: number, userId: number) {
  return request<SeatCraftLayoutVO | null>(`/api/ticket/admin/venues/${venueId}/default-layout`, {
    method: 'GET', // GET 不需要 body
  })
}

export async function updateVenueDefaultLayout(venueId: number, body: { userId: number; layout: SeatCraftLayoutVO }) {
  return request<SeatCraftLayoutVO>(`/api/ticket/admin/venues/${venueId}/default-layout`, {
    method: 'PUT', body: JSON.stringify(body),
  })
}
```

---

### Task 14: 前端场馆创建页 — 嵌入 SeatCraft 编辑器

**Files:**
- Modify: `frontend/src/app/console/venue/page.tsx`

- [ ] **Step 1: 在新建场馆的表单中增加"配置座位图"区域**

点击"新建场馆"按钮打开一个模态框/步骤页：
1. 填写名称/城市/地址/容量
2. 第二步：内嵌 `SeatLayoutDesigner` 组件（空白画布）
3. 无分区时保存按钮灰色
4. 提交时发送 `{..., layout: designer.toJSON()}`

---

### Task 15: 前端场馆申请页 — 嵌入 SeatCraft 编辑器

**Files:**
- Modify: `frontend/src/app/console/venue/apply/page.tsx`

- [ ] **Step 1: 在场馆申请表单中增加座位图编辑区域**

与 Task 14 相同，但提交时走申请 API（含 `layout` 字段）。

---

### Task 16: 前端活动创建页 — 替换模板选择为场馆默认预览

**Files:**
- Modify: `frontend/src/app/console/activities/new/page.tsx`

- [ ] **Step 1: 移除 `seatLayoutMode` 切换、`ensureSeatLayoutTemplates` 调用、模板下拉选择**

- [ ] **Step 2: 场馆选择后自动加载 `venueDefaultLayout`，展示在预览组件中**

- [ ] **Step 3: 提供"确认使用"和"微调"按钮，微调时弹出 SeatCraft 编辑器**

- [ ] **Step 4: 提交时 `seatLayout` 字段随活动数据一起发送**

---

### Task 17: 最终验证

- [ ] **Step 1: 编译**

```bash
cd C:\Users\Administrator\Desktop\omni\java
mvn clean compile -pl java-ticket -am -DskipTests
```

- [ ] **Step 2: 运行测试**

```bash
cd C:\Users\Administrator\Desktop\omni\java
mvn test -pl java-ticket -am
```

- [ ] **Step 3: 前端类型检查**

```bash
cd C:\Users\Administrator\Desktop\omni\frontend
pnpm run typecheck
```

- [ ] **Step 4: 重启服务并验证**

停止旧服务 → kill-ports.bat → 启动所有服务 → 验证创建场馆+座位图、创建活动+复制座位图流程
