# 客服上下文工作台 Implementation Plan

> **给执行代理：** REQUIRED SUB-SKILL: Use `executing-plans` 按任务逐项实施；涉及生产代码改动时先用 `test-driven-development`。步骤使用 checkbox（`- [ ]`）跟踪。本项目规则要求不要自动提交和推送，因此本计划不包含 commit step。

**Goal:** 在客服会话页右侧聚合用户订单、退款、票夹、候补、抢票和通知上下文，让客服不离开当前会话即可判断问题来源并跳转处理。

**Architecture:** 第一轮采用 `java-user` 聚合上下文接口，前端只按 `conversationId` 请求一个受控上下文。订单、票夹、退款、通知、抢票和候补仍由各 owner service 拥有，`java-user` 通过 internal API 和 `X-Internal-Token` 拉取只读摘要，不新增跨服务 Mapper、不跨库 join。任何 owner service 不可用时返回分区错误和空列表，不阻断客服看会话、回复、备注和转接。

**Tech Stack:** Spring Boot 2.7.18、Spring Cloud OpenFeign、MyBatis-Plus、PostgreSQL、NestJS grab-service、Next.js 16、React 19、TypeScript、RabbitMQ、Redis。

---

## 非目标

- 第一轮不做排班系统、满意度采集、质检评分和客服容量调度；这些放到二期客服主管工作台。
- 第一轮不让前端直接拿被咨询用户 token，也不复用 `/api/order/my`、`/api/payment/refunds/my`、`/api/waitlist/my` 这类当前登录用户接口。
- 第一轮不新增数据库表；上下文从 owner service 实时读取并裁剪为摘要。
- 第一轮不做 AI 深度生成，仅预留 `knowledgeHints`、`orderContextHints` 字段，避免把 AI 回复质量和上下文面板绑成一个大任务。
- 不把 `java-user` 改成订单、票务、通知数据的所有者。

## 当前现状

- `frontend/src/app/support/page.tsx` 已接客服会话、消息、备注、标签、快捷话术、转接、升级、关闭和审计。
- `frontend/src/lib/api.ts` 已有 C 端接口：`listOrders()`、`listMyTickets()`、`listMyRefunds()`、`listWaitlistEntries()`、`getGrabProgress()`、`listNotifications()`，但它们按当前登录用户查，不能直接给客服查被咨询用户。
- `java-user` 已有 `SupportController`、`CustomerSupportService`、`SupportConversationResponse`、`SupportMessageResponse`，也已有 OpenFeign internal client 模式：`PaymentReconciliationInternalClient`。
- `java-order` 拥有订单和票夹，并已有 `OrderService.listOrderItems(userId)`、`TicketWalletService.listMyTickets(userId)`；`/api/order/user/{userId}` 当前实际仍按登录用户查询，不能作为客服上下文契约。
- `java-payment` 拥有退款，已有 `RefundService.listUserRefunds(userId)`，但没有 internal 按用户只读接口。
- `java-notification` 拥有通知，已有用户自己的 `/api/notification/list`，但没有 internal 按用户只读接口。
- `nestjs/grab-service` 拥有抢票和候补，已有用户自己的 `GET /api/waitlist/my` 和单个抢票进度接口，但没有 internal 按用户列表接口。

## 设计口径

### 后端聚合接口

新增客服上下文接口：

```text
GET /api/user/support/agent/conversations/{conversationId}/context
```

权限：

- 必须登录。
- `support`、`support_manager`、`admin` 或拥有 `support.conversation.view` 权限的用户可访问。
- 普通客服只能访问自己可见队列内的会话；客服主管和平台管理员可访问全量客服会话。
- 接口只接收 `conversationId`，不接收 `userId`，避免客服手工枚举用户数据。

返回摘要：

```json
{
  "conversationId": 1001,
  "user": {
    "userId": 2004,
    "nickname": "普通用户",
    "phoneMask": "139****0001"
  },
  "orders": [
    {
      "id": 9001,
      "orderNo": "DM202606080001",
      "status": 2,
      "amount": 38000,
      "activityName": "周末演唱会",
      "sessionTime": "2026-06-20T19:30:00",
      "href": "/orders/9001"
    }
  ],
  "refunds": [],
  "tickets": [],
  "waitlist": [],
  "grabRequests": [],
  "notifications": [],
  "errors": []
}
```

说明：

- 每个分区默认最多返回 5 条，按业务时间倒序。
- `href` 是前端可用跳转路径，不代表后端持久化字段。
- `errors` 使用 `{ section, message }`，例如 `{ "section": "refunds", "message": "退款上下文暂不可用" }`。
- 金额沿用现有接口单位；前端只展示，不在本任务内改金额模型。

### Owner Service 内部只读接口

