# SeatCraft 座位图系统重构：场馆与活动流程设计

## 概述

重新设计场馆 → 座位图 → 活动 → 场次的整体流程，废除"公共场馆模板库"概念，改为**场馆默认座位图 + 活动独立副本**模型。

## 场景角色

| 角色 | 职责 |
|:---|:---|
| **Admin** | 预先录入场馆（名称/地址等）+ 画好默认座位图；审核组织者提交的新场馆申请；管理所有活动 |
| **Organizer** | 提交新场馆申请（含场馆信息+座位图）；上架活动时选择已有场馆，从默认座位图复制并微调；管理自己的活动 |
| **管理员审核** | 审核活动申请（含场馆真实性+座位图），通过即上架，新场馆同时入库 |

## 核心原则

1. **座位图挂在活动上** — 每个活动有自己独立的座位图副本
2. **场馆有一份默认座位图** — 创建场馆时现场画好，作为活动创建时的起始模板
3. **复制即独立** — 活动从场馆默认布局复制后，两者完全独立，互不影响
4. **一个活动一张座位图** — 砍掉 `layout_mode`（unified / per_session），所有场次共用同一份活动座位图
5. **不画完座位图不能保存创建/申请**

## 数据模型

### 新增：`venue_default_layout`

取代 `venue_seat_layout_template`。每个 venue 最多一条活跃记录。

| 字段 | 类型 | 说明 |
|:---|:---|:---|
| `id` | BIGSERIAL PK | 自增主键 |
| `venue_id` | BIGINT NOT NULL UNIQUE FK→venue | 关联场馆，唯一约束确保一条 |
| `name` | VARCHAR(80) | 布局名称 |
| `template_type` | VARCHAR(20) | concert / cinema / custom |
| `stage_title` | VARCHAR(80) | 舞台名称 |
| `stage_x` | INTEGER | 舞台 X 坐标 |
| `stage_y` | INTEGER | 舞台 Y 坐标 |
| `canvas_width` | INTEGER | 画布宽度 |
| `canvas_height` | INTEGER | 画布高度 |
| `status` | SMALLINT DEFAULT 1 | 1=激活 |
| `create_time` | TIMESTAMP | 创建时间 |
| `update_time` | TIMESTAMP | 更新时间 |

### 新增：`venue_default_layout_section`

取代 `venue_seat_layout_template_section`。

| 字段 | 类型 | 说明 |
|:---|:---|:---|
| `id` | BIGSERIAL PK | 自增 |
| `layout_id` | BIGINT FK→venue_default_layout CASCADE | 关联布局 |
| `section_key` | VARCHAR(80) | 分区标识 |
| `name` | VARCHAR(80) | 分区名称 |
| `rows` | INTEGER | 排数 |
| `cols` | INTEGER | 列数 |
| `x, y` | INTEGER | 坐标 |
| `color` | VARCHAR(20) | 颜色 |
| `type` | VARCHAR(20) | core / stand / zone |
| `layout` | VARCHAR(20) | grid / curved |
| `radius, arc_span, rotation` | INTEGER? | 弧线布局参数 |
| `prime_row_start/end, prime_col_start/end` | INTEGER? | 优选区 |
| `sort` | INTEGER | 排序 |
| `status` | SMALLINT DEFAULT 1 | 1=激活 |
| `create_time, update_time` | TIMESTAMP | 时间戳 |

约束：`UNIQUE(layout_id, section_key)`、`CHECK(rows > 0 AND cols > 0)`

### 修改：`activity_seat_layout`

| 字段 | 改动 |
|:---|:---|
| `source_template_id` | **删除**，替换为 `source_venue_layout_id` FK→`venue_default_layout` |
| `layout_mode` | **删除**，不再需要 |
| 其余字段 | 不变 |

### 修改：`session_seat_layout`

| 字段 | 改动 |
|:---|:---|
| `source_template_id` | **删除** |
| `activity_layout_id` | 保留，FK→`activity_seat_layout` |
| 其余字段 | 不变 |

### 删除的表

| 表 | 删除原因 |
|:---|:---|
| `venue_seat_layout_template` | 被 `venue_default_layout` 替代 |
| `venue_seat_layout_template_section` | 被 `venue_default_layout_section` 替代 |

### 保留不变的表

`activity_seat_layout_section`、`session_seat_layout`、`session_seat_layout_section`、`session_seat` 结构不动。

## 数据库迁移步骤

1. DROP `activity_seat_layout` 外键 `source_template_id` → `venue_seat_layout_template`
2. DROP `session_seat_layout` 外键 `source_template_id` → `venue_seat_layout_template`
3. CREATE TABLE `venue_default_layout`
4. CREATE TABLE `venue_default_layout_section`
5. ALTER `activity_seat_layout` ADD `source_venue_layout_id` FK→`venue_default_layout`，DROP `source_template_id`，DROP `layout_mode`
6. ALTER `session_seat_layout` DROP `source_template_id`
7. DROP TABLE `venue_seat_layout_template_section`
8. DROP TABLE `venue_seat_layout_template`
9. 迁移已有数据：若 `venue_seat_layout_template` 中有默认模板，插入 `venue_default_layout`

## 流程设计

### 1. Admin 创建场馆

```
POST /api/ticket/admin/venues { name, city, address, capacity, layout: {...} }
    ↓
校验：layout.sections 不能为空
    ↓
事务：insert venue → insert venue_default_layout → insert sections
```

前端：场馆表单 → 基本信息 → 下方 SeatCraft 编辑器（空白画布）→ 画好分区 → "完成"按钮启用 → 提交

### 2. Organizer 申请新场馆

