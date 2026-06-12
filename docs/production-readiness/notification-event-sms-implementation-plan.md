# 通知事件中台与 SMS 渠道 Implementation Plan

> **给执行代理：** REQUIRED SUB-SKILL: Use `executing-plans` 按任务逐项实施；涉及生产代码改动时先用 `test-driven-development`。步骤使用 checkbox（`- [ ]`）跟踪。本项目规则要求不要自动提交和推送，因此本计划不包含 commit step。

**Goal:** 把客服回复、抢票、候补、退款、改期等关键业务动作收口到统一通知事件模型，默认稳定产生站内通知，并预留可插拔 SMS 渠道。

**Architecture:** 业务服务只发布通知事件，不直接关心站内通知表和 SMS 供应商；`java-notification` 消费事件后按渠道生成投递任务，站内通知写 `notification`，SMS 通过 `SmsSender` 适配器投递或在未配置时记录 `SKIPPED`。旧 `NotificationMessage` 与 `/api/notification/internal/messages` 保持兼容，后续逐个业务发送点迁移到 `NotificationEventMessage`。

**Tech Stack:** Spring Boot 2.7.18、RabbitMQ、MyBatis-Plus、PostgreSQL、Redis、Next.js、TypeScript。第一阶段不新增 SMS SDK；真实供应商接入前只定义接口、配置和投递记录。

---

## 非目标

- 不在第一轮接入真实短信供应商 SDK。
- 不让业务服务直接写 `notification`、`notification_delivery` 或 SMS 表。
- 不把短信验证码、登录认证和 Clerk 迁移混进本阶段第一轮。
- 不删除旧 `NotificationMessage`，先兼容再迁移。
- 不恢复动态系统、moment API 或旧 social/moment 持久化代码。

## 当前现状

- `java-common` 已有 `NotificationMessage`、`MqConstants`、`MqConfig`、`MqPublishSupport`。
- `java-notification` 已有站内通知表、`NotificationService.createInternalMessage()`、MQ 监听、重试队列和死信队列。
- `notification` 表已有 `action_href`、`action_label`、`aggregate_key`，可支持用户可见去重和业务入口。
- `java-user` 的人工客服回复已通过 MQ 发 `SUPPORT_REPLY`。
- `java-ticket` 的风险待办、阵容变更已通过 MQ 发部分站内通知。
- `grab-service` 仍通过 internal HTTP 直连 `/api/notification/internal/messages`。
- `java-payment` 的退款审批链路已通过 MQ 发布 `REFUND_APPROVED`、`REFUND_REJECTED`、`REFUND_UNKNOWN`、`COMPENSATION_REQUIRED`。

## 设计口径

### 事件与渠道

统一事件模型命名为 `NotificationEventMessage`，字段包含：

- `eventId`：业务事件幂等键，生产者必须提供。
- `eventType`：业务事件类型，例如 `SUPPORT_REPLY`、`REFUND_APPROVED`。
- `aggregateKey`：用户可见通知聚合键，用于避免重复刷屏。
- `userId`：接收用户。
- `orderId`：关联订单，可为空。
- `activityId`：关联活动，可为空。
- `templateCode`：渠道模板编码，可为空；未配置模板时使用 `content`。
- `channels`：投递渠道，第一轮支持 `IN_APP`、`SMS`，默认 `IN_APP`。
- `priority`：`NORMAL`、`HIGH`；第一轮只用于记录和后续频控。
- `content`：站内通知文案或短信兜底文案。
- `actionHref` / `actionLabel`：站内通知业务入口。
- `payload`：模板变量，使用 `Map<String,Object>`。
- `occurredAt`：业务事件发生时间。

旧 `NotificationMessage` 视为站内通知快捷消息，后续监听层会转换成 `NotificationEventMessage`，保证旧发送点继续可用。

### 投递记录

新增 `notification_delivery`，由 `java-notification` 拥有：

- `id`
- `event_id`
- `event_type`
- `user_id`
- `order_id`
- `activity_id`
- `channel`
- `status`：`PENDING`、`SENT`、`FAILED`、`SKIPPED`
- `failure_reason`
- `retry_count`
- `provider_message_id`
- `template_code`
- `content_snapshot`
- `payload_json`
- `created_time`
- `updated_time`
- `sent_time`

约束：