建议新增以下 internal endpoint：

```text
GET /api/order/internal/users/{userId}/orders?limit=5
GET /api/order/internal/users/{userId}/tickets?limit=5
GET /api/payment/refunds/internal/users/{userId}?limit=5
GET /api/notification/internal/users/{userId}/notifications?limit=5
GET /api/grab/internal/users/{userId}/requests?limit=5
GET /api/waitlist/internal/users/{userId}/entries?limit=5
```

约束：

- 全部校验 `X-Internal-Token`。
- 全部只读。
- 全部返回已有 DTO 或轻量 internal DTO，不暴露密钥、入场二维码原文、身份证号、完整手机号。
- 失败时不要在接口返回中打印 token、SQL 或内部堆栈。

### 前端展示

在 `frontend/src/app/support/page.tsx` 右侧栏新增“用户上下文”区块，放在标签和内部备注之前。

展示顺序：

1. 订单：订单号、状态、活动、场次、金额、跳转订单详情。
2. 退款：退款状态、原因、关联订单、跳转退款处理。
3. 票夹：票状态、活动、场次、是否已核验。
4. 候补：状态、排位、预计等待。
5. 抢票：进度状态、队列序号、失败原因、跳转进度。
6. 通知：最近通知标题、渠道、已读状态。

UI 状态：

- 加载：`正在加载用户上下文...`
- 全空：`暂无可关联的业务上下文`
- 分区失败：显示 `部分上下文暂不可用`，同时保留其他分区数据。
- 当前无会话：右侧仍显示现有空状态。

---

## Task 1: 契约和测试先行

