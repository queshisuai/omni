# Support Workbench Queue SLA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 先完成客服高频使用所需的会话队列、客服可见范围和 SLA 倒计时，后续再接备注、标签、快捷回复、转接和审计。

**Architecture:** 后端以 `CustomerSupportService` 作为唯一队列与 SLA 计算入口，数据库在 `support_conversation` 上补充 SLA 时间戳，避免前端重复推导业务状态。前端 `/support` 只负责展示队列、倒计时和操作按钮，管理员 `/console/support-conversations` 继续作为全量记录视角。

**Tech Stack:** Java Spring Boot, MyBatis-Plus, PostgreSQL SQL migration, Next.js, TypeScript, Node test runner, Maven/JUnit/Mockito。

---

## File Structure

- Modify: `sql/production-split/user/20260602_support_workbench_sla.sql`
  - 新增 SLA 字段和索引，回填历史会话的等待时间戳。
- Modify: `java/java-user/src/main/java/com/omni/user/entity/SupportConversation.java`
  - 映射 SLA 字段。
- Modify: `java/java-user/src/main/java/com/omni/user/dto/SupportConversationResponse.java`
  - 返回 SLA 倒计时、用户等待时长、最后回复时间、是否超时。
- Modify: `java/java-user/src/main/java/com/omni/user/service/CustomerSupportService.java`
  - 队列权限、SLA 字段维护、响应对象计算。
- Modify: `java/java-user/src/main/java/com/omni/user/controller/SupportController.java`
  - `/api/user/support/agent/conversations` 增加 `queue` 参数，保留现有 `status` 兼容。
- Modify: `java/java-user/src/test/java/com/omni/user/service/CustomerSupportServiceTest.java`
  - 覆盖客服只看公共池和自己会话、SLA 超时计算。
- Modify: `frontend/src/types/api.ts`
  - 补充队列和 SLA 字段类型。
- Modify: `frontend/src/lib/api.ts`
  - `listAgentSupportConversations` 支持 `queue` 参数。
- Modify: `frontend/src/lib/support-tools.ts`
  - 队列分组、SLA 格式化、排序工具函数。
- Modify: `frontend/src/lib/support-tools.test.ts`
  - 覆盖前端分组、排序、倒计时文案。
- Modify: `frontend/src/app/support/page.tsx`
  - 客服工作台改为“待处理、处理中、超时、已申请结束、已关闭”五组。
- Modify: `frontend/src/app/console/support-conversations/page.tsx`
  - 管理员记录页展示 SLA 摘要，但不限制全量记录视角。

---

### Task 1: Backend Queue Rules

**Files:**
- Modify: `java/java-user/src/main/java/com/omni/user/service/CustomerSupportService.java`
- Modify: `java/java-user/src/main/java/com/omni/user/controller/SupportController.java`
- Test: `java/java-user/src/test/java/com/omni/user/service/CustomerSupportServiceTest.java`

- [ ] **Step 1: Write failing tests for support-agent visibility**

Add these tests to `CustomerSupportServiceTest`:

