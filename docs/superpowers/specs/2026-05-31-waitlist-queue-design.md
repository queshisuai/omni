# 候补排队自动分配设计

## 背景

抢票透明度层已经把普通抢票改为真实异步排队，前端也预留了失败后“加入候补”的入口。当前售罄后的用户只能重新尝试抢票，系统无法在退票或未付款释放库存后按等待顺序自动递补。

本设计新增候补排队能力：售罄后用户加入候补队列；当待支付订单超时释放或退款恢复可售库存时，系统按候补顺序自动尝试创建待支付订单并通知用户限时付款。用户支付成功后候补完成；用户超时未支付后释放名额并继续递补下一位。

## 目标

- 售罄后用户可按场次、票档、数量加入候补队列。
- 同一用户在同一场次同一票档只能有一个活跃候补。
- 候补队列只管理排队资格和自动分配，不替代订单、锁座或库存系统。
- 释放库存后按 `priority_no ASC, create_time ASC` 分配，第一版不拆单。
- 分配时复用 order-service 创建待支付订单，由 order-service 和 ticket-service 做最终限购、锁座、扣库存校验。
- 分配过程幂等，避免同一释放事件重复给同一候补生成订单。
- 候补订单超时未支付后，现有订单释放链路继续触发下一位候补。
- 站内通知用户获得候补名额、候补过期和候补支付成功。

## 非目标

- 不做新的库存事实源。
- 不用 Redis 队列作为最终事实源。
- 不做拆单分配。
- 不做座位偏好、连座优先、会员优先、跨票档替代或跨场次替代。
- 不做外部短信真实发送，短信先保持 mock 或站内通知。
- 不改造支付系统的核心支付状态机。

## 服务归属

候补队列属于 `grab-service` 和 `omni_grab`。原因是候补是售罄后的排队和自动下单编排，不是票务库存，也不是订单事实。

- `grab-service`：拥有 `waitlist_entry`、`waitlist_offer`、`waitlist_allocation_log`，处理候补报名、取消、查询、释放事件分配、offer 过期扫描和通知。
- `java-order`：仍拥有订单、待支付状态、支付成功、订单超时取消、退款后订单状态。
- `java-ticket`：仍拥有票档库存、座位锁定、座位售出、退款座位是否可二次销售。
- `java-notification`：仍拥有站内通知落库。
- `frontend`：售罄后展示加入候补、我的候补和候补 offer 状态。

网关需要把 `/api/waitlist/**` 路由到 `grab-service`，与现有 `/api/grab/**` 并列。

## 核心原则

1. 候补不是库存系统。库存是否可售以 ticket-service 和 order-service 的锁座/扣库存结果为准。
2. 自动分配不是直接占库存。候补分配器只能调用 order-service 创建待支付订单。
3. 数据库状态是事实源。Redis 只可做短期锁或辅助缓存，不保存不可恢复的候补事实。
4. 释放事件必须幂等。相同 `eventKey` 重放时，不能重复生成订单或重复推进同一 entry。
5. `ALLOCATING` 是并发保护状态。分配器先原子抢占 `WAITING` entry，再调用 order-service。
6. `OFFERED` 只代表用户获得待支付订单，不代表支付成功。
7. `PAID` 以 order-service 支付成功事件或补偿扫描结果为准。

## 数据模型

三张表都在 `omni_grab`。

### `waitlist_entry`

候补报名记录。

| 字段 | 说明 |
|:---|:---|
| `id` | 主键 |
| `user_id` | 候补用户 |
| `session_id` | 场次 |
| `ticket_type_id` | 票档 |
| `quantity` | 完整满足的票数 |
| `seat_preference` | 座位偏好，第一版保留为 nullable JSON |
| `status` | `WAITING`、`ALLOCATING`、`OFFERED`、`PAID`、`CANCELLED`、`EXPIRED`、`FAILED` |
| `priority_no` | 排队优先号 |
| `offer_order_id` | 已生成的待支付订单 |
| `offer_expire_time` | 付款截止时间 |
| `fail_reason` | 分配失败说明 |
| `create_time` | 创建时间 |
| `update_time` | 更新时间 |

活跃去重：

```sql
CREATE UNIQUE INDEX uk_waitlist_entry_active_user_ticket
ON waitlist_entry(user_id, session_id, ticket_type_id)
WHERE status IN ('WAITING', 'ALLOCATING', 'OFFERED');
```

### `waitlist_offer`

一次候补分配记录。

| 字段 | 说明 |
|:---|:---|
| `id` | 主键 |
| `entry_id` | 候补 entry |
| `user_id` | 用户 |
| `session_id` | 场次 |
| `ticket_type_id` | 票档 |
| `quantity` | 分配票数 |
| `order_id` | 待支付订单 |
| `status` | `OFFERED`、`PAID`、`EXPIRED`、`CANCELLED` |
| `expire_time` | 付款截止时间 |
| `create_time` | 创建时间 |
| `update_time` | 更新时间 |