**Files:**
- Create: `java/java-user/src/main/java/com/omni/user/dto/SupportContextResponse.java`
- Create: `java/java-user/src/test/java/com/omni/user/service/SupportContextServiceTest.java`
- Modify: `java/java-user/src/test/java/com/omni/user/service/CustomerSupportFullTest.java`
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/api.test.ts`

- [x] **Step 1: 定义前端类型红灯测试**

在 `frontend/src/lib/api.test.ts` 增加断言，要求新增 API wrapper 使用 `conversationId` 路径，不允许传 `userId`。

```ts
test('getSupportConversationContext uses conversation scoped endpoint', async () => {
  const { getSupportConversationContext } = await import('./api')
  mockFetchSuccess({
    conversationId: 1001,
    user: { userId: 2004, nickname: '普通用户', phoneMask: '139****0001' },
    orders: [],
    refunds: [],
    tickets: [],
    waitlist: [],
    grabRequests: [],
    notifications: [],
    errors: [],
  })

  await getSupportConversationContext(1001)

  assert.equal(fetchMock.calls[0][0], `${baseUrl}/api/user/support/agent/conversations/1001/context`)
})
```

Run:

```powershell
cd frontend
node --test src\lib\api.test.ts
```

Expected: FAIL，提示 `getSupportConversationContext` 未导出。

Result: 2026-06-08 按预期失败，错误为 `The requested module './api.ts' does not provide an export named 'getSupportConversationContext'`。

- [x] **Step 2: 定义后端 DTO 红灯测试**

在 `SupportContextServiceTest` 先写目标 payload 断言，字段包括 `orders/refunds/tickets/waitlist/grabRequests/notifications/errors`。

```java
@Test
void contextResponseDefaultsToEmptySections() {
    SupportContextResponse response = SupportContextResponse.empty(1001L, 2004L, "普通用户", "139****0001");

    assertEquals(1001L, response.getConversationId());
    assertEquals(2004L, response.getUser().getUserId());
    assertTrue(response.getOrders().isEmpty());
    assertTrue(response.getRefunds().isEmpty());
    assertTrue(response.getTickets().isEmpty());
    assertTrue(response.getWaitlist().isEmpty());
    assertTrue(response.getGrabRequests().isEmpty());
    assertTrue(response.getNotifications().isEmpty());
    assertTrue(response.getErrors().isEmpty());
}
```

Run:

```powershell
cd java
mvn -pl java-user -am "-Dtest=SupportContextServiceTest" "-Dsurefire.failIfNoSpecifiedTests=false" test
```

Expected: FAIL，提示 `SupportContextResponse` 未定义。

Result: 2026-06-08 按预期失败，错误为 `找不到符号 类 SupportContextResponse`。

- [x] **Step 3: 实现最小 DTO 和前端类型**

新增 `SupportContextResponse`，先只覆盖空数组和用户摘要；`frontend/src/types/api.ts` 同步新增 `SupportContextVO`。

关键字段：

```java
private Long conversationId;
private SupportContextUser user;
private List<SupportContextOrder> orders = new ArrayList<>();
private List<SupportContextRefund> refunds = new ArrayList<>();
private List<SupportContextTicket> tickets = new ArrayList<>();
private List<SupportContextWaitlist> waitlist = new ArrayList<>();
private List<SupportContextGrabRequest> grabRequests = new ArrayList<>();
private List<SupportContextNotification> notifications = new ArrayList<>();
private List<SupportContextError> errors = new ArrayList<>();
```

前端 wrapper：

```ts
export async function getSupportConversationContext(conversationId: number) {
  assertPositiveInteger(conversationId, '会话ID')
  return request<import('@/types/api').SupportContextVO>(`/api/user/support/agent/conversations/${conversationId}/context`)
}
```

- [x] **Step 4: 运行契约测试**

Run:

```powershell
cd java
mvn -pl java-user -am "-Dtest=SupportContextServiceTest" "-Dsurefire.failIfNoSpecifiedTests=false" test
cd ..\frontend
node --test src\lib\api.test.ts
```

Expected: PASS。

Result: 2026-06-08 PASS；`node --test src\lib\api.test.ts` 26 tests passed，`mvn -pl java-user -am "-Dtest=SupportContextServiceTest" "-Dsurefire.failIfNoSpecifiedTests=false" test` 1 test passed。

## Task 2: `java-user` 聚合服务骨架

**Files:**
- Create: `java/java-user/src/main/java/com/omni/user/service/SupportContextService.java`
- Modify: `java/java-user/src/main/java/com/omni/user/controller/SupportController.java`
- Modify: `java/java-user/src/test/java/com/omni/user/service/SupportContextServiceTest.java`
- Modify: `java/java-user/src/test/java/com/omni/user/service/CustomerSupportFullTest.java`

- [x] **Step 1: 写权限和会话绑定测试**

覆盖三个行为：

- 未登录返回 `401`。
- 普通客服不能通过猜 `userId` 查上下文，因为接口只接收 `conversationId`。
- 不可见会话返回无权限或业务异常。

核心断言：

```java
@Test
void loadsContextByConversationInsteadOfUserId() {
    SupportConversation conversation = conversation(1001L, 2004L, "WAITING_AGENT");
    when(conversationMapper.selectById(1001L)).thenReturn(conversation);
    when(userMapper.selectById(2004L)).thenReturn(user(2004L, "普通用户", "13900000001", "user"));
    when(userMapper.selectById(3001L)).thenReturn(user(3001L, "客服A", "13800000003", "support"));

    SupportContextResponse response = service.getContext(3001L, 1001L);

    assertEquals(2004L, response.getUser().getUserId());
}
```

Run:

```powershell
cd java
mvn -pl java-user -am "-Dtest=SupportContextServiceTest,CustomerSupportFullTest" "-Dsurefire.failIfNoSpecifiedTests=false" test
```

Expected: FAIL，提示 `SupportContextService.getContext` 或 Controller endpoint 未实现。

Result: 2026-06-08 按预期失败，错误为 `找不到符号 类 SupportContextService` 和 `找不到符号 方法 getContext(java.lang.String,long)`。

- [x] **Step 2: 实现 `SupportContextService`**

实现策略：

- 注入 `SupportConversationMapper`、`UserMapper` 和后续 internal clients。
- 复用 `CustomerSupportService` 的可见性规则；如果复用困难，先把可见性抽到包内 helper，避免复制出两套不同规则。
- 先返回用户摘要和空分区。

接口：

```java
public SupportContextResponse getContext(Long actorUserId, Long conversationId) {
    User actor = requireSupportOrAdmin(actorUserId);
    SupportConversation conversation = requireConversationVisible(actor, actorUserId, conversationId);
    User user = userMapper.selectById(conversation.getUserId());
    return SupportContextResponse.empty(conversationId, conversation.getUserId(), displayName(user), maskPhone(user));
}
```

- [x] **Step 3: Controller 接口接入**

在 `SupportController` 新增：

```java
@GetMapping("/support/agent/conversations/{id}/context")
public Result<SupportContextResponse> getContext(
        @RequestHeader(value = "Authorization", required = false) String authorization,
        @PathVariable Long id) {
    Long userId = parseUserId(authorization);
    if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
    return Result.success(supportContextService.getContext(userId, id));
}
```

同时构造器注入 `SupportContextService`，更新 `CustomerSupportFullTest` 中 controller 构造。

- [x] **Step 4: 运行测试**

Run:

```powershell
cd java
mvn -pl java-user -am "-Dtest=SupportContextServiceTest,CustomerSupportFullTest" "-Dsurefire.failIfNoSpecifiedTests=false" test
```

Expected: PASS。

Result: 2026-06-08 PASS；`mvn -pl java-user -am "-Dtest=SupportContextServiceTest,CustomerSupportFullTest" "-Dsurefire.failIfNoSpecifiedTests=false" test` 34 tests passed；`mvn -pl java-user -am test` 235 tests passed；`scripts\verify-microservice-boundaries.ps1` PASS。

## Task 3: owner service internal 只读接口

**Files:**
- Modify: `java/java-order/src/main/java/com/omni/order/controller/OrderController.java`
- Modify: `java/java-order/src/test/java/com/omni/order/controller/OrderControllerInternalCreateTest.java`
- Modify: `java/java-payment/src/main/java/com/omni/payment/controller/RefundController.java`
- Modify: `java/java-payment/src/test/java/com/omni/payment/controller/RefundControllerTest.java`
- Modify: `java/java-notification/src/main/java/com/omni/notification/controller/NotificationController.java`
- Modify: `java/java-notification/src/test/java/com/omni/notification/controller/NotificationControllerAuthTest.java`
- Modify: `nestjs/grab-service/src/grab/grab.controller.ts`
- Modify: `nestjs/grab-service/src/grab/grab.module.ts`
- Modify: `nestjs/grab-service/src/grab/grab.service.ts`
- Modify: `nestjs/grab-service/src/grab/grab.repository.ts`
- Modify: `nestjs/grab-service/src/waitlist/waitlist.controller.ts`
- Modify: `nestjs/grab-service/src/waitlist/waitlist.service.ts`
- Modify: `nestjs/grab-service/src/waitlist/waitlist.repository.ts`
- Test: corresponding `*.spec.ts`

- [x] **Step 1: `java-order` 增加订单和票夹 internal 测试**

新增测试：

```java
@Test
void internalListUserOrdersRequiresToken() {
    Result<List<OrderListItemResponse>> result = controller.listInternalUserOrders(2004L, 5, null);

    assertEquals(403, result.getCode());
    verify(orderService, never()).listOrderItems(any());
}

