# SeatCraft Layout Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `seatcraft` 的座位图设计器和选座体验并入主站，支持活动统一座位图、场次独立座位图、分区生成票档、C 端按场次最终座位图选座购票。

**Architecture:** 第一阶段在 `java-ticket` 增加 SeatCraft 布局模板、活动座位图、场次座位图和分区实体，以场次座位图生成 `session_seat` 快照。第二阶段把 `seatcraft` 组件迁入 `frontend`，拆成后台设计器和 C 端选座组件。第三阶段改造后台活动/场次流程和 C 端活动详情页，保留现有订单/锁座逻辑作为交易事实来源。

**Tech Stack:** Java Spring Cloud Alibaba、MyBatis-Plus、PostgreSQL、Next.js 16、React 19、TypeScript、Tailwind CSS、motion、react-zoom-pan-pinch。

**Important Constraint:** 本计划执行时不要提交 Git，除非用户明确要求。每个任务完成后运行对应验证命令并汇报结果。

---

## Scope Check

本功能跨后端数据模型、后台活动流程、场次流程、C 端选座和 SeatCraft 组件迁移。为避免一次性大爆改，按以下顺序实施：

- 后端基础模型和 API 先落地，保证可测试。
- 后台设计器先能保存活动/场次座位图，再接入完整创建流程。
- C 端最后替换渲染组件，继续复用现有 `createOrderWithSeats` 下单。

---

## File Structure

### SQL

- Create: `sql/migrations/shared/20260519_create_seatcraft_layouts.sql`
- Modify: `sql/init.sql`

职责：新增 SeatCraft 模板、活动座位图、场次座位图、场次布局分区表，并为 `session_seat` 增加 `layout_section_id`。

### Java Entity / Mapper

- Create: `java/java-ticket/src/main/java/com/omni/ticket/entity/VenueSeatLayoutTemplate.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/entity/VenueSeatLayoutTemplateSection.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/entity/ActivitySeatLayout.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/entity/ActivitySeatLayoutSection.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/entity/SessionSeatLayout.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/entity/SessionSeatLayoutSection.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/entity/SessionSeat.java`
- Create matching mapper files under `java/java-ticket/src/main/java/com/omni/ticket/mapper/`

职责：MyBatis-Plus 实体和 Mapper，保持 Java 字段驼峰和数据库下划线映射一致。

### Java DTO / Service / Controller

- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/SeatCraftLayoutDtos.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/SeatCraftLayoutGenerator.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/SeatCraftTemplateService.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/ActivitySeatLayoutService.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/SessionSeatLayoutService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/SessionSeatService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/SessionAdminService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/SeatController.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/dto/SeatMapResponse.java`

职责：复制模板、保存活动/场次布局、生成票档草稿、生成 `session_seat` 快照、返回 C 端可渲染布局。

### Java Tests

- Create: `java/java-ticket/src/test/java/com/omni/ticket/service/SeatCraftLayoutGeneratorTest.java`
- Create: `java/java-ticket/src/test/java/com/omni/ticket/service/SeatCraftTemplateServiceTest.java`
- Create: `java/java-ticket/src/test/java/com/omni/ticket/service/ActivitySeatLayoutServiceTest.java`
- Create: `java/java-ticket/src/test/java/com/omni/ticket/service/SessionSeatLayoutServiceTest.java`
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/SessionSeatSyncServiceTest.java`

职责：先用单元测试约束生成规则、复制语义、安全修改和快照生成。

### Frontend Dependencies / Types / API

- Modify: `frontend/package.json`
- Modify: `frontend/pnpm-lock.yaml`
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`

职责：引入 SeatCraft 依赖并增加 API 类型。

### Frontend Components

- Create: `frontend/src/components/seatcraft/types.ts`
- Create: `frontend/src/components/seatcraft/layout.ts`
- Create: `frontend/src/components/seatcraft/SeatCanvas.tsx`
- Create: `frontend/src/components/seatcraft/SeatLayoutDesigner.tsx`
- Create: `frontend/src/components/seatcraft/SeatSelectionMap.tsx`
- Create: `frontend/src/components/seatcraft/SeatLayoutControls.tsx`
- Modify or deprecate: `frontend/src/components/SeatMap.tsx`

职责：将 SeatCraft 拆为业务组件，后台设计和 C 端选座共用布局算法。

### Frontend Pages

- Modify: `frontend/src/app/console/activities/new/page.tsx`
- Modify: `frontend/src/app/console/activities/[id]/edit/page.tsx`
- Modify: `frontend/src/app/console/sessions/page.tsx`
- Create: `frontend/src/app/console/activities/[id]/seat-layout/page.tsx`
- Create: `frontend/src/app/console/sessions/[id]/seat-layout/page.tsx`
- Modify: `frontend/src/app/activity/[id]/page.tsx`

职责：后台活动/场次配置 SeatCraft 座位图，C 端使用 SeatCraft 选座。

---

## Task 1: 数据库结构

**Files:**
- Create: `sql/migrations/shared/20260519_create_seatcraft_layouts.sql`
- Modify: `sql/init.sql`

- [ ] **Step 1: 新建迁移 SQL**

创建 `sql/migrations/shared/20260519_create_seatcraft_layouts.sql`，内容如下：

```sql
CREATE TABLE venue_seat_layout_template (
    id BIGSERIAL PRIMARY KEY,
    venue_id BIGINT NOT NULL REFERENCES venue(id),
    name VARCHAR(80) NOT NULL,
    template_type VARCHAR(20) NOT NULL,
    stage_title VARCHAR(80) NOT NULL DEFAULT '演出舞台 / STAGE',
    stage_x INTEGER NOT NULL DEFAULT 500,
    stage_y INTEGER NOT NULL DEFAULT 50,
    canvas_width INTEGER NOT NULL DEFAULT 1000,
    canvas_height INTEGER NOT NULL DEFAULT 800,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_venue_seat_layout_template_type CHECK (template_type IN ('concert', 'cinema', 'custom'))
);

