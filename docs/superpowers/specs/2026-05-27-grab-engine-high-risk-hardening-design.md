# 抢票核心引擎高风险优化设计

## 背景

当前抢票链路已经能跑通：前端提交抢票请求，grab-service 通过 Redis Lua 做准入，成功后调用 order-service 创建订单，随后进入现有支付、同步和退款入口。但第一版验收要求更严格：1000 并发抢 100 张票不能超卖、同一用户重复点击返回同一个抢票结果、Redis 预占失败可恢复、订单创建必须进入现有交易链路且不信任前端 userId。

本设计只覆盖高风险 correctness 问题，不引入 MQ、不做异步排队、不重构现有订单交易链路。

## 目标

1. Redis 抢票库存未初始化时不允许绕过准入。
2. 同一用户重复提交同一抢票意图时返回同一个抢票结果。
3. grab-service 创建订单时走可信 internal API，而不是公开 C 端订单接口。
4. 保持订单成功后的支付、超时释放、退款链路继续由现有 order/payment/ticket 服务负责。
5. 不破坏现有订单和票务测试。

## 非目标

1. 不实现 MQ 异步削峰。
2. 不实现排队进度或候补队列。
3. 不把支付、退款、订单超时逻辑迁入 grab-service。
4. 不让 grab-service 直接访问 ticket/order/user 数据库。

## 设计一：Redis 库存 key 缺失 fail-closed

### 当前问题

`GrabAdmissionService` 的 Lua 脚本在 `grab:stock:{sessionId}:{ticketTypeId}` 不存在时返回 `BYPASSED` 并放行。这会绕过 Redis 库存闸门。如果压测或生产环境忘记初始化 Redis stock，1000 个请求会全部进入 order-service，抢票引擎不能承担“不超卖”的第一道准入职责。

### 新行为

Lua 脚本在库存 key 不存在时返回 `STOCK_UNINITIALIZED`，不写入 idempotency/user-hold/seat-hold，也不扣库存。

grab-service 收到 `STOCK_UNINITIALIZED` 后，将 grab_request 标记为失败状态并返回明确原因：`抢票库存未初始化`。

### 状态选择

第一版不新增数据库状态，复用 `FAILED`，`failReason = '抢票库存未初始化'`。这样避免迁移状态枚举和前端状态映射扩散。

### 验收

1. Redis 不存在 `grab:stock:sessionId:ticketTypeId` 时，抢票请求返回失败，不创建订单。
2. Redis stock 为 100 时，1000 并发最多只有 100 个请求能通过 Redis 准入。
3. Redis stock 扣减不能变成负数。

## 设计二：重复点击返回同一个抢票结果

### 当前问题

后端只对相同 `idempotencyKey` 幂等，但前端每次点击确认支付都会生成新的 key。用户双击或网络重试时，第二个请求可能返回 `LIMITED`，而不是返回第一次抢票的 `requestId/orderId`。

### 同一抢票意图定义

同一用户在同一场次、同一票档、同一数量、同一座位集合或同一随机分配模式下，存在未终止请求或已创建订单请求时，视为同一抢票意图。

比较字段：

- `userId`
- `sessionId`
- `ticketTypeId`
- `quantity`
- `allocateRandom`
- `seatIds` 归一化后比较；座位数组按数字升序排序。

活跃状态：

- `PENDING`
- `ACCEPTED`
- `ORDER_CREATING`
- `ORDER_CREATED`

终止状态不复用：

- `SOLD_OUT`
- `LIMITED`
- `FAILED`
- `EXPIRED`

### 后端行为

`GrabService.submitRequest` 在创建新请求前：

1. 先按 `userId + idempotencyKey` 查询，命中则返回。
2. 再按同一抢票意图查询活跃请求，命中则返回。
3. 未命中才创建 `PENDING` 请求并进入 Redis 准入。

如果并发下两个相同 idempotencyKey 请求同时插入，数据库唯一约束可能抛错。服务层捕获唯一键冲突后重新查询已有记录并返回，不能把它暴露为 500。

### 前端行为

确认订单弹窗打开或用户第一次确认支付时生成一次 `idempotencyKey`，在弹窗关闭、下单成功或用户修改场次/票档/数量/座位时重置。点击按钮期间禁用提交，避免本地重复提交；但后端仍必须保证幂等。

### 验收

1. 同一个用户连续双击确认支付，只创建一个 grab_request。
2. 同一个用户重复提交同一抢票意图，返回同一个 `requestId` 和相同 `orderId`。
3. 用户修改票档、数量或座位后，应产生新的抢票意图。

## 设计三：grab-service 使用 order internal API 创建订单

### 当前问题

前端到 grab-service 的 userId 来自 JWT 登录态，这是正确的。但 grab-service 再调用 order-service 时走公开接口 `/api/order/create` 或 `/api/order/create-with-seats`，并在请求体中传 `userId`。如果公开订单接口信任 body userId，服务边界仍不够强。