@Test
void internalListUserOrdersReturnsLimitedUserOrders() {
    when(orderService.listOrderItems(2004L)).thenReturn(List.of(new OrderListItemResponse(), new OrderListItemResponse()));

    Result<List<OrderListItemResponse>> result = controller.listInternalUserOrders(2004L, 1, "test-internal-token");

    assertEquals(200, result.getCode());
    assertEquals(1, result.getData().size());
}
```

Run:

```powershell
cd java
mvn -pl java-order -am "-Dtest=OrderControllerInternalCreateTest" "-Dsurefire.failIfNoSpecifiedTests=false" test
```

Expected: FAIL。

Result: 2026-06-08 RED；新增测试先因 `OrderController` 缺少 `listInternalUserOrders`、`listInternalUserTickets` 编译失败。

- [x] **Step 2: `java-order` 实现只读接口**

新增：

```java
@GetMapping("/internal/users/{userId}/orders")
public Result<List<OrderListItemResponse>> listInternalUserOrders(
        @PathVariable Long userId,
        @RequestParam(defaultValue = "5") Integer limit,
        @RequestHeader(value = "X-Internal-Token", required = false) String token) {
    if (!isValidInternalToken(token)) return Result.fail(403, "无权限");
    return Result.success(limitList(orderService.listOrderItems(userId), limit));
}