CREATE TABLE venue_seat_layout_template_section (
    id BIGSERIAL PRIMARY KEY,
    template_id BIGINT NOT NULL REFERENCES venue_seat_layout_template(id) ON DELETE CASCADE,
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
    CONSTRAINT chk_template_section_type CHECK (type IN ('core', 'stand', 'zone')),
    CONSTRAINT chk_template_section_layout CHECK (layout IN ('grid', 'curved')),
    CONSTRAINT chk_template_section_size CHECK (rows > 0 AND cols > 0),
    CONSTRAINT uq_template_section_key UNIQUE (template_id, section_key)
);

CREATE TABLE activity_seat_layout (
    id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT NOT NULL REFERENCES activity(id) ON DELETE CASCADE,
    source_template_id BIGINT REFERENCES venue_seat_layout_template(id),
    layout_mode VARCHAR(20) NOT NULL DEFAULT 'unified',
    name VARCHAR(80) NOT NULL,
    template_type VARCHAR(20) NOT NULL,
    stage_title VARCHAR(80) NOT NULL,
    stage_x INTEGER NOT NULL,
    stage_y INTEGER NOT NULL,
    canvas_width INTEGER NOT NULL DEFAULT 1000,
    canvas_height INTEGER NOT NULL DEFAULT 800,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_activity_seat_layout_mode CHECK (layout_mode IN ('unified', 'per_session')),
    CONSTRAINT chk_activity_seat_layout_type CHECK (template_type IN ('concert', 'cinema', 'custom'))
);

CREATE TABLE activity_seat_layout_section (
    id BIGSERIAL PRIMARY KEY,
    activity_layout_id BIGINT NOT NULL REFERENCES activity_seat_layout(id) ON DELETE CASCADE,
    source_template_section_id BIGINT REFERENCES venue_seat_layout_template_section(id),
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
    CONSTRAINT chk_activity_section_type CHECK (type IN ('core', 'stand', 'zone')),
    CONSTRAINT chk_activity_section_layout CHECK (layout IN ('grid', 'curved')),
    CONSTRAINT chk_activity_section_size CHECK (rows > 0 AND cols > 0),
    CONSTRAINT uq_activity_section_key UNIQUE (activity_layout_id, section_key)
);

CREATE TABLE session_seat_layout (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL UNIQUE REFERENCES session(id) ON DELETE CASCADE,
    activity_layout_id BIGINT REFERENCES activity_seat_layout(id),
    source_template_id BIGINT REFERENCES venue_seat_layout_template(id),
    name VARCHAR(80) NOT NULL,
    template_type VARCHAR(20) NOT NULL,
    stage_title VARCHAR(80) NOT NULL,
    stage_x INTEGER NOT NULL,
    stage_y INTEGER NOT NULL,
    canvas_width INTEGER NOT NULL DEFAULT 1000,
    canvas_height INTEGER NOT NULL DEFAULT 800,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_session_seat_layout_type CHECK (template_type IN ('concert', 'cinema', 'custom'))
);

CREATE TABLE session_seat_layout_section (
    id BIGSERIAL PRIMARY KEY,
    session_layout_id BIGINT NOT NULL REFERENCES session_seat_layout(id) ON DELETE CASCADE,
    activity_layout_section_id BIGINT REFERENCES activity_seat_layout_section(id),
    source_template_section_id BIGINT REFERENCES venue_seat_layout_template_section(id),
    ticket_type_id BIGINT REFERENCES ticket_type(id),
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
    seat_count INTEGER NOT NULL DEFAULT 0,
    sort INTEGER NOT NULL DEFAULT 0,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_session_section_type CHECK (type IN ('core', 'stand', 'zone')),
    CONSTRAINT chk_session_section_layout CHECK (layout IN ('grid', 'curved')),
    CONSTRAINT chk_session_section_size CHECK (rows > 0 AND cols > 0),
    CONSTRAINT uq_session_section_key UNIQUE (session_layout_id, section_key)
);

ALTER TABLE session_seat ADD COLUMN IF NOT EXISTS layout_section_id BIGINT REFERENCES session_seat_layout_section(id);

CREATE INDEX idx_venue_seat_layout_template_venue ON venue_seat_layout_template(venue_id);
CREATE INDEX idx_template_section_template ON venue_seat_layout_template_section(template_id);
CREATE INDEX idx_activity_seat_layout_activity ON activity_seat_layout(activity_id);
CREATE INDEX idx_activity_section_layout ON activity_seat_layout_section(activity_layout_id);
CREATE INDEX idx_session_seat_layout_session ON session_seat_layout(session_id);
CREATE INDEX idx_session_section_layout ON session_seat_layout_section(session_layout_id);
CREATE INDEX idx_session_section_ticket_type ON session_seat_layout_section(ticket_type_id);
CREATE INDEX idx_session_seat_layout_section ON session_seat(layout_section_id);
```

- [ ] **Step 2: 同步 `sql/init.sql`**

把 Step 1 中的建表语句追加到现有 `sql/init.sql` 的基础表和座位表之后。不要删除已有 `venue_area`、`venue_seat`、`session_seat` 表，第一版保留兼容。

- [ ] **Step 3: 验证 SQL 无明显语法问题**

Run:

```powershell
git diff --check
```

Expected: 没有 whitespace error。Windows 的 LF/CRLF warning 可以接受。

---

## Task 2: 后端实体和 Mapper

**Files:**
- Create entity and mapper files listed in File Structure
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/entity/SessionSeat.java`