```
POST /api/ticket/admin/venue-applications { name, city, address, capacity, layout: {...}, ... }
    ↓
保存为申请记录（含 layout JSON 字段）
    ↓
Admin 审核 → POST /applications/{id}/review { action: "approve" }
    ↓
审批通过：事务创建 venue + venue_default_layout + sections
```

前端：与 admin 创建场馆一致的 UI（场馆表单 + 编辑器），但走申请提交流程

### 3. 活动创建（使用已有场馆）

```
POST /api/ticket/admin/activities { categoryId, name, ..., venueId, sessions, ticketTypes, seatLayout: {...} }
    ↓
seatLayout 初始值 = 场馆默认布局（前端加载用户可调）
    ↓
事务：insert activity → insert activity_seat_layout + sections
```

前端：选择场馆后 → 调用 `GET /api/ticket/admin/venues/{id}/default-layout` → 加载到 SeatCraft 编辑器 → 用户确认或微调 → 提交

### 4. 编辑活动座位图

```
PUT /api/ticket/admin/activities/{id}/seat-layout { userId, layout: {...} }
    ↓
更新 activity_seat_layout + 重建 sections
    ↓
重新生成该活动所有场次的 session_seat（diff 算法）
```

### 5. 票档创建

```
POST /api/ticket/admin/ticket-types { sessionId, name, price, layoutSectionIds: [...] }
    ↓
校验所选分区 exist in activity_seat_layout_sections
    ↓
根据分区 rows×cols 计算库存
    ↓
生成 session_seat 快照
```

## API 端点说明

### 新增/修改的端点

| 方法 | 路径 | 说明 |
|:---|:---|:---|
| `POST` | `/api/ticket/admin/venues` | 创建场馆 + layout（body 增加 layout 字段） |
| `GET` | `/api/ticket/admin/venues/{id}` | 返回场馆 + `defaultLayout` |
| `GET` | `/api/ticket/admin/venues/{id}/default-layout` | 获取场馆默认座位图 |
| `PUT` | `/api/ticket/admin/venues/{id}/default-layout` | 更新场馆默认座位图 |
| `POST` | `/api/ticket/admin/activities` | 创建活动，body 含 `seatLayout`（不再需要 templateId） |
| `POST` | `/api/ticket/admin/venue-applications` | 场馆申请，body 含 `layout` 字段 |

### 移除的端点

| 方法 | 路径 | 原因 |
|:---|:---|:---|
| `POST` | `/venues/{id}/seat-layout-templates/defaults` | 被 default-layout 替代 |
| `GET` | `/venues/{id}/seat-layout-templates` | 被 default-layout 替代 |
| `POST` | `/activities/{id}/seat-layout/from-template` | 活动创建时直接提交 layout，不再单独调用 |
| `POST` | `/sessions/{id}/seat-layout/from-template` | 同上 |
| `POST` | `/sessions/{id}/seat-layout/from-activity` | 不再需要 |

## 前端页面改动

### 新建场馆页（admin）

- 场馆表单 + 内嵌 `SeatLayoutDesigner` 组件
- 编辑器无分区时"提交"按钮灰色
- 后端 `POST /api/ticket/admin/venues` body 中携带 `layout` 字段

### 场馆申请页（organizer）

- 与 admin 一样：场馆表单 + 内嵌 `SeatLayoutDesigner`
- 提交时座位图 JSON 作为申请数据一部分
- 审批通过后自动入库

### 活动创建页

- **移除**：`seatLayoutMode`（unified/per_session）切换
- **移除**：场馆模板下拉选择器
- **新增**：选择场馆后调用 `GET /default-layout`，加载到内嵌编辑器预览
- 用户可确认使用或微调
- 提交时 `seatLayout` 字段随活动数据一起发送

### 场馆列表页

- 场馆项增加"查看/编辑默认座位图"按钮
- 弹窗或跳转到默认座位图编辑页

## 实体/服务层改动 (Java)

### 新增

| 文件 | 说明 |
|:---|:---|
| `VenueDefaultLayout.java` | 实体 |
| `VenueDefaultLayoutSection.java` | 实体 |
| `VenueDefaultLayoutMapper.java` | Mapper |
| `VenueDefaultLayoutSectionMapper.java` | Mapper |

### 修改

| 文件 | 改动 |
|:---|:---|
| `VenueSeatLayoutTemplate.java` | **删除** |
| `VenueSeatLayoutTemplateSection.java` | **删除** |
| `VenueSeatLayoutTemplateMapper.java` | **删除** |
| `VenueSeatLayoutTemplateSectionMapper.java` | **删除** |
| `SeatCraftTemplateService.java` | **删除**（原有逻辑不再需要） |
| `ActivitySeatLayoutService.java` | `copyFromTemplate` → `createFromVenueDefault`，移除 `sourceTemplateId` 引用 |
| `SessionSeatLayoutService.java` | 移除 `fromTemplate` 方法 |
| `AdminController.java` | 移除旧端点，新增 venue default-layout 端点 |

### 测试改动

| 文件 | 改动 |
|:---|:---|
| `SeatCraftTemplateServiceTest.java` | **删除** |
| `ActivitySeatLayoutServiceTest.java` | 适配 `createFromVenueDefault` |
| `AdminControllerTest.java` | 适配 venue 创建 body |

## 边界情况

| 场景 | 处理 |
|:---|:---|
| 场馆默认布局为空 | 不允许保存，前端编辑器无分区时按钮灰色 |
| 活动更新座位图后已有订单 | 不允许修改（活动已产生订单后座位图锁定） |
| 场馆默认布局更新 | 不影响已有活动的独立副本 |
| Organizer 申请已存在的场馆 | 直接走活动创建流程（选已有场馆），不可重复申请 |
| 多场次票档绑定分区 | 票档绑定 `activity_seat_layout_section`，库存 = rows×cols，跨场次快照独立 |
