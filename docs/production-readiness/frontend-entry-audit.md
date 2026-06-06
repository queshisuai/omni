# 生产前前端入口闭环清单

> 阶段 0 输出物。目标是找出“后端已有、测试也过，但前端没有体现或体验不完整”的断层。本文只记录审计结论，不直接修改业务代码。

## 审计结论

前端页面数量和 API 接入已经不少，不是空白状态。主要问题是部分入口只展示 ID、缺业务上下文，部分后端能力缺管理端入口，部分按钮虽然接了接口但需要补真实验收数据和错误态。

## 已有入口，建议继续打磨

| 能力 | 前端入口 | 后端/API 证据 | 生产前问题 |
|:---|:---|:---|:---|
| 活动详情、购票、抢票、候补、小队 | `frontend/src/app/activity/[id]/page.tsx` | `frontend/src/lib/api.ts` 已接活动详情、抢票、候补、小队、支付等 API | 页面过重，建议后续拆组件；抢票/候补失败原因需要更细中文解释。 |
| 评价与问答 | `frontend/src/app/activity/[id]/page.tsx` 显示“评价与问答” | `listActivityReviews`、`createActivityReview`、`listActivityQuestions`、`createActivityQuestion` | 需要正式化：购票校验、评价审核/举报、后台管理入口。 |
| 票夹和电子票 | `frontend/src/app/tickets/page.tsx` | `listMyTickets`、`createTicketEntryCode`、`createTicketTransfer`、`revokeTicketTransfer` | C 端有入口；平台/主办方侧缺线下核验同步状态、核验记录查询和异常补录入口。Web 扫码核验页只应作为备用入口。 |
| 候补列表 | `frontend/src/app/waitlist/page.tsx` | `listMyWaitlistEntries`、`cancelWaitlistEntry` | 当前列表仍显示 `ticketTypeId` 等技术 ID，应补活动名、场次、票档名。 |
| 小队房间 | `frontend/src/app/teams/[id]/page.tsx` | `getTeamGrab`、`triggerTeamGrab`、`getTeamGrabProgress` | 页面部分区域显示活动/场次/票档 ID，应补名称和摘要。 |
| 客服工作台 | `frontend/src/app/support/page.tsx` | 客服会话、消息、转接、升级、备注、标签 API 已接 | 缺订单、退款、票夹、候补、抢票、通知聚合上下文。 |
| 客服管理 | `frontend/src/app/console/support-accounts/page.tsx`、`frontend/src/app/console/support-conversations/page.tsx` | 客服账号、会话记录、审计 API 已接 | 缺排班、接待容量、满意度、质检评分。 |
| 控制台运营能力 | `frontend/src/app/console/*` 多页面 | `console-auth.ts` 已配置权限到路由 | 角色命名需调整，平台主办方运营员入口需重新组织。 |
| 异常任务与对账 | `frontend/src/app/console/exception-tasks/page.tsx`、`frontend/src/app/console/reconciliation/page.tsx` | `listExceptionTasks`、`createExceptionTask`、`listReconciliationBatches` | 需要确认是否能闭环处理：认领、重试、关闭、复核。 |

## 缺入口或入口不足

| 缺口 | 建议 |
|:---|:---|
| 入场核验同步与备用核验入口 | 主流程应是线下闸机、扫码设备或工作人员 App 调用受控核验接口并同步平台；前端优先补入场概览、核验记录、异常补录和可选备用 Web 扫码页。详见 `docs/production-readiness/check-in-flow.md`。 |
| 评价审核/举报入口 | 新增平台评价审核页，支持隐藏、恢复、举报处理。 |
| 平台主办方运营员工作台 | 不应只停留在“主办方管理员账号管理”，应有主办方列表、待办、跟进、分配和复核。 |
| 通知偏好设置 | 用户侧可设置站内通知、短信、邮件偏好；SMS 未接入前可先展示站内通知偏好。 |
| ES 搜索体验 | 搜索页应接真实 ES 响应，支持排序、筛选、失败态、空状态、搜索建议。 |
| Gateway 慢链路可视化 | 管理端可先做只读诊断页，展示 route 延迟和错误聚合，或接 Sentry/日志面板。 |

## 前端验收纪律

- 每个后端能力必须有至少一个前端入口或明确标记“后台任务/内部接口，不对用户展示”。
- 每个入口必须覆盖加载态、空状态、失败态、权限不足态。
- 不能用 mock 数据假装接口可用。
- 涉及新增字段时，同步更新 `frontend/src/types/api.ts`。
- 关键角色都要手工跑一条路径：普通用户、主办方、客服、客服主管、平台主办方运营员、平台管理员。

## 下一步建议

1. 先做“入场核验同步流程和记录模型”详细计划。
2. 再做“评价系统正式化入口”详细计划。
3. 与 ES 搜索阶段并行，重构搜索页的失败态和筛选状态。