- [ ] **Step 1: 增加实体类**

为六张新表创建实体。每个实体使用 `@TableName` 和 `@TableId(type = IdType.AUTO)`，字段类型统一如下：

```java
private Long id;
private Long venueId;
private Long activityId;
private Long sessionId;
private Long sourceTemplateId;
private Long sourceTemplateSectionId;
private Long activityLayoutId;
private Long activityLayoutSectionId;
private Long sessionLayoutId;
private Long ticketTypeId;
private String sectionKey;
private String name;
private String templateType;
private String layoutMode;
private String stageTitle;
private Integer stageX;
private Integer stageY;
private Integer canvasWidth;
private Integer canvasHeight;
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
private Integer seatCount;
private Integer sort;
private Integer status;
private LocalDateTime createTime;
private LocalDateTime updateTime;
```

只在对应实体保留对应表实际存在的字段。Getter/Setter 使用项目现有手写风格，不引入 Lombok。

- [ ] **Step 2: 增加 Mapper**

每张表创建一个 Mapper，例如：

```java
package com.omni.ticket.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.omni.ticket.entity.SessionSeatLayout;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface SessionSeatLayoutMapper extends BaseMapper<SessionSeatLayout> {
}
```

- [ ] **Step 3: 扩展 `SessionSeat`**

在 `SessionSeat` 增加：

```java
private Long layoutSectionId;

public Long getLayoutSectionId() { return layoutSectionId; }
public void setLayoutSectionId(Long layoutSectionId) { this.layoutSectionId = layoutSectionId; }
```

- [ ] **Step 4: 编译验证**

Run:

```powershell
mvn test -pl java-ticket -DskipTests
```

Expected: `BUILD SUCCESS`。如果因测试跳过参数只编译模块，也可以接受。

---

## Task 3: SeatCraft 布局生成器

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/SeatCraftLayoutGenerator.java`
- Create: `java/java-ticket/src/test/java/com/omni/ticket/service/SeatCraftLayoutGeneratorTest.java`

- [ ] **Step 1: 写失败测试**

测试固定行列生成和弧形第一版固定列数生成。

```java
@Test
void countSeatsUsesRowsTimesColsForGridAndCurved() {
    SeatCraftLayoutGenerator generator = new SeatCraftLayoutGenerator();

    assertEquals(60, generator.countSeats(3, 20));
    assertEquals(96, generator.countSeats(8, 12));
}

@Test
void buildSeatLabelUsesOneBasedRowAndSeatNo() {
    SeatCraftLayoutGenerator generator = new SeatCraftLayoutGenerator();

    assertEquals("2排8座", generator.buildSeatLabel(2, 8));
}
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
mvn test -pl java-ticket -Dtest=SeatCraftLayoutGeneratorTest
```

Expected: FAIL，因为类不存在。

- [ ] **Step 3: 实现生成器**

```java
package com.omni.ticket.service;

import com.omni.exception.BusinessException;
import org.springframework.stereotype.Component;

@Component
public class SeatCraftLayoutGenerator {
    public int countSeats(Integer rows, Integer cols) {
        int rowCount = requirePositive(rows, "排数必须大于0");
        int colCount = requirePositive(cols, "座数必须大于0");
        return rowCount * colCount;
    }

    public String buildSeatLabel(int rowNo, int seatNo) {
        if (rowNo <= 0 || seatNo <= 0) {
            throw new BusinessException(400, "排号和座号必须大于0");
        }
        return rowNo + "排" + seatNo + "座";
    }

