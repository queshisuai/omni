# 场次票档 SeatCraft 统一管理设计

## 背景

当前场次管理页的“票档”入口停留在列表页内联面板，和场次 SeatCraft 座位图设计器分离。商家或 admin 想增删改票档、调整座位块、维护库存时，需要在多个入口之间切换，容易出现座位图、票档、真实 `session_seat` 和库存统计不一致。

当前业务要求把票档管理收敛到场次座位图中：点击“票档”应跳转到对应场次 SeatCraft 座位图；商家或 admin 在座位图中完成票档绑定、增删改和库存调整。系统必须保护已购/锁定座位，已购买座位不允许删除或改绑，必须提示先退款，退款完成后才能调整。

同时，活动上架时 admin 和商家需要选择 C 端座位图展示策略：

- `公布座位图`：C 端展示 SeatCraft 座位图，用户自由选择座位。
- `座位图暂不公布`：C 端只选择票档和数量，后端在该票档真实座位池内随机分配座位。

## 目标

1. 场次管理页“票档”按钮直接跳转到该场次 SeatCraft 座位图票档管理模式。
2. 场次 SeatCraft 页同时支持座位图编辑和票档管理。
3. 支持扩容：新增座位块或站区后，库存按真实新增可售座位增加。
4. 支持局部调整未售座位：未售、未锁定、未关联订单座位可删除、隐藏、改票档归属、调整布局。
5. 保护已购/交易中座位：已锁定、已售、有关联订单、退款未完成的座位灰色锁定，保留在原位置，不允许拖动、删除、隐藏或改绑。
6. 保存座位图后自动重算票档库存统计。
7. 活动上架时选择座位图是否公布，并影响 C 端购买流程。
8. 保持微服务边界：ticket 服务不直接访问 order 表；涉及订单状态的能力通过现有或新增 order internal API 获取。

## 非目标

1. 不引入完整座位图版本化系统。
2. 不恢复评价/动态系统。
3. 不把场馆/地点档案重新设计成平台场馆资产。
4. 不新增跨服务 Mapper、Entity、XML mapper 或跨服务 SQL join。
5. 不让前端库存预估替代后端真实座位池。

## 入口与前端行为

### 场次管理页

`frontend/src/app/console/sessions/page.tsx` 中“票档”按钮改为跳转：

```text
/console/sessions/{sessionId}/seat-layout?mode=tickets
```

列表页不再承载复杂票档增删改面板，避免和座位图页形成双入口。列表页继续展示库存汇总：票档数、余票、总票、已售。

### 场次 SeatCraft 页

`frontend/src/app/console/sessions/[id]/seat-layout/page.tsx` 根据 query 参数切换模式：

- 默认：座位图设计模式。
- `mode=tickets`：票档管理模式。

票档管理模式包含：

- 左侧 SeatCraft 画布。
- 右侧票档面板。
- 点击 block / arcBlock / standingBlock 可选中座位块。
- 选中未绑定座位块后可创建新票档。
- 选中已有票档后可新增未绑定座位块、移除未售座位块、改名称、改价格、删除票档。
- 已售/锁定座位灰色展示，固定在原位置，不可拖动、删除、隐藏或改绑。

### 活动上架座位图展示策略

活动创建/编辑/上架流程增加 SeatCraft 展示策略字段：

```text
seat_map_visibility = published | hidden
```

前端文案：

- `公布座位图：用户可在前台自由选择座位。`
- `座位图暂不公布：用户只选择票档和数量，座位将在下单后由系统自动分配。`

C 端活动页行为：

- `published`：加载并展示 SeatCraft 座位图，用户必须选择指定数量座位后才能下单。
- `hidden`：展示提示 `座位图暂不公布，座位将在下单后由系统自动分配。`，用户只选票档和数量，创建订单时传空 `seatIds`，order 调 ticket internal 随机锁座。

## 后端规则

### 数据模型

活动表新增字段：

```text
activity.seat_map_visibility VARCHAR(20) NOT NULL DEFAULT 'hidden'
```

取值：

- `published`
- `hidden`

默认 `hidden`，避免未明确配置的活动误公开座位图。

### SeatCraft 保存与差异校验

场次 SeatCraft 保存不再简单替换全部区域后重新生成座位，而是按差异处理：

1. 读取当前场次已有 `session_seat`。
2. 标记保护座位。
3. 根据新 SeatCraft block layout 生成目标座位集合。
4. 对比旧座位与目标座位。
5. 允许对未售未锁定座位新增、删除、隐藏、改绑。
6. 拒绝任何影响保护座位的删除、隐藏、改绑、移动到不存在座位块等操作。
7. 保存成功后重算票档库存。

保护座位判定：

- `session_seat.status IN (2, 3)`。
- `session_seat.order_id IS NOT NULL`。
- order 服务 internal API 返回该 `sessionSeatId` 仍被未完成订单引用。

ticket 服务不得直接查询 order 表。需要新增或复用 order internal API，例如：

```text
POST /api/order/internal/session-seats/usage
Header: X-Internal-Token
Body: { "sessionSeatIds": [1, 2, 3] }
```

