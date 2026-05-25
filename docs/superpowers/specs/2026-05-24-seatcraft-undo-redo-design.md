# SeatCraft Undo/Redo 设计

## 背景

SeatCraft 设计器当前所有编辑都在 `SeatLayoutDesigner` 中直接调用 `onChange(nextLayout)`。这让添加区块、移动区块、隐藏座位、移动单座、自动排列等操作可以立即更新画布，但没有撤销和重做能力。后续多边形 Block 会增加更复杂的点编辑和形状调整，先补齐 Undo/Redo 可以降低后续编辑风险。

## 目标

- 在 SeatCraft 设计器内提供本地 Undo/Redo。
- 支持按钮和快捷键：`Ctrl/Cmd+Z` 撤销，`Ctrl/Cmd+Shift+Z` 或 `Ctrl/Cmd+Y` 重做。
- 覆盖当前设计器已有编辑操作。
- 不改变后端 API、数据库结构或保存 payload。
- 避免拖拽过程产生大量历史记录。

## 非目标

- 不实现跨页面、跨刷新、跨登录会话的历史恢复。
- 不实现多人协同冲突解决。
- 不引入命令模式或操作审计日志。
- 不改变座位图保存接口的语义。
- 不在本阶段实现多边形 Block。

## 方案选择

采用 `SeatLayoutDesigner` 本地历史栈方案。

备选方案包括页面级历史栈和命令模式历史栈。页面级历史栈会把 SeatCraft 编辑语义泄漏到活动/场次页面，改动分散；命令模式更精细，但需要重写大量现有直接更新逻辑。设计器本地历史栈改动集中，能覆盖当前 P1 需求，也不会影响后端保存格式。

## 组件边界

### `SeatLayoutDesigner`

`SeatLayoutDesigner` 是 Undo/Redo 的唯一状态拥有者。它维护历史栈，并继续通过 `onChange(layout)` 把当前快照同步给外部页面。

建议状态结构：

```ts
interface SeatCraftHistoryState {
  past: SeatCraftLayoutDraft[]
  future: SeatCraftLayoutDraft[]
  lastMergeKey?: string | null
}
```

`layout` prop 仍是当前真值。历史栈只保存用户编辑前后的快照，不替代页面层保存状态。

### `SeatCanvas`

初版不要求 `SeatCanvas` 重构为 pointerup 才提交。为了控制改动范围，连续拖拽类事件通过 `commit` 的 `mergeKey` 合并历史记录。

后续如需要更精确的编辑事务，可以再给 `SeatCanvas` 增加 `onInteractionEnd`，但不作为本阶段要求。

### 页面层

活动座位图页和场次座位图页不维护历史栈。页面只接收 `onChange` 后的最新 layout，并按现有流程保存。

## 历史栈行为

统一通过 `commit(nextLayout, options?)` 修改 layout。

默认行为：

- 将当前 `layout` 推入 `past`。
- 将 `nextLayout` 通过 `onChange` 交给外部页面。
- 清空 `future`。
- `past` 最多保留 50 步，超出时丢弃最早记录。

撤销行为：

- 如果 `past` 为空，不执行。
- 取出 `past` 最后一项作为下一个当前 layout。
- 将撤销前的当前 `layout` 放入 `future` 开头。
- 调用 `onChange(previousLayout)`。

重做行为：

- 如果 `future` 为空，不执行。
- 取出 `future` 第一项作为下一个当前 layout。
- 将重做前的当前 `layout` 推入 `past`。
- 调用 `onChange(nextLayout)`。

新编辑行为：

- 撤销后发生任何新编辑，清空 `future`。
- 这符合常见编辑器行为。

## 连续操作合并

拖拽和滑动输入会产生连续 `onChange`。为避免一次拖动生成几十个撤销点，`commit` 支持 `mergeKey`。

建议规则：

