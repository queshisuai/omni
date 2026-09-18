# Copilot 客服工作台前端接入实施计划

> **For agentic workers:** 本计划按当前会话直接执行，不创建提交。每个步骤完成后运行对应验证命令并保留现有用户改动。

**目标：** 在现有 B 端客服工作台接入 Copilot，并补齐人工回复编辑、发送和会话隔离闭环。

**架构：** 新增 `SupportCopilotPanel` 管理 AI 建议状态和 Copilot API；`sessions/page.tsx` 继续管理选中会话、消息、人工 `replyDraft` 和 `sendSupportMessage(selectedSession.id, replyDraft)`。Accept/Edit/Reject 只调用 Copilot API，人工发送只走既有 `/messages`。

**技术栈：** Next.js 16、React 19、TypeScript、Tailwind、`lucide-react`、现有 `request<T>()`、Node `node:test`。

---

## 文件结构

- Create: `frontend/src/components/customer-service/SupportCopilotPanel.tsx`
  - 独立渲染 Copilot 面板，管理 Generate/Accept/Edit/Reject、状态、错误和过期操作。
- Create: `frontend/src/lib/customer-service-copilot.ts`
  - 存放 Copilot 状态类型、权限判断、HTTP 错误中文文案和消息快照比较等无副作用辅助函数。
- Create: `frontend/src/lib/customer-service-copilot.test.ts`
  - 使用 `node:test` 覆盖纯函数和源码级契约，验证 Accept 不发送、状态隔离和错误映射。
- Modify: `frontend/src/types/api.ts`
  - 增加基于 Java Controller Response DTO JSON 的 Copilot 类型。
- Modify: `frontend/src/lib/api.ts`
  - 仅在现有 `request<T>()` 基础设施上增加四个 Copilot API 方法；不改 `request<T>()`。
- Modify: `frontend/src/app/console/customer-service/sessions/page.tsx`
  - 增加人工回复编辑器/发送、挂载 Copilot、会话切换清理和消息更新提示。
- Modify: `frontend/src/lib/customer-service-workbench.test.ts`
  - 增加工作台结构契约，确认人工发送链路和 Copilot 面板接入。
- Modify: `implementation-notes.md`
  - 记录 Phase ⑤-3 实现范围、偏离和验证结果。

## Task 1: 锁定 DTO 类型与 API 契约

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`
- Test: `frontend/src/lib/customer-service-copilot.test.ts`

- [ ] **Step 1: 先确认 Controller Response JSON 来源**

读取并核对以下文件：

```powershell
Get-Content -Raw java/java-user/src/main/java/com/omni/user/controller/CsCopilotController.java
Get-Content -Raw java/java-user/src/main/java/com/omni/user/dto/CsCopilotSuggestionResponse.java
Get-Content -Raw java/java-user/src/main/java/com/omni/user/dto/CsCopilotSourceEvidenceResponse.java
Get-Content -Raw java/java-user/src/main/java/com/omni/user/dto/CsCopilotEditRequest.java
Get-Content -Raw java/java-user/src/main/java/com/omni/user/dto/CsCopilotRejectRequest.java
```

类型必须以 `CsCopilotSuggestionResponse` 的 getter 属性名对应的 JSON 为准：

```ts
export type SupportAiSuggestionStatus =
  | 'GENERATING'
  | 'READY'
  | 'ACCEPTED'
  | 'ACCEPTED_EDITED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'FAILED'

export interface CsCopilotSourceEvidenceResponse {
  factKey: string
  text: string
}

export interface SupportAiSuggestion {
  suggestionId: number
  conversationId: number
  agentId: number
  messageCutoff: number | null
  contextDigest: string | null
  status: SupportAiSuggestionStatus
  suggestionText: string | null
  summary: string | null
  issueType: string | null
  recommendedAction: string | null
  missingInformation: string[]
  sourceEvidence: CsCopilotSourceEvidenceResponse[]
  editedText: string | null
  createTime: string | null
  updateTime: string | null
  acceptedAt: string | null
  editedAt: string | null
  rejectedAt: string | null
}