- `UNIQUE(event_id, channel)` 保证同一业务事件同一渠道只投递一次。
- `event_id` 不替代 `aggregateKey`：前者保证投递幂等，后者保证用户看到的通知不刷屏。
- SMS 未配置时写 `SKIPPED`，站内通知仍成功。

### SMS 适配器

第一轮只定义接口：

```java
public interface SmsSender {
    SmsSendResult send(SmsSendRequest request);
}
```

默认实现 `DisabledSmsSender`：

- 配置 `omni.notification.sms.enabled=false` 时启用。
- 不调用外部 API。
- 返回 `SKIPPED` 和中文原因“短信渠道未配置”。

后续接真实供应商时再新增 `AliyunSmsSender`、`TencentSmsSender` 或其它实现，并先说明下载 SDK、环境变量、资费和退出方案。

### Redis 使用边界

第一轮不强依赖 Redis 才能投递通知。Redis 放在后续任务：

- `notification:event:{eventId}:{channel}` 短期幂等保护。
- `notification:sms:rate:{userId}` 短信频控。
- `sms:code:{phone}:{scene}` 验证码缓存。

DB 唯一索引仍是最终幂等边界，Redis 只做高频保护。

---

## 文件结构

### java-common

- Modify: `java/java-common/src/main/java/com/omni/common/mq/MqConstants.java`
- Modify: `java/java-common/src/main/java/com/omni/common/mq/MqConfig.java`
- Create: `java/java-common/src/main/java/com/omni/common/mq/message/NotificationEventMessage.java`
- Test: `java/java-common/src/test/java/com/omni/common/mq/MqConfigTest.java`
- Test: `java/java-common/src/test/java/com/omni/common/mq/NotificationEventMessageTest.java`

### java-notification

- Create: `java/java-notification/src/main/java/com/omni/notification/entity/NotificationDelivery.java`
- Create: `java/java-notification/src/main/java/com/omni/notification/mapper/NotificationDeliveryMapper.java`
- Create: `java/java-notification/src/main/java/com/omni/notification/service/NotificationEventService.java`
- Create: `java/java-notification/src/main/java/com/omni/notification/sms/SmsSender.java`
- Create: `java/java-notification/src/main/java/com/omni/notification/sms/SmsSendRequest.java`
- Create: `java/java-notification/src/main/java/com/omni/notification/sms/SmsSendResult.java`
- Create: `java/java-notification/src/main/java/com/omni/notification/sms/DisabledSmsSender.java`
- Modify: `java/java-notification/src/main/java/com/omni/notification/mq/NotificationMessageListener.java`
- Modify: `java/java-notification/src/main/java/com/omni/notification/service/NotificationService.java`
- Test: `java/java-notification/src/test/java/com/omni/notification/service/NotificationEventServiceTest.java`
- Test: `java/java-notification/src/test/java/com/omni/notification/mq/NotificationMessageListenerTest.java`
- Test: `java/java-notification/src/test/java/com/omni/notification/sms/DisabledSmsSenderTest.java`

### SQL

- Create: `sql/production-split/notification/20260607_notification_delivery.sql`
- Modify: `sql/production-split/manifest.json`

### 业务服务迁移

- Modify: `java/java-user/src/main/java/com/omni/user/mq/NotificationMqProducer.java`
- Modify: `java/java-user/src/main/java/com/omni/user/service/CustomerSupportService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/mq/NotificationMqProducer.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityArtistService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityRiskResponseService.java`
- Modify: `java/java-payment/src/main/java/com/omni/payment/service/RefundService.java`
- Modify: `nestjs/grab-service/src/team-grab/notification-client.service.ts`

### frontend

- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`
- Create or modify: `frontend/src/app/notifications/settings/page.tsx`
- Modify: notification list or header entry files after locating current notification UI.

---

## Task 1: common 事件模型与 MQ 队列声明

**Files:**
- Create: `java/java-common/src/main/java/com/omni/common/mq/message/NotificationEventMessage.java`
- Create: `java/java-common/src/test/java/com/omni/common/mq/NotificationEventMessageTest.java`
- Modify: `java/java-common/src/main/java/com/omni/common/mq/MqConstants.java`
- Modify: `java/java-common/src/main/java/com/omni/common/mq/MqConfig.java`
- Modify: `java/java-common/src/test/java/com/omni/common/mq/MqConfigTest.java`

- [x] **Step 1: 写事件模型红灯测试**

测试目标：事件模型默认站内通知渠道，规范化渠道，保留 SMS 和 payload。

```java
@Test
void defaultsToInAppChannelAndNormalPriority() {
    NotificationEventMessage message = new NotificationEventMessage();
    message.setEventId("support-reply:99");
    message.setEventType("SUPPORT_REPLY");
    message.setUserId(2004L);
    message.setContent("人工客服回复了你的咨询，请查看客服会话。");

    assertEquals(List.of("IN_APP"), message.effectiveChannels());
    assertEquals("NORMAL", message.effectivePriority());
}