@GetMapping("/internal/users/{userId}/tickets")
public Result<List<TicketWalletItemResponse>> listInternalUserTickets(...) {
    if (!isValidInternalToken(token)) return Result.fail(403, "无权限");
    return Result.success(limitList(ticketWalletService.listMyTickets(userId), limit));
}
```

注意：不要改已有 `/api/order/user/{userId}` 的行为，避免影响 C 端历史兼容；后续单独清理该误导接口。

Result: 2026-06-08 PASS；`OrderControllerInternalCreateTest` 17 tests passed。

- [x] **Step 3: `java-payment` 增加退款 internal 接口**

新增：

```java
@GetMapping("/internal/users/{userId}")
public Result<List<RefundRequestVO>> listInternalUserRefunds(
        @PathVariable Long userId,
        @RequestParam(defaultValue = "5") Integer limit,
        @RequestHeader(value = "X-Internal-Token", required = false) String token) {
    if (!StringUtils.hasText(internalApiToken) || !internalApiToken.equals(token)) {
        return Result.fail(403, "无权限");
    }
    return Result.success(limitList(refundService.listUserRefunds(userId), limit));
}
```

路径完整为：

```text
GET /api/payment/refunds/internal/users/{userId}?limit=5
```

Result: 2026-06-08 PASS；`RefundControllerTest` 3 tests passed。

- [x] **Step 4: `java-notification` 增加通知 internal 接口**

新增：

```java
@GetMapping("/internal/users/{userId}/notifications")
public Result<List<Notification>> listInternalUserNotifications(
        @PathVariable Long userId,
        @RequestParam(defaultValue = "5") Integer limit,
        @RequestHeader(value = "X-Internal-Token", required = false) String token) {
    if (!StringUtils.hasText(internalApiToken) || !internalApiToken.equals(token)) {
        return Result.fail(403, "无权限");
    }
    return Result.success(limitList(notificationService.listNotifications(userId), limit));
}
```

Result: 2026-06-08 PASS；`NotificationControllerAuthTest` 13 tests passed。

- [x] **Step 5: grab-service 增加 internal guard 和列表接口**

新增 internal token helper，路径：

```text
GET /api/grab/internal/users/{userId}/requests?limit=5
GET /api/waitlist/internal/users/{userId}/entries?limit=5
```

实现：

```ts
@Get('internal/users/:userId/requests')
async internalListByUser(
  @Headers('x-internal-token') token: string | undefined,
  @Param('userId') userId: string,
  @Query('limit') limit = '5',
) {
  this.requireInternalToken(token)
  return success(await this.grabService.listByUser(Number(userId), Number(limit)))
}
```

仓储 SQL 按 `user_id` 倒序取最近记录：

```sql
select * from grab_request where user_id = $1 order by updated_at desc, id desc limit $2
```

Result: 2026-06-08 RED -> PASS；新增 specs 先因缺少 `GrabInternalController`、`GrabService.listByUser`、`WaitlistService.listByUser`、`WaitlistController.internalListByUser` 失败；实现后 `npm test -- grab.controller.spec.ts waitlist.controller.spec.ts grab.service.spec.ts waitlist.service.spec.ts` 6 suites / 86 tests passed。

- [x] **Step 6: owner service 验证**

Run:

```powershell
cd java
mvn -pl java-order,java-payment,java-notification -am "-Dtest=OrderControllerInternalCreateTest,RefundServiceBoundaryTest,NotificationControllerAuthTest" "-Dsurefire.failIfNoSpecifiedTests=false" test
cd ..\nestjs\grab-service
npm test -- grab.controller.spec.ts waitlist.controller.spec.ts grab.service.spec.ts waitlist.service.spec.ts
```

Expected: PASS。

Result: 2026-06-08 PASS；`mvn -pl java-order,java-payment,java-notification -am "-Dtest=OrderControllerInternalCreateTest,RefundControllerTest,NotificationControllerAuthTest" "-Dsurefire.failIfNoSpecifiedTests=false" test` passed；`scripts\verify-microservice-boundaries.ps1` PASS。

## Task 4: `java-user` Feign clients 和容错聚合

**Files:**
- Create: `java/java-user/src/main/java/com/omni/user/client/OrderSupportContextInternalClient.java`
- Create: `java/java-user/src/main/java/com/omni/user/client/PaymentSupportContextInternalClient.java`
- Create: `java/java-user/src/main/java/com/omni/user/client/NotificationSupportContextInternalClient.java`
- Create: `java/java-user/src/main/java/com/omni/user/client/GrabSupportContextInternalClient.java`
- Modify: `java/java-user/src/main/java/com/omni/user/service/SupportContextService.java`
- Modify: `java/java-user/src/test/java/com/omni/user/service/SupportContextServiceTest.java`

- [x] **Step 1: 写聚合成功测试**

模拟各 client 返回数据，断言服务聚合并裁剪为 5 条。

```java
@Test
void aggregatesOwnerServiceSections() {
    mockVisibleConversation();
    when(orderClient.listOrders(2004L, 5, "internal-token")).thenReturn(Result.success(List.of(order("DM1"))));
    when(paymentClient.listRefunds(2004L, 5, "internal-token")).thenReturn(Result.success(List.of(refund(8001L))));

    SupportContextResponse response = service.getContext(3001L, 1001L);

    assertEquals("DM1", response.getOrders().get(0).getOrderNo());
    assertEquals(8001L, response.getRefunds().get(0).getId());
    assertTrue(response.getErrors().isEmpty());
}
```

Expected: FAIL。

Result: 2026-06-08 RED；新增测试先因缺少 `OrderSupportContextInternalClient`、`PaymentSupportContextInternalClient`、`NotificationSupportContextInternalClient`、`GrabSupportContextInternalClient` 编译失败。

- [x] **Step 2: 写单分区失败降级测试**

```java
@Test
void keepsOtherSectionsWhenRefundContextFails() {
    mockVisibleConversation();
    when(orderClient.listOrders(2004L, 5, "internal-token")).thenReturn(Result.success(List.of(order("DM1"))));
    when(paymentClient.listRefunds(2004L, 5, "internal-token")).thenThrow(new RuntimeException("payment down"));

    SupportContextResponse response = service.getContext(3001L, 1001L);

    assertEquals(1, response.getOrders().size());
    assertTrue(response.getRefunds().isEmpty());
    assertEquals("refunds", response.getErrors().get(0).getSection());
    assertEquals("退款上下文暂不可用", response.getErrors().get(0).getMessage());
}
```

Expected: FAIL。

Result: 2026-06-08 RED；缺少 owner context clients 和新构造器，符合预期。

- [x] **Step 3: 实现 Feign clients**

示例：

```java
@FeignClient(name = "java-order")
public interface OrderSupportContextInternalClient {
    @GetMapping("/api/order/internal/users/{userId}/orders")
    Result<List<SupportContextResponse.SupportContextOrder>> listOrders(
            @PathVariable("userId") Long userId,
            @RequestParam("limit") Integer limit,
            @RequestHeader("X-Internal-Token") String internalToken);
}
```

grab-service 如果未注册 Nacos，第一轮可使用 URL 配置：

```java
@FeignClient(name = "grab-service", url = "${omni.grab-service.url:http://localhost:3001}")
```

Result: 2026-06-08 PASS；新增 `OrderSupportContextInternalClient`、`PaymentSupportContextInternalClient`、`NotificationSupportContextInternalClient`、`GrabSupportContextInternalClient`。

- [x] **Step 4: 实现容错聚合**

每个分区单独 try/catch：

```java
private <T> List<T> safeLoad(String section, String message, Supplier<Result<List<T>>> loader, SupportContextResponse response) {
    try {
        Result<List<T>> result = loader.get();
        if (result == null || result.getCode() != 200 || result.getData() == null) {
            response.addError(section, message);
            return Collections.emptyList();
        }
        return result.getData();
    } catch (RuntimeException e) {
        response.addError(section, message);
        return Collections.emptyList();
    }
}
```

Result: 2026-06-08 PASS；`SupportContextService` 聚合订单、票夹、退款、通知、抢票和候补；任一分区失败只写入 `errors`，不阻断其他分区。

- [x] **Step 5: 运行 java-user 聚合测试**

Run:

```powershell
cd java
mvn -pl java-user -am "-Dtest=SupportContextServiceTest,CustomerSupportFullTest" "-Dsurefire.failIfNoSpecifiedTests=false" test
```

Expected: PASS。

Result: 2026-06-08 PASS；`mvn -pl java-user -am "-Dtest=SupportContextServiceTest,CustomerSupportFullTest" "-Dsurefire.failIfNoSpecifiedTests=false" test` 36 tests passed；`mvn -pl java-user -am test` 237 tests passed；`scripts\verify-microservice-boundaries.ps1` PASS。

## Task 5: 前端右侧上下文面板

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/support-tools.ts`
- Modify: `frontend/src/lib/support-tools.test.ts`
- Modify: `frontend/src/app/support/page.tsx`