export interface CsCopilotEditRequest {
  editedText: string
}

export interface CsCopilotRejectRequest {
  reason?: string | null
}
```

If the direct DTO inspection shows a field is non-null in the actual response contract, tighten only that field; do not derive types from `SupportAiSuggestion` entity.

- [ ] **Step 2: Add the four API methods without changing `request<T>()`**

Add imports for the new types and add the following methods near the existing CS API methods:

```ts
export async function generateCsCopilotSuggestion(sessionId: number) {
  assertPositiveInteger(sessionId, '客服会话编号')
  return request<SupportAiSuggestion>(`/api/user/cs/sessions/${sessionId}/copilot/suggestions`, {
    method: 'POST',
  }, { timeoutMs: 70000 })
}

export async function acceptCsCopilotSuggestion(suggestionId: number) {
  assertPositiveInteger(suggestionId, 'AI 建议编号')
  return request<SupportAiSuggestion>(`/api/user/cs/copilot/suggestions/${suggestionId}/accept`, {
    method: 'POST',
  }, { timeoutMs: 70000 })
}

export async function editCsCopilotSuggestion(suggestionId: number, body: CsCopilotEditRequest) {
  assertPositiveInteger(suggestionId, 'AI 建议编号')
  return request<SupportAiSuggestion>(`/api/user/cs/copilot/suggestions/${suggestionId}/edit`, {
    method: 'POST',
    body: JSON.stringify(body),
  }, { timeoutMs: 70000 })
}

