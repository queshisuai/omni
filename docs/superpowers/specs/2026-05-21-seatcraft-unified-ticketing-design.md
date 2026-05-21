# SeatCraft 统一票档与选座设计

## 背景

当前主前端已有 `frontend/src/components/seatcraft/*` 的简化 SeatCraft 集成，同时根目录 `seatcraft/` 存在一套更完整的座位图设计器和选座模式。用户明确要求：

- 票档创建和新增过程应发生在 `C:\Users\Administrator\Desktop\omni\seatcraft` 这套座位编辑器体验中。
- C 端用户选座也应使用 `seatcraft` 中的选座编辑器体验。
- 选定票档后座位图应自动拉近到对应区域，而不是继续使用旧点阵或卡片式区域选择。
- 修复返回上一页不刷新、商户导航同时高亮、商户活动管理与 admin 下架活动等体验问题。

## 目标

1. 主业务前端统一使用根目录 `seatcraft` 的座位图交互语言。
2. 场次管理中的票档创建从表单勾选改为 SeatCraft 票档编辑模式。
3. C 端活动详情页使用 SeatCraft 选座模式，选票档后自动缩放/平移到对应票档区。
4. 保留现有后端服务边界，不引入跨服务 SQL 或跨库访问。
5. 优先通过前端适配复用现有后端接口；只有现有字段无法表达时，才补最小后端 DTO/接口。

## 非目标

- 不重建评价/动态系统。
- 不改变当前 `prod-split` 数据库拓扑。
- 不在本迭代内引入 MQ、outbox、实时锁座推送或复杂座位协同编辑。
- 不把 `seatcraft` 独立 Vite 应用作为单独运行服务嵌入 iframe；应把核心组件迁入或封装到主前端中。

## 现状

### 可复用资产

- `seatcraft/src/components/SeatMap/SeatMap.tsx`：完整画布、缩放、设计/选座模式、分区渲染。
- `seatcraft/src/components/SeatMap/Controls.tsx`：右侧控制面板。
- `seatcraft/src/components/SeatMap/types.ts`：`SectionData`、`SeatData` 类型。
- `frontend/src/app/console/sessions/page.tsx`：当前场次管理和票档创建入口。
- `frontend/src/app/activity/[id]/page.tsx`：当前 C 端活动详情和选座入口。
- `frontend/src/app/console/layout.tsx`：当前导航高亮 bug 所在。

### 当前问题

- 场次管理里票档创建是卡片/checkbox 选择分区，体验不符合 SeatCraft 编辑流程。
- C 端选座仍有旧 `SeatMap` 和简化版 `SeatSelectionMap` 混用。
- `pathname.startsWith(item.href)` 导致 `/console/tours/new` 同时高亮 `/console/tours` 和 `/console/tours/new`。
- 页面返回后部分列表或详情不重新拉取数据。
- 商户侧活动管理、创建演出、admin 全局活动管理的入口和文案容易混淆。

## 方案

### 1. SeatCraft 组件整合

在主前端新增统一组件目录，例如：

```text
frontend/src/components/seatcraft-unified/
├── SeatCraftCanvas.tsx
├── SeatCraftControls.tsx
├── SeatCraftTicketEditor.tsx
├── SeatCraftSelector.tsx
├── adapters.ts
└── types.ts
```

迁入或改造根目录 `seatcraft/src/components/SeatMap/*` 的核心代码，保留其交互体验：

- 左侧模式语义：设计模式、选座模式、票档绑定模式。
- 中央画布：缩放、平移、拖拽、圆弧/方阵分区。
- 右侧面板：分区属性、票档属性、已选座位摘要。

主前端不直接依赖 `seatcraft` 作为独立包，避免增加构建链路复杂度；先通过代码迁入和适配落地。

### 2. 数据适配层

建立适配函数，在以下模型之间转换：

- 后端 `SeatCraftLayoutVO` / `SeatCraftSectionVO`
- 主前端当前 `SeatCraftLayoutDraft`
- 根目录 SeatCraft 的 `SectionData` / `SeatData`
- C 端 `SeatMapResponse` / `SessionSeatVO`

原则：

- 后端仍以活动座位图、场次座位图、session seat 为事实来源。
- ticket type 与 layout section 的绑定继续通过现有 `layoutSectionIds` 表达。
- 如果 SeatCraft 里出现 block 但后端只支持 section，第一版将 block 映射为 section-like draft；只有无法表达库存/票档绑定时再扩展后端。

### 3. B 端票档创建流程

场次管理页中的“票档”按钮改为进入 SeatCraft 票档编辑流程：

