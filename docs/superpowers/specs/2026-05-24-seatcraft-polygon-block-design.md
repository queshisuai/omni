# SeatCraft 多边形 Block 设计

## 背景

SeatCraft 当前支持 `gridBlock`、`arcBlock` 和 `standingBlock`。方阵和扇形可以自动生成座位，站区只记录容量。后端 `SeatBlockGeometryService` 已有 `polygonBlock` 常量痕迹，但数据库约束、前端类型、保存 DTO 和画布交互都尚未支持多边形区块。

P1 目标是支持自动填充多边形座位区块，用于异形看台、局部遮挡后仍可规则排座的场景。

## 目标

- 新增 `polygonBlock` 区块类型。
- 多边形区块用顶点描述边界，并在边界内按行距/座距自动生成座位。
- 支持前端创建、展示、保存、读取和编辑多边形顶点。
- 支持现有 `hidden/deleted` 座位过滤和 `dx/dy` 单座移动。
- 后端库存和场次座位生成以服务端几何结果为准。
- 复用已实现的 Undo/Redo 历史栈。

## 非目标

- 不做沿任意斜边自动对齐的高级排座。
- 不做复杂布尔运算、洞、多多边形或内环裁剪。
- 不做曲线边界。
- 不做跨服务数据访问或跨服务 SQL join。
- 不改变订单、支付或库存服务边界。

## 方案选择

采用“局部坐标多边形 + 轴对齐网格填充”。

多边形顶点相对于 `seat_block.x/y` 保存。生成座位时计算多边形 bounding box，按 `seatSpacing` 和 `rowSpacing` 扫描候选点，保留落在多边形内部或边界上的点。该方案规则清晰、前后端容易保持一致、测试成本低。

不采用“前端生成所有座位并作为 overrides 传给后端”，因为库存和场次座位生成必须由后端权威计算，不能依赖前端完整传参。不采用“边界自适应填充”，因为 P1 风险高，交互和算法都明显更复杂。

## 数据模型

### `seat_block`

新增字段：

```sql
polygon_points JSONB
```

示例：

```json
[
  { "x": 0, "y": 0 },
  { "x": 220, "y": 20 },
  { "x": 180, "y": 140 },
  { "x": 20, "y": 120 }
]
```

字段语义：

- 顶点是局部坐标，相对于 `seat_block.x/y`。
- 顶点按顺时针或逆时针顺序保存。
- 至少 3 个点。
- 面积必须大于最小阈值，防止退化成线。
- `rotation` 仍是区块整体旋转角。
- `rowSpacing` / `seatSpacing` 控制自动填充密度。

迁移需要更新 `chk_seat_block_type`，允许 `polygonBlock`。

### Java 实体和 DTO

`SeatBlock` 增加：

```java
private String polygonPoints;
```

`SeatCraftBlockDtos.BlockRequest` 增加：

```java
private String polygonPoints;
```

原因：MyBatis-Plus 可直接保存 JSONB 文本到 PostgreSQL，避免 P1 引入自定义 TypeHandler。服务层负责解析和校验 JSON 文本。

### 前端类型

`SeatBlockType` 增加 `polygonBlock`。

`SeatBlockDraft` 增加：

```ts
polygonPoints?: Array<{ x: number; y: number }> | null
```

前端 payload 仍通过现有 `toSeatCraftLayoutPayload()` 发送，`polygonPoints` 随 block 一起进入 `blockLayout.blocks`。

## 几何规则

### 坐标系统

多边形局部点转换为画布点：

```text
worldX = block.x + localX
worldY = block.y + localY
```

如果 `rotation != 0`，以多边形局部 bounding box 中心为旋转中心，对生成座位和轮廓统一旋转。

### 自动填充

生成流程：

```text
解析 polygonPoints
-> 校验点数和面积
-> 计算 local bounding box
-> 从 minY 到 maxY 按 rowSpacing 扫描
-> 从 minX 到 maxX 按 seatSpacing 扫描
-> 候选点在 polygon 内或边界上则保留
-> 按行、列生成 rowNo/seatNo
-> 应用 block.x/y、rotation
-> 应用 override dx/dy/customLabel/status
```

编号规则：

- `rowNo` 从 1 开始，按扫描行递增。
- 每一行只对保留下来的座位连续编号，`seatNo` 从 1 开始。
- 同一多边形顶点和间距下，前端与后端必须生成稳定编号。

边界规则：

- 点在多边形边界上视为内部。
- 使用射线法判断点内，并单独处理点到线段距离用于边界命中。
- 浮点容差建议 `0.000001`。

### Override 规则

- `hidden` / `deleted` 不生成可售座位。
- `visible dx/dy` 可移动单座，不改变库存数量。
- `customLabel` 覆盖默认标签。
- override 的 key 仍是 `(rowNo, seatNo)`。

## 前端交互

### 创建

左侧工具栏新增“添加多边形区块”按钮。默认创建四点不规则多边形：

```ts
polygonPoints: [
  { x: 0, y: 0 },
  { x: 220, y: 20 },
  { x: 180, y: 140 },
  { x: 20, y: 120 },
]
```

默认参数：