export async function rejectCsCopilotSuggestion(suggestionId: number, body: CsCopilotRejectRequest = {}) {
  assertPositiveInteger(suggestionId, 'AI 建议编号')
  return request<SupportAiSuggestion>(`/api/user/cs/copilot/suggestions/${suggestionId}/reject`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
```

Use the repository's existing timeout convention if the direct API inspection shows a different timeout requirement. Do not add a second fetch wrapper, axios, or direct `fetch`.

- [ ] **Step 3: Add the API contract tests**

Extend `customer-service-copilot.test.ts` with a source contract test:

```ts
test('Copilot API 复用 request 并使用四条真实路径', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/lib/api.ts'), 'utf8')
  assert.match(source, /generateCsCopilotSuggestion/)
  assert.match(source, /acceptCsCopilotSuggestion/)
  assert.match(source, /editCsCopilotSuggestion/)
  assert.match(source, /rejectCsCopilotSuggestion/)
  assert.match(source, /\/api\/user\/cs\/sessions\/\$\{sessionId\}\/copilot\/suggestions/)
  assert.match(source, /\/api\/user\/cs\/copilot\/suggestions\/\$\{suggestionId\}\/accept/)
  assert.match(source, /\/api\/user\/cs\/copilot\/suggestions\/\$\{suggestionId\}\/edit/)
  assert.match(source, /\/api\/user\/cs\/copilot\/suggestions\/\$\{suggestionId\}\/reject/)
  assert.doesNotMatch(source, /axios/)
})
```

- [ ] **Step 4: Run the focused contract test**

Run:

```powershell
cd frontend
node --test src/lib/customer-service-copilot.test.ts
```

Expected: the test passes after the types and methods exist.

## Task 2: Add Copilot pure helpers and failing behavior tests

**Files:**
- Create: `frontend/src/lib/customer-service-copilot.ts`
- Modify: `frontend/src/lib/customer-service-copilot.test.ts`

- [ ] **Step 1: Add pure helper contracts**

Implement:

```ts
import type { SupportAiSuggestionStatus } from '../types/api.ts'

export function canUseSupportCopilot(
  role: string | null | undefined,
  permissionCodes: string[] = [],
) {
  void role
  return permissionCodes.includes('support.ai.use')
}

export function getCopilotErrorMessage(code: number) {
  if (code === 409) return '会话内容已发生变化，当前 AI 建议已失效，请重新生成。'
  if (code === 502) return 'AI 返回内容未通过系统事实校验，请重新生成。'
  if (code === 503) return 'AI 服务暂时不可用，请稍后重试。'
  return 'AI 建议处理失败，请稍后重试。'
}

export function canActOnSuggestion(status: SupportAiSuggestionStatus) {
  return status === 'READY' || status === 'ACCEPTED'
}

export function isCopilotDraftStatus(status: SupportAiSuggestionStatus) {
  return status === 'READY' || status === 'ACCEPTED' || status === 'ACCEPTED_EDITED'
}

export function haveMessagesChanged(
  previousIds: number[],
  nextIds: number[],
) {
  return previousIds.length !== nextIds.length
    || previousIds.some((id, index) => id !== nextIds[index])
}
```

The helper must not alter a draft or call any API.

- [ ] **Step 2: Write failing pure tests**

Add tests for:

```ts
test('只有 support.ai.use 可以使用 Copilot', () => {
  assert.equal(canUseSupportCopilot('support', []), false)
  assert.equal(canUseSupportCopilot('support', ['support.ai.use']), true)
  assert.equal(canUseSupportCopilot('platform_super_admin', []), false)
})

test('Copilot 错误码映射为中文业务提示', () => {
  assert.equal(getCopilotErrorMessage(409), '会话内容已发生变化，当前 AI 建议已失效，请重新生成。')
  assert.equal(getCopilotErrorMessage(502), 'AI 返回内容未通过系统事实校验，请重新生成。')
  assert.equal(getCopilotErrorMessage(503), 'AI 服务暂时不可用，请稍后重试。')
})

test('仅 READY 和 ACCEPTED 允许旧建议动作', () => {
  assert.equal(canActOnSuggestion('READY'), true)
  assert.equal(canActOnSuggestion('ACCEPTED'), true)
  assert.equal(canActOnSuggestion('EXPIRED'), false)
  assert.equal(canActOnSuggestion('REJECTED'), false)
})

test('消息 ID 序列可检测新消息且空序列稳定', () => {
  assert.equal(haveMessagesChanged([], []), false)
  assert.equal(haveMessagesChanged([1, 2], [1, 2]), false)
  assert.equal(haveMessagesChanged([1, 2], [1, 2, 3]), true)
  assert.equal(haveMessagesChanged([1, 2], [1, 4]), true)
})
```

- [ ] **Step 3: Run the pure tests**

Run:

```powershell
cd frontend
node --test src/lib/customer-service-copilot.test.ts
```

Expected: PASS.

## Task 3: Implement `SupportCopilotPanel`

**Files:**
- Create: `frontend/src/components/customer-service/SupportCopilotPanel.tsx`
- Modify: `frontend/src/lib/customer-service-copilot.test.ts`

- [ ] **Step 1: Implement state and request isolation**

The component props must be:

```ts
type SupportCopilotPanelProps = {
  sessionId: number
  canUse: boolean
  onDraftChange: (draft: string) => void
}
```

Maintain:

```ts
const [suggestion, setSuggestion] = useState<SupportAiSuggestion | null>(null)
const [loadingAction, setLoadingAction] = useState<'generate' | 'accept' | 'edit' | 'reject' | null>(null)
const [error, setError] = useState('')
const [editDraft, setEditDraft] = useState('')
const requestSessionRef = useRef(sessionId)
```

On `sessionId` change:

```ts
useEffect(() => {
  requestSessionRef.current = sessionId
  setSuggestion(null)
  setEditDraft('')
  setError('')
  setLoadingAction(null)
}, [sessionId])
```

Every async action captures `const requestedSessionId = sessionId` and only writes state when `requestSessionRef.current === requestedSessionId`. Copilot API response data must be ignored after a session switch.

- [ ] **Step 2: Implement Generate**

Generate must:

```ts
const requestedSessionId = sessionId
setLoadingAction('generate')
setError('')
try {
  const result = await generateCsCopilotSuggestion(requestedSessionId)
  if (requestSessionRef.current !== requestedSessionId) return
  setSuggestion(result)
} catch (error) {
  if (requestSessionRef.current === requestedSessionId) {
    setError(getCopilotErrorMessage(getApiErrorCode(error)))
  }
} finally {
  if (requestSessionRef.current === requestedSessionId) setLoadingAction(null)
}
```

Use a typed `getApiErrorCode(error: unknown): number | null` helper that reads `ApiError.code` only when `error instanceof ApiError`; `getCopilotErrorMessage` accepts `number | null`, and unknown errors use the generic Chinese message.

Do not show Generate when `canUse` is false. When no suggestion exists show “AI 智能助手”, “暂无 AI 回复建议” and “生成 AI 回复建议”.

- [ ] **Step 3: Implement READY, ACCEPTED and ACCEPTED_EDITED UI**

Render:

- `suggestionText` as “AI 回复建议”;
- `summary` as “问题摘要”;
- `issueType` as “问题类型”;
- `recommendedAction` as “建议动作”;
- `missingInformation` as a Chinese bullet list;
- `sourceEvidence` using each backend `text`, with `factKey` only as a technical secondary label;
- a visible “AI 建议尚未发送” marker while the draft is not a `support_message`.

For `READY`, buttons are “接受”“编辑”“拒绝”. Because the backend `edit` endpoint only accepts `ACCEPTED`, the READY “编辑” shortcut first calls the same accept transition, loads the suggestion into the human editor, and enters local edit mode; only “保存修改” calls `/copilot/suggestions/{id}/edit`.

For `ACCEPTED`, initialize `editDraft` from `suggestion.editedText || suggestion.suggestionText || ''`, show “已接受 AI 建议，可继续修改”, and provide a text area plus “保存修改”.

For `ACCEPTED_EDITED`, show the edited text in the panel but keep `suggestion.suggestionText` unchanged in state. The artificial draft returned by edit is sent through `onDraftChange`, not through a message API.

- [ ] **Step 4: Implement Accept, READY edit shortcut, saved Edit and Reject**

Accept:

```ts
const result = await acceptCsCopilotSuggestion(suggestion.suggestionId)
setSuggestion(result)
onDraftChange(result.suggestionText || '')
```

The READY “编辑” shortcut uses the accept request above, then sets `editDraft` from the returned suggestion and enters local edit mode. It must not call `sendSupportMessage`.

Edit:

```ts
const result = await editCsCopilotSuggestion(suggestion.suggestionId, {
  editedText: editDraft.trim(),
})
setSuggestion(result)
onDraftChange(result.editedText || editDraft.trim())
```

Reject:

```ts
const result = await rejectCsCopilotSuggestion(suggestion.suggestionId, { reason: null })
setSuggestion(result)
```

None of these handlers may import or call `sendSupportMessage`, `sendSupportMessageStream`, or any `/messages` API.

- [ ] **Step 5: Implement stale, failure and regenerate UI**

For API code `409`, set the current suggestion to the same suggestion with `status: 'EXPIRED'`, disable Accept/Edit/Reject, preserve the stale message, and render “重新生成”. The regenerate button must call Generate with the current `sessionId`, creating a new suggestion.

For `502`, render “AI 返回内容未通过系统事实校验，请重新生成。”.

For `503`, render “AI 服务暂时不可用，请稍后重试。”.

For all other errors, render “AI 建议处理失败，请稍后重试。” without exposing exception text.

- [ ] **Step 6: Add source contract tests**

Add assertions:

```ts
const panel = source('components/customer-service/SupportCopilotPanel.tsx')
assert.match(panel, /generateCsCopilotSuggestion/)
assert.match(panel, /acceptCsCopilotSuggestion/)
assert.match(panel, /editCsCopilotSuggestion/)
assert.match(panel, /rejectCsCopilotSuggestion/)
assert.match(panel, /onDraftChange/)
assert.doesNotMatch(panel, /sendSupportMessage/)
assert.match(panel, /EXPIRED/)
assert.match(panel, /重新生成/)
```

- [ ] **Step 7: Run focused tests**

Run:

```powershell
cd frontend
node --test src/lib/customer-service-copilot.test.ts
```

Expected: PASS.

## Task 4: Add the manual reply editor and send flow

**Files:**
- Modify: `frontend/src/app/console/customer-service/sessions/page.tsx`
- Modify: `frontend/src/lib/customer-service-workbench.test.ts`

- [ ] **Step 1: Add imports and state**

Import `sendSupportMessage` and `SupportCopilotPanel`. Add:

```ts
const [replyDraft, setReplyDraft] = useState('')
const [sendingReply, setSendingReply] = useState(false)
const [replyError, setReplyError] = useState('')
const [copilotMessageWarning, setCopilotMessageWarning] = useState('')
const previousMessageIdsRef = useRef<number[]>([])
```

Add `useRef` to the React import.

- [ ] **Step 2: Clear session-scoped state on selected session changes**

Inside the existing selected-session effect, before loading messages:

```ts
setReplyDraft('')
setReplyError('')
setCopilotMessageWarning('')
previousMessageIdsRef.current = []
```

The Copilot panel receives `selectedSession.id`; its own effect clears suggestion and in-flight UI state. The page must not preserve a previous session's reply draft.

- [ ] **Step 3: Track message changes without changing the reply draft**

After a successful message load:

```ts
const nextMessages = data || []
const nextIds = nextMessages.map(message => message.id)
const changed = haveMessagesChanged(previousMessageIdsRef.current, nextIds)
if (previousMessageIdsRef.current.length > 0 && changed) {
  setCopilotMessageWarning('会话内容已更新，已有 AI 建议可能已失效')
}
previousMessageIdsRef.current = nextIds
setMessages(nextMessages)
```

Never call `setReplyDraft('')` in this branch and never write the Copilot suggestion directly into `replyDraft` except through the panel's explicit `onDraftChange` callback.

- [ ] **Step 4: Extract message reload and add `handleSendReply`**

Extract the existing selected-session message request into a callback or local function that accepts an explicit session ID and an optional message-change callback. It must retain the existing cancellation guard:

```ts
const reloadSelectedSessionMessages = async (sessionId: number) => {
  const data = await listCsSessionMessages(sessionId)
  if (selectedSessionId !== sessionId) return
  const nextMessages = data || []
  const nextIds = nextMessages.map(message => message.id)
  const changed = haveMessagesChanged(previousMessageIdsRef.current, nextIds)
  if (previousMessageIdsRef.current.length > 0 && changed) {
    setCopilotMessageWarning('会话内容已更新，已有 AI 建议可能已失效')
  }
  previousMessageIdsRef.current = nextIds
  setMessages(nextMessages)
}
```

The selected-session `useEffect` may still use its existing `cancelled` closure for initial loading, but all manual sends must call this single reload path so the message-change warning has one source of truth.

Implement:

```ts
const handleSendReply = async () => {
  const content = replyDraft.trim()
  if (!selectedSession || !content || sendingReply) return
  const sessionId = selectedSession.id
  setSendingReply(true)
  setReplyError('')
  try {
    await sendSupportMessage(sessionId, content)
    if (selectedSessionId !== sessionId) return
    setReplyDraft('')
    await reloadSelectedSessionMessages(sessionId)
  } catch (err: unknown) {
    setReplyError(err instanceof Error ? err.message : '发送客服消息失败')
  } finally {
    setSendingReply(false)
  }
}
```

Keep `sessionId` captured before awaiting. The call must be exactly `sendSupportMessage(selectedSession.id, content)` or an equivalent captured-value implementation where the first argument is the selected session's `id`.

- [ ] **Step 5: Replace the internal-note-only footer with two separate editors**

Keep the existing internal note editor unchanged in behavior. Above it, add:

```tsx
<section aria-label="人工回复编辑区" className="border-b border-[#edf0f3] pb-3">
  <div className="mb-2 flex items-center justify-between">
    <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#374151]">
      <MessageSquareText className="h-4 w-4 text-[#ff1268]" />
      人工回复
    </div>
    <span className="text-[10px] text-[#9ca3af]">发送后客户可见</span>
  </div>
  <textarea
    value={replyDraft}
    onChange={event => setReplyDraft(event.target.value)}
    rows={3}
    maxLength={5000}
    placeholder="输入要发送给客户的回复"
    className="min-h-[72px] w-full resize-none rounded-md border border-[#e5e7eb] px-3 py-2 text-[12px] text-[#374151] outline-none focus:border-[#ff1268]"
  />
  <div className="mt-2 flex items-center justify-between gap-2">
    <span className="text-[10px] text-[#9ca3af]">AI 建议仅作为草稿，发送前请人工确认</span>
    <button
      type="button"
      onClick={() => void handleSendReply()}
      disabled={sendingReply || !replyDraft.trim()}
      className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#ff1268] px-3 text-[12px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Send className="h-3.5 w-3.5" />
      {sendingReply ? '发送中...' : '发送'}
    </button>
  </div>
  {copilotMessageWarning ? <div className="mt-2 text-[11px] text-[#b45309]">{copilotMessageWarning}</div> : null}
  {replyError ? <div className="mt-2 text-[11px] text-[#dc2626]">{replyError}</div> : null}
</section>
```

All visible text must remain Chinese. The AI draft warning must not claim that a message was sent.

- [ ] **Step 6: Mount the Copilot panel**

Place `SupportCopilotPanel` in the existing right-side workbench area without removing the orders/quality/history tabs:

```tsx
<SupportCopilotPanel
  sessionId={selectedSession.id}
  canUse={canUseCopilot}
  onDraftChange={draft => {
    setReplyDraft(draft)
    setReplyError('')
  }}
/>
```

`canUseCopilot` must derive from `getUser()` and `permissionCodes` using the helper; do not infer it from the page route permission.

- [ ] **Step 7: Add workbench source contract tests**

Add assertions:

```ts
const page = source('app/console/customer-service/sessions/page.tsx')
assert.match(page, /SupportCopilotPanel/)
assert.match(page, /sendSupportMessage/)
assert.match(page, /selectedSession\.id/)
assert.match(page, /人工回复/)
assert.match(page, /AI 建议仅作为草稿/)
assert.doesNotMatch(page, /sendSupportMessage\(.*accept/i)
```

- [ ] **Step 8: Run focused workbench tests**

Run:

```powershell
cd frontend
node --test src/lib/customer-service-workbench.test.ts src/lib/customer-service-copilot.test.ts
```

Expected: PASS.

The page must not modify or call the C-end streaming endpoint `/api/user/support/conversations/{id}/messages/stream`; Phase ⑤-3 uses only the existing B-end manual `sendSupportMessage()` request.

## Task 5: Verify full frontend behavior and record notes

**Files:**
- Modify: `implementation-notes.md`

- [ ] **Step 1: Run the focused frontend tests**

```powershell
cd frontend
node --test src/lib/customer-service-workbench.test.ts src/lib/customer-service-copilot.test.ts src/lib/api.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 2: Run TypeScript validation**

```powershell
cd frontend
pnpm typecheck
```

Expected: exit code `0`.

- [ ] **Step 3: Run the production build**

```powershell
cd frontend
pnpm build
```

Expected: exit code `0`; no new TypeScript or route build error.

- [ ] **Step 4: Run diff validation**

```powershell
git diff --check
```

Expected: no output and exit code `0`.

- [ ] **Step 5: Record implementation notes**

Append an entry to `implementation-notes.md` with:

- exact files changed;
- `session.id -> sendSupportMessage(conversationId, content)` mapping;
- four Copilot endpoint mappings;
- `support.ai.use` UI gate and backend enforcement;
- 409 -> `EXPIRED` behavior;
- Accept never calling `/messages`;
- message-refresh warning preserving `replyDraft`;
- selected test, typecheck, build, and diff-check results;
- any test/build blocker;
- explicit `未提交、未推送、未合并 Git`.