@Test
void normalizesChannelsAndKeepsPayload() {
    NotificationEventMessage message = new NotificationEventMessage();
    message.setChannels(List.of("sms", "IN_APP", " ", "sms"));
    message.setPayload(Map.of("activityName", "周杰伦演唱会", "amount", 1880));

    assertEquals(List.of("SMS", "IN_APP"), message.effectiveChannels());
    assertEquals("周杰伦演唱会", message.getPayload().get("activityName"));
    assertEquals(1880, message.getPayload().get("amount"));
}
```

- [x] **Step 2: 跑红灯**

Run:

```powershell
cd java
mvn -pl java-common test "-Dtest=NotificationEventMessageTest"
```

Expected:

- 编译失败，原因是 `NotificationEventMessage` 不存在。

- [x] **Step 3: 实现最小事件模型**

新增 `NotificationEventMessage`，只包含字段、getter/setter、`effectiveChannels()` 和 `effectivePriority()`。

- [x] **Step 4: 写 MQ 声明红灯测试**

在 `MqConfigTest` 增加：

```java
@Test
void declaresNotificationEventExchangeAndQueue() {
    assertEquals("omni.notification", MqConstants.NOTIFICATION_EXCHANGE);
    assertEquals("notification.event", MqConstants.RK_NOTIFICATION_EVENT);
    assertEquals("notification.event.retry", MqConstants.RK_NOTIFICATION_EVENT_RETRY);
    assertEquals("notification.event.dlq", MqConstants.RK_NOTIFICATION_EVENT_DLQ);
    assertEquals("notification.event.queue", MqConstants.Q_NOTIFICATION_EVENT);
    assertEquals("notification.event.retry.queue", MqConstants.Q_NOTIFICATION_EVENT_RETRY);
    assertEquals("notification.event.dlq", MqConstants.Q_NOTIFICATION_EVENT_DLQ);
}

@Test
void notificationEventQueueDeadLettersToRetryQueue() {
    Queue queue = config.notificationEventQueue();

    assertEquals(MqConstants.Q_NOTIFICATION_EVENT, queue.getName());
    assertEquals(MqConstants.NOTIFICATION_RETRY_EXCHANGE, queue.getArguments().get("x-dead-letter-exchange"));
    assertEquals(MqConstants.RK_NOTIFICATION_EVENT_RETRY, queue.getArguments().get("x-dead-letter-routing-key"));
}
```

- [x] **Step 5: 跑红灯**

Run:

```powershell
cd java
mvn -pl java-common test "-Dtest=MqConfigTest"
```

Expected:

- 编译失败或断言失败，原因是通知事件常量和队列 bean 尚未声明。

- [x] **Step 6: 实现 MQ 常量和队列**

在现有 `omni.notification` exchange 下新增事件 routing key 和队列：

```java
public static final String RK_NOTIFICATION_EVENT = "notification.event";
public static final String RK_NOTIFICATION_EVENT_RETRY = "notification.event.retry";
public static final String RK_NOTIFICATION_EVENT_DLQ = "notification.event.dlq";
public static final String Q_NOTIFICATION_EVENT = "notification.event.queue";
public static final String Q_NOTIFICATION_EVENT_RETRY = "notification.event.retry.queue";
public static final String Q_NOTIFICATION_EVENT_DLQ = "notification.event.dlq";
```

队列策略与 `notification.send.queue` 一致：主队列失败进入 retry exchange，retry queue TTL 后回主 exchange，超过监听层最大重试后由监听层投递 DLX。

- [x] **Step 7: 跑绿灯**

Run:

```powershell
cd java
mvn -pl java-common test "-Dtest=NotificationEventMessageTest,MqConfigTest"
```

Expected:

- common 测试通过。

本地验证记录（2026-06-07）：

- 红灯：`mvn -pl java-common test "-Dtest=NotificationEventMessageTest,MqConfigTest"` 按预期失败，原因是 `NotificationEventMessage` 不存在。
- 绿灯：`mvn -pl java-common test "-Dtest=NotificationEventMessageTest,MqConfigTest"` 通过，`Tests run: 13, Failures: 0, Errors: 0, Skipped: 0`。
- 完整 common：`mvn -pl java-common test` 通过，`Tests run: 22, Failures: 0, Errors: 0, Skipped: 0`。
- 边界验收：`powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1` 通过。
- 空白检查：`git diff --check` 退出码为 0，仅有 Windows CRLF warning。

---

## Task 2: 投递记录表迁移

**Files:**
- Create: `sql/production-split/notification/20260607_notification_delivery.sql`
- Modify: `sql/production-split/manifest.json`
- Create: `java/java-notification/src/main/java/com/omni/notification/entity/NotificationDelivery.java`
- Create: `java/java-notification/src/main/java/com/omni/notification/mapper/NotificationDeliveryMapper.java`

- [x] **Step 1: 写 SQL 迁移**

```sql
-- owner: java-notification

