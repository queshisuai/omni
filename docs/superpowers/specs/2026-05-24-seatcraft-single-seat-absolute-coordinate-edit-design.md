# SeatCraft 单座绝对坐标编辑 P2 设计

## 背景

SeatCraft P0 已支持在设计器中拖动单个座位，并将结果保存为 `SeatOverride.dx` / `SeatOverride.dy`。前端座位生成会同时输出：

- `baseX/baseY`：未应用 override 的算法基准坐标。
- `x/y`：应用 `dx/dy` 后的最终画布坐标。

P2 目标是在不改变后端数据模型的前提下，为单座移动补充精确编辑能力：用户选中某个座位后，可以在右侧属性面板直接输入画布绝对坐标 `X/Y`。

## 目标

- 支持在 SeatCraft 设计器中选中单个座位。
- 右侧属性面板显示选中座位的逻辑编号、当前绝对坐标、基准坐标、偏移值和状态。
- 用户可以编辑绝对坐标 `X/Y`，系统自动换算为 `dx/dy` override。
- 拖拽单座和手动输入坐标复用同一套更新逻辑。
- 与现有 Undo/Redo 集成。
- 不新增数据库字段，不改变保存接口，不改变后端座位生成逻辑。

## 非目标

- 不新增 `absolute_x` / `absolute_y` 字段。
- 不新增独立座位节点表。
- 不改变 `seat_override` 表结构。
- 不支持 `standingBlock` 单座坐标编辑。
- 不允许编辑已售、已锁定、隐藏或删除座位的位置。
- 不实现多座批量坐标编辑。
- 不实现键盘方向键微调。
- 不改变订单、锁座、支付、库存链路。

## 交互设计

### 座位选中

设计器新增单座选中状态：

```ts
type ActiveSeatKey = {
  blockKey: string
  rowNo: number
  seatNo: number
} | null
```

在设计模式下，用户点击座位时：

- 如果当前工具是 `pointer` 或 `seatMove`，选中该座位。
- 如果当前工具是 `eraser`，保持现有隐藏/恢复座位行为，不切换为坐标编辑。
- 选中座位后，仍保留所属 block 为 active block，右侧面板展示座位属性。
- 切换 active block、删除 block、座位被隐藏或删除后，清空无效的 active seat。

### 画布展示

`SeatCanvas` 增加设计态座位选中高亮能力：

- 接收 `activeSeatKey`。
- 对匹配 `blockKey + rowNo + seatNo` 的座位绘制高亮样式。
- 点击座位时通过回调通知 `SeatLayoutDesigner`。
- 不复用 C 端选座语义的 `selectedSeatIds`，避免设计态选中和真实选座状态混淆。

### 右侧属性面板

`SeatLayoutControls` 在存在 active seat 时显示“座位属性”区域，字段包括：

- 所属区域名称。
- 逻辑排号：`rowNo`。
- 逻辑座号：`seatNo`。
- 当前状态：`available`、`occupied`、`deleted` 等。
- 当前绝对坐标：`X/Y`，可编辑。
- 基准坐标：`baseX/baseY`，只读。
- 偏移量：`dx/dy`，只读。

当座位不可编辑时，绝对坐标输入框禁用，并显示简短原因：

- 已售或已锁定：不可移动已占用座位。
- hidden/deleted：请先恢复座位后再编辑坐标。
- 缺少 `baseX/baseY`：无法计算偏移。

### 坐标更新

用户编辑绝对 `X/Y` 时，前端执行：

```text
dx = inputX - baseX
dy = inputY - baseY
```

然后复用现有 `moveSeat(blockKey, rowNo, seatNo, inputX, inputY, baseX, baseY)` 更新对应 block 的 `overrides`。

更新规则保持 P0 行为：

- 如果已有 override，保留 `customLabel`，将 `status` 设为 `visible`，更新 `dx/dy`。
- 如果没有 override，新建 `{ blockKey, rowNo, seatNo, status: 'visible', dx, dy }`。
- 如果当前 override 是 `hidden` 或 `deleted`，不允许位置更新。
- 如果座位状态是 `occupied`，不允许位置更新。

## 数据模型

继续复用 `seat_override`：

- `block_id`
- `row_no`
- `seat_no`
- `status`
- `dx`
- `dy`
- `custom_label`

前端仅把绝对坐标作为编辑视图。保存 payload 仍由现有 `toSeatCraftLayoutPayload()` 将 block 内的 overrides 扁平化为 `blockLayout.overrides`。

后端不需要新增字段或接口。

## 组件边界

### `SeatLayoutDesigner`

职责：

- 维护 `activeSeatKey`。
- 根据 `blocks` 和 `sectionSeats` 解析当前 active seat 的完整信息。
- 将 active seat 信息传给 `SeatLayoutControls`。
- 提供 `onSeatSelect` 和 `onUpdateSeatPosition`。
- 坐标编辑复用 `moveSeat()`。
- 清理失效 active seat。

### `SeatCanvas`

职责：

- 在设计模式下响应座位点击选择。
- 渲染 active seat 高亮。
- 保持现有 `seatMove` 拖拽逻辑。
- 保持现有 `eraser` 行为优先级。

### `SeatLayoutControls`

职责：

- 展示 active block 信息。
- 当存在 active seat 时，额外展示座位属性编辑区。
- 绝对坐标输入变化后调用 `onUpdateSeatPosition`。
- 不直接修改 overrides。

## Undo/Redo

单座绝对坐标编辑进入现有历史栈。

`moveSeat()` 支持可选 `CommitOptions`，坐标输入使用：

```text
edit:seat-position:<blockKey>:<rowNo>:<seatNo>
```

同一个座位连续编辑可以合并为一个历史项。拖拽仍使用现有：

```text
move:seat:<blockKey>:<rowNo>:<seatNo>
```

这样可以区分“拖动单座”和“手动输入坐标”的历史来源，同时不改变最终数据结构。

## 错误处理

- active block 不存在：清空 active seat。
- active seat 在当前生成结果中不存在：清空 active seat。
- 输入为空或非数字：按现有 number input 行为归零或拒绝提交，实施时优先避免产生 `NaN`。
- `baseX/baseY` 缺失：禁用编辑。
- `standingBlock`：没有单座，不出现座位属性编辑区。
- occupied 座位：允许查看坐标，不允许编辑。
- hidden/deleted 座位：允许通过 eraser 恢复，恢复前不允许坐标编辑。

## 验收标准

- 设计模式下点击座位后，右侧属性面板显示该座位信息。
- 可编辑座位的绝对 `X/Y` 输入框可修改，并立即更新画布位置。
- 修改后保存并重新读取布局，座位仍位于输入的绝对坐标。
- 坐标编辑实际保存为 `dx/dy` override，不新增后端字段。
- 单座拖拽功能保持可用。
- eraser 隐藏/恢复座位行为保持可用。
- Undo/Redo 能撤销和重做坐标输入变更。
- occupied、hidden、deleted 座位不允许坐标编辑。
- `pnpm typecheck` 通过。
- 相关前端纯函数测试和必要后端测试通过。

## 风险和后续

- 当前坐标仍依赖算法生成座位的逻辑 `rowNo/seatNo`。如果后续修改 block 行列、间距或多边形顶点，`baseX/baseY` 会变化，绝对显示位置也会随 `base + dx/dy` 重新计算。
- 大量精确编辑会增加 override 数量，但仍符合当前 P0/P1 决策，不引入独立座位表。
- 后续可以在同一座位属性面板扩展“重置位置”“自定义座位标签”“键盘微调”“批量对齐”等能力。