返回每个座位是否被订单引用、订单状态、是否可编辑。该接口由 order 服务自己查询 `order_seat` 和 `order`。

### 库存重算

每次场次 SeatCraft 保存、票档绑定变更、票档删除后，ticket 服务按真实 `session_seat` 重算对应票档：

```text
total_stock = count(status IN (1, 2, 3) AND ticket_type_id = 当前票档)
remain_stock = count(status = 1 AND order_id IS NULL AND lock_expire_time IS NULL AND ticket_type_id = 当前票档)
sold_stock = total_stock - remain_stock
```

`status=4` 退款后不可复售/不可售座位不计入可购买库存。

如果退款后座位可复售，则退款流程将座位恢复为 `status=1`，库存重算时自动进入余票。

### 票档删除与改绑

删除票档时：

- 如果该票档下存在保护座位，拒绝删除。
- 返回提示：`该票档已有购票订单，请先完成退款后再删除。`
- 如果只有未售座位，允许删除票档，同时清理/解绑对应未售座位并重算库存。

改绑座位块时：

- 新增未绑定块到票档：允许，生成或更新真实座位，库存增加。
- 从票档移除未售块：允许，删除或解绑未售座位，库存减少。
- 从票档移除含保护座位的块：拒绝，提示先退款。
- 改绑含保护座位的块到其他票档：拒绝，提示先退款。

### 已售保留座位展示

已售/锁定座位在 SeatCraft 编辑器中显示为灰色锁定，保持原位置和原票档归属。它们不参与拖动、删除、隐藏、改绑和一键排版。商家修改周边未售座位时，这些保护座位作为不可编辑锚点保留。

## API 设计

### Ticket 服务

新增或扩展 admin 场次 SeatCraft 保存接口：

```text
PUT /api/ticket/admin/sessions/{sessionId}/seat-layout
```

保存时返回：

- 最新 layout。
- 票档库存汇总。
- 被保护座位数量。
- 如果失败，返回明确业务错误。

新增票档绑定接口可选择独立 API 或合入 layout 保存。推荐独立 API，避免一次保存承担太多职责：

```text
PUT /api/ticket/admin/sessions/{sessionId}/ticket-bindings
```

body 包含票档与 block keys 的绑定关系。保存后重算库存。

### Order 服务 Internal API

新增订单座位使用查询：

```text
POST /api/order/internal/session-seats/usage
Header: X-Internal-Token
```

用途：ticket 服务保存座位图前判断哪些座位被订单占用，不跨库查询。

## 错误处理

典型错误提示：

- `该座位区域已有购票订单，请先完成退款后再调整或删除。`
- `该票档已有购票订单，请先完成退款后再删除。`
- `选中的座位块不属于当前场次座位图。`
- `座位图暂不公布时仍需要先配置真实座位池。`
- `票档没有可售座位，无法上架销售。`

前端应在保存失败时保留用户当前编辑草稿，不清空画布，并高亮冲突 block / seat。

## 测试计划

### 后端单元测试

1. 新增 block 后生成 `session_seat`，对应票档 `total_stock/remain_stock` 增加。
2. 删除未售 block 后删除未售座位，库存减少。
3. 删除含已售座位 block 被拒绝。
4. 改绑含已售座位 block 被拒绝。
5. 删除含已售座位票档被拒绝。
6. 修改票档名称/价格不改变库存。
7. `seat_map_visibility=published` 时 C 端返回座位图。
8. `seat_map_visibility=hidden` 时 C 端不公开可选座位图，但随机分配下单仍可成功。
9. order internal usage API 必须校验 `X-Internal-Token`。

### 前端验证

1. 场次管理点“票档”跳转到 `/console/sessions/{id}/seat-layout?mode=tickets`。
2. 票档模式可选择 block 创建票档。
3. 已售座位灰色锁定，无法删除/拖动/改绑。
4. 活动上架可选择 `公布座位图` / `座位图暂不公布`。
5. C 端公布模式必须选座。
6. C 端不公布模式可只选票档和数量购买。

### 边界验证

继续运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1
```

确认 ticket 不新增跨服务 SQL，不直接访问 order 表。

## 实施顺序

1. 后端补 `seat_map_visibility` 字段、迁移和 DTO。
2. order 服务新增 internal seat usage API。
3. ticket 服务新增 seat usage client，保存 SeatCraft 前查保护座位。
4. ticket 服务实现 SeatCraft 差异保存和库存重算。
5. ticket 服务实现票档绑定/删除保护规则。
6. 前端场次管理“票档”入口跳转到 SeatCraft 页。
7. 前端 SeatCraft 页实现 `mode=tickets` 票档管理面板。
8. 前端活动上架增加座位图展示策略。
9. C 端按展示策略切换自由选座和随机分配购买。
10. 跑完整测试与边界验证。

## 风险与约束

1. 不做完整版本化时，已售保留座位会和新布局共存，需要前端明确灰色锁定展示。
2. 站区没有具体座位坐标时，需要按容量生成可随机分配的虚拟站位座位。
3. 退款是否可复售由现有退款规则决定，库存重算只消费最终座位状态。
4. 所有保护规则必须后端强校验，前端提示不能作为安全边界。