CREATE TABLE IF NOT EXISTS notification_delivery (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(120) NOT NULL,
    event_type VARCHAR(60) NOT NULL,
    user_id BIGINT NOT NULL,
    order_id BIGINT NULL,
    activity_id BIGINT NULL,
    channel VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    failure_reason VARCHAR(500) NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    provider_message_id VARCHAR(120) NULL,
    template_code VARCHAR(80) NULL,
    content_snapshot TEXT NULL,
    payload_json TEXT NULL,
    created_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_time TIMESTAMP NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_notification_delivery_event_channel
    ON notification_delivery(event_id, channel);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_user_time
    ON notification_delivery(user_id, created_time DESC);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_status_time
    ON notification_delivery(status, created_time DESC);
```

- [x] **Step 2: 更新 manifest**

在 `java-notification` 服务下：

- `tables` 增加 `notification_delivery`。
- `migrations` 增加 `notification/20260607_notification_delivery.sql`。

- [x] **Step 3: 执行本地通知库迁移**

Run:

```powershell
$env:PGPASSWORD='123456'
psql -h localhost -p 5432 -U postgres -d omni_notification -f sql/production-split/notification/20260607_notification_delivery.sql
```

Expected:

- 输出 `CREATE TABLE` 或 `NOTICE already exists`。

- [x] **Step 4: 验证本地表结构**

Run:

```powershell
$env:PGPASSWORD='123456'
psql -h localhost -p 5432 -U postgres -d omni_notification -c "\d notification_delivery"
```

Expected:

- 存在 `event_id`、`channel`、`status`、`payload_json` 和唯一索引 `uk_notification_delivery_event_channel`。

本地验证记录（2026-06-07）：

- 红灯：`mvn -pl java-notification -am test "-Dtest=NotificationDeliveryTest" "-Dsurefire.failIfNoSpecifiedTests=false"` 按预期失败，原因是 `NotificationDelivery` 不存在。第一次未加 `-Dsurefire.failIfNoSpecifiedTests=false` 时被 common 模块“无匹配测试”拦截，已按项目既有参数重跑。
- 绿灯：`mvn -pl java-notification -am test "-Dtest=NotificationDeliveryTest" "-Dsurefire.failIfNoSpecifiedTests=false"` 通过，`Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`。
- 本地迁移：`psql -h localhost -p 5432 -U postgres -d omni_notification -f sql/production-split/notification/20260607_notification_delivery.sql` 输出 `CREATE TABLE`、`CREATE INDEX`。
- 表结构验证：`\d notification_delivery` 显示 `event_id`、`channel`、`status`、`payload_json` 和唯一索引 `uk_notification_delivery_event_channel`。
- 通知服务定向测试：`mvn -pl java-notification -am test "-Dtest=NotificationDeliveryTest,NotificationServiceTest,NotificationServiceFullTest,NotificationControllerAuthTest" "-Dsurefire.failIfNoSpecifiedTests=false"` 通过，`Tests run: 37, Failures: 0, Errors: 0, Skipped: 0`。
- SQL 安全检查首次失败：`check-production-split-sql.ps1` 报 `manifest references unknown production table 'notification_delivery'`。根因是脚本 `$schemaColumns` 生产表白名单未纳入新表，已补 `notification_delivery` 列清单。
- 修复后：`powershell -ExecutionPolicy Bypass -File scripts\check-production-split-sql.ps1` 通过。
- 边界验收：`powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1` 通过。

---

## Task 3: notification 服务事件消费与站内投递

**Files:**
- Create: `NotificationDelivery.java`
- Create: `NotificationDeliveryMapper.java`
- Create: `NotificationEventService.java`
- Modify: `NotificationMessageListener.java`
- Test: `NotificationEventServiceTest.java`
- Test: `NotificationMessageListenerTest.java`

- [x] **Step 1: 写站内投递红灯测试**

测试目标：

- `IN_APP` 渠道写 `notification`。
- `notification_delivery` 写 `SENT`。
- 重复 `eventId + IN_APP` 不重复插入通知。

- [x] **Step 2: 实现 `NotificationEventService.processEvent()`**

行为：

- 校验 `eventId`、`eventType`、`userId`、`content`。
- 对每个 `effectiveChannels()` 创建或读取 `notification_delivery`。
- `IN_APP` 调用 `NotificationService.createInternalMessage()`。
- 已存在 `eventId + channel` 时直接返回，不抛异常。

- [x] **Step 3: 增加 MQ 监听方法**

`NotificationMessageListener` 新增：

```java
@RabbitListener(queues = MqConstants.Q_NOTIFICATION_EVENT)
public void onNotificationEvent(NotificationEventMessage message, Message rawMessage) {
    // 调用 NotificationEventService，失败按现有 retry/DLQ 方式处理
}
```

旧 `onNotificationSend(NotificationMessage, Message)` 保留。

- [x] **Step 4: 跑 notification 定向测试**

Run:

```powershell
cd java
mvn -pl java-notification -am test "-Dtest=NotificationEventServiceTest,NotificationMessageListenerTest,NotificationServiceTest"
```

Expected:

- 事件消费、旧消息消费、站内通知去重测试通过。

本地验证记录（2026-06-07）：

- 红灯：`mvn -pl java-notification -am test "-Dtest=NotificationEventServiceTest,NotificationMessageListenerTest" "-Dsurefire.failIfNoSpecifiedTests=false"` 按预期失败，原因是 `NotificationEventService` 和 `onNotificationEvent` 尚未实现。
- 绿灯：`mvn -pl java-notification -am test "-Dtest=NotificationEventServiceTest,NotificationMessageListenerTest,NotificationServiceTest" "-Dsurefire.failIfNoSpecifiedTests=false"` 通过，`Tests run: 14, Failures: 0, Errors: 0, Skipped: 0`。
- 通知服务完整测试：`mvn -pl java-notification -am test` 通过，`Tests run: 43, Failures: 0, Errors: 0, Skipped: 0`。
- SQL 安全检查：`powershell -ExecutionPolicy Bypass -File scripts\check-production-split-sql.ps1` 通过。
- 边界验收：`powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1` 通过。
- 空白检查：`git diff --check` 退出码为 0，仅有 Windows CRLF warning。

---

## Task 4: SMS 适配器与未配置跳过

**Files:**
- Create: `SmsSender.java`
- Create: `SmsSendRequest.java`
- Create: `SmsSendResult.java`
- Create: `DisabledSmsSender.java`
- Modify: `NotificationEventService.java`
- Test: `DisabledSmsSenderTest.java`
- Test: `NotificationEventServiceTest.java`

- [x] **Step 1: 写 SMS 未配置测试**

测试目标：

- 事件渠道包含 `SMS`。
- `omni.notification.sms.enabled=false` 时不调用外部 API。
- `notification_delivery` 写 `SKIPPED`。
- 同一事件的 `IN_APP` 仍写站内通知。

- [x] **Step 2: 实现 `DisabledSmsSender`**

返回：

```java
new SmsSendResult("SKIPPED", null, "短信渠道未配置");
```

- [x] **Step 3: 事件服务接入 SMS 渠道**

`NotificationEventService` 遇到 `SMS`：

- 构造 `SmsSendRequest`。
- 调用 `SmsSender.send()`。
- 根据结果更新 `notification_delivery.status`。

- [x] **Step 4: 跑定向测试**

Run:

```powershell
cd java
mvn -pl java-notification -am test "-Dtest=NotificationEventServiceTest,DisabledSmsSenderTest"
```

Expected:

- SMS 未配置时投递记录为 `SKIPPED`，站内通知不受影响。

本地验证记录（2026-06-07）：

- 红灯：`mvn -pl java-notification -am test "-Dtest=NotificationEventServiceTest,DisabledSmsSenderTest" "-Dsurefire.failIfNoSpecifiedTests=false"` 按预期失败，原因是 `SmsSender`、`SmsSendRequest`、`SmsSendResult` 和 `DisabledSmsSender` 尚未实现。
- 绿灯：`mvn -pl java-notification -am test "-Dtest=NotificationEventServiceTest,DisabledSmsSenderTest" "-Dsurefire.failIfNoSpecifiedTests=false"` 通过，`Tests run: 5, Failures: 0, Errors: 0, Skipped: 0`。
- 通知服务完整测试：`mvn -pl java-notification -am test` 通过，`Tests run: 45, Failures: 0, Errors: 0, Skipped: 0`。
- SQL 安全检查：`powershell -ExecutionPolicy Bypass -File scripts\check-production-split-sql.ps1` 通过。
- 边界验收：`powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1` 通过，Java boundary tests `Tests run: 81, Failures: 0, Errors: 0, Skipped: 0`。
- 空白检查：`git diff --check` 退出码为 0，仅有 Windows CRLF warning。

---

## Task 5: 业务事件发送点迁移

**Files:**
- Modify: `java-user` 客服回复发送点。
- Modify: `java-ticket` 阵容变更、风险待办、活动取消/改期相关发送点。
- Modify: `java-payment` 退款审核通过/拒绝/异常发送点。
- Modify: `grab-service` 小队抢票/普通抢票通知客户端。

- [x] **Step 1: 先迁移 `SUPPORT_REPLY`**

客服回复事件：

- `eventId = "support-reply:" + conversationId + ":" + lastMessageId`
- `eventType = "SUPPORT_REPLY"`
- `aggregateKey = "SUPPORT_REPLY:" + conversationId`
- `channels = ["IN_APP"]`
- `actionHref = "/help"`
- `actionLabel = "查看客服会话"`

本地验证记录（2026-06-07）：

- 红灯：`mvn -pl java-user -am test "-Dtest=NotificationMqProducerTest,CustomerSupportServiceTest,CustomerSupportFullTest" "-Dsurefire.failIfNoSpecifiedTests=false"` 按预期失败，原因是 `NotificationMqProducer.sendNotificationEvent(NotificationEventMessage)` 尚未实现。
- 边界红灯：`mvn -pl java-user -am test "-Dtest=CustomerSupportServiceTest" "-Dsurefire.failIfNoSpecifiedTests=false"` 按预期失败，原因是客服回复消息 ID 未回填时仍会发送 `messageId=null` 的事件。
- 绿灯：`mvn -pl java-user -am test "-Dtest=NotificationMqProducerTest,CustomerSupportServiceTest,CustomerSupportFullTest" "-Dsurefire.failIfNoSpecifiedTests=false"` 通过，`Tests run: 64, Failures: 0, Errors: 0, Skipped: 0`。
- `java-user` 完整测试：`mvn -pl java-user -am test` 通过，`Tests run: 218, Failures: 0, Errors: 0, Skipped: 0`。
- 通知消费定向测试：`mvn -pl java-notification -am test "-Dtest=NotificationEventServiceTest,NotificationMessageListenerTest" "-Dsurefire.failIfNoSpecifiedTests=false"` 通过，`Tests run: 7, Failures: 0, Errors: 0, Skipped: 0`。
- 边界验收：`powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1` 通过。
- 空白检查：`git diff --check` 退出码为 0，仅有 Windows CRLF warning。

- [x] **Step 2: 迁移退款事件**

覆盖：

- `REFUND_APPROVED`
- `REFUND_REJECTED`
- `REFUND_UNKNOWN`
- `COMPENSATION_REQUIRED`

站内通知入口统一指向 `/orders/{orderId}`。

本地验证记录（2026-06-07）：

- 红灯：`mvn -pl java-payment -am test "-Dtest=NotificationMqProducerTest,RefundServiceBoundaryTest" "-Dsurefire.failIfNoSpecifiedTests=false"` 按预期失败，原因是 `java-payment` 尚无 `NotificationMqProducer`。
- 绿灯：同一命令通过，`Tests run: 25, Failures: 0, Errors: 0, Skipped: 0`。
- 完整 payment：`mvn -pl java-payment -am test` 通过，`Tests run: 86, Failures: 0, Errors: 0, Skipped: 0`。
- 通知消费定向：`mvn -pl java-notification -am test "-Dtest=NotificationEventServiceTest,NotificationMessageListenerTest" "-Dsurefire.failIfNoSpecifiedTests=false"` 通过，`Tests run: 7, Failures: 0, Errors: 0, Skipped: 0`。
- 边界验收：`powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1` 通过，所有 microservice boundary checks passed。
- 空白检查：`git diff --check` 退出码为 0，仅有 Windows CRLF warning。

- [x] **Step 3: 迁移抢票与候补事件**

覆盖：

- `GRAB_SUCCESS`
- `GRAB_FAILED`
- `WAITLIST_MATCHED`
- `ORDER_PAYMENT_TIMEOUT`

`grab-service` 可先继续 HTTP internal 调用，但请求体升级为事件模型；后续再统一 RabbitMQ。

本地验证记录（2026-06-07）：

- Java 红灯：`mvn -pl java-notification -am test "-Dtest=NotificationControllerAuthTest,NotificationServiceFullTest" "-Dsurefire.failIfNoSpecifiedTests=false"` 按预期失败，原因是 `NotificationController` 尚未注入 `NotificationEventService` 且没有 `/api/notification/internal/events`。
- NestJS 红灯：`npm test -- notification-client.service.spec.ts waitlist-notification.service.spec.ts` 按预期失败，原因是抢票和候补通知仍调用 `/api/notification/internal/messages`，请求体仍为旧 `type/content` 消息。
- 绿灯：`mvn -pl java-notification -am test "-Dtest=NotificationControllerAuthTest,NotificationServiceFullTest,NotificationEventServiceTest,NotificationMessageListenerTest" "-Dsurefire.failIfNoSpecifiedTests=false"` 通过，`Tests run: 37, Failures: 0, Errors: 0, Skipped: 0`。
- 绿灯：`npm test -- notification-client.service.spec.ts waitlist-notification.service.spec.ts` 通过，`Test Suites: 2 passed, Tests: 5 passed`。
- grab-service 全量测试：`npm test` 中通知相关 suite 均通过，但既有 `src/main.spec.ts` 失败，原因是测试期望 bootstrap 使用 `getHttpServer().listen(port, 2048, callback)`，当前 `main.ts` 实现为 `app.listen(port, host)`；本轮不改变启动绑定语义。
- 边界验收：`powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1` 通过，所有 microservice boundary checks passed。
- 空白检查：`git diff --check` 退出码为 0，仅有 Windows CRLF warning。

- [x] **Step 4: 迁移活动取消与改期事件**

覆盖：

- `ACTIVITY_RESCHEDULED`
- `ACTIVITY_CANCELLED`

已购用户通知必须有订单入口；本轮同步预留 `IN_APP + SMS` 渠道，SMS 未接入时由通知服务记录 `SKIPPED`。

本地验证记录（2026-06-07）：

- 红灯：`mvn -pl java-ticket -am test "-Dtest=NotificationMqProducerTest,ActivityAdminServiceTest,SessionAdminServiceTest" "-Dsurefire.failIfNoSpecifiedTests=false"` 按预期失败，原因是 `NotificationMqProducer.sendNotificationEvent()`、`ActivityAdminService.setNotificationProducer()` 和带通知依赖的 `SessionAdminService` 构造器尚未实现。
- 绿灯：同一命令通过，`Tests run: 35, Failures: 0, Errors: 0, Skipped: 0`。
- `java-ticket` 完整测试：`mvn -pl java-ticket -am test` 通过，`Tests run: 1019, Failures: 0, Errors: 0, Skipped: 0`。
- 通知消费定向：`mvn -pl java-notification -am test "-Dtest=NotificationEventServiceTest,NotificationMessageListenerTest" "-Dsurefire.failIfNoSpecifiedTests=false"` 通过，`Tests run: 7, Failures: 0, Errors: 0, Skipped: 0`。
- 边界验收：`powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1` 通过，所有 microservice boundary checks passed。
- 空白检查：`git diff --check` 退出码为 0，仅有 Windows CRLF warning。

---

## Task 6: 前端通知偏好与用户可见闭环

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/types/api.ts`
- Create or modify: `frontend/src/app/notifications/settings/page.tsx`
- Modify current notification list/header entry files.

- [x] **Step 1: 入口审计**

定位当前通知中心、消息铃铛和账户设置入口。

- [x] **Step 2: 新增通知偏好页最小闭环**

第一轮只展示：

- 站内通知：默认开启且不可关闭。
- 短信通知：显示“暂未接入短信供应商”，不可开启。

用户可见文案必须中文，不显示 provider、DLQ、eventId 等技术字段。

- [x] **Step 3: 浏览器验收**

打开通知中心和通知偏好页，确认：

- 通知列表仍可查看和标记已读。
- 偏好页不会误导用户以为短信已经可用。

本地验证记录（2026-06-07）：

- 红灯：`node --test src/components/notification-state.test.ts src/lib/api.test.ts` 按预期失败，原因是 `GRAB_SUCCESS`、`GRAB_FAILED`、`WAITLIST_MATCHED`、`ORDER_PAYMENT_TIMEOUT`、`ACTIVITY_RESCHEDULED`、`ACTIVITY_CANCELLED` 尚未映射，且 `getNotificationPreferences()` 尚未导出。
- 绿灯：同一前端定向测试通过，`tests 38, pass 38`。
- 前端类型检查：`pnpm typecheck` 通过。
- 浏览器验收：使用 `http://localhost:3006` 登录测试账号 `13900000001` 后，`/notifications/settings` 显示“站内通知已开启、不可修改”和“短信通知暂未接入短信供应商、不可修改”，通知中心和个人中心均有“通知偏好”入口。
- 通知列表验收：启动 `java-notification:8085` 后，`GET /api/notification/list` 经网关返回 `code=200`，浏览器通知中心展示种子通知、未读标记、“全部已读”和“删除已读”按钮。为避免改动本地种子数据状态，未点击写入型按钮。
- 运行时修复：浏览器验收启动通知服务时发现 `NotificationEventService` 构造器未标记注入、`SmsSender` 默认 Bean 未注册，已补 `@Autowired` 构造器测试和 `SmsSenderConfig` 默认禁用短信 Bean 测试。
- 后端通知服务测试：`mvn -pl java-notification -am test` 通过，`Tests run: 49, Failures: 0, Errors: 0, Skipped: 0`。
- 边界验收：`powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1` 通过。
- 空白检查：`git diff --check` 退出码为 0，仅有 Windows CRLF warning。

---

## 验证命令

每完成一个后端任务至少运行：

```powershell
cd java
mvn -pl java-common,java-notification -am test "-Dtest=NotificationEventMessageTest,MqConfigTest,NotificationServiceTest,NotificationEventServiceTest,NotificationMessageListenerTest,DisabledSmsSenderTest" "-Dsurefire.failIfNoSpecifiedTests=false"
```

涉及数据库迁移后运行：

```powershell
$env:PGPASSWORD='123456'
psql -h localhost -p 5432 -U postgres -d omni_notification -c "\d notification_delivery"
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
```

涉及前端后运行：

```powershell
cd frontend
node --test src/lib/api.test.ts
pnpm typecheck
```

涉及页面后用浏览器打开真实页面验证，不能只看后端测试。

## 风险与回退

- 事件模型引入后旧消息仍保留，任一业务迁移失败可回退到 `NotificationMessage`。
- SMS 未配置时只写 `SKIPPED`，不影响站内通知。
- `notification_delivery` 唯一索引可以防重复投递，但不替代业务事务幂等。
- Redis 频控放后续，避免第一轮把通知投递依赖变复杂。
- 真实 SMS SDK 接入前必须单独确认依赖下载、环境变量、资费、限额、签名模板审核和关闭方案。

## 完成标志

- `NotificationEventMessage` 已在 common 中可用。
- `java-notification` 可以同时消费旧消息和新事件。
- `notification_delivery` 在本地 `omni_notification` 已迁移。
- `IN_APP` 稳定写入站内通知。
- `SMS` 未配置时记录 `SKIPPED`，不影响站内通知。
- `SUPPORT_REPLY`、退款、抢票、候补、改期/取消至少完成站内通知覆盖。
- 前端有通知偏好入口，且文案不误导用户短信已接入。
