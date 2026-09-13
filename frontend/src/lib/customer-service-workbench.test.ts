import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildCustomerServiceSessionQuery,
  buildCustomerServiceSelectionQuery,
  filterCustomerServiceOrgTree,
  groupCustomerServiceSessionsByUser,
  getCustomerServiceSlaMeta,
} from './customer-service-workbench.ts'

const source = (relativePath: string) => readFileSync(resolve(process.cwd(), 'src', relativePath), 'utf8')

test('客服会话查询只发送已选择的分层筛选和分页参数', () => {
  assert.equal(
    buildCustomerServiceSessionQuery({
      groupId: 12,
      agentId: 34,
      status: 'NEED_AUDIT',
      slaTimeoutOnly: true,
      keyword: '退款',
      page: 2,
      size: 30,
      sort: 'sla_waiting',
    }),
    'groupId=12&agentId=34&status=NEED_AUDIT&slaTimeoutOnly=true&keyword=%E9%80%80%E6%AC%BE&page=2&size=30&sort=sla_waiting',
  )
})

test('同一页的同一用户只生成一张主卡片并按最新会话排序', () => {
  const grouped = groupCustomerServiceSessionsByUser([
    {
      id: 1,
      userId: 2004,
      userNickname: '普通用户小明',
      userPhoneMask: '139****0001',
      status: 'CLOSED',
      lastMessage: '较早的咨询',
      createTime: '2026-09-01T15:24:00+08:00',
      updateTime: '2026-09-01T15:24:00+08:00',
    },
    {
      id: 2,
      userId: 2004,
      userNickname: '普通用户小明',
      userPhoneMask: '139****0001',
      status: 'CLOSED',
      lastMessage: '最新的咨询',
      createTime: '2026-09-01T15:58:00+08:00',
      updateTime: '2026-09-01T15:58:00+08:00',
    },
    {
      id: 3,
      userId: 2005,
      userNickname: '管理员',
      status: 'ACTIVE',
      lastMessage: '管理员咨询',
      createTime: '2026-09-01T15:40:00+08:00',
      updateTime: '2026-09-01T15:40:00+08:00',
    },
  ])

  assert.equal(grouped.length, 2)
  assert.equal(grouped[0].userId, 2004)
  assert.equal(grouped[0].userName, '普通用户小明')
  assert.equal(grouped[0].historyList.length, 2)
  assert.deepEqual(grouped[0].historyList.map(session => session.id), [2, 1])
  assert.equal(grouped[0].latestSession.id, 2)
  assert.equal(grouped[0].latestSession.lastMessage, '最新的咨询')
})

test('组织树选择转换为服务端过滤参数而不是前端按用户折叠或过滤', () => {
  assert.deepEqual(
    buildCustomerServiceSelectionQuery({ type: 'pool' }),
    { unassignedOnly: true },
  )
  assert.deepEqual(
    buildCustomerServiceSelectionQuery({ type: 'ai-human' }),
    { sourceType: 'AI' },
  )
  assert.deepEqual(
    buildCustomerServiceSelectionQuery({ type: 'agent', groupId: 12, agentId: 34 }),
    { groupId: 12, agentId: 34 },
  )
})

test('组织树搜索保留根节点并只保留命中的技能组或坐席', () => {
  const result = filterCustomerServiceOrgTree({
    activeCount: 6,
    totalCount: 19,
    publicPoolCount: 2,
    publicPoolTimeoutCount: 1,
    aiResolvedCount: 3,
    aiHumanCount: 1,
    groups: [
      {
        id: 1,
        groupCode: 'TICKET_REFUND',
        groupName: '票务退改与咨询组',
        leaderUserId: 10,
        leaderName: '主管甲',
        activeCount: 4,
        totalCount: 12,
        waitingCount: 1,
        overdueCount: 1,
        agents: [
          { userId: 11, agentName: '小周', agentStatus: 1, activeSessionCount: 2, totalCount: 8 },
          { userId: 12, agentName: '小林', agentStatus: 0, activeSessionCount: 0, totalCount: 4 },
        ],
      },
    ],
  }, '小周')

  assert.equal(result.groups.length, 1)
  assert.equal(result.groups[0].agents.length, 1)
  assert.equal(result.groups[0].agents[0].agentName, '小周')
  assert.equal(result.activeCount, 6)
})

test('SLA 元数据区分正常、预警和超时', () => {
  assert.equal(getCustomerServiceSlaMeta({ slaOverdue: false, slaTimeoutFlag: false }).label, '服务正常')
  assert.equal(getCustomerServiceSlaMeta({ slaOverdue: true, slaTimeoutFlag: false }).tone, 'warning')
  assert.equal(getCustomerServiceSlaMeta({ slaOverdue: true, slaTimeoutFlag: true }).tone, 'danger')
})

test('规范客服页采用三栏满高结构并包含订单弱依赖文案', () => {
  const page = source('app/console/customer-service/sessions/page.tsx')
  assert.match(page, /h-full flex overflow-hidden/)
  assert.match(page, /max-w-lg/)
  assert.match(page, /暂无近期订单/)
  assert.match(page, /org-tree/)
})

test('质检查看权限与质检写入权限分离', () => {
  const page = source('app/console/customer-service/sessions/page.tsx')
  assert.match(page, /const canAudit = Boolean\(/)
  assert.match(page, /disabled={!canAudit \|\| submitting}/)
  assert.match(page, /if \(!selectedSession \|\| !canAudit\) return/)
})

test('旧客服路由跳转到规范工作台', () => {
  const page = source('app/console/support-conversations/page.tsx')
  assert.match(page, /\/console\/customer-service\/sessions/)
})

test('右侧画像使用订单与质检和用户全历史轨迹双 Tab，并按需加载历史', () => {
  const page = source('app/console/customer-service/sessions/page.tsx')
  assert.match(page, /订单与质检/)
  assert.match(page, /用户全历史轨迹/)
  assert.match(page, /listCsUserSessionHistory/)
  assert.match(page, /activeRightTab/)
  assert.doesNotMatch(page, /selectCustomerServiceSessions/)
  assert.doesNotMatch(page, /visibleSessions/)
})

test('中间列表按用户主卡片聚合并支持展开会话子目录', () => {
  const page = source('app/console/customer-service/sessions/page.tsx')
  assert.match(page, /groupCustomerServiceSessionsByUser/)
  assert.match(page, /expandedUserIds/)
  assert.match(page, /ChevronDown/)
  assert.match(page, /次咨询/)
  assert.match(page, /historyList/)
  assert.match(page, /setSelectedSessionId\(session\.id\)/)
})