```java
@Test
void supportAgentPendingQueueOnlyShowsUnclaimedWaitingConversations() {
    when(userMapper.selectById(30L)).thenReturn(user(30L, "support"));
    SupportConversation publicWaiting = supportConversation(1L, 10L, "WAITING_AGENT", null);
    SupportConversation assignedWaiting = supportConversation(2L, 11L, "WAITING_AGENT", 31L);
    SupportConversation ownAssigned = supportConversation(3L, 12L, "ASSIGNED", 30L);
    when(conversationMapper.selectList(any())).thenReturn(List.of(publicWaiting, assignedWaiting, ownAssigned));

    List<SupportConversationResponse> response = service.listAgentConversations(30L, null, "pending");

    assertEquals(List.of(1L), response.stream().map(SupportConversationResponse::getId).toList());
}

@Test
void supportAgentInProgressQueueOnlyShowsOwnAssignedConversations() {
    when(userMapper.selectById(30L)).thenReturn(user(30L, "support"));
    SupportConversation ownAssigned = supportConversation(1L, 10L, "ASSIGNED", 30L);
    SupportConversation otherAssigned = supportConversation(2L, 11L, "ASSIGNED", 31L);
    SupportConversation publicWaiting = supportConversation(3L, 12L, "WAITING_AGENT", null);
    when(conversationMapper.selectList(any())).thenReturn(List.of(ownAssigned, otherAssigned, publicWaiting));

    List<SupportConversationResponse> response = service.listAgentConversations(30L, null, "in_progress");

    assertEquals(List.of(1L), response.stream().map(SupportConversationResponse::getId).toList());
}

private SupportConversation supportConversation(Long id, Long userId, String status, Long assignedAgentId) {
    SupportConversation conversation = new SupportConversation();
    conversation.setId(id);
    conversation.setUserId(userId);
    conversation.setStatus(status);
    conversation.setSourceType("HUMAN");
    conversation.setAssignedAgentId(assignedAgentId);
    conversation.setCreateTime(LocalDateTime.of(2026, 6, 2, 10, 0));
    conversation.setUpdateTime(LocalDateTime.of(2026, 6, 2, 10, 0));
    return conversation;
}
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
cd java
mvn -pl java-user "-Dtest=CustomerSupportServiceTest#supportAgentPendingQueueOnlyShowsUnclaimedWaitingConversations+CustomerSupportServiceTest#supportAgentInProgressQueueOnlyShowsOwnAssignedConversations" test
```

Expected: compile failure or test failure because `listAgentConversations(Long, String, String)` does not exist yet.

- [ ] **Step 3: Implement queue parameter**

Change controller method:

```java
@GetMapping("/support/agent/conversations")
public Result<List<SupportConversationResponse>> listAgentConversations(
        @RequestHeader(value = "Authorization", required = false) String authorization,
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String queue) {
    Long userId = parseUserId(authorization);
    if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
    return Result.success(customerSupportService.listAgentConversations(userId, status, queue));
}
```

Keep the old service signature as a delegating overload:

```java
public List<SupportConversationResponse> listAgentConversations(Long agentUserId, String status) {
    return listAgentConversations(agentUserId, status, null);
}
```

Implement queue filtering after DB fetch so existing Mockito tests remain simple:

```java
public List<SupportConversationResponse> listAgentConversations(Long agentUserId, String status, String queue) {
    User agent = requireSupportOrAdmin(agentUserId);
    String normalizedStatus = trimToNull(status);
    String normalizedQueue = trimToNull(queue);
    LambdaQueryWrapper<SupportConversation> wrapper = new LambdaQueryWrapper<SupportConversation>()
            .orderByDesc(SupportConversation::getUpdateTime)
            .orderByDesc(SupportConversation::getId);
    if (normalizedStatus != null) {
        wrapper.eq(SupportConversation::getStatus, normalizedStatus);
    } else {
        wrapper.ne(SupportConversation::getStatus, STATUS_CLOSED);
    }
    if (ROLE_SUPPORT.equals(agent.getRole()) && normalizedQueue == null && normalizedStatus == null) {
        wrapper.and(w -> w.eq(SupportConversation::getStatus, STATUS_WAITING_AGENT)
                .isNull(SupportConversation::getAssignedAgentId)
                .or()
                .eq(SupportConversation::getAssignedAgentId, agentUserId));
    }
    return conversationMapper.selectList(wrapper).stream()
            .filter(conversation -> isVisibleInAgentQueue(conversation, agent, agentUserId, normalizedStatus, normalizedQueue))
            .map(this::toConversationResponse)
            .collect(Collectors.toList());
}
```

Add helper:

```java
private boolean isVisibleInAgentQueue(SupportConversation conversation, User agent, Long agentUserId, String status, String queue) {
    if (!ROLE_SUPPORT.equals(agent.getRole())) return true;
    if (status != null) {
        if (STATUS_WAITING_AGENT.equals(status)) {
            return conversation.getAssignedAgentId() == null;
        }
        return agentUserId.equals(conversation.getAssignedAgentId());
    }
    if ("pending".equals(queue)) {
        return STATUS_WAITING_AGENT.equals(conversation.getStatus()) && conversation.getAssignedAgentId() == null;
    }
    if ("in_progress".equals(queue)) {
        return STATUS_ASSIGNED.equals(conversation.getStatus()) && agentUserId.equals(conversation.getAssignedAgentId());
    }
    if ("close_requested".equals(queue)) {
        return STATUS_CLOSE_REQUESTED.equals(conversation.getStatus()) && agentUserId.equals(conversation.getAssignedAgentId());
    }
    if ("closed".equals(queue)) {
        return STATUS_CLOSED.equals(conversation.getStatus()) && agentUserId.equals(conversation.getAssignedAgentId());
    }
    return (STATUS_WAITING_AGENT.equals(conversation.getStatus()) && conversation.getAssignedAgentId() == null)
            || agentUserId.equals(conversation.getAssignedAgentId());
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```powershell
cd java
mvn -pl java-user "-Dtest=CustomerSupportServiceTest#supportAgentPendingQueueOnlyShowsUnclaimedWaitingConversations+CustomerSupportServiceTest#supportAgentInProgressQueueOnlyShowsOwnAssignedConversations" test
```

Expected: 2 tests pass.

---

### Task 2: Backend SLA Fields and Computation

**Files:**
- Create: `sql/production-split/user/20260602_support_workbench_sla.sql`
- Modify: `java/java-user/src/main/java/com/omni/user/entity/SupportConversation.java`
- Modify: `java/java-user/src/main/java/com/omni/user/dto/SupportConversationResponse.java`
- Modify: `java/java-user/src/main/java/com/omni/user/service/CustomerSupportService.java`
- Test: `java/java-user/src/test/java/com/omni/user/service/CustomerSupportServiceTest.java`

- [ ] **Step 1: Write failing SLA response test**

Add:

```java
@Test
void responseIncludesSlaWhenHumanConversationWaitsForFirstResponse() {
    when(userMapper.selectById(30L)).thenReturn(user(30L, "support"));
    SupportConversation conversation = supportConversation(1L, 10L, "WAITING_AGENT", null);
    conversation.setFirstResponseDueAt(LocalDateTime.of(2026, 6, 2, 10, 5));
    conversation.setLastUserMessageAt(LocalDateTime.of(2026, 6, 2, 10, 0));
    when(conversationMapper.selectList(any())).thenReturn(List.of(conversation));

    List<SupportConversationResponse> response = service.listAgentConversations(30L, null, "pending");

    assertEquals(LocalDateTime.of(2026, 6, 2, 10, 5), response.get(0).getFirstResponseDueAt());
    assertTrue(response.get(0).getUserWaitingSeconds() >= 0);
}
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
cd java
mvn -pl java-user "-Dtest=CustomerSupportServiceTest#responseIncludesSlaWhenHumanConversationWaitsForFirstResponse" test
```

Expected: compile failure because SLA fields are not defined.

- [ ] **Step 3: Add SQL migration**

Create `sql/production-split/user/20260602_support_workbench_sla.sql`:

```sql
-- owner: java-user

ALTER TABLE support_conversation
    ADD COLUMN IF NOT EXISTS first_response_due_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS first_agent_replied_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS last_user_message_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS last_agent_message_at TIMESTAMP;

UPDATE support_conversation c
SET first_response_due_at = COALESCE(first_response_due_at, c.create_time + INTERVAL '5 minutes')
WHERE c.source_type = 'HUMAN'
  AND c.status IN ('WAITING_AGENT', 'ASSIGNED', 'CLOSE_REQUESTED');

UPDATE support_conversation c
SET last_user_message_at = m.last_user_message_at
FROM (
    SELECT conversation_id, MAX(create_time) AS last_user_message_at
    FROM support_message
    WHERE sender_type = 'USER'
    GROUP BY conversation_id
) m
WHERE c.id = m.conversation_id
  AND c.last_user_message_at IS NULL;

UPDATE support_conversation c
SET last_agent_message_at = m.last_agent_message_at,
    first_agent_replied_at = COALESCE(c.first_agent_replied_at, m.first_agent_replied_at)
FROM (
    SELECT
        conversation_id,
        MIN(create_time) AS first_agent_replied_at,
        MAX(create_time) AS last_agent_message_at
    FROM support_message
    WHERE sender_type = 'AGENT'
    GROUP BY conversation_id
) m
WHERE c.id = m.conversation_id;

CREATE INDEX IF NOT EXISTS idx_support_conversation_sla_due
    ON support_conversation(status, first_response_due_at, update_time DESC);