1. 用户点击某场次的“票档”。
2. 页面加载该场次从活动复制来的 SeatCraft 布局与 `getSessionTicketDrafts()`。
3. 展示 SeatCraft 票档编辑器。
4. 用户在画布上选择一个或多个未绑定分区/座位块。
5. 右侧填写票档名称、价格、颜色等信息。
6. 系统实时显示预计库存。
7. 保存时调用 `createAdminTicketType()`，传入 `layoutSectionIds`、`name`、`price`、`totalStock`。
8. 保存成功后画布区域显示已绑定票档，不再允许重复绑定。

旧的区域卡片勾选作为 legacy fallback 仅在没有 SeatCraft layout drafts 时显示，并降低视觉优先级。

### 4. C 端用户选座流程

活动详情页改为统一 SeatCraft 选座：

1. 用户选择场次。
2. 用户选择票档。
3. 前端调用 `getSeatMap(sessionId, ticketTypeId)` 获取该票档可选座位和 layout。
4. SeatCraft 进入选座模式，只允许点击该票档下的可售座位。
5. 选定票档时执行自动聚焦：计算该票档绑定分区的 bbox，调用缩放/平移 API 将画布拉近到目标区域。
6. 用户选择座位后创建订单，仍走 `createOrderWithSeats()`。

自动聚焦规则：

- 如果票档绑定多个分区，聚焦到这些分区的联合 bbox。
- 如果只有一个分区，聚焦到该分区中心，缩放级别约 1.6 到 2.2。
- 如果 layout 数据缺失，则不自动缩放，显示普通票档购买流程。

### 5. Admin 下架活动

保留当前 `deactivateActivity()` 后端能力和退款确认流程。前端调整：

- admin 活动管理页显示“下架并退款”明确文案。
- organizer 如果允许下架自己的活动，也必须走同样确认流程；如果当前权限不允许，则隐藏或禁用下架入口。
- 下架成功后刷新列表，展示退款影响摘要。

### 6. 商户活动管理

商户侧菜单和页面语义调整：

- “我的演出”：展示商户自己的 tour / activity 草稿和发布状态。
- “创建演出”：进入创建向导。
- “活动管理”：如果保留给 organizer，则只显示 `organizer_id = userId` 的活动 CRUD；页面标题必须区别于 admin 的“平台演出管理”。

后端已有 organizer 权限限制，前端主要修正文案、入口和可见操作。

### 7. 导航高亮修复

修复 `frontend/src/app/console/layout.tsx`：

- 精确匹配优先。
- 对子路径只高亮最长匹配项。
- `/console/tours/new` 只高亮“创建演出”，不再同时高亮“我的演出”。

### 8. 返回刷新

对以下页面补充返回刷新策略：

- 活动详情页。
- 订单页。
- 管理端列表页：活动、场次、我的演出。

实现方式优先使用浏览器 `pageshow` 事件和 `document.visibilitychange`，避免过度侵入路由结构。刷新必须调用页面已有 load 函数，不引入 mock/offline 降级。

## 后端影响

第一阶段优先不改数据库表结构。需要确认现有接口是否足够：

- `getActivitySeatLayout(activityId, userId)`
- `getSessionTicketDrafts(sessionId, userId)`
- `createAdminTicketType({ layoutSectionIds })`
- `getSeatMap(sessionId, ticketTypeId)`
- `createOrderWithSeats()`

如果发现 block 无法映射到 layout section，新增最小后端扩展：

- 在 session seat / layout draft 中增加 block 标识或将 block 生成 section draft。
- 不新增跨服务 mapper，不跨库查询。

## 验收标准

1. 场次管理点击“票档”后出现 SeatCraft 票档编辑器，而不是当前 checkbox 卡片表单。
2. 票档创建必须在座位图上选择分区/座位块后完成。
3. C 端活动详情页选票档后，座位图自动拉近到对应票档区域。
4. 用户只能选中当前票档下的可售座位。
5. `/console/tours/new` 只高亮“创建演出”。
6. 从详情页返回列表后，列表数据重新刷新。
7. admin 下架活动流程仍要求退款确认，并展示退款影响。
8. `pnpm typecheck` 通过。
9. `scripts/verify-microservice-boundaries.ps1` 通过。

## 实施顺序

1. 建立 SeatCraft 统一组件与适配层。
2. 替换场次管理票档创建流程。
3. 替换 C 端选座流程并实现票档自动聚焦。
4. 修复导航高亮和返回刷新。
5. 梳理商户活动管理入口与 admin 下架文案。
6. 运行前端类型检查和微服务边界验收。