    private int requirePositive(Integer value, String message) {
        if (value == null || value <= 0) {
            throw new BusinessException(400, message);
        }
        return value;
    }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run:

```powershell
mvn test -pl java-ticket -Dtest=SeatCraftLayoutGeneratorTest
```

Expected: `BUILD SUCCESS`。

---

## Task 4: 场馆模板初始化和查询

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/SeatCraftTemplateService.java`
- Create DTOs in: `java/java-ticket/src/main/java/com/omni/ticket/dto/SeatCraftLayoutDtos.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/SeatCraftTemplateServiceTest.java`

- [ ] **Step 1: 写失败测试**

测试 admin 初始化一个场馆的三类默认模板。

```java
@Test
void ensureDefaultTemplatesCreatesConcertCinemaAndCustomWhenMissing() {
    when(userRefMapper.selectById(2002L)).thenReturn(user(2002L, "admin"));
    when(venueMapper.selectById(1L)).thenReturn(activeVenue(1L));
    when(templateMapper.selectList(any())).thenReturn(java.util.List.of());

    List<VenueSeatLayoutTemplate> templates = service.ensureDefaults(2002L, 1L);

    assertEquals(3, templates.size());
    verify(templateMapper, times(3)).insert(any());
    verify(sectionMapper, atLeast(3)).insert(any());
}
```

- [ ] **Step 2: 实现 DTO**

在 `SeatCraftLayoutDtos.java` 中创建嵌套静态类，减少文件数量：

```java
package com.omni.ticket.dto;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public class SeatCraftLayoutDtos {
    public static class LayoutResponse {
        private Long id;
        private Long venueId;
        private Long activityId;
        private Long sessionId;
        private String name;
        private String templateType;
        private String stageTitle;
        private Integer stageX;
        private Integer stageY;
        private Integer canvasWidth;
        private Integer canvasHeight;
        private List<SectionResponse> sections = new ArrayList<>();
        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public Long getVenueId() { return venueId; }
        public void setVenueId(Long venueId) { this.venueId = venueId; }
        public Long getActivityId() { return activityId; }
        public void setActivityId(Long activityId) { this.activityId = activityId; }
        public Long getSessionId() { return sessionId; }
        public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
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
        public List<SectionResponse> getSections() { return sections; }
        public void setSections(List<SectionResponse> sections) { this.sections = sections; }
    }

    public static class SectionResponse {
        private Long id;
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
        private Integer seatCount;
        private Long ticketTypeId;
        private BigDecimal price;
        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
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
        public Integer getSeatCount() { return seatCount; }
        public void setSeatCount(Integer seatCount) { this.seatCount = seatCount; }
        public Long getTicketTypeId() { return ticketTypeId; }
        public void setTicketTypeId(Long ticketTypeId) { this.ticketTypeId = ticketTypeId; }
        public BigDecimal getPrice() { return price; }
        public void setPrice(BigDecimal price) { this.price = price; }
    }

    public static class LayoutSaveRequest {
        private Long userId;
        private LayoutResponse layout;
        public Long getUserId() { return userId; }
        public void setUserId(Long userId) { this.userId = userId; }
        public LayoutResponse getLayout() { return layout; }
        public void setLayout(LayoutResponse layout) { this.layout = layout; }
    }
}
```

- [ ] **Step 3: 实现模板服务**

`SeatCraftTemplateService.ensureDefaults(userId, venueId)`：

- 校验 user 是 admin。
- 校验场馆存在且启用。
- 如果该场馆已有任意模板，直接返回现有模板。
- 否则创建三套模板和默认分区。

默认分区采用：

```java
concert: floor 12x24 grid, stands 8x48 curved radius=300 arcSpan=180 rotation=180
cinema: cinema-main 15x30 grid prime row 6-11 col 11-21
custom: 无分区
```

- [ ] **Step 4: 暴露接口**

在 `AdminController` 增加：

```java
@PostMapping("/venues/{venueId}/seat-layout-templates/defaults")
public Result<List<VenueSeatLayoutTemplate>> ensureSeatLayoutDefaults(@PathVariable Long venueId, @RequestParam Long userId) {
    return Result.success(seatCraftTemplateService.ensureDefaults(userId, venueId));
}

@GetMapping("/venues/{venueId}/seat-layout-templates")
public Result<List<SeatCraftLayoutDtos.LayoutResponse>> listSeatLayoutTemplates(@PathVariable Long venueId, @RequestParam Long userId) {
    return Result.success(seatCraftTemplateService.listTemplates(userId, venueId));
}
```

- [ ] **Step 5: 验证**

Run:

```powershell
mvn test -pl java-ticket -Dtest=SeatCraftTemplateServiceTest
```

Expected: `BUILD SUCCESS`。

---

## Task 5: 活动默认座位图服务

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/ActivitySeatLayoutService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/ActivitySeatLayoutServiceTest.java`

- [ ] **Step 1: 写失败测试**

测试 organizer 只能为自己的活动从模板复制活动默认座位图。

```java
@Test
void organizerCopiesTemplateToOwnActivityLayout() {
    when(userRefMapper.selectById(2003L)).thenReturn(user(2003L, "organizer"));
    when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
    when(templateMapper.selectById(7L)).thenReturn(template(7L, 1L, "concert"));
    when(templateSectionMapper.selectList(any())).thenReturn(java.util.List.of(section("floor", "池座内场", 12, 24)));

    ActivitySeatLayout layout = service.copyFromTemplate(2003L, 10L, 7L, "unified");

    assertEquals(10L, layout.getActivityId());
    assertEquals("unified", layout.getLayoutMode());
    verify(activityLayoutMapper).insert(any());
    verify(activitySectionMapper).insert(any());
}
```

- [ ] **Step 2: 实现服务**

`copyFromTemplate(userId, activityId, templateId, layoutMode)`：

- `layoutMode` 只允许 `unified` 或 `per_session`。
- admin 可操作任意活动。
- organizer 只能操作 `activity.organizer_id = userId` 的活动。
- 复制模板主表和分区到活动座位图表。
- `per_session` 模式可只保存活动模式记录，不强制分区；为了简化第一版，仍允许没有活动布局，前端在场次创建时按模板配置。

- [ ] **Step 3: 暴露接口**

在 `AdminController` 增加：

```java
@PostMapping("/activities/{activityId}/seat-layout/from-template")
public Result<SeatCraftLayoutDtos.LayoutResponse> createActivitySeatLayout(@PathVariable Long activityId, @RequestBody Map<String, Object> body) {
    Long userId = parsePositiveLong(body.get("userId"));
    Long templateId = parsePositiveLong(body.get("templateId"));
    String layoutMode = body.get("layoutMode") == null ? "unified" : body.get("layoutMode").toString();
    return Result.success(activitySeatLayoutService.copyFromTemplate(userId, activityId, templateId, layoutMode));
}

@GetMapping("/activities/{activityId}/seat-layout")
public Result<SeatCraftLayoutDtos.LayoutResponse> getActivitySeatLayout(@PathVariable Long activityId, @RequestParam Long userId) {
    return Result.success(activitySeatLayoutService.getLayout(userId, activityId));
}
```

- [ ] **Step 4: 验证**

Run:

```powershell
mvn test -pl java-ticket -Dtest=ActivitySeatLayoutServiceTest
```

Expected: `BUILD SUCCESS`。

---

## Task 6: 场次座位图、票档草稿和快照生成

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/SessionSeatLayoutService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/SessionSeatService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/SessionAdminService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/SessionSeatLayoutServiceTest.java`

- [ ] **Step 1: 写失败测试：分区生成票档草稿**

```java
@Test
void createTicketDraftsFromSectionsUsesSectionNameAndSeatCount() {
    SessionSeatLayoutSection floor = sessionSection(1L, "floor", "池座内场", 12, 24);
    SessionSeatLayoutSection stand = sessionSection(2L, "stands", "环绕看台", 8, 48);
    when(sessionSectionMapper.selectList(any())).thenReturn(java.util.List.of(floor, stand));

    List<SeatCraftLayoutDtos.SectionResponse> drafts = service.buildTicketDrafts(99L);

    assertEquals(2, drafts.size());
    assertEquals("池座内场", drafts.get(0).getName());
    assertEquals(288, drafts.get(0).getSeatCount());
    assertEquals(384, drafts.get(1).getSeatCount());
}
```

- [ ] **Step 2: 写失败测试：保存票档后生成座位快照**

```java
@Test
void generateSeatsCreatesSessionSeatForEachSectionSeat() {
    Session session = new Session();
    session.setId(99L);
    session.setVenueId(1L);
    when(sessionMapper.selectById(99L)).thenReturn(session);
    when(sessionSectionMapper.selectList(any())).thenReturn(java.util.List.of(sessionSectionWithTicket(10L, 900L, 2, 3)));
    when(sessionSeatMapper.selectCount(any())).thenReturn(0L);

    int generated = service.generateSessionSeats(99L);

    assertEquals(6, generated);
    verify(sessionSeatMapper, times(6)).insert(argThat(seat -> Long.valueOf(10L).equals(seat.getLayoutSectionId()) && Long.valueOf(900L).equals(seat.getTicketTypeId())));
}
```

- [ ] **Step 3: 实现核心服务方法**

`SessionSeatLayoutService` 至少包含：

```java
public SeatCraftLayoutDtos.LayoutResponse copyFromTemplate(Long userId, Long sessionId, Long templateId)
public SeatCraftLayoutDtos.LayoutResponse copyFromActivityLayout(Long userId, Long sessionId, Long activityLayoutId)
public List<SeatCraftLayoutDtos.SectionResponse> buildTicketDrafts(Long sessionLayoutId)
public int bindTicketTypesAndGenerateSeats(Long userId, Long sessionId, Map<Long, TicketDraftInput> drafts)
public int generateSessionSeats(Long sessionId)
```

生成 `session_seat` 规则：

- 每个 active `session_seat_layout_section` 生成 `rows * cols` 个座位。
- `area_id` 第一版可复用 `layout_section_id` 的值时会破坏 FK，因此需要同步创建或保留对应 `venue_area`。第一版推荐在生成 SeatCraft 场次布局时，为每个场次分区创建或复用一个 `venue_area` 兼容旧 FK，并把 `session_seat.area_id` 写入该 `venue_area.id`。
- `venue_seat_id` 当前有 NOT NULL FK。第一版为了兼容旧表，生成场次座位前需要为每个布局座位创建对应 `venue_seat` 模板座位，或后续迁移放宽该 FK。推荐本任务使用现有兼容方式：为 SeatCraft 分区自动创建 `venue_area` 和 `venue_seat`，再生成 `session_seat`。
- `layout_section_id` 写入对应 `session_seat_layout_section.id`。
- `ticket_type_id` 写入分区绑定票档。

- [ ] **Step 4: 修改 `SessionSeatService.generateForSession`**

优先判断场次是否存在 SeatCraft 场次座位图：

```java
if (sessionSeatLayoutService.hasLayout(sessionId)) {
    return sessionSeatLayoutService.generateSessionSeats(sessionId);
}
```

没有 SeatCraft 布局时保留旧 `venue_seat` 生成逻辑。

- [ ] **Step 5: 修改场次创建流程**

`SessionAdminService.createSession` 暂时不要强制要求 `layoutId`，保持兼容；但如果 body 含 `templateId` 或 `activityLayoutId`，创建场次后复制座位图。

- [ ] **Step 6: 暴露接口**

在 `AdminController` 增加：

```java
@PostMapping("/sessions/{sessionId}/seat-layout/from-template")
public Result<SeatCraftLayoutDtos.LayoutResponse> createSessionLayoutFromTemplate(@PathVariable Long sessionId, @RequestBody Map<String, Object> body)

@PostMapping("/sessions/{sessionId}/seat-layout/from-activity")
public Result<SeatCraftLayoutDtos.LayoutResponse> createSessionLayoutFromActivity(@PathVariable Long sessionId, @RequestBody Map<String, Object> body)

@GetMapping("/sessions/{sessionId}/seat-layout")
public Result<SeatCraftLayoutDtos.LayoutResponse> getSessionSeatLayout(@PathVariable Long sessionId, @RequestParam Long userId)

@GetMapping("/sessions/{sessionId}/seat-layout/ticket-drafts")
public Result<List<SeatCraftLayoutDtos.SectionResponse>> getTicketDrafts(@PathVariable Long sessionId, @RequestParam Long userId)
```

- [ ] **Step 7: 验证**

Run:

```powershell
mvn test -pl java-ticket -Dtest=SessionSeatLayoutServiceTest,SessionSeatSyncServiceTest
```

Expected: `BUILD SUCCESS`。

---

## Task 7: C 端 SeatMap 响应扩展

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/dto/SeatMapResponse.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/SeatController.java`

- [ ] **Step 1: 扩展响应 DTO**

在 `SeatMapResponse` 增加：

```java
private SeatCraftLayoutDtos.LayoutResponse layout;

public SeatCraftLayoutDtos.LayoutResponse getLayout() { return layout; }
public void setLayout(SeatCraftLayoutDtos.LayoutResponse layout) { this.layout = layout; }
```

- [ ] **Step 2: 修改 SeatController 查询逻辑**

如果场次有 `session_seat_layout`，返回布局配置和该票档分区座位。过滤优先用 `SessionSeat.layoutSectionId` 对应 `session_seat_layout_section.ticket_type_id`，旧数据继续用 `ticket_type_area` + `area_id`。

- [ ] **Step 3: 验证**

Run:

```powershell
mvn test -pl java-ticket -am
```

Expected: `BUILD SUCCESS`。

---

## Task 8: 前端引入 SeatCraft 依赖和类型

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/pnpm-lock.yaml`
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: 安装依赖**

Run:

```powershell
pnpm add motion react-zoom-pan-pinch
```

Expected: `package.json` 增加 `motion` 和 `react-zoom-pan-pinch`，`pnpm-lock.yaml` 更新。

- [ ] **Step 2: 增加 TS 类型**

在 `frontend/src/types/api.ts` 增加：

```ts
export type SeatCraftTemplateType = 'concert' | 'cinema' | 'custom'
export type SeatCraftSectionType = 'core' | 'stand' | 'zone'
export type SeatCraftSectionLayout = 'grid' | 'curved'

export interface SeatCraftSectionVO {
  id: number
  sectionKey: string
  name: string
  rows: number
  cols: number
  x: number
  y: number
  color: string
  type: SeatCraftSectionType
  layout: SeatCraftSectionLayout
  radius?: number | null
  arcSpan?: number | null
  rotation?: number | null
  primeRowStart?: number | null
  primeRowEnd?: number | null
  primeColStart?: number | null
  primeColEnd?: number | null
  seatCount?: number | null
  ticketTypeId?: number | null
  price?: number | null
}

export interface SeatCraftLayoutVO {
  id: number
  venueId?: number | null
  activityId?: number | null
  sessionId?: number | null
  name: string
  templateType: SeatCraftTemplateType
  stageTitle: string
  stageX: number
  stageY: number
  canvasWidth: number
  canvasHeight: number
  sections: SeatCraftSectionVO[]
}
```

并在 `SeatMapResponse` 类型上增加：

```ts
layout?: SeatCraftLayoutVO | null
```

- [ ] **Step 3: 增加 API 方法**

在 `frontend/src/lib/api.ts` 增加：

```ts
export async function ensureSeatLayoutTemplates(venueId: number, userId: number) {
  return request<import('@/types/api').SeatCraftLayoutVO[]>(`/api/ticket/admin/venues/${venueId}/seat-layout-templates/defaults?userId=${userId}`, { method: 'POST' })
}

export async function listSeatLayoutTemplates(venueId: number, userId: number) {
  return request<import('@/types/api').SeatCraftLayoutVO[]>(`/api/ticket/admin/venues/${venueId}/seat-layout-templates?userId=${userId}`)
}

export async function createActivitySeatLayoutFromTemplate(activityId: number, body: { userId: number; templateId: number; layoutMode: 'unified' | 'per_session' }) {
  return request<import('@/types/api').SeatCraftLayoutVO>(`/api/ticket/admin/activities/${activityId}/seat-layout/from-template`, { method: 'POST', body: JSON.stringify(body) })
}

export async function getActivitySeatLayout(activityId: number, userId: number) {
  return request<import('@/types/api').SeatCraftLayoutVO | null>(`/api/ticket/admin/activities/${activityId}/seat-layout?userId=${userId}`)
}

export async function createSessionSeatLayoutFromTemplate(sessionId: number, body: { userId: number; templateId: number }) {
  return request<import('@/types/api').SeatCraftLayoutVO>(`/api/ticket/admin/sessions/${sessionId}/seat-layout/from-template`, { method: 'POST', body: JSON.stringify(body) })
}

export async function createSessionSeatLayoutFromActivity(sessionId: number, body: { userId: number; activityLayoutId: number }) {
  return request<import('@/types/api').SeatCraftLayoutVO>(`/api/ticket/admin/sessions/${sessionId}/seat-layout/from-activity`, { method: 'POST', body: JSON.stringify(body) })
}

export async function getSessionSeatLayout(sessionId: number, userId: number) {
  return request<import('@/types/api').SeatCraftLayoutVO | null>(`/api/ticket/admin/sessions/${sessionId}/seat-layout?userId=${userId}`)
}

export async function getSessionTicketDrafts(sessionId: number, userId: number) {
  return request<import('@/types/api').SeatCraftSectionVO[]>(`/api/ticket/admin/sessions/${sessionId}/seat-layout/ticket-drafts?userId=${userId}`)
}
```

- [ ] **Step 4: 验证**

Run:

```powershell
pnpm run typecheck
```

Expected: `tsc --noEmit` 通过。

---

## Task 9: 迁移 SeatCraft 前端组件

**Files:**
- Create files under `frontend/src/components/seatcraft/`

- [ ] **Step 1: 创建 `types.ts`**

从 `seatcraft/src/components/SeatMap/types.ts` 迁移并对齐主站类型：

```ts
export type SeatStatus = 'available' | 'reserved' | 'selected' | 'occupied'
export type SectionType = 'core' | 'stand' | 'zone'
export type SectionLayout = 'grid' | 'curved'

export interface SeatCraftSeat {
  id: string
  sessionSeatId?: number
  row: number
  col: number
  x: number
  y: number
  angle: number
  status: SeatStatus
  price?: number
  sectionKey: string
  sectionName: string
  label: string
}

export interface SeatCraftSection {
  id: string
  sectionKey: string
  name: string
  rows: number
  cols: number
  x: number
  y: number
  color: string
  type: SectionType
  layout: SectionLayout
  radius?: number | null
  arcSpan?: number | null
  rotation?: number | null
  primeRowStart?: number | null
  primeRowEnd?: number | null
  primeColStart?: number | null
  primeColEnd?: number | null
  ticketTypeId?: number | null
}

export interface SeatCraftStage {
  title: string
  x: number
  y: number
}
```

- [ ] **Step 2: 创建布局算法 `layout.ts`**

实现 `buildSeatsForSection(section)`，第一版固定 `rows * cols`，圆弧只改变坐标和角度，不改变每排座位数。

- [ ] **Step 3: 创建 `SeatCanvas.tsx`**

从 `seatcraft` 的 `SeatMap.tsx` 提取 SVG 画布，props 支持：

```ts
type SeatCanvasProps = {
  sections: SeatCraftSection[]
  stage: SeatCraftStage
  selectedSeatIds: string[]
  selectableTicketTypeId?: number | null
  isDesignMode: boolean
  onSeatClick?: (seat: SeatCraftSeat) => void
  onSectionMove?: (sectionKey: string, x: number, y: number) => void
  onStageMove?: (x: number, y: number) => void
}
```

- [ ] **Step 4: 创建后台设计器 `SeatLayoutDesigner.tsx`**

提供模板/布局编辑 UI，先支持本地编辑和 `onChange(layout)`，不要在组件内直接调 API。

- [ ] **Step 5: 创建 C 端选座组件 `SeatSelectionMap.tsx`**

输入 `SeatCraftLayoutVO`、`SessionSeatVO[]`、`ticketTypeId`、`selectedSeatIds`，输出真实 `sessionSeatId[]`。

- [ ] **Step 6: 验证**

Run:

```powershell
pnpm run typecheck
```

Expected: `tsc --noEmit` 通过。

---

## Task 10: 后台活动创建流程接入座位图配置方式

**Files:**
- Modify: `frontend/src/app/console/activities/new/page.tsx`
- Create: `frontend/src/app/console/activities/[id]/seat-layout/page.tsx`

- [ ] **Step 1: 活动创建页增加配置方式**

在步骤 2 或新增步骤中增加：

```ts
const [seatLayoutMode, setSeatLayoutMode] = useState<'unified' | 'per_session'>('unified')
const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
```

UI 文案：

- `统一座位图：多个场次默认使用同一套座位图，可为单场复制后修改。`
- `每场单独配置：每个场次创建时单独选择模板和编辑座位图。`

- [ ] **Step 2: 创建活动后保存活动座位图**

如果 `seatLayoutMode === 'unified'` 且 `selectedTemplateId` 存在，调用：

```ts
await createActivitySeatLayoutFromTemplate(activity.id, {
  userId: u.userId,
  templateId: selectedTemplateId,
  layoutMode: 'unified',
})
```

- [ ] **Step 3: 活动座位图编辑页**

创建 `frontend/src/app/console/activities/[id]/seat-layout/page.tsx`，加载活动座位图并渲染 `SeatLayoutDesigner`。保存接口在后端 Task 11 补齐，第一步可以先只展示和本地编辑。

- [ ] **Step 4: 验证**

Run:

```powershell
pnpm run typecheck
```

Expected: 通过。

---

## Task 11: 保存活动/场次座位图编辑结果

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/ActivitySeatLayoutService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/SessionSeatLayoutService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/app/console/activities/[id]/seat-layout/page.tsx`
- Create: `frontend/src/app/console/sessions/[id]/seat-layout/page.tsx`

- [ ] **Step 1: 后端增加保存接口**

接口：

```java
@PutMapping("/activities/{activityId}/seat-layout")
public Result<SeatCraftLayoutDtos.LayoutResponse> updateActivitySeatLayout(@PathVariable Long activityId, @RequestBody SeatCraftLayoutDtos.LayoutSaveRequest request)

@PutMapping("/sessions/{sessionId}/seat-layout")
public Result<SeatCraftLayoutDtos.LayoutResponse> updateSessionSeatLayout(@PathVariable Long sessionId, @RequestBody SeatCraftLayoutDtos.LayoutSaveRequest request)
```

保存策略：

- 无交易场次：删除旧分区，重建分区，重建兼容 `venue_area` / `venue_seat` / `session_seat`。
- 有交易场次：执行安全修改校验；只允许视觉修改和新增座位，不允许删除或改变已交易座位票档。

- [ ] **Step 2: 前端 API 增加保存方法**

```ts
export async function updateActivitySeatLayout(activityId: number, body: { userId: number; layout: SeatCraftLayoutVO }) {
  return request<import('@/types/api').SeatCraftLayoutVO>(`/api/ticket/admin/activities/${activityId}/seat-layout`, { method: 'PUT', body: JSON.stringify(body) })
}

export async function updateSessionSeatLayout(sessionId: number, body: { userId: number; layout: SeatCraftLayoutVO }) {
  return request<import('@/types/api').SeatCraftLayoutVO>(`/api/ticket/admin/sessions/${sessionId}/seat-layout`, { method: 'PUT', body: JSON.stringify(body) })
}
```

- [ ] **Step 3: 前端页面接入保存**

活动座位图页和场次座位图页点击保存时调用对应 API，成功后显示“座位图已保存”。

- [ ] **Step 4: 验证**

Run:

```powershell
mvn test -pl java-ticket -Dtest=ActivitySeatLayoutServiceTest,SessionSeatLayoutServiceTest
pnpm run typecheck
```

Expected: 全部通过。

---

## Task 12: 场次管理接入 SeatCraft 分区票档草稿

**Files:**
- Modify: `frontend/src/app/console/sessions/page.tsx`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/types/api.ts`

- [ ] **Step 1: 新建场次表单增加座位图来源**

在 `SessionForm` 增加：

```ts
seatLayoutSource: 'activity' | 'template'
templateId: string
activityLayoutId: string
```

- [ ] **Step 2: 创建场次后复制布局**

创建场次成功后：

```ts
if (form.seatLayoutSource === 'activity' && form.activityLayoutId) {
  await createSessionSeatLayoutFromActivity(session.id, { userId, activityLayoutId: Number(form.activityLayoutId) })
}
if (form.seatLayoutSource === 'template' && form.templateId) {
  await createSessionSeatLayoutFromTemplate(session.id, { userId, templateId: Number(form.templateId) })
}
```

- [ ] **Step 3: 票档弹窗改为分区草稿**

打开票档创建时优先调用 `getSessionTicketDrafts(session.id, userId)`。若返回非空，按分区展示名称、库存、价格输入，不再要求手动选择 `venue_area`。

- [ ] **Step 4: 创建票档后绑定分区**

后端需要在创建票档后把 `session_seat_layout_section.ticket_type_id` 写回对应分区，并把该分区座位 `ticket_type_id` 更新为新票档。

- [ ] **Step 5: 验证**

Run:

```powershell
pnpm run typecheck
```

Expected: 通过。

---

## Task 13: C 端活动详情页替换 SeatCraft 选座图

**Files:**
- Modify: `frontend/src/app/activity/[id]/page.tsx`
- Create/Use: `frontend/src/components/seatcraft/SeatSelectionMap.tsx`

- [ ] **Step 1: 加载 seat map 后判断布局**

现有 `getSeatMap(selectedSession.session.id, selectedTicket.id)` 返回 `SeatMapResponse`。如果 `response.layout` 存在，使用 `SeatSelectionMap`；否则保留旧 `SeatMap`。

- [ ] **Step 2: 选座组件传真实座位 ID**

`SeatSelectionMap` 的 `onChange` 必须返回 `SessionSeatVO.id[]`，保持现有 `createOrderWithSeats({ seatIds })` 不变。

- [ ] **Step 3: 自动分配兼容 SeatCraft**

`handleAutoSelectSeats` 保持按 `seat.status === 1` 过滤，并优先同 `layoutSectionId`、同排连续座位。

- [ ] **Step 4: 验证**

Run:

```powershell
pnpm run typecheck
```

Expected: 通过。

---

## Task 14: 全量验证

**Files:**
- No direct edits unless previous tasks fail.

- [ ] **Step 1: 后端回归**

Run:

```powershell
mvn test -pl java-ticket,java-order -am
```

Expected: `BUILD SUCCESS`。

- [ ] **Step 2: 前端类型检查**

Run:

```powershell
pnpm run typecheck
```

Expected: `tsc --noEmit` 通过。

- [ ] **Step 3: 空白检查**

Run:

```powershell
git diff --check
```

Expected: 没有 whitespace error；LF/CRLF warning 可接受。

- [ ] **Step 4: 手动验收路径**

按以下路径手动验证：

1. admin 登录后台。
2. 新建活动，选择统一座位图，选择演出场地模板。
3. 编辑活动座位图，增加一个区域并保存。
4. 创建场次，复制活动座位图。
5. 按分区生成票档草稿，填写价格并保存。
6. C 端打开活动详情，选择场次和票档。
7. 页面展示 SeatCraft 风格座位图，非当前票档分区不可选。
8. 选座下单并扫码支付。
9. 回到同一场次，已售座位不可选。
10. 后台尝试删除已售座位所在分区，应被安全修改规则拒绝。

---

## Self-Review

### Spec Coverage

- 场馆模板库：Task 1、Task 4。
- 活动统一/每场独立配置：Task 5、Task 10、Task 12。
- 模板复制后独立编辑：Task 5、Task 6、Task 11。
- 分区生成票档草稿：Task 6、Task 12。
- C 端按场次座位图选座：Task 7、Task 9、Task 13。
- 后端 `session_seat` 作为交易事实来源：Task 6、Task 13。
- 安全修改：Task 11、Task 14。

### Known Implementation Risk

- 现有 `session_seat.area_id` 和 `venue_seat_id` 都是 NOT NULL FK。为了降低迁移风险，本计划第一版要求 SeatCraft 布局生成时同步创建兼容 `venue_area` 和 `venue_seat`，而不是立刻放宽旧表约束。
- SeatCraft 当前弧形算法会按外圈弧长增加座位数。第一版后端固定 `rows * cols`，前端也应按同样规则渲染，避免库存数量和视觉数量不一致。
- 保存设计器结果的接口和安全修改规则是最大风险点，必须优先用测试覆盖有交易座位的删除/缩排/改票档拒绝。

### Validation Commands

- 后端主验证：`mvn test -pl java-ticket,java-order -am`
- 前端主验证：`pnpm run typecheck`
- 空白检查：`git diff --check`