- [x] **Step 1: 写展示辅助函数测试**

在 `support-tools.test.ts` 增加：

```ts
test('formatSupportContextSectionCount returns Chinese labels', () => {
  assert.equal(formatSupportContextSectionCount('orders', 2), '订单 2')
  assert.equal(formatSupportContextSectionCount('refunds', 0), '退款 0')
})

test('hasSupportContextData detects any non-empty section', () => {
  assert.equal(hasSupportContextData({ orders: [{ id: 1 }], refunds: [], tickets: [], waitlist: [], grabRequests: [], notifications: [] } as any), true)
  assert.equal(hasSupportContextData({ orders: [], refunds: [], tickets: [], waitlist: [], grabRequests: [], notifications: [] } as any), false)
})
```

Expected: FAIL。

Result: 2026-06-08 按预期失败，错误为 `The requested module './support-tools.ts' does not provide an export named 'formatSupportContextSectionCount'`。

- [x] **Step 2: 实现 helper**

新增：

```ts
export function hasSupportContextData(context: SupportContextVO | null | undefined) {
  if (!context) return false
  return Boolean(
    context.orders.length ||
    context.refunds.length ||
    context.tickets.length ||
    context.waitlist.length ||
    context.grabRequests.length ||
    context.notifications.length,
  )
}
```

Result: 2026-06-08 PASS；`node --test src\lib\support-tools.test.ts` 21 tests passed。

- [x] **Step 3: 页面接入上下文加载**

在 `SupportWorkbenchPage` 增加状态：

```ts
const [context, setContext] = useState<SupportContextVO | null>(null)
const [contextLoading, setContextLoading] = useState(false)
```

在 `reloadActiveConversation` 中并行加载：

```ts
await Promise.all([
  loadMessages(conversationId, loadId),
  loadOperationData(conversationId, loadId),
  loadSupportContext(conversationId, loadId),
])
```

右侧栏在“用户标签”之前增加 `用户上下文` section，所有用户可见文案使用中文。

