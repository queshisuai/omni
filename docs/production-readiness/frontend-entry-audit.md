# 生产前前端入口闭环清单

> 阶段 0 输出物。目标是找出“后端已有、测试也过，但前端没有体现或体验不完整”的断层。本文只记录审计结论，不直接修改业务代码。

## 审计结论

前端页面数量和 API 接入已经不少，不是空白状态。主要问题是部分入口只展示 ID、缺业务上下文，部分后端能力缺管理端入口，部分按钮虽然接了接口但需要补真实验收数据和错误态。

## 已有入口，建议继续打磨

| 能力 | 前端入口 | 后端/API 证据 | 生产前问题 |
|:---|:---|:---|:---|
| 活动详情、购票、抢票、候补、小队 | `frontend/src/app/activity/[id]/page.tsx` | `frontend/src/lib/api.ts` 已接活动详情、抢票、候补、小队、支付等 API | 页面过重，建议后续拆组件；抢票/候补失败原因需要更细中文解释。 |
| 评价与问答 | `frontend/src/app/activity/[id]/page.tsx` 显示“评价与问答”，订单页已提供“评价演出”，控制台已新增 `/console/activity-engagement` | `listActivityReviews`、`createActivityReview`、`reportActivityReview`、后台评价/举报/问答管理 API 已接 | 第一轮已接订单页评价入口、活动详情举报入口和后台管理入口；标准 Gateway、前端代理和浏览器复测已完成。 |
| 票夹、电子票和入场核验 | C 端 `frontend/src/app/tickets/page.tsx`，B 端 `frontend/src/app/console/check-in/page.tsx` | `listMyTickets`、`createTicketEntryCode`、`createTicketTransfer`、`revokeTicketTransfer`、`getCheckInOverview`、`listCheckInRecords` | C 端票夹和 B 端只读入场概览/核验记录已接通；备用 Web 扫码页、异常补录和 Gateway 设备签名鉴权仍是后续增强。 |
| 候补列表 | `frontend/src/app/waitlist/page.tsx` | `listMyWaitlistEntries`、`cancelWaitlistEntry` | 当前列表仍显示 `ticketTypeId` 等技术 ID，应补活动名、场次、票档名。 |
| 小队房间 | `frontend/src/app/teams/[id]/page.tsx` | `getTeamGrab`、`triggerTeamGrab`、`getTeamGrabProgress` | 页面部分区域显示活动/场次/票档 ID，应补名称和摘要。 |
| 客服工作台 | `frontend/src/app/support/page.tsx` | 客服会话、消息、转接、升级、备注、标签和“用户上下文”API 已接 | 已接订单、退款、票夹、候补、抢票、通知聚合上下文；real-demo seed 已补 `988102`，普通客服进入默认待处理队列即可看到可处理会话，后续继续补客服主管二期能力。 |
| 客服管理 | `frontend/src/app/console/support-accounts/page.tsx`、`frontend/src/app/console/support-conversations/page.tsx` | 客服账号、会话记录、审计 API 已接 | 缺排班、接待容量、满意度、质检评分。 |
| 控制台运营能力 | `frontend/src/app/console/*` 多页面 | `console-auth.ts` 已配置权限到路由 | 平台主办方运营员入口已重组；后续继续按领域拆入口和补权限态验收。 |
| 平台主办方运营员工作台 | `frontend/src/app/console/organizer-ops/page.tsx` | `listOrganizerOpsAssignments`、`updateOrganizerOpsAssignment`、`listOrganizerOpsFollowUps`、`createOrganizerOpsFollowUp` | 第一轮已接通跟进、分配、风险/状态、下次跟进和审计；剩余高风险双人复核、自动分配和主办方业务摘要。 |
| 异常任务与对账 | `frontend/src/app/console/exception-tasks/page.tsx`、`frontend/src/app/console/reconciliation/page.tsx` | `listExceptionTasks`、`claimExceptionTask`、`resolveExceptionTask`、`closeExceptionTask`、`listReconciliationBatches`、`resolveReconciliationDifference`、`ignoreReconciliationDifference` | 已接认领、标记已处理、关闭、差异处理和忽略；后续补复核归档和更细审计筛选。 |

## 缺入口或入口不足

| 缺口 | 建议 |
|:---|:---|
| 入场核验异常补录与备用扫码入口 | 第一阶段已新增 `/console/check-in` 只读入场概览和核验记录；主流程仍应是线下闸机、扫码设备或工作人员 App。后续只在小型活动、设备故障或异常补录场景评估备用 Web 扫码页。详见 `docs/production-readiness/check-in-flow.md`。 |
| 评价审核/举报运营增强 | 第一轮已新增 `/console/activity-engagement` 并完成标准端口复测；后续补审核统计、违规原因分类和主办方回复效率。 |
| 平台主办方运营二期能力 | 已有第一轮工作台；后续补高风险动作双人复核、运营员负载/规则分配、主办方活动/订单/退款摘要。 |
| 通知偏好设置 | 用户侧已可访问 `/notifications/settings` 查看站内通知和短信通道状态；SMS 未接入前两个状态按钮保持禁用，标准浏览器复测已完成。 |
| ES 搜索体验 | 搜索页应接真实 ES 响应，支持排序、筛选、失败态、空状态、搜索建议。 |
| Gateway 慢链路可视化 | 管理端可先做只读诊断页，展示 route 延迟和错误聚合，或接 Sentry/日志面板。 |

## 前端验收纪律

- 每个后端能力必须有至少一个前端入口或明确标记“后台任务/内部接口，不对用户展示”。
- 每个入口必须覆盖加载态、空状态、失败态、权限不足态。
- 不能用 mock 数据假装接口可用。
- 涉及新增字段时，同步更新 `frontend/src/types/api.ts`。
- 关键角色都要手工跑一条路径：普通用户、主办方、客服、客服主管、平台主办方运营员、平台管理员。

## 下一步建议

1. 入场核验后续只做异常补录、备用扫码和设备/人员鉴权增强，不重复实现第一阶段只读入口。
2. 继续扩展可回滚写动作旅程验收，优先覆盖评价处理、客服回复等本地可恢复路径。
3. “同意退款”等会调用外部支付能力的路径，需要单独授权或 mock/sandbox 隔离后再验收。