CREATE INDEX IF NOT EXISTS idx_support_conversation_last_user_message
    ON support_conversation(status, last_user_message_at DESC);
```

- [ ] **Step 4: Add entity and DTO fields**

In `SupportConversation`, add:

```java
private LocalDateTime firstResponseDueAt;
private LocalDateTime firstAgentRepliedAt;
private LocalDateTime lastUserMessageAt;
private LocalDateTime lastAgentMessageAt;

public LocalDateTime getFirstResponseDueAt() { return firstResponseDueAt; }
public void setFirstResponseDueAt(LocalDateTime firstResponseDueAt) { this.firstResponseDueAt = firstResponseDueAt; }
public LocalDateTime getFirstAgentRepliedAt() { return firstAgentRepliedAt; }
public void setFirstAgentRepliedAt(LocalDateTime firstAgentRepliedAt) { this.firstAgentRepliedAt = firstAgentRepliedAt; }
public LocalDateTime getLastUserMessageAt() { return lastUserMessageAt; }
public void setLastUserMessageAt(LocalDateTime lastUserMessageAt) { this.lastUserMessageAt = lastUserMessageAt; }
public LocalDateTime getLastAgentMessageAt() { return lastAgentMessageAt; }
public void setLastAgentMessageAt(LocalDateTime lastAgentMessageAt) { this.lastAgentMessageAt = lastAgentMessageAt; }
```

In `SupportConversationResponse`, add the same four `LocalDateTime` fields plus:

```java
private Long userWaitingSeconds;
private Boolean slaOverdue;

public Long getUserWaitingSeconds() { return userWaitingSeconds; }
public void setUserWaitingSeconds(Long userWaitingSeconds) { this.userWaitingSeconds = userWaitingSeconds; }
public Boolean getSlaOverdue() { return slaOverdue; }
public void setSlaOverdue(Boolean slaOverdue) { this.slaOverdue = slaOverdue; }
```

- [ ] **Step 5: Maintain SLA timestamps**

In `startConversation`, when `preferHuman` is true:

```java
if (preferHuman) {
    LocalDateTime now = LocalDateTime.now();
    conversation.setFirstResponseDueAt(now.plusMinutes(5));
    if (initialMessage != null) {
        conversation.setLastUserMessageAt(now);
    }
}
```

In `sendMessage`, after inserting the message:

```java
LocalDateTime messageTime = message.getCreateTime() == null ? LocalDateTime.now() : message.getCreateTime();
if ("USER".equals(senderType)) {
    conversation.setLastUserMessageAt(messageTime);
}
if ("AGENT".equals(senderType)) {
    if (conversation.getFirstAgentRepliedAt() == null) {
        conversation.setFirstAgentRepliedAt(messageTime);
    }
    conversation.setLastAgentMessageAt(messageTime);
}
```

In `handoff`, set first-response due date if missing:

```java
if (conversation.getFirstResponseDueAt() == null) {
    conversation.setFirstResponseDueAt(LocalDateTime.now().plusMinutes(5));
}
```

In `toConversationResponse`, map fields and compute:

```java
response.setFirstResponseDueAt(conversation.getFirstResponseDueAt());
response.setFirstAgentRepliedAt(conversation.getFirstAgentRepliedAt());
response.setLastUserMessageAt(conversation.getLastUserMessageAt());
response.setLastAgentMessageAt(conversation.getLastAgentMessageAt());
response.setUserWaitingSeconds(computeUserWaitingSeconds(conversation, LocalDateTime.now()));
response.setSlaOverdue(isSlaOverdue(conversation, LocalDateTime.now()));
```

Add helpers:

```java
private Long computeUserWaitingSeconds(SupportConversation conversation, LocalDateTime now) {
    if (conversation.getLastUserMessageAt() == null) return null;
    LocalDateTime lastAgent = conversation.getLastAgentMessageAt();
    if (lastAgent != null && !conversation.getLastUserMessageAt().isAfter(lastAgent)) return 0L;
    return Math.max(0L, java.time.Duration.between(conversation.getLastUserMessageAt(), now).getSeconds());
}