Result: 2026-06-08 已在 `frontend/src/app/support/page.tsx` 接入 `getSupportConversationContext`，选择会话后并行加载消息、备注、审计、快捷回复、客服列表和用户上下文；无会话或切换会话时清空上下文状态。

- [x] **Step 4: 运行前端测试和类型检查**

Run:

```powershell
cd frontend
node --test src\lib\api.test.ts src\lib\support-tools.test.ts
pnpm typecheck
```

Expected: PASS。

Result: 2026-06-08 PASS；`node --test src\lib\api.test.ts src\lib\support-tools.test.ts` 47 tests passed；`pnpm typecheck` PASS。

- [x] **Step 5: 浏览器冒烟验收**

Run:

```text
http://localhost:3000/support
```

Expected: 页面无渲染崩溃，未授权用户会被权限守卫拦截。

Result: 2026-06-08 PARTIAL PASS；本地前端 `/support` HTTP 200，普通用户访问 `/support` 后按权限守卫跳回 `/`，浏览器 console 无 error/warn。普通客服账号 `13910000003` 后端登录接口返回 `code=200`、`role=support`、`permissionCodes=[support.conversation.view]`；当时真实会话数据 seed 尚未导入本地库，右侧面板视觉验收保留到 Task 7 复测。

## Task 6: 演示种子数据和本地验证

**Files:**
- Modify: `sql/seeds/prod-split-real-demo/04-user-ops.sql`
- Modify: `sql/seeds/prod-split-real-demo/02-order.sql`
- Modify: `sql/seeds/prod-split-real-demo/03-payment.sql`
- Modify: `sql/seeds/prod-split-real-demo/05-notification.sql`
- Modify: `sql/seeds/prod-split-real-demo/06-grab.sql`
- Modify: `sql/seeds/prod-split-real-demo/README.md`
- Modify: `scripts/verify-prod-split-real-demo-seed.ps1`
- Modify: `docs/production-readiness/seed-data-audit.md`

- [x] **Step 1: 补真实演示链路**

为 `13900000001` 或指定真实用户补齐：

- 至少 2 个订单：待支付、已支付。
- 至少 1 条退款申请。
- 至少 1 张可用票和 1 张已核验票。
- 至少 1 条候补记录。
- 至少 1 条抢票请求。
- 至少 2 条通知。
- 至少 1 个客服会话，主题能指向订单或退款。

Result: 2026-06-08 已补 `04-user-ops.sql`：新增客服主管/普通客服演示账号、`support_account`、`support_conversation`、`support_message`、`support_conversation_note`、`support_conversation_tag`、`support_conversation_audit` 和 `support_quick_reply`。会话用户为 `13900000001` / `2004`，主题指向 `DMREAL980045` 和 `REFREAL985004`；订单、退款、电子票、候补、抢票和通知数据复用现有 `02-order.sql`、`03-payment.sql`、`05-notification.sql`、`06-grab.sql`。

- [x] **Step 2: 扩展 seed verifier**

检查 SQL 中包含：

```powershell
@(
  "support_conversation",
  "refund_request",
  "electronic_ticket",
  "waitlist_entry",
  "grab_request",
  "notification"
)
```

Result: 2026-06-08 已扩展 `scripts/verify-prod-split-real-demo-seed.ps1`。先红灯失败，缺少 `support_conversation`、`support_message`、`support_conversation_note`、`support_conversation_tag`、`support_conversation_audit`、`support_quick_reply`、`13910000003`、`REFREAL985004`、`用户上下文`；补齐 seed 后 PASS。

- [x] **Step 3: 本地数据库迁移规则**

本任务第一轮不新增表字段；如后续为了客服质检、满意度、排班新增表，必须同时补：

- `sql/production-split/user/YYYYMMDD_support_quality_schedule.sql`
- `sql/migrations/shared/YYYYMMDD_support_quality_schedule.sql`
- 本地 `omni_user` 执行迁移。

Result: 2026-06-08 本任务只补演示种子数据和 verifier，不新增表、字段、索引或约束，因此无需 schema migration。已按用户授权执行 `scripts\apply-prod-split-real-demo-seed.ps1 -ConfirmApply`，将 real-demo seed 持久写入本地五库；导入后 `scripts\verify-prod-split-real-demo-seed.ps1` PASS。

## Task 7: 全链路验收和文档更新

**Files:**
- Modify: `2026-06-06-platform-improvement-roadmap.md`
- Modify: `docs/production-readiness/frontend-entry-audit.md`
- Modify: `docs/production-readiness/seed-data-audit.md`
- Modify: `docs/production-readiness/replacement-audit.md`

- [x] **Step 1: 后端测试**

Run:

