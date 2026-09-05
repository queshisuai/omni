import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

test('next dev allows local loopback hmr origin', () => {
  const content = source('../../next.config.ts')

  assert.match(content, /allowedDevOrigins/)
  assert.match(content, /127\.0\.0\.1/)
})

test('console activity list does not expose unavailable relist copy', () => {
  const content = source('../app/console/activities/page.tsx')

  assert.doesNotMatch(content, /暂不支持从列表直接重新上架/)
})

test('console activity list keeps unknown sale status visible and protected', () => {
  const content = source('../app/console/activities/page.tsx')

  assert.doesNotMatch(content, /return activity\.status === 1 \? '上架' : '下架'/)
  assert.doesNotMatch(content, /const newStatus = activity\.status === 1 \? 0 : 1/)
  assert.match(content, /未知活动状态/)
  assert.match(content, /状态待核对/)
})

test('console layout keeps organizer whitelist path checks inside grouped menu filtering', () => {
  const content = source('../app/console/layout.tsx')

  assert.match(content, /buildVisibleConsoleMenuGroups/)
  assert.match(content, /role === 'organizer'\) return isConsolePathAllowedForRole\(role, child\.href\)/)
  assert.match(content, /return canAccessConsolePath\(child\.href, permissionCodes\)/)
  assert.match(content, /filter\(group => group\.children\.length > 0\)/)
  assert.match(content, /canOpenConsolePath/)
})

