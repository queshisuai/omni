# Standing Ticket Explicit Binding Design

## 背景

当前普通坐席票档通过 `session_seat.ticket_type_id` 与真实座位池逐座位绑定，数据库可审计性充分。站区票档没有逐座位号，当前只能依赖同场次、站区 block、票档名称/容量等信息推断关系，审计时不够明确。

## 目标

- 为站区票档提供显式数据库绑定。
- 保持普通坐席票档现有逐座位绑定不变。
- 后端判断站区无座票时优先使用显式绑定，不再依赖名称/容量猜测。
- 本机和 seed 中现有站区票档可通过迁移自动回填。

## 设计

在 `ticket_type` 新增可空字段：

- `seat_block_id BIGINT`：站区票档指向同场次 `seat_block.id`。
- `ticket_group_key VARCHAR(120)`：辅助审计字段，与 `seat_block.ticket_group_key` 对齐。

规则：

- 普通坐席票档：`seat_block_id IS NULL`，仍由 `session_seat.ticket_type_id` 审计库存。
- 站区票档：`seat_block_id IS NOT NULL`，对应 `seat_block.block_type='standingBlock'`，且 `seat_block.owner_type='session'`、`seat_block.owner_id=ticket_type.session_id`。
- 站区票档库存必须等于 `seat_block.capacity`。

## 后端影响

`TicketSalesInternalService`：

- `hasRealStandingBlock()` 改为读取 `ticket_type.seat_block_id`。
- 只允许显式绑定到当前场次 standing block 的票档走无座扣库存。
- 没有显式绑定的无座票档直接返回普通票档库存不足，避免误判。

`TicketTypeStockRecalculationService`：

- 站区票档库存重算优先使用 `ticket_type.seat_block_id` 指向的 standing block capacity。
- 普通坐席票档仍按 `session_seat` 统计。

## SQL 回填

迁移按现有 demo 数据回填：

- 找出同场次 `standingBlock`。
- 找出该场次没有逐座位记录且 `total_stock=seat_block.capacity` 的票档。
- 写入 `ticket_type.seat_block_id` 与 `ticket_type.ticket_group_key`。

如果未来同一场次多个站区容量相同，需要后台保存票档时显式传入 `seat_block_id`，不能继续依赖迁移猜测。

## 验收

- 坐席票档：`session_seat` 数量等于 `ticket_type.total_stock`。
- 站区票档：`ticket_type.seat_block_id` 指向 standing block，`seat_block.capacity=ticket_type.total_stock`。
- 无座售卖只允许显式绑定站区票档。
