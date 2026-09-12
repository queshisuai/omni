import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { test } from 'node:test'

const here = dirname(fileURLToPath(import.meta.url))

function source(path: string) {
  return readFileSync(join(here, path), 'utf8')
}

function assertAllTableHeadersNoWrap(content: string) {
  const headers = content.match(/<th\b[^>]*className="[^"]*"/g) || []
  assert.ok(headers.length > 0)
  for (const header of headers) {
    assert.match(header, /whitespace-nowrap/)
  }
}

test('declares reusable Modal and Drawer primitives for console workflows', () => {
  const modalPath = join(here, '../components/ui/Modal.tsx')
  const drawerPath = join(here, '../components/ui/Drawer.tsx')

  assert.equal(existsSync(modalPath), true)
  assert.equal(existsSync(drawerPath), true)

  const modal = readFileSync(modalPath, 'utf8')
  const drawer = readFileSync(drawerPath, 'utf8')

  assert.match(modal, /export interface ModalProps/)
  assert.match(modal, /size\?: 'sm' \| 'md' \| 'lg' \| 'xl'/)
  assert.match(modal, /bg-black\/50 backdrop-blur-xs/)
  assert.match(modal, /max-h-\[75vh\] overflow-y-auto/)
  assert.match(modal, /keydown/)
  assert.match(modal, /#f53f3f/)

  assert.match(drawer, /export interface DrawerProps/)
  assert.match(drawer, /width\?: string/)
  assert.match(drawer, /transition-transform duration-300/)
  assert.match(drawer, /flex-1 overflow-y-auto p-6/)
  assert.match(drawer, /border-t p-4 bg-white/)
  assert.match(drawer, /keydown/)
})

test('console tour and artist tables reserve nowrap functional columns', () => {
  const tours = source('../app/console/tours/page.tsx')
  const artists = source('../app/console/artists/page.tsx')

  assertAllTableHeadersNoWrap(tours)
  assertAllTableHeadersNoWrap(artists)

  assert.match(tours, /max-w-\[240px\] truncate/)
  assert.match(tours, /w-24 min-w-\[90px\]/)
  assert.match(tours, /w-28 min-w-\[110px\]/)
  assert.match(tours, /min-w-\[220px\]/)
  assert.match(tours, /flex items-center gap-2 whitespace-nowrap/)

  assert.match(artists, /max-w-\[240px\] truncate/)
  assert.match(artists, /w-24 min-w-\[90px\]/)
  assert.match(artists, /min-w-\[150px\]/)
  assert.match(artists, /flex items-center gap-2 whitespace-nowrap/)
})

test('sessions and venue pages use Modal or Drawer instead of inline form blocks', () => {
  const sessions = source('../app/console/sessions/page.tsx')
  const venue = source('../app/console/venue/page.tsx')

  assert.match(sessions, /@\/components\/ui\/Modal/)
  assert.match(sessions, /@\/components\/ui\/Drawer/)
  assert.match(sessions, /<Modal[\s\S]*open=\{formOpen\}[\s\S]*title="编辑场次"/)
  assert.match(sessions, /<Drawer[\s\S]*width="w-\[540px\]"[\s\S]*title="票档配置"/)
  assert.doesNotMatch(sessions, /fixed inset-y-0 right-0/)
  assert.doesNotMatch(sessions, /\{formOpen && form && \(/)

  assert.match(venue, /@\/components\/ui\/Modal/)
  assert.match(venue, /<Modal[\s\S]*title=\{editingVenue \? '编辑场馆记录' : '新增场馆记录'\}/)
  assert.doesNotMatch(venue, /max-w-\[900px\]/)
  assertAllTableHeadersNoWrap(venue)
  assert.match(venue, /max-w-\[240px\] truncate/)
  assert.match(venue, /min-w-\[260px\]/)
})

test('review flows use dedicated modals instead of shared or inline textarea state', () => {
  const refunds = source('../app/console/refunds/page.tsx')
  const organizerApplications = source('../app/console/organizer-applications/page.tsx')
  const pendingArtists = source('../app/console/artists/pending/page.tsx')
  const riskResolutions = source('../app/console/risk-resolutions/page.tsx')
  const venueApplications = source('../app/console/venue/applications/page.tsx')
  const stationConfigReviews = source('../app/console/station-config-reviews/page.tsx')

  assert.doesNotMatch(refunds, /window\.confirm/)
  assert.doesNotMatch(refunds, /canReview && reviewing/)
  assert.match(refunds, /@\/components\/ui\/Modal/)
  assert.match(refunds, /refundReviewDialog/)
  assert.match(refunds, /拒绝原因不能为空/)

  assert.match(organizerApplications, /@\/components\/ui\/Modal/)
  assert.match(organizerApplications, /reviewDialog/)
  assert.match(organizerApplications, /@\/components\/ui\/Drawer/)
  assert.match(organizerApplications, /selectedMaterial/)
  assert.doesNotMatch(organizerApplications, /const \[reviewNote/)
  assert.doesNotMatch(organizerApplications, /驳回前请在上方备注框填写原因/)

  assert.match(pendingArtists, /@\/components\/ui\/Modal/)
  assert.match(pendingArtists, /artistReviewDialog/)
  assert.doesNotMatch(pendingArtists, /const \[note/)
  assert.doesNotMatch(pendingArtists, /审核备注或风险原因/)

  assert.match(riskResolutions, /@\/components\/ui\/Modal/)
  assert.match(riskResolutions, /resolutionReviewDialog/)
  assert.doesNotMatch(riskResolutions, /const \[notes/)
  assert.doesNotMatch(riskResolutions, /<textarea[\s\S]*placeholder="审核备注"/)

  assert.match(venueApplications, /@\/components\/ui\/Modal/)
  assert.match(venueApplications, /venueReviewDialog/)
  assert.doesNotMatch(venueApplications, /const \[reviewNote/)
  assert.doesNotMatch(venueApplications, /reviewingId === item\.id/)

  assert.match(stationConfigReviews, /@\/components\/ui\/Modal/)
  assert.match(stationConfigReviews, /stationReviewDialog/)
  assert.doesNotMatch(stationConfigReviews, /globalPrompt/)
  assert.doesNotMatch(stationConfigReviews, /await globalPrompt/)
})

test('support conversation page exposes claim transfer escalate and close actions', () => {
  const supportConversations = source('../app/console/support-conversations/page.tsx')

  assert.match(supportConversations, /claimSupportConversation/)
  assert.match(supportConversations, /transferSupportConversation/)
  assert.match(supportConversations, /escalateSupportConversation/)
  assert.match(supportConversations, /closeSupportConversation/)
  assert.match(supportConversations, /listEnabledSupportAgents/)
  assert.match(supportConversations, /@\/components\/ui\/Modal/)
  assert.match(supportConversations, /supportActionDialog/)
  assert.match(supportConversations, /认领会话/)
  assert.match(supportConversations, /转接会话/)
  assert.match(supportConversations, /升级工单/)
  assert.match(supportConversations, /结束会话/)
})

test('risk case management uses contextual modal instead of cross-page action links', () => {
  const riskCases = source('../app/console/risk-cases/page.tsx')

  assert.match(riskCases, /@\/components\/ui\/Modal/)
  assert.match(riskCases, /riskCaseDialog/)
  assert.match(riskCases, /上下文对比/)
  assert.match(riskCases, /openRiskCaseDialog/)
  assert.doesNotMatch(riskCases, /href=\{`\/console\/risk-resolutions\?/)
})

test('reconciliation batch generation is wrapped in a standard modal', () => {
  const reconciliation = source('../app/console/reconciliation/page.tsx')

  assert.match(reconciliation, /@\/components\/ui\/Modal/)
  assert.match(reconciliation, /batchDialogOpen/)
  assert.match(reconciliation, /title="生成日结批次"/)
  assert.doesNotMatch(reconciliation, /<input[^>]*type="date"[^>]*value=\{bizDate\}[^>]*onChange=\{event => setBizDate/)
})

test('account management pages keep create and edit forms inside modals', () => {
  const organizerAdmins = source('../app/console/organizer-admins/page.tsx')
  const supportAccounts = source('../app/console/support-accounts/page.tsx')

  assert.match(organizerAdmins, /@\/components\/ui\/Modal/)
  assert.match(organizerAdmins, /accountDialog/)
  assert.match(organizerAdmins, /<Modal[\s\S]*title=\{accountDialog\.mode === 'edit' \? '编辑平台主办方运营员账号' : '新建平台主办方运营员账号'\}/)
  assert.doesNotMatch(organizerAdmins, /editingId === account\.id \? \(/)
  assert.doesNotMatch(organizerAdmins, /md:grid-cols-\[170px_170px_170px_110px\]/)

  assert.match(supportAccounts, /@\/components\/ui\/Modal/)
  assert.match(supportAccounts, /accountDialog/)
  assert.match(supportAccounts, /<Modal[\s\S]*title=\{accountDialog\.mode === 'edit' \? '编辑客服账号' : '新建人工客服'\}/)
  assert.doesNotMatch(supportAccounts, /editingId === account\.id \? \(/)
  assert.doesNotMatch(supportAccounts, /md:grid-cols-\[150px_150px_150px_120px_110px\]/)
})

test('exception task page moves complex create and row actions out of inline blocks', () => {
  const exceptionTasks = source('../app/console/exception-tasks/page.tsx')

  assert.match(exceptionTasks, /@\/components\/ui\/Drawer/)
  assert.match(exceptionTasks, /@\/components\/ui\/Modal/)
  assert.match(exceptionTasks, /<Drawer[\s\S]*open=\{createDrawerOpen\}[\s\S]*title="新建异常任务"/)
  assert.match(exceptionTasks, /<Modal[\s\S]*open=\{Boolean\(actionTarget\)\}[\s\S]*title=\{actionTarget\?\.action === 'resolve' \? '填写处理结果' : '填写关闭原因'\}/)
  assert.doesNotMatch(exceptionTasks, /\{actionTarget && \(/)
  assertAllTableHeadersNoWrap(exceptionTasks)
  assert.match(exceptionTasks, /flex items-center gap-2 whitespace-nowrap/)
})

test('remaining console workflows use shared Modal and Drawer primitives', () => {
  const tourDetail = source('../app/console/tours/[id]/page.tsx')
  const activities = source('../app/console/activities/page.tsx')
  const seatLayout = source('../app/console/sessions/[id]/seat-layout/page.tsx')
  const activityEdit = source('../app/console/activities/[id]/edit/page.tsx')
  const organizerOps = source('../app/console/organizer-ops/page.tsx')

  assert.match(tourDetail, /@\/components\/ui\/Modal/)
  assert.match(tourDetail, /publishDialog/)
  assert.match(tourDetail, /<Modal[\s\S]*title="发布城市站点"/)
  assert.doesNotMatch(tourDetail, /<div className="mt-4 rounded-xl border border-\[#f0f0f0\] bg-\[#fafafa\] p-4">/)

  assert.match(activities, /@\/components\/ui\/Modal/)
  assert.match(activities, /activityActionDialog/)
  assert.match(activities, /riskResolutionDialog/)
  assert.doesNotMatch(activities, /globalPrompt/)
  assert.doesNotMatch(activities, /fixed inset-0 z-50 flex items-center justify-center bg-black\/45/)

  assert.match(seatLayout, /@\/components\/ui\/Drawer/)
  assert.match(seatLayout, /<Drawer[\s\S]*title="票档与座区绑定"/)
  assert.doesNotMatch(seatLayout, /ticketEditorPanelOpen && ticketEditorLayout && \(/)

  assert.match(activityEdit, /@\/components\/ui\/Drawer/)
  assert.match(activityEdit, /<Drawer[\s\S]*title="场地临时变更申请"[\s\S]*<StationVenueApprovalForm/)
  assert.doesNotMatch(activityEdit, /venueApprovalOpen && activity \? \(/)

  assert.match(organizerOps, /@\/components\/ui\/Drawer/)
  assert.match(organizerOps, /<Drawer[\s\S]*title="主办方运营处理"/)
  assert.doesNotMatch(organizerOps, /\{selectedAssignment \? \(/)
})