test('console activity list supports batch deactivate with refund confirmation', () => {
  const content = source('../app/console/activities/page.tsx')

  assert.match(content, /selectedActivityKeys/)
  assert.match(content, /getBatchDeactivatableActivities/)
  assert.match(content, /handleBatchDeactivate/)
  assert.match(content, /批量下架并退款/)
  assert.match(content, /已选择/)
  assert.match(content, /同意退款/)
  assert.match(content, /deactivateActivity\(activity\.id/)
  assert.match(content, /deactivateTour\(activity\.id/)
})

test('console activity list supports batch buyer notifications without external channels', () => {
  const content = source('../app/console/activities/page.tsx')

  assert.match(content, /notifyActivityBuyers/)
  assert.match(content, /getBatchNotifiableActivities/)
  assert.match(content, /handleBatchNotifyBuyers/)
  assert.match(content, /批量通知购票用户/)
  assert.match(content, /通知内容/)
  assert.match(content, /仅发送站内通知/)
  assert.match(content, /notifyActivityBuyers\(activity\.id/)
})

test('console artist page does not use browser alert directly', () => {
  const content = source('../app/console/artists/page.tsx')

  assert.doesNotMatch(content, /\balert\s*\(/)
})

test('console artist list keeps unknown review and risk statuses visible and protected', () => {
  const page = source('../app/console/artists/page.tsx')
  const content = [page, source('./console-artists.ts')].join('\n')

  assert.doesNotMatch(page, /if \(status === 'rejected'\) return '已拒绝'\s*return '待审核'/)
  assert.doesNotMatch(page, /item\.riskStatus === 'risky' \? '风险艺人' : '风险正常'/)
  assert.doesNotMatch(page, /item\.riskStatus === 'risky' \? '解除风险' : '列入风险'/)
  assert.match(page, /formatArtistListReviewStatus/)
  assert.match(page, /formatArtistListRiskStatus/)
  assert.match(page, /canToggleArtistRiskStatus/)
  assert.match(content, /未知审核状态/)
  assert.match(content, /未知风险状态/)
  assert.match(content, /状态待核对/)
})

test('console exception task create options use shared Chinese task labels', () => {
  const content = source('../app/console/exception-tasks/page.tsx')

  assert.match(content, /getExceptionTaskTypeOptions/)
  assert.doesNotMatch(content, /const taskTypeOptions = \[/)
  assert.match(content, /formatExceptionTaskType/)
})

test('console exception task actions show status review prompt and use shared guards', () => {
  const content = source('../app/console/exception-tasks/page.tsx')

  assert.match(content, /isOpenExceptionStatus/)
  assert.match(content, /isClaimableExceptionStatus/)
  assert.match(content, /isResolvableExceptionStatus/)
  assert.match(content, /isClosableExceptionStatus/)
  assert.match(content, /状态待核对/)
  assert.doesNotMatch(content, /item\.status === 'pending'/)
  assert.doesNotMatch(content, /item\.status === 'processing'/)
  assert.doesNotMatch(content, /item\.status === 'resolved' \|\| item\.status === 'closed'/)
})

test('seat layout controls do not label the real minimap as placeholder UI', () => {
  const content = source('../components/seatcraft/SeatLayoutControls.tsx')

  assert.doesNotMatch(content, /placeholder for visual match/)
})

test('seat layout controls show selected seat status with Chinese fallback', () => {
  const content = source('../components/seatcraft/SeatLayoutControls.tsx')

  assert.doesNotMatch(content, /\{seat\.status\}/)
  assert.match(content, /function formatSeatStatus/)
  assert.match(content, /未知座位状态/)
})

test('console home uses shared Chinese reconciliation status labels', () => {
  const content = source('../app/console/page.tsx')

  assert.match(content, /formatReconciliationBatchStatus/)
  assert.doesNotMatch(content, /function formatBatchStatus/)
  assert.doesNotMatch(content, /return status \|\| '-'/)
})

test('console home shows platform operation summary health without exposing raw downstream source codes', () => {
  const content = source('../app/console/page.tsx')

  assert.match(content, /buildPlatformOpsHealthItems/)
  assert.match(content, /摘要链路健康/)
  assert.match(content, /摘要链路正常/)
  assert.match(content, /状态待核对/)
  assert.doesNotMatch(content, /error\.source/)
})

test('console home shows real infrastructure health separately from summary health', () => {
  const content = source('../app/console/page.tsx')
  const helper = source('./console-ops.ts')

  assert.match(content, /buildInfrastructureHealthItems/)
  assert.match(content, /基础设施健康/)
  assert.match(helper, /未配置/)
  assert.match(helper, /Nacos 注册中心/)
  assert.match(helper, /Redis 缓存/)
  assert.match(helper, /RabbitMQ 消息队列/)
  assert.match(helper, /Seata 事务协调器/)
  assert.doesNotMatch(content, /Nacos\/Seata\/Redis\/RabbitMQ 状态正常/)
})

test('console sessions list gives fallback activity and venue ids Chinese context', () => {
  const content = source('../app/console/sessions/page.tsx')

  assert.doesNotMatch(content, /活动 #/)
  assert.doesNotMatch(content, /场馆 #/)
  assert.doesNotMatch(content, /场馆ID/)
  assert.match(content, /活动编号/)
  assert.match(content, /场馆编号/)
})

test('console sessions status uses shared Chinese fallback', () => {
  const page = source('../app/console/sessions/page.tsx')
  const helper = source('./console-sessions.ts')

  assert.doesNotMatch(page, /session\.status === 1 \? '启用' : '停用'/)
  assert.doesNotMatch(page, /session\.status === 1 \? 'bg-\[#f0fff4\] text-\[#22c55e\]' : 'bg-\[#f5f5f5\] text-\[#999\]'/)
  assert.match(page, /formatConsoleSessionStatus/)
  assert.match(page, /getConsoleSessionStatusClassName/)
  assert.match(helper, /未知场次状态/)
  assert.match(helper, /bg-\[#fff7e6\] text-\[#ad6800\]/)
})

test('console sessions page supports batch ticket price updates through existing single update api', () => {
  const content = source('../app/console/sessions/page.tsx')

  assert.match(content, /selectedTicketTypeKeys/)
  assert.match(content, /getBatchTicketPriceUpdateTargets/)
  assert.match(content, /handleBatchTicketPriceUpdate/)
  assert.match(content, /批量改价/)
  assert.match(content, /目标票价/)
  assert.match(content, /确认批量改价/)
  assert.match(content, /批量改价处理完成/)
  assert.match(content, /updateAdminTicketType\(ticket\.id/)
})

test('console sessions page supports batch ticket status updates through existing single update api', () => {
  const content = source('../app/console/sessions/page.tsx')

  assert.match(content, /getBatchTicketStatusUpdateTargets/)
  assert.match(content, /handleBatchTicketStatusUpdate/)
  assert.match(content, /批量启用/)
  assert.match(content, /批量停用/)
  assert.match(content, /确认批量调整票档状态/)
  assert.match(content, /批量调整票档状态处理完成/)
  assert.match(content, /updateAdminTicketType\(ticket\.id,\s*\{\s*status: targetStatus\s*\}/)
})

test('console sessions page supports guarded batch ticket stock updates through existing single update api', () => {
  const content = source('../app/console/sessions/page.tsx')

  assert.match(content, /parseBatchTicketStockInput/)
  assert.match(content, /getBatchTicketStockUpdateTargets/)
  assert.match(content, /getBatchTicketStockUpdateBlockedTargets/)
  assert.match(content, /handleBatchTicketStockUpdate/)
  assert.match(content, /批量库存/)
  assert.match(content, /目标总库存/)
  assert.match(content, /确认批量调整票档库存/)
  assert.match(content, /批量调整票档库存处理完成/)
  assert.match(content, /updateAdminTicketType\(ticket\.id,\s*\{\s*totalStock: parsed\.totalStock\s*\}/)
})

test('console sessions page supports batch ticket import through existing single create api', () => {
  const content = source('../app/console/sessions/page.tsx')

  assert.match(content, /createAdminTicketType/)
  assert.match(content, /parseBatchTicketImportInput/)
  assert.match(content, /handleBatchTicketImport/)
  assert.match(content, /批量导入票档/)
  assert.match(content, /场次编号,票档名称,票价,总库存/)
  assert.match(content, /确认批量导入票档/)
  assert.match(content, /批量导入票档处理完成/)
  assert.match(content, /createAdminTicketType\(\{\s*userId,\s*sessionId: row\.sessionId,\s*name: row\.name,\s*price: row\.price,\s*totalStock: row\.totalStock\s*\}\)/)
})

test('console risk and venue fallbacks do not use hash ids', () => {
  const riskContent = source('../app/console/risk-resolutions/page.tsx')
  const venueSeatsContent = source('../app/console/venue/[id]/seats/page.tsx')

  assert.doesNotMatch(riskContent, /活动 #/)
  assert.doesNotMatch(riskContent, /活动ID/)
  assert.match(riskContent, /活动编号/)

  assert.doesNotMatch(venueSeatsContent, /场馆 #/)
  assert.match(venueSeatsContent, /场馆编号/)
})

test('console risk resolution status uses Chinese fallback for unknown codes', () => {
  const content = source('../app/console/risk-resolutions/page.tsx')

  assert.doesNotMatch(content, /STATUS_LABEL\[item\.status\] \|\| item\.status/)
  assert.match(content, /未知审核状态/)
})

test('console risk resolution review protects unknown statuses from write actions', () => {
  const content = source('../app/console/risk-resolutions/page.tsx')

  assert.doesNotMatch(content, /const editable = item\.status === 'pending'/)
  assert.doesNotMatch(content, /onClick=\{\(\) => review\(item\.id, 'approve'\)\}/)
  assert.doesNotMatch(content, /onClick=\{\(\) => review\(item\.id, 'reject'\)\}/)
  assert.match(content, /\bisKnownRiskResolutionStatus\b/)
  assert.match(content, /\bisReviewableRiskResolutionStatus\b/)
  assert.match(content, /状态待核对/)
  assert.match(content, /恢复售票审核状态待核对，请刷新后再操作/)
})

test('console risk events keeps unknown resolution status visible in Chinese', () => {
  const content = source('../app/console/risk-events/page.tsx')

  assert.doesNotMatch(content, /STATUS_META\[latest\.status\] : null/)
  assert.match(content, /未知审核状态/)
})

test('console risk events protects recovery submission when latest status is unknown', () => {
  const content = source('../app/console/risk-events/page.tsx')

  assert.doesNotMatch(content, /disabled=\{latest\?\.status === 'pending'\}/)
  assert.doesNotMatch(content, /latest\?\.status === 'pending' \? '审核中' : '提交恢复申请'/)
  assert.match(content, /canSubmitRiskResolution/)
  assert.match(content, /formatRiskResolutionSubmitLabel/)
  assert.match(content, /状态待核对/)
})

test('console risk events gives feedback when recovery submission is blocked', () => {
  const content = source('../app/console/risk-events/page.tsx')

  assert.match(content, /formatRiskResolutionSubmitBlockedMessage/)
  assert.match(content, /恢复售票审核状态待核对，请刷新后再操作/)
  assert.doesNotMatch(content, /if \(!canSubmitResolution\) return\s+onOpenDialog\(activity\)/)
  assert.match(content, /const blockedMessage = formatRiskResolutionSubmitBlockedMessage\(latest\?\.status\)/)
  assert.match(content, /onBlocked\(blockedMessage\)/)
  assert.match(content, /formatRiskResolutionSubmitBlockedMessage\(latestResolutionByActivity\.get\(target\.id\)\?\.status\)/)
})

test('console risk cases keeps unknown resolution status visible in Chinese', () => {
  const content = source('../app/console/risk-cases/page.tsx')

  assert.doesNotMatch(content, /const meta = STATUS_META\[status\]/)
  assert.match(content, /未知审核状态/)
})

test('console risk cases does not label unknown resolution status as waiting for organizer', () => {
  const content = source('../app/console/risk-cases/page.tsx')

  assert.doesNotMatch(content, /<span className="rounded-lg bg-\[#f3f4f6\][^>]*>等待主办方处理<\/span>/)
  assert.match(content, /formatRiskCaseActionLabel/)
  assert.match(content, /状态待核对/)
})

test('console venue application status uses Chinese fallback for unknown codes', () => {
  const contents = [
    source('../app/console/venue/apply/page.tsx'),
    source('../app/console/venue/applications/page.tsx'),
  ].join('\n')

  assert.doesNotMatch(contents, /statusText\[item\.status\]/)
  assert.match(contents, /未知场馆审核状态/)
})

test('console venue application review protects unknown statuses from write actions', () => {
  const content = source('../app/console/venue/applications/page.tsx')

  assert.doesNotMatch(content, /item\.status === 0 && <button onClick=\{\(\) => openReview\(item\.id\)\}/)
  assert.match(content, /\bisKnownVenueApplicationStatus\b/)
  assert.match(content, /\bisReviewableVenueApplicationStatus\b/)
  assert.match(content, /状态待核对/)
  assert.match(content, /场馆审核状态待核对，请刷新后再操作/)
})

test('console route error messages use Chinese identifier context', () => {
  const contents = [
    source('../app/console/activities/[id]/seat-layout/page.tsx'),
    source('../app/console/activities/[id]/marketing/page.tsx'),
    source('../app/console/activities/[id]/edit/page.tsx'),
    source('../app/console/venue/[id]/seats/page.tsx'),
    source('../app/console/sessions/[id]/seat-layout/page.tsx'),
    source('../app/console/stations/[id]/seatcraft/page.tsx'),
    source('../app/console/tours/[id]/page.tsx'),
    source('../app/console/tours/[id]/stations/new/page.tsx'),
    source('../app/console/tours/[id]/stations/[stationId]/venue/page.tsx'),
    source('../app/console/artists/[id]/edit/page.tsx'),
  ].join('\n')

  assert.doesNotMatch(contents, /ID不正确/)
  assert.doesNotMatch(contents, /艺人 ID/)
  assert.match(contents, /活动编号不正确/)
  assert.match(contents, /场馆编号不正确/)
  assert.match(contents, /场次编号不正确/)
  assert.match(contents, /站点编号不正确/)
  assert.match(contents, /巡演编号不正确/)
  assert.match(contents, /巡演或站点编号不正确/)
  assert.match(contents, /艺人编号不正确/)
})

test('console artist edit page maps review and risk statuses to Chinese fallbacks', () => {
  const content = source('../app/console/artists/[id]/edit/page.tsx')

  assert.doesNotMatch(content, /artist\.reviewStatus \|\|/)
  assert.doesNotMatch(content, /artist\.riskStatus \|\|/)
  assert.match(content, /function formatArtistReviewStatus/)
  assert.match(content, /function formatArtistRiskStatus/)
  assert.match(content, /待审核/)
  assert.match(content, /已通过/)
  assert.match(content, /已驳回/)
  assert.match(content, /风险正常/)
  assert.match(content, /风险艺人/)
  assert.match(content, /未知审核状态/)
  assert.match(content, /未知风险状态/)
})

test('console pending artist review protects unknown review statuses from write actions', () => {
  const content = source('../app/console/artists/pending/page.tsx')

  assert.doesNotMatch(content, /onClick=\{\(\) => review\(item\.id, 'approve'\)\}/)
  assert.doesNotMatch(content, /onClick=\{\(\) => review\(item\.id, 'reject'\)\}/)
  assert.doesNotMatch(content, /onClick=\{\(\) => markRisk\(item\.id\)\}/)
  assert.match(content, /\bisKnownArtistReviewStatus\b/)
  assert.match(content, /\bisReviewableArtistReviewStatus\b/)
  assert.match(content, /formatArtistListReviewStatus/)
  assert.match(content, /状态待核对/)
  assert.match(content, /艺人审核状态待核对，请刷新后再操作/)
})

test('activity artist selector does not use artist id as fallback display name', () => {
  const content = source('../components/activity-artist/ActivityArtistSelector.tsx')

  assert.doesNotMatch(content, /艺人 \$\{item\.artistId\}/)
  assert.match(content, /艺人信息待同步/)
})

test('console support account roles use Chinese fallback for unknown codes', () => {
  const content = source('../app/console/support-accounts/page.tsx')

  assert.doesNotMatch(content, /supportRoleOptions\.find\(option => option\.value === role\)\?\.label \|\| '普通客服'/)
  assert.match(content, /未知客服角色/)
})

test('console roles page shows permission change preview before saving', () => {
  const content = source('../app/console/roles/page.tsx')

  assert.match(content, /buildRbacPermissionDiff/)
  assert.match(content, /权限变更预览/)
  assert.match(content, /新增权限/)
  assert.match(content, /移除权限/)
  assert.match(content, /敏感权限变更/)
  assert.match(content, /确认更新角色权限/)
  assert.doesNotMatch(content, /确认保存角色授权/)
})

test('console roles page offers role templates before saving', () => {
  const content = source('../app/console/roles/page.tsx')

  assert.match(content, /getRbacRoleTemplatesForRole/)
  assert.match(content, /套用角色模板/)
  assert.match(content, /套用模板/)
  assert.match(content, /请核对权限变更预览后保存/)
})

test('console support account status uses Chinese fallback for unknown codes', () => {
  const content = source('../app/console/support-accounts/page.tsx')

  assert.doesNotMatch(content, /account\.status === 1 \? '启用中' : '已停用'/)
  assert.doesNotMatch(content, /account\.status === 1 \? '停用' : '启用'/)
  assert.match(content, /未知账号状态/)
  assert.match(content, /状态待核对/)
})

test('console support account status protects unknown statuses from edit and toggle actions', () => {
  const content = source('../app/console/support-accounts/page.tsx')

  assert.match(content, /\bisKnownSupportAccountStatus\b/)
  assert.match(content, /!isKnownSupportAccountStatus\(account\.status\)/)
  assert.match(content, /账号状态待核对，请刷新后再操作/)
  assert.doesNotMatch(content, /账号状态未知，请先核对后再操作/)
  assert.doesNotMatch(content, /account\.status === 1 \? <ShieldOff/)
  assert.doesNotMatch(content, /disabled=\{saving \|\| \(account\.status !== 1 && account\.status !== 0\)\}/)
})

test('console organizer admin account status uses Chinese fallback for unknown codes', () => {
  const content = source('../app/console/organizer-admins/page.tsx')

  assert.doesNotMatch(content, /account\.status === 1 \? '启用中' : '已停用'/)
  assert.doesNotMatch(content, /account\.status === 1 \? '停用' : '启用'/)
  assert.match(content, /未知账号状态/)
  assert.match(content, /状态待核对/)
})

test('console organizer admin account status protects unknown statuses from edit and toggle actions', () => {
  const content = source('../app/console/organizer-admins/page.tsx')

  assert.match(content, /\bisKnownOrganizerAdminAccountStatus\b/)
  assert.match(content, /!isKnownOrganizerAdminAccountStatus\(account\.status\)/)
  assert.match(content, /账号状态待核对，请刷新后再操作/)
  assert.doesNotMatch(content, /账号状态未知，请先核对后再操作/)
  assert.doesNotMatch(content, /account\.status === 1 \? <ShieldOff/)
})

test('console organizer application status uses Chinese fallback for unknown codes', () => {
  const organizerApplications = source('../app/console/organizer-applications/page.tsx')
  const consoleProfile = source('../app/console/profile/page.tsx')

  for (const content of [organizerApplications, consoleProfile]) {
    assert.match(content, /status === 2\) return \{ text: '已驳回'/)
    assert.match(content, /未知入驻状态/)
  }
})

test('console organizer application review protects unknown statuses from write actions', () => {
  const content = source('../app/console/organizer-applications/page.tsx')

  assert.doesNotMatch(content, /onClick=\{\(\) => handleApprove\(item\.id\)\}/)
  assert.doesNotMatch(content, /onClick=\{\(\) => handleReject\(item\.id\)\}/)
  assert.doesNotMatch(content, /disabled=\{savingId === item\.id \|\| item\.status !== 0\}/)
  assert.match(content, /\bisKnownOrganizerApplicationStatus\b/)
  assert.match(content, /\bisReviewableOrganizerApplicationStatus\b/)
  assert.match(content, /状态待核对/)
  assert.match(content, /入驻审核状态待核对，请刷新后再操作/)
})

test('console organizer account status keeps unknown values visible in Chinese', () => {
  const content = source('../app/console/organizer-applications/page.tsx')

  assert.doesNotMatch(content, /return null/)
  assert.doesNotMatch(content, /userStatusMeta \? \(/)
  assert.match(content, /未知主办方状态/)
})

test('console organizer deactivation protects unknown organizer account statuses', () => {
  const content = source('../app/console/organizer-applications/page.tsx')

  assert.doesNotMatch(content, /const isCancelled = item\.organizerStatus === 3 \|\| item\.role === 'user'/)
  assert.doesNotMatch(content, /disabled=\{savingId === item\.id \|\| item\.status !== 1 \|\| isCancelled\}/)
  assert.match(content, /\bisKnownOrganizerStatus\b/)
  assert.match(content, /\bcanDeactivateOrganizerAccount\b/)
  assert.match(content, /主办方状态待核对，请刷新后再操作/)
  assert.match(content, /状态待核对/)
})

test('console profile account status uses Chinese fallback for unknown codes', () => {
  const content = source('../app/console/profile/page.tsx')

  assert.match(content, /status === 1\) return \{ text: '正常'/)
  assert.match(content, /status === 0\) return \{ text: '已禁用'/)
  assert.match(content, /未知账号状态/)
})

test('console tour detail status formatters use Chinese fallback for unknown codes', () => {
  const content = source('../app/console/tours/[id]/page.tsx')

  assert.doesNotMatch(content, /statusText\[status\] \|\| status/)
  assert.doesNotMatch(content, /status \? statusText\[status\] \|\| status/)
  assert.match(content, /未知发布状态/)
  assert.match(content, /未知配置状态/)
})

test('console risk and support headers label user and organizer identifiers', () => {
  const contents = [
    source('../app/console/risk-cases/page.tsx'),
    source('../app/console/support-conversations/page.tsx'),
  ].join('\n')

  assert.doesNotMatch(contents, /活动 ID/)
  assert.doesNotMatch(contents, /用户 ID/)
  assert.doesNotMatch(contents, /主办 \{/)
  assert.doesNotMatch(contents, /用户 \$\{conversation\.userId\}/)
  assert.match(contents, /活动编号/)
  assert.match(contents, /主办方编号/)
  assert.match(contents, /用户编号/)
})

test('console venue list labels venue identifier with Chinese context', () => {
  const content = source('../app/console/venue/page.tsx')

  assert.doesNotMatch(content, /<th[^>]*>\s*ID\s*<\/th>/)
  assert.match(content, /场馆编号/)
})

test('console station config reviews show status in Chinese and protect non-reviewable states', () => {
  const content = source('../app/console/station-config-reviews/page.tsx')

  assert.match(content, /formatStationConfigStatus/)
  assert.match(content, /isReviewableStationConfigStatus/)
  assert.match(content, /状态待核对/)
  assert.doesNotMatch(content, /disabled=\{processingId === item\.id\}/)
})

test('console reconciliation differences protect unknown statuses from write actions', () => {
  const content = source('../app/console/reconciliation/page.tsx')

  assert.doesNotMatch(content, /diff\.status === 'open' \? \(/)
  assert.doesNotMatch(content, /handleDifferenceAction\(diff\.id, 'resolve'\)/)
  assert.doesNotMatch(content, /handleDifferenceAction\(diff\.id, 'ignore'\)/)
  assert.match(content, /isKnownReconciliationDifferenceStatus/)
  assert.match(content, /isOpenReconciliationDifferenceStatus/)
  assert.match(content, /状态待核对/)
  assert.match(content, /对账差异状态待核对，请刷新后再操作/)
})