```powershell
cd java
mvn -pl java-user,java-order,java-payment,java-notification -am "-Dtest=SupportContextServiceTest,CustomerSupportFullTest,OrderControllerInternalCreateTest,RefundServiceBoundaryTest,NotificationControllerAuthTest" "-Dsurefire.failIfNoSpecifiedTests=false" test
```

Expected: PASS。

Result: 2026-06-08 PASS。`java-user` 36 个测试、`java-order` 17 个测试、`java-payment` 24 个测试、`java-notification` 13 个测试通过；日志中的 timeout/error stack trace 来自边界测试的预期异常路径，最终 failures/errors 为 0。

- [x] **Step 2: grab-service 测试**

Run:

```powershell
cd nestjs\grab-service
npm test -- grab.controller.spec.ts grab.service.spec.ts waitlist.controller.spec.ts waitlist.service.spec.ts
```

Expected: PASS。

Result: 2026-06-08 PASS。Jest 运行 `grab.controller.spec.ts`、`grab.service.spec.ts`、`waitlist.controller.spec.ts`、`waitlist.service.spec.ts`，实际匹配到 6 个 suites，86 个 tests 全部通过。

- [x] **Step 3: 边界验收**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1
```

Expected: PASS，且无新增跨服务 Mapper、Entity、XML mapper 或 SQL join。

Result: 2026-06-08 PASS。`scripts\verify-microservice-boundaries.ps1` 完成 service boundary guard、cross-owner FK inventory、local schema profiles、local schema SQL safety、production split SQL safety 和 Java boundary tests，最终输出 `All microservice boundary checks passed.`。

- [x] **Step 4: 前端验收**

Run:

```powershell
cd frontend
node --test src\lib\api.test.ts src\lib\support-tools.test.ts
pnpm typecheck
```

Expected: PASS。

Result: 2026-06-08 PASS。`node --test src\lib\api.test.ts src\lib\support-tools.test.ts` 共 47 个测试通过；`pnpm typecheck` 执行 `tsc --noEmit`，exit 0。

- [x] **Step 5: 浏览器验收**

手工或 Browser 验证：

```text
/support
```

验收点：

- 客服登录后能进入工作台。
- 选择会话后右侧显示“用户上下文”。
- 订单、退款、票夹、候补、抢票、通知至少一个分区有数据。
- 某个 owner service 停止时，只显示对应分区错误，不影响消息、备注、标签和审计。
- 浏览器 console 无 error/warn。

Result: 2026-06-08 PASS。已使用客服账号 `13910000003` 登录 `/support`，进入已关闭会话 `DMREAL980045 退款和票夹异常` 后，右侧“用户上下文”真实显示订单 5、退款 4、票夹 5、候补 5、抢票 5、通知 2；可见订单、退款、票夹、抢票、候补和通知分区，退款分区包含 `DMREAL980045`。浏览器 console error/warn 为 0，相关队列、消息、上下文、备注和审计请求均为 200。运行态说明：本轮初次浏览器验收使用隔离端口 `18081/18083/18084/18085`、`grab-service:3001` 和 `API_PROXY_TARGET=http://localhost:18081`。后续标准端口复测已补齐：经 Gateway `8088` 使用客服账号登录、拉取 `closed` 队列会话 `988101`，`/api/user/support/agent/conversations/988101/context` 返回订单 5、退款 4、票夹 5、候补 5、抢票 5、通知 2，标准前端 `3000/support` 右侧“用户上下文”同步展示相同数据，浏览器 console 无 warn/error。owner service 停止时的分区降级由 `SupportContextServiceTest` 覆盖，本次未热停浏览器验证环境中的 owner service。

---

## 风险和处理

- **`/api/order/user/{userId}` 语义误导：** 当前实际按 JWT 用户查。第一轮不要复用它，新增 internal endpoint；后续单独移除或改名，避免前端误用。
- **grab-service 可能未注册 Nacos：** Feign client 第一轮用 `omni.grab-service.url` 显式 URL，默认 `http://localhost:3001`。
- **上下文接口变慢：** 每个分区后续可加 Redis 短 TTL 缓存；第一轮先做分区容错和 limit=5。
- **敏感信息泄露：** 票夹只展示票状态，不返回验票二维码原文；用户手机号只展示 mask。
- **测试启动成本高：** 按任务先跑定向测试，阶段完成再跑 `java-user` 模块和边界脚本。

## 第一轮完成标准

- `/api/user/support/agent/conversations/{conversationId}/context` 可用。
- 客服页右侧能显示业务上下文，并支持跳转到已有订单、退款、抢票页面。
- 任一 owner service 故障不会导致客服工作台整页失败。
- 后端定向测试、前端测试、`pnpm typecheck`、微服务边界脚本通过。
- 文档标记 Stage 5 第一轮完成，未实现的客服主管二期能力保留为后续任务。
