# 隐藏座位图与随机分配真实座位设计

## 目标

支持主办方或 admin 上架活动时选择“不公布座位图”。后端仍必须生成并维护真实座位表，前端只隐藏座位图展示。用户按票档和数量购买时，ticket 服务从真实可售座位池随机锁座，订单成功后展示真实票档和座位信息。

## 低耦合边界

- `java-order` 不直接读取 ticket 表，不直接生成座位，不直接统计座位库存。
- `java-order` 只通过 `java-ticket` internal API 完成报价、随机锁座、指定座位锁座、确认售出、释放和退款。
- `java-ticket` 拥有座位、票档、库存和座位图公开策略。
- 前端不自行计算库存，不把设计容量当库存。
- 前端只根据后端返回字段展示“公开选座”或“随机分配”。

## 售票模式

### 公开座位图

- 后端有真实 `session_seat`。
- C 端展示 SeatCraft 座位图。
- 用户手动选择座位。
- 下单传 `seatIds`。
- ticket internal `lockSeats` 锁定指定座位。

### 不公布座位图

- 后端仍有真实 `session_seat`。
- C 端不展示座位图，只展示票档、价格、数量和“系统将自动分配座位”。
- 用户下单不传 `seatIds`，只传 `ticketTypeId + quantity`。
- order 调用 ticket internal 随机锁座 API。
- ticket 从 `session_seat` 中按 `ticketTypeId` 随机选择 `quantity` 个可售座位并锁定。
- ticket 返回 `lockedSeatIds` 和 `seatLabels`。
- order 写 `order_seat` 和 `order_snapshot.seat_labels`。

## 库存规则

- 票档绑定真实座位块前不显示库存，只显示“待生成库存”。
- 设计器里只能显示“设计容量”或“预计座位数”。
- 票档库存只来自后端持久化数据：`ticket_type.total_stock/remain_stock` 或 `session_seat`。
- 随机锁座和手动锁座都必须扣减真实 `ticket_type.remain_stock`。
- 释放/退款必须释放真实座位或标记退款后不可售，并回补符合条件的库存。

## 订单展示

- 订单快照必须包含真实活动、场馆、场次、票档、座位标签。
- 公开选座订单展示用户选择的座位。
- 隐藏座位图订单展示系统分配后的座位。
- 已退款订单显示“已退款”，并保留原票档与座位信息作为历史快照。

## 前端行为

- 活动详情读取座位图公开策略。
- `public`：显示 SeatCraft 选座器。
- `hidden`：不显示座位图，显示“座位将在下单后由系统自动分配”。
- 无真实库存时显示“待生成库存”或“暂不可售”，不展示模拟余票。
- 订单页不使用 mock/offline 降级，只展示后端返回的真实快照。

## 数据清理

- 当前模拟/错误已购买订单不硬删。
- 对已支付订单走退款流程，最终状态为 `已退款`。
- 退款后保留订单快照作为历史记录。
- 后续重新用真实 SeatCraft 座位表创建订单数据。

## 非目标

- 不引入 MQ/outbox/CDC。
- 不新增跨服务 SQL 或跨服务 Mapper。
- 不让 order 服务直接访问 ticket 数据库。
- 不恢复旧点阵或旧 section 编辑器。