### `waitlist_allocation_log`

释放事件和候补分配日志，兼顾幂等和排查。为了支持一次释放事件跳过失败 entry 后继续尝试，本表在基础字段上增加 `attempt_no`。

| 字段 | 说明 |
|:---|:---|
| `id` | 主键 |
| `event_key` | 原始释放事件幂等键 |
| `attempt_no` | 同一事件内的第几次候补尝试，0 表示事件开始 |
| `session_id` | 场次 |
| `ticket_type_id` | 票档 |
| `released_quantity` | 本次释放数量 |
| `allocated_entry_id` | 本次尝试的候补 entry，可为空 |
| `order_id` | 创建成功的订单，可为空 |
| `source_order_id` | 触发释放的订单，可为空 |
| `status` | `PROCESSING`、`FAILED`、`OFFERED`、`NO_MATCH`、`DUPLICATE` |
| `message` | 说明 |
| `create_time` | 创建时间 |

唯一约束：

```sql
CREATE UNIQUE INDEX uk_waitlist_allocation_event_attempt
ON waitlist_allocation_log(event_key, attempt_no);
```

分配器先插入 `attempt_no = 0, status = PROCESSING`。如果同一 `event_key` 已经存在 `attempt_no = 0`，本次调用视为重复事件并直接返回。

## 状态流转

```text
WAITING -> ALLOCATING -> OFFERED -> PAID
WAITING -> CANCELLED
ALLOCATING -> FAILED
ALLOCATING -> WAITING
OFFERED -> EXPIRED
OFFERED -> CANCELLED
```

规则：

- `WAITING -> ALLOCATING` 必须通过单条 SQL 原子更新完成。
- order-service 返回限购、库存不足、用户已有有效订单等业务失败时，entry 进入 `FAILED`，分配器继续找下一位。
- order-service 或网络短暂不可用时，entry 恢复 `WAITING`，当前释放事件停止，避免批量错误跳过用户。
- 待支付订单创建成功后，entry 和 offer 都进入 `OFFERED`。
- order-service 支付成功后，entry 和 offer 都进入 `PAID`。
- 待支付订单超时释放后，释放事件会先把来源 order 对应的 waitlist offer 标记为 `EXPIRED`，再尝试递补下一位。

## 分配策略

第一版只支持同票档完整满足：

```text
释放 quantity=N
查找 session_id + ticket_type_id 下 status=WAITING 且 entry.quantity <= N 的最早 entry
```

排序：

```text
priority_no ASC, create_time ASC, id ASC
```

不拆单：

- 候补 `quantity=2` 不会被 `releasedQuantity=1` 满足。
- 如果队首需要 2 张而只释放 1 张，分配器会继续寻找后面 `quantity <= 1` 的候补。被跳过的 2 张候补仍保持 `WAITING`，当下一次释放数量足够时仍按原优先级参与。

失败跳过：

- 如果 entry 被原子改成 `ALLOCATING` 后，order-service 返回明确业务失败，该 entry 标记 `FAILED`，日志记录失败原因，释放事件继续尝试下一位。
- 如果是系统不可用、超时、429 或 5xx，entry 恢复 `WAITING`，日志记录失败，释放事件停止。

第一版一次释放事件最多生成一个 `OFFERED` 订单。释放数量大于候补数量时，剩余库存回到公开可售库存，由后续抢票或购票链路消费。

## 触发点

### 未付款订单超时释放

现有入口：

```text
SeatLockScheduler.releaseExpiredSeatLocks()
  -> OrderService.releaseExpiredSeatLocks()
  -> ticket-service release()
```

改造后：

```text
SeatLockScheduler.releaseExpiredSeatLocks()
  -> OrderService.releaseExpiredSeatLocks()
  -> 返回 TicketReleasedEvent 列表
  -> 发布 waitlist.released MQ 事件
```

事件字段：

```json
{
  "eventKey": "order-timeout:9001:session:101:ticket-type:202",
  "source": "ORDER_TIMEOUT",
  "sourceOrderId": 9001,
  "sessionId": 101,
  "ticketTypeId": 202,
  "quantity": 1,
  "seatIds": [30001]
}
```

### 退款释放

退款成功后，payment-service 调 order-service 的 `markRefunded` 或 `markPartialRefunded`。order-service 调 ticket-service `refund()` 恢复库存或座位。

改造后，ticket-service 的 `refund()` 返回实际可二次销售的恢复数量；order-service 只在 `restoredQuantity > 0` 时发布候补释放事件。

如果退票座位不可二次销售，`restoredQuantity = 0`，不触发候补。