private boolean isSlaOverdue(SupportConversation conversation, LocalDateTime now) {
    if (STATUS_CLOSED.equals(conversation.getStatus())) return false;
    if (conversation.getFirstAgentRepliedAt() == null
            && conversation.getFirstResponseDueAt() != null
            && now.isAfter(conversation.getFirstResponseDueAt())) {
        return true;
    }
    Long waitingSeconds = computeUserWaitingSeconds(conversation, now);
    return waitingSeconds != null && waitingSeconds > 10 * 60;
}
```

- [ ] **Step 6: Run SLA tests**

Run:

```powershell
cd java
mvn -pl java-user "-Dtest=CustomerSupportServiceTest#responseIncludesSlaWhenHumanConversationWaitsForFirstResponse" test
```

Expected: test passes.

---

### Task 3: Frontend Queue and SLA Utilities

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/support-tools.ts`
- Test: `frontend/src/lib/support-tools.test.ts`

- [ ] **Step 1: Write failing frontend utility tests**

Add to `support-tools.test.ts`:

```ts
import { getSupportQueueTabs, sortSupportConversationsForQueue, formatSupportSlaText } from './support-tools.ts'

test('groups support conversations into queue tabs', () => {
  const conversations = [
    { id: 1, status: 'WAITING_AGENT', slaOverdue: false },
    { id: 2, status: 'ASSIGNED', slaOverdue: false },
    { id: 3, status: 'ASSIGNED', slaOverdue: true },
    { id: 4, status: 'CLOSE_REQUESTED', slaOverdue: false },
    { id: 5, status: 'CLOSED', slaOverdue: false },
  ] as any[]

  const tabs = getSupportQueueTabs(conversations)

  assert.deepEqual(tabs.map(tab => [tab.value, tab.count]), [
    ['pending', 1],
    ['in_progress', 1],
    ['overdue', 1],
    ['close_requested', 1],
    ['closed', 1],
  ])
})

test('sorts urgent support conversations first', () => {
  const sorted = sortSupportConversationsForQueue([
    { id: 1, status: 'WAITING_AGENT', slaOverdue: false, updateTime: '2026-06-02T10:00:00' },
    { id: 2, status: 'ASSIGNED', slaOverdue: true, updateTime: '2026-06-02T09:00:00' },
  ] as any[])

  assert.deepEqual(sorted.map(item => item.id), [2, 1])
})

test('formats SLA text in Chinese', () => {
  assert.equal(formatSupportSlaText({ status: 'WAITING_AGENT', firstResponseDueAt: '2026-06-02T10:05:00', slaOverdue: false } as any, new Date('2026-06-02T10:03:00')), '首次响应剩余 2 分钟')
  assert.equal(formatSupportSlaText({ status: 'ASSIGNED', userWaitingSeconds: 660, slaOverdue: true } as any, new Date('2026-06-02T10:03:00')), '用户已等待 11 分钟')
})
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
node --test frontend/src/lib/support-tools.test.ts
```

Expected: test fails because these functions do not exist.

- [ ] **Step 3: Add frontend types and API parameter**

In `api.ts`, extend `SupportConversationVO`:

```ts
firstResponseDueAt?: string | null
firstAgentRepliedAt?: string | null
lastUserMessageAt?: string | null
lastAgentMessageAt?: string | null
userWaitingSeconds?: number | null
slaOverdue?: boolean | null
```

In `frontend/src/lib/api.ts`:

```ts
export async function listAgentSupportConversations(statusOrOptions?: string | { status?: string; queue?: string }) {
  const params = new URLSearchParams()
  if (typeof statusOrOptions === 'string') {
    params.set('status', statusOrOptions)
  } else {
    if (statusOrOptions?.status) params.set('status', statusOrOptions.status)
    if (statusOrOptions?.queue) params.set('queue', statusOrOptions.queue)
  }
  const qs = params.toString()
  return request<import('@/types/api').SupportConversationVO[]>(`/api/user/support/agent/conversations${qs ? `?${qs}` : ''}`)
}
```

- [ ] **Step 4: Add queue utilities**

In `support-tools.ts`:

```ts
export type SupportQueueFilter = 'pending' | 'in_progress' | 'overdue' | 'close_requested' | 'closed'

export function getSupportQueueTabs(conversations: SupportConversationVO[]) {
  const tabs: Array<{ value: SupportQueueFilter; label: string; count: number }> = [
    { value: 'pending', label: '待处理', count: 0 },
    { value: 'in_progress', label: '处理中', count: 0 },
    { value: 'overdue', label: '超时', count: 0 },
    { value: 'close_requested', label: '已申请结束', count: 0 },
    { value: 'closed', label: '已关闭', count: 0 },
  ]
  for (const item of conversations) {
    if (item.status === 'CLOSED') tabs[4].count += 1
    else if (item.slaOverdue) tabs[2].count += 1
    else if (item.status === 'WAITING_AGENT') tabs[0].count += 1
    else if (item.status === 'CLOSE_REQUESTED') tabs[3].count += 1
    else if (item.status === 'ASSIGNED') tabs[1].count += 1
  }
  return tabs
}

export function sortSupportConversationsForQueue<T extends Pick<SupportConversationVO, 'slaOverdue' | 'updateTime' | 'createTime'>>(items: T[]) {
  return [...items].sort((a, b) => {
    if (Boolean(a.slaOverdue) !== Boolean(b.slaOverdue)) return a.slaOverdue ? -1 : 1
    const left = new Date(a.updateTime || a.createTime || 0).getTime()
    const right = new Date(b.updateTime || b.createTime || 0).getTime()
    return right - left
  })
}

export function formatSupportSlaText(conversation: SupportConversationVO, now = new Date()) {
  if (conversation.userWaitingSeconds && conversation.userWaitingSeconds > 0) {
    return `用户已等待 ${Math.ceil(conversation.userWaitingSeconds / 60)} 分钟`
  }
  if (conversation.firstResponseDueAt && !conversation.firstAgentRepliedAt) {
    const due = new Date(conversation.firstResponseDueAt).getTime()
    const remainingMinutes = Math.max(0, Math.ceil((due - now.getTime()) / 60000))
    return conversation.slaOverdue ? '首次响应已超时' : `首次响应剩余 ${remainingMinutes} 分钟`
  }
  if (conversation.lastAgentMessageAt) return `最后回复：${formatSupportRelativeMinute(conversation.lastAgentMessageAt, now)}`
  return '等待会话更新'
}

function formatSupportRelativeMinute(value: string, now: Date) {
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return value
  const minutes = Math.max(0, Math.floor((now.getTime() - time) / 60000))
  return minutes === 0 ? '刚刚' : `${minutes} 分钟前`
}
```

- [ ] **Step 5: Run frontend utility tests**

Run:

```powershell
node --test frontend/src/lib/support-tools.test.ts
```

Expected: tests pass.

---

### Task 4: Support Workbench UI

**Files:**
- Modify: `frontend/src/app/support/page.tsx`

- [ ] **Step 1: Replace three-tab workbench with five queue tabs**

Use `SupportQueueFilter`, `getSupportQueueTabs`, `formatSupportSlaText`, and `sortSupportConversationsForQueue`.

Core state shape:

```ts
const [conversationFilter, setConversationFilter] = useState<SupportQueueFilter>('pending')
```

Load current queue plus closed history:

```ts
const loadConversations = async () => {
  const [pending, inProgress, overdue, closeRequested, closed] = await Promise.all([
    listAgentSupportConversations({ queue: 'pending' }),
    listAgentSupportConversations({ queue: 'in_progress' }),
    listAgentSupportConversations({ queue: 'overdue' }),
    listAgentSupportConversations({ queue: 'close_requested' }),
    listAgentSupportConversations({ queue: 'closed' }),
  ])
  const data = mergeSupportConversations([
    ...(pending || []),
    ...(inProgress || []),
    ...(overdue || []),
    ...(closeRequested || []),
    ...(closed || []),
  ])
  setConversations(sortSupportConversationsForQueue(data))
  setActive(current => current ? data.find(item => item.id === current.id) || data[0] || null : data[0] || null)
}
```

Filter visible rows:

```ts
const visibleConversations = useMemo(() => {
  return sortSupportConversationsForQueue(conversations.filter(item => {
    if (conversationFilter === 'closed') return item.status === 'CLOSED'
    if (conversationFilter === 'overdue') return item.status !== 'CLOSED' && Boolean(item.slaOverdue)
    if (conversationFilter === 'pending') return item.status === 'WAITING_AGENT' && !item.slaOverdue
    if (conversationFilter === 'close_requested') return item.status === 'CLOSE_REQUESTED' && !item.slaOverdue
    return item.status === 'ASSIGNED' && !item.slaOverdue
  }))
}, [conversations, conversationFilter])
```

In each conversation card, add SLA line:

```tsx
<div className={`mt-2 text-[12px] ${item.slaOverdue ? 'text-red-500' : 'text-gray-400'}`}>
  {formatSupportSlaText(item)}
</div>
```

- [ ] **Step 2: Ensure visible Chinese copy**

Use these visible labels exactly:

```ts
待处理
处理中
超时
已申请结束
已关闭
首次响应已超时
用户已等待
最后回复
```

- [ ] **Step 3: Run frontend checks**

Run:

```powershell
node --test frontend/src/lib/support-tools.test.ts
cd frontend
npm run typecheck
```

Expected: tests pass and typecheck exits 0.

---

### Task 5: Admin Conversation Records SLA Summary

**Files:**
- Modify: `frontend/src/app/console/support-conversations/page.tsx`

- [ ] **Step 1: Keep admin full view but show SLA**

Do not apply support-agent queue ownership filtering in admin page. Add SLA summary beside status:

```tsx
<span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${
  item.slaOverdue ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-500'
}`}>
  {formatSupportSlaText(item)}
</span>
```

- [ ] **Step 2: Keep admin loading all active and closed conversations**

Keep:

```ts
const [activeItems, closedItems] = await Promise.all([
  listAgentSupportConversations(),
  listAgentSupportConversations('CLOSED'),
])
```

This preserves administrator all-records behavior while backend still restricts real support accounts.

- [ ] **Step 3: Run frontend checks**

Run:

```powershell
node --test frontend/src/lib/support-tools.test.ts
cd frontend
npm run typecheck
```

Expected: tests pass and typecheck exits 0.

---

### Task 6: Final Verification

**Files:**
- All files touched above.

- [ ] **Step 1: Run focused backend tests**

Run:

```powershell
cd java
mvn -pl java-user "-Dtest=CustomerSupportServiceTest" test
```

Expected: `CustomerSupportServiceTest` passes.

- [ ] **Step 2: Run focused frontend tests**

Run:

```powershell
node --test frontend/src/lib/support-tools.test.ts
```

Expected: support-tools tests pass.

- [ ] **Step 3: Run frontend typecheck**

Run:

```powershell
cd frontend
npm run typecheck
```

Expected: typecheck exits 0.

- [ ] **Step 4: Run SQL split check**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\check-production-split-sql.ps1
```

Expected: SQL split check passes.

- [ ] **Step 5: Manual smoke path**

Start the existing local stack only if it is already configured locally. Do not download dependencies or pull Docker images without user authorization.

Smoke checklist:

- 客服 A 登录 `/support`，能看到公共池“待处理”会话。
- 客服 A 接入后，会话进入“处理中”。
- 客服 B 登录 `/support`，看不到客服 A 的“处理中”会话。
- 管理员进入 `/console/support-conversations`，能看到全部会话和 SLA 摘要。
- SLA 超时会话显示在“超时”分组。

---

## Self-Review

- Spec coverage:
  - 已覆盖队列分组：待处理、处理中、超时、已申请结束、已关闭。
  - 已覆盖客服账号可见范围：公共池未接入会话 + 自己处理中会话。
  - 已覆盖 SLA：首次响应、用户等待时长、最后回复时间、超时标记。
  - 未纳入备注、标签、快捷回复、转接、结束原因和审计；这些属于下一轮阶段 3/4。
- Placeholder scan:
  - 未发现占位式步骤或空泛实现说明。
  - 每个任务都有明确文件、测试命令和期望结果。
- Type consistency:
  - 后端字段：`firstResponseDueAt`、`firstAgentRepliedAt`、`lastUserMessageAt`、`lastAgentMessageAt`、`userWaitingSeconds`、`slaOverdue`。
  - 前端字段与后端 DTO JSON 命名一致。
  - 队列值统一为 `pending`、`in_progress`、`overdue`、`close_requested`、`closed`。
