# SeatCraft 单座自由摆放 P0 设计

## 背景

当前 SeatCraft 布局仍以 block 算法生成座位坐标。`gridBlock` 和 `arcBlock` 根据行列、间距和角度批量计算座位，`standingBlock` 只按容量计数。前端已有 `SeatOverride` 能隐藏座位、调整 `dx/dy` 偏移和自定义标签，后端也能保存并在生成座位时应用这些偏移。

P0 目标不是重做完整自由排座数据模型，而是在现有 block 模型上允许主办方拖动单个可售座位到任意画布位置。

## 目标

- 在 SeatCraft 设计器中增加单座移动模式。
- 用户可以拖动 `gridBlock` / `arcBlock` 中的单个未售座位。
- 拖动结果保存为该座位的 `SeatOverride.dx` / `SeatOverride.dy`。
- 后端继续使用现有 `seat_override` 表持久化，不新增表。
- 后端生成座位时继续按 `base + dx/dy` 计算位置。
- `hidden` / `deleted` 仍只影响是否生成座位和库存；`dx/dy` 不影响库存。

## 非目标

- 不实现完全脱离 block 的独立座位表。
- 不新增 `absolute_x` / `absolute_y` 字段。
- 不支持站区 `standingBlock` 单座拖动。
- 不支持已售或已锁定座位拖动。
- 不做 Undo/Redo。
- 不改变 ticket group 绑定模型。
- 不改变订单、锁座、支付链路。

## 数据模型

复用现有 `seat_override`：

- `block_id`：座位所属 block。
- `row_no` / `seat_no`：算法生成座位的逻辑坐标。
- `status`：`visible`、`hidden`、`deleted`。
- `dx` / `dy`：相对算法基准坐标的画布偏移。
- `custom_label`：自定义座位标签。

前端拖动单座时计算：

```text
dx = targetX - baseX
```

其中 `baseX/baseY` 是不应用 override 时的算法基准坐标。最终显示坐标仍是：

```text
x = baseX + dx
```

## 前端设计

### 工具模式

`SeatCanvas` 和 `SeatLayoutDesigner` 的 `toolMode` 从当前：

```text
pointer | eraser
```

扩展为：

```text
pointer | eraser | seatMove
```

左侧工具栏新增“移动单座”按钮。行为：

- `pointer`：移动/旋转/缩放 block 和舞台。
- `eraser`：点击座位切换 hidden。
- `seatMove`：拖动单个座位，写入 `dx/dy` override。

### 座位基准坐标

`SeatCraftSeat` 增加可选字段：

```ts
baseX?: number
baseY?: number
```

`buildSeatsForBlock()` 在构造每个座位时同时输出：

- `baseX/baseY`：未应用 override 的算法坐标。
- `x/y`：应用 override 后的最终坐标。

### 单座拖动

`SeatCanvas` 增加 seat drag 状态：

```ts
{ type: 'seat'; blockKey: string; rowNo: number; seatNo: number; startX: number; startY: number; originX: number; originY: number; baseX: number; baseY: number }
```

拖动过程中只更新视觉位置或直接回调最终位置。P0 采用最终落点回调，减少状态复杂度。

`SeatCanvasProps` 增加：

```ts
onSeatMove?: (blockKey: string, rowNo: number, seatNo: number, x: number, y: number, baseX: number, baseY: number) => void
```

`SeatLayoutDesigner` 在回调中更新对应 block 的 `overrides`：

- 如果同一 `rowNo/seatNo` 已有 override，保留 `customLabel`，将 `status` 设为 `visible`，更新 `dx/dy`。
- 如果没有 override，新建 `{ blockKey, rowNo, seatNo, status: 'visible', dx, dy }`。
- 如果座位是 `occupied`，不允许拖动。
- 如果座位是 `deleted`，不允许拖动，用户需要先用 eraser 恢复。

### 保存

现有 `toSeatCraftLayoutPayload()` 已会把 `layout.blocks[].overrides` 扁平化为 `blockLayout.overrides`。P0 不改保存协议。

## 后端设计

后端保持现有接口和表结构。

需要补测试锁定行为：

- `SeatCraftBlockLayoutService.replaceLayout()` 能保存较大的 `dx/dy`。
- `SeatCraftBlockLayoutService.getLayout()` 能返回 `dx/dy`。
- `SeatBlockGeometryService.generateSeats()` 对 `visible` override 应用 `dx/dy`，但不改变座位数量。
- `SessionBlockTicketStockService.generateForSession()` 的票档库存不因 `dx/dy` 改变。

如测试发现缺口，只做最小修复。

## 错误处理

- 拖动 occupied 座位：前端忽略操作，不写 override。
- 拖动 hidden/deleted 座位：前端忽略操作。
- block 不存在：前端忽略操作。
- `standingBlock`：不渲染单座，所以不存在单座拖动入口。

## 验收标准

- 设计器有“移动单座”工具。
- 方阵座位可拖到任意位置，保存后刷新仍在该位置。
- 扇形座位可拖到任意位置，保存后刷新仍在该位置。
- 隐藏座位仍不参与生成和库存。
- 单座移动不改变票档库存。
- 已售/锁定座位不能被拖动。
- `pnpm typecheck` 通过。
- 相关 Java 单元测试通过。

## 风险和后续

- P0 仍依赖 block 的逻辑行列坐标，删除或缩小 block 时，被拖远的座位仍可能随原逻辑坐标一起被判定为删除，需要后续结合布局版本和售票保护优化。
- 大量单座拖动会产生大量 override 行，但数据量仍远小于直接为所有座位建自定义坐标。
- 后续真正自由排座可演进为 `freeBlock` 或独立 `seat_node` 表。