### 候补 offer 超时释放

第一版复用订单待支付锁定时间。候补订单未支付时，由 order-service 原有超时释放链路取消订单、释放座位或库存，并发布 `ORDER_TIMEOUT` 释放事件。分配器收到事件后：

1. 根据 `sourceOrderId` 把原 `waitlist_offer` 标记为 `EXPIRED`。
2. 把对应 `waitlist_entry` 从 `OFFERED` 标记为 `EXPIRED`。
3. 用本次释放数量继续分配下一位候补。

`POST /api/waitlist/internal/offers/expire-scan` 作为补偿扫描，用于修复通知或状态回写漏掉的 offer，不直接绕过 order-service 释放库存。

## 自动下单

候补分配时调用 order-service，不直接改库存。

流程：

```text
WaitlistAllocator
  -> 原子 claim WAITING entry 为 ALLOCATING
  -> 构造 grabRequestId = WAITLIST-{entryId}-{eventHash}
  -> 调 order-service internal create 或 create-with-seats
  -> order-service 校验用户、限购、库存、锁座或扣库存
  -> 成功后写 waitlist_offer，entry=OFFERED
  -> 通知用户限时付款
```

订单幂等：

- `order_snapshot.grab_request_id` 已有唯一索引，可复用为候补订单幂等键。
- order client 创建前先用 `GET /api/order/internal/grab-requests/{grabRequestId}` 查询。
- 如果已存在订单，直接绑定到 entry 和 offer，不重复创建。

付款有效期：

- 第一版复用现有订单 15 分钟有效期。
- `offer_expire_time` 与订单锁定过期时间保持一致。
- 如果未来要缩短到 5-10 分钟，需要新增 order-service 支持自定义 `lockExpireTime`，仍由 order-service 释放。

## 通知

复用 `java-notification`：

```text
POST /api/notification/internal/messages
Header: X-Internal-Token
```

通知类型：

- `WAITLIST_OFFERED`
- `WAITLIST_EXPIRED`
- `WAITLIST_PAID`

内容包括：

- 活动名
- 场次时间
- 票档
- 数量
- 付款截止时间
- 订单入口

## API

### 用户侧

```text
POST   /api/waitlist/entries
GET    /api/waitlist/my
DELETE /api/waitlist/entries/{id}
```

创建候补请求：

```json
{
  "sessionId": 101,
  "ticketTypeId": 202,
  "quantity": 2
}
```

响应：

```json
{
  "id": 9001,
  "status": "WAITING",
  "rank": 12
}
```

取消规则：

- 只有 `WAITING` 可由用户取消。
- `ALLOCATING` 不可取消，避免与自动分配并发冲突。
- `OFFERED` 不通过候补取消释放库存；用户应取消订单，走 order-service 释放链路。

### 内部入口

```text
RabbitMQ exchange: omni.waitlist
Routing key: waitlist.released
Routing key: waitlist.order-paid
POST /api/waitlist/internal/offers/expire-scan
```

释放和支付事件通过 RabbitMQ 投递；过期扫描仍是内部 HTTP 接口，只接受 `X-Internal-Token`。

## 前端行为

活动详情页：

- 当抢票进度进入 `SOLD_OUT`、`FAILED` 且可见库存为 `SOLD_OUT` 时，启用“加入候补”按钮。
- 创建候补成功后显示当前候补名次。
- `GET /api/waitlist/my` 展示用户候补列表。
- `OFFERED` 状态展示“去支付”入口。
- `EXPIRED`、`FAILED` 展示原因和可重新加入入口。

第一版不做复杂候补管理页，先在活动详情失败弹层和订单/通知入口完成闭环。

## 验收标准

- 票档售罄后，用户能加入候补。
- 同一用户同一场次票档不能重复候补。
- 释放 1 张票，只分配给最早且 `quantity <= 1` 的候补。
- 队首限购失败或订单创建业务失败，会跳过并记录失败，不阻塞后续候补。
- 候补订单超时未支付，会释放并递补下一位。
- 支付成功后候补状态变为 `PAID`。
- 并发释放时不会给同一候补生成多个订单。
- 退款释放和未付款释放都能触发候补分配。
- 退票座位不可二次销售时不触发候补。
- 微服务边界检查通过，不新增跨服务数据库访问。

## 落地顺序

1. 建 `waitlist_entry`、`waitlist_offer`、`waitlist_allocation_log` 和状态枚举。
2. 做用户加入、查询、取消候补。
3. 做 `WaitlistAllocatorService`，先支持手动释放事件。
4. 接入 order-service 未付款超时释放事件。
5. 接入退款实际恢复库存事件。
6. 做候补 offer 状态补偿扫描。
7. 接入站内通知。
8. 前端售罄入口改成可用的“加入候补”。