- `blockType: 'polygonBlock'`
- `rowSpacing: 24`
- `seatSpacing: 24`
- `rows/cols/seatsPerRow: null`
- `width/height/capacity: null`

### 展示

`SeatCanvas` 对 `polygonBlock`：

- 绘制多边形轮廓。
- 绘制自动生成座位。
- 选中时显示包围框、旋转手柄和顶点控制点。
- 顶点控制点使用当前区块颜色或白色描边，便于在深色画布中识别。

### 顶点编辑

P1 支持拖拽已有顶点。

- 拖拽顶点更新 `polygonPoints[index]`。
- 使用 Undo/Redo `mergeKey: resize:polygon:<blockKey>:<index>` 合并一次拖拽。
- 顶点拖动后实时重新生成座位。
- 如果拖动导致面积过小，前端可以允许临时显示，但保存前和后端必须拒绝。

P1 不要求新增/删除顶点。后续可在属性面板增加“添加顶点/删除顶点”。

### 属性面板

`polygonBlock` 的高级属性显示：

- X / Y
- 旋转角度
- 行距
- 座距
- 顶点数
- 预估容量

不显示 rows、cols、seatsPerRow、capacity。

## 后端行为

### 保存读取

`SeatCraftBlockLayoutService`：

- `upsertBlocks()` 保存 `polygonPoints`。
- `toBlockRequest()` 返回 `polygonPoints`。
- `validateLayout()` 校验 `polygonBlock` 必须有合法 `polygonPoints`、`rowSpacing`、`seatSpacing`。

### 几何生成

`SeatBlockGeometryService`：

- `polygonBlock` 使用 `generatePolygonSeats()`，不再走 `generateFreeSeats()`。
- JSON 解析失败返回 `BusinessException(400, "多边形座位块顶点不正确")`。
- 少于 3 点返回 `BusinessException(400, "多边形座位块至少需要3个顶点")`。
- 面积过小返回 `BusinessException(400, "多边形座位块面积必须大于0")`。
- 行距或座距无效返回现有风格的 400 业务错误。

### 库存和场次座位

`SessionBlockTicketStockService`、`SessionSeatLayoutService` 等不需要跨服务访问新增数据。它们继续通过 `SeatBlockGeometryService.generateSeats()` 和 `countSellableSeats()` 获得权威结果。

## SQL 迁移

需要新增 shared 和 production-split ticket 迁移：

- `sql/migrations/shared/20260524_seatcraft_polygon_block.sql`
- `sql/production-split/ticket/20260524_seatcraft_polygon_block.sql`

迁移内容：

```sql
-- owner: java-ticket
ALTER TABLE seat_block ADD COLUMN IF NOT EXISTS polygon_points JSONB;

ALTER TABLE seat_block DROP CONSTRAINT IF EXISTS chk_seat_block_type;
ALTER TABLE seat_block ADD CONSTRAINT chk_seat_block_type
    CHECK (block_type IN ('gridBlock', 'arcBlock', 'standingBlock', 'polygonBlock'));
```

如生产拆库校验脚本对新增列有白名单，需要在 `scripts/check-production-split-sql.ps1` 中登记 `polygon_points`。

## 数据流

```text
前端添加 polygonBlock
-> 编辑 polygonPoints/rowSpacing/seatSpacing
-> buildSeatsForBlock 前端预览自动生成座位
-> 保存 blockLayout.blocks[].polygonPoints
-> java-ticket 保存 seat_block.polygon_points
-> 场次生成库存/座位时后端 generatePolygonSeats
-> hidden/deleted overrides 过滤
-> SessionSeat 和 TicketType 库存按后端结果落库
```

## 测试策略

### 前端

`frontend/src/components/seatcraft/block-layout.test.ts` 增加：

- `polygon block fills seats inside polygon bounds`
- `polygon block excludes candidates outside polygon`
- `polygon block applies hidden and moved overrides`

运行：

```powershell
node --test --experimental-strip-types --experimental-transform-types "src/components/seatcraft/block-layout.test.ts"
pnpm typecheck
```

### 后端

`SeatBlockGeometryServiceTest` 增加：

- 矩形 polygon 生成预期数量。
- 梯形 polygon 裁掉边界外候选点。
- hidden/deleted override 被过滤。
- dx/dy 不改变库存数量。
- 少于 3 点报 400。

`SeatCraftBlockLayoutServiceTest` 增加：

- `replaceLayoutPersistsAndReturnsPolygonPoints`

运行：

```powershell
mvn test -pl java-ticket "-Dtest=SeatBlockGeometryServiceTest,SeatCraftBlockLayoutServiceTest"
```

### 边界验证

如果改动 SQL 或生产拆库脚本，运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
```

## 验收标准

- 前端可以添加 `polygonBlock`。
- 选中多边形区块时可以拖动顶点。
- 顶点拖动会实时改变自动生成座位。
- 撤销一次可回到顶点拖动前状态。
- 保存后刷新页面仍能看到同样的多边形和座位预览。
- 后端生成的库存等于多边形内可售座位数量。
- `hidden/deleted` 仍减少库存，`dx/dy` 不改变库存。
- 不新增跨服务 SQL 或跨服务 Mapper。