- 如果本次 `mergeKey` 与上一条历史记录的 `lastMergeKey` 相同，不再追加新的 `past` 快照，只更新当前 layout。
- 如果 `mergeKey` 不同，按默认行为新增历史快照。
- 非连续操作不传 `mergeKey`，每次都是独立撤销点。
- 撤销、重做、新增非连续操作后清空 `lastMergeKey`。

推荐 `mergeKey`：

- `move:block:<blockKey>`
- `move:blocks`，用于多选移动。
- `move:stage`
- `rotate:block:<blockKey>`
- `resize:block:<blockKey>`
- `move:seat:<blockKey>:<rowNo>:<seatNo>`

属性面板数字输入暂不强制合并。它们每次输入产生历史点是可接受的，后续可按需要扩展 debounce 或 blur 提交。

## 操作覆盖

Undo/Redo 覆盖以下操作：

- 添加、复制、删除 Block。
- 移动、旋转、缩放单个 Block。
- 多选移动 Block。
- 移动舞台。
- 修改舞台标题和坐标。
- 修改 Block 名称、坐标、角度、颜色和类型相关参数。
- 修改票档名称和价格。
- 隐藏或恢复座位。
- 移动单座。
- 自动排列。
- 镜像 Block。

只要操作通过 `SeatLayoutDesigner.commit` 写入 layout，就必须进入历史机制。

## UI 与快捷键

设计器左侧工具栏增加撤销和重做按钮。

- 撤销按钮 disabled：`past.length === 0`。
- 重做按钮 disabled：`future.length === 0`。
- title 展示快捷键。
- 图标建议使用现有 `lucide-react` 的 `Undo2` 和 `Redo2`。

快捷键：

- `Ctrl+Z` / `Cmd+Z`：撤销。
- `Ctrl+Shift+Z` / `Cmd+Shift+Z`：重做。
- `Ctrl+Y` / `Cmd+Y`：重做。

输入框、textarea、select 或 contenteditable 聚焦时不拦截快捷键，避免影响文本编辑和数字编辑。

## 外部 layout 同步

页面可能因为接口加载、重新拉取或保存后回填而传入新的 `layout` prop。设计器需要避免把外部同步误认为用户编辑。

规则：

- 初次挂载时不建立历史记录。
- 如果外部传入的 layout id 或 owner 变化，清空历史栈。
- 如果外部 layout 与当前 layout 引用变化但属于同一 owner，保持历史栈，避免普通页面 setState 导致历史丢失。

owner 判断字段优先级：`sessionId`、`activityId`、`venueId`、`id`。

## 数据流

```text
用户操作
-> SeatLayoutDesigner 生成 nextLayout
-> commit(nextLayout, options)
-> 更新 history past/future
-> onChange(nextLayout)
-> 页面持有最新 layout
-> 保存时仍走现有 toSeatCraftLayoutPayload
```

撤销/重做数据流：

```text
快捷键或按钮
-> undo/redo
-> 从 past/future 取快照
-> 调整 history
-> onChange(snapshot)
```

## 错误处理

- 历史栈为空时点击按钮或触发快捷键不报错。
- `layout.blocks`、`layout.ticketGroups` 等可选字段继续按现有空数组处理。
- 如果传入外部 layout owner 变化，清空历史，避免撤销到另一个活动或场次。

## 测试与验收

自动验证：

- `frontend` 下运行 `pnpm typecheck`。

手动验收路径：

- 添加 Block，撤销后消失，重做后恢复。
- 拖动 Block 多次 pointermove 后，撤销一步回到拖动前位置。
- 隐藏座位，撤销后恢复显示，重做后再次隐藏。
- 移动单座，撤销后回到原位置，重做后恢复移动位置。
- 撤销后新增 Block，重做按钮变为不可用。
- 输入框聚焦时 `Ctrl+Z` 不触发设计器撤销。
- 保存后的 payload 结构不变。

## 后续扩展

多边形 Block 实现时，应复用同一历史栈。点新增、点移动、点删除和形状参数编辑都应通过 `commit`，拖拽点移动可使用 `mergeKey` 合并为单步撤销。