### 新接口

在 java-order 增加 internal controller 接口：

- `POST /api/order/internal/create`
- `POST /api/order/internal/create-with-seats`

两个接口都要求请求头：

- `X-Internal-Token: <internal.api.token>`

请求体沿用现有 `CreateOrderRequest` 和 `LockSeatsRequest`，因为 grab-service 是可信调用方，`userId` 代表已由 grab-service 从 JWT 验证出的用户。

### 服务复用

internal controller 不重复交易逻辑，直接调用现有：

- `OrderService.createOrder`
- `OrderService.createOrderWithSeats`

这样订单快照、库存锁定、座位锁定、支付超时释放、退款链路继续保持现有行为。

### grab-service 调用变更

`OrderClientService` 改为：

- 默认 baseUrl 仍为 `ORDER_SERVICE_URL` 或 `http://localhost:8088`
- 路径改为 `/api/order/internal/create*`
- 请求头增加 `X-Internal-Token`，来源为 `INTERNAL_API_TOKEN`
- 未配置 token 时直接失败，不发起订单请求

### 验收

1. 不带 `X-Internal-Token` 调 internal order API 返回 403 或等价失败。
2. token 正确时，grab-service 能创建订单。
3. 订单创建后仍能走现有二维码支付、支付同步、退款入口。

## 测试策略

### grab-service 单元测试

1. Redis stock key 缺失返回失败，不调用 order-client。
2. Redis stock 成功准入后订单失败，调用 release 并恢复库存。
3. 同一 idempotencyKey 返回已有请求。
4. 同一抢票意图返回已有活跃请求。
5. 数据库唯一键冲突时查回已有请求。
6. internal token 未配置时订单创建失败并释放 Redis 预占。

### java-order 测试

1. internal create 接口缺 token 被拒绝。
2. internal create-with-seats 缺 token 被拒绝。
3. internal token 正确时调用现有 service 创建订单。
4. 现有公开订单接口测试保持不变。

### 运行时验证

1. 浏览器真实流程：活动详情页点击购买，进入抢票，生成订单，弹出支付宝二维码。
2. 用户扫码支付后点击“我已完成付款”，订单显示已支付。
3. 已支付订单显示申请退款入口。
4. 缺 Redis stock key 时，前端显示明确失败，不创建订单。

### 压测验证

构造 1000 个并发请求抢同一 `sessionId + ticketTypeId` 的 100 库存：

1. Redis 初始化 `grab:stock:{sessionId}:{ticketTypeId}=100`。
2. 使用 1000 个不同用户或不同 idempotencyKey 提交请求。
3. 断言 `ORDER_CREATED` 数量不超过 100。
4. 断言 Redis stock 最终不小于 0。
5. 断言 order-service 对应票档新增有效订单数不超过 100。

## 文件影响范围

### grab-service

- `nestjs/grab-service/src/grab/grab-admission.service.ts`：移除 BYPASSED 放行，增加 STOCK_UNINITIALIZED 结果。
- `nestjs/grab-service/src/grab/grab.service.ts`：增加同一抢票意图复用、唯一键冲突恢复、库存未初始化失败处理。
- `nestjs/grab-service/src/grab/grab.repository.ts`：增加按抢票意图查活跃请求的方法。
- `nestjs/grab-service/src/grab/order-client.service.ts`：改为 internal order API 并携带 internal token。
- `nestjs/grab-service/src/grab/*.spec.ts`：更新和新增测试。

### java-order

- `java/java-order/src/main/java/com/omni/order/controller/*`：增加 internal order controller 或在现有 controller 中增加 internal endpoint。
- `java/java-order/src/test/java/com/omni/order/**`：增加 internal token 和复用 service 的测试。

### frontend

- `frontend/src/app/activity/[id]/page.tsx`：同一确认订单流程复用 idempotencyKey，修改购票条件时重置。

## 风险与缓解

1. Redis stock 未初始化会让用户下单失败。缓解：启动脚本或压测脚本必须显式初始化 stock；错误文案明确指向库存未初始化。
2. 同一抢票意图查询可能误复用。缓解：只复用活跃和已创建订单状态，用户修改票档/数量/座位后不会复用。
3. internal order API 增加入口可能扩大攻击面。缓解：必须校验 `X-Internal-Token`，并保持网关路径只用于服务间调用。
4. 支付二维码可能超过前端 5 秒超时。该问题独立于本设计，但运行时验收时需要关注；如仍复现，应单独调整支付接口超时或前端请求策略。

## 自检

- 没有保留 BYPASSED 放行路径。
- 没有把订单交易逻辑迁入 grab-service。
- 没有新增跨库访问。
- 重复点击以服务端幂等为准，前端禁用按钮只作为体验优化。
- 第一版不引入 MQ，避免扩大范围。
