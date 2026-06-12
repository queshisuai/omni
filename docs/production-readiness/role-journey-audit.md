# 阶段 9 角色旅程审计

> 2026-06-09 当前标准端口审计记录。本文用于对齐“后端已有、前端入口、种子数据、运行态验证”四件事，不直接修改业务代码或数据库。

## 审计方法

- 静态读取前端路由、`console-auth.ts`、`console-paths.ts`、`console/layout.tsx`、`api.ts`、real-demo seed 和 RBAC SQL。
- 通过 Gateway `8088` 登录 6 类种子账号，确认返回角色和权限，不输出 token。
- 通过标准前端 `3000` 浏览器登录 6 类账号，确认默认落点、关键文案和 console error。
- 通过 Gateway `8088` 做只读 API 计数探针，确认 seed 是否支撑对应旅程。

## 账号和默认落点

| 角色 | 账号 | 当前 role | 默认落点 | 浏览器证据 | 状态 |
|:---|:---|:---|:---|:---|:---|
| 平台管理员 | `13800000001` | `platform_super_admin` | `/console` | 可见“平台后台”“运营漏斗摘要”，console error 为 0 | 通过 |
| 主办方 | `13800000002` | `organizer` | `/console` | 可见“主办方后台”“快捷操作”，console error 为 0 | 通过 |
| 普通用户 | `13900000001` | `user` | `/` | 可见“猜你喜欢”和首页真实活动，console error 为 0 | 通过 |
| 客服主管 | `13910000002` | `support` + `support_manager` | `/console/support-accounts` | 可见“客服管理后台”“客服账号管理”，console error 为 0 | 通过 |
| 普通客服 | `13910000003` | `support` + `support_agent` | `/support` | 默认“待处理 1”可见 `DMREAL980006` / `REFREAL985009` 会话和用户上下文分区，console error 为 0 | 通过 |
| 平台主办方运营员 | `13910000004` | `organizer_admin` | `/console/organizer-ops` | 可见“平台主办方运营后台”“运营工作台”，console error 为 0 | 通过 |

## 只读 API 证据

### 普通用户

| 能力 | 接口 | 结果 |
|:---|:---|:---|
| 订单 | `GET /api/order/user/2004` | `code=200`，45 条 |
| 票夹 | `GET /api/order/tickets` | `code=200`，16 条 |
| 退款 | `GET /api/payment/refunds/my` | `code=200`，4 条 |
| 候补 | `GET /api/waitlist/my` | `code=200`，17 条 |
| 通知 | `GET /api/notification/list` | `code=200`，2 条 |
| 客服会话 | `GET /api/user/support/conversations/my` | `code=200`，2 条 |

判断：普通用户旅程的浏览、订单、票夹、退款、候补、通知、客服 seed 都能支撑演示。

### 主办方

| 能力 | 接口 | 结果 |
|:---|:---|:---|
| 活动 | `GET /api/ticket/admin/activities?page=1&size=5` | `code=200`，5 条 |
| 场次 | `GET /api/ticket/admin/sessions?userId=2003&page=1&size=5` | `code=200`，5 条 |
| 订单 | `GET /api/ticket/admin/orders?paidOnly=false` | `code=200`，638 条 |
| 退款 | `GET /api/payment/refunds/admin` | `code=200`，1 条，包含 `REFREAL985009` |
| 入场核验 | `GET /api/ticket/admin/check-in/overview?sessionId=910011` | `code=200`，1 组概览 |

判断：主办方活动、场次、订单、退款处理和入场核验均可演示；退款列表已通过 `REFREAL985009` 补齐主办方 `2003` 的演示数据。

### 平台管理员

| 能力 | 接口 | 结果 |
|:---|:---|:---|
| 运营摘要 | `GET /api/user/console/ops-summary` | `code=200`，9 个漏斗步骤 |
| 异常任务 | `GET /api/user/console/exception-tasks` | `code=200`，7 条 |
| 日结对账 | `GET /api/user/console/reconciliation/batches` | `code=200`，3 条 |
| 评价审核 | `GET /api/ticket/admin/activity-engagement/reviews?status=0` | `code=200`，2 条 |
| 入场核验 | `GET /api/ticket/admin/check-in/overview?sessionId=910011` | `code=200`，1 组概览 |
| 客服账号 | `GET /api/user/support/admin/accounts` | `code=200`，4 条 |
| 主办方运营分配 | `GET /api/user/console/organizer-ops/assignments` | `code=200`，4 条 |

判断：平台管理员主路径已经覆盖运营摘要、异常、对账、评价、核验、客服账号和主办方运营。

### 客服主管和普通客服

| 角色 | 能力 | 接口 | 结果 |
|:---|:---|:---|:---|
| 客服主管 | 客服账号 | `GET /api/user/support/admin/accounts` | `code=200`，4 条 |
| 客服主管 | 会话队列 | `GET /api/user/support/agent/conversations?queue=closed` | `code=200`，11 条 |
| 客服主管 | 用户上下文 | `GET /api/user/support/agent/conversations/988101/context` | `code=200`，1 组上下文 |
| 普通客服 | 会话队列 | `GET /api/user/support/agent/conversations?queue=pending` | `code=200`，1 条，包含 `988102` |
| 普通客服 | 用户上下文 | `GET /api/user/support/agent/conversations/988102/context` | `code=200`，1 组上下文 |

判断：客服主管和普通客服的权限分层有效。普通客服默认待处理队列已补 `988102`，进入 `/support` 后可直接看到待处理会话和 real-demo 用户上下文。

### 平台主办方运营员

| 能力 | 接口 | 结果 |
|:---|:---|:---|
| 主办方分配 | `GET /api/user/console/organizer-ops/assignments` | `code=200`，4 条 |
| 运营员账号 | `GET /api/user/console/organizer-admins` | `code=200`，2 条 |
| 跟进记录 | `GET /api/user/console/organizer-ops/assignments/2003/follow-ups` | `code=200`，3 条 |
| 评价管理 | `GET /api/ticket/admin/activity-engagement/reviews?status=0` | `code=200`，2 条 |
| 入场核验 | `GET /api/ticket/admin/check-in/overview?sessionId=910011` | `code=200`，1 组概览 |

判断：平台主办方运营员已经能进入工作台、分配、跟进、评价和核验能力。内部 role code 仍为 `organizer_admin`，用户可见文案已经收口。

## 本轮发现缺口

| 优先级 | 缺口 | 证据 | 建议 |
|:---|:---|:---|:---|
| P1 已关闭 | 主办方退款处理入口可达但当前无数据 | 已补 `REFREAL985009`，主办方 `GET /api/payment/refunds/admin` 返回 1；浏览器 `/console/refunds` 可见待审核退款和同意/拒绝操作 | 保留 `REFREAL985009` 作为主办方退款处理标准演示样本。 |
| P1 已关闭 | 普通客服默认队列没有待处理演示数据 | 已补 `988102`，普通客服 `GET /api/user/support/agent/conversations?queue=pending` 返回 1 且 `slaOverdue=false`；浏览器 `/support` 默认显示“待处理 1” | 保留 `988102` 作为普通客服默认待处理队列标准演示样本。 |
| P2 部分关闭 | 角色旅程仍未做完整写动作回归 | 已完成退款拒绝、普通客服认领、对账差异处理 3 条可回滚写动作，并通过 re-seed 恢复基线；同意退款、评价处理、客服回复等仍未做 | 后续继续按“可回滚样本优先，外部调用单独授权”补剩余写路径。 |
| P2 已关闭 | 通知偏好页浏览器复测 | 普通用户访问 `/notifications/settings` 可见“通知偏好”、“站内通知已开启”、“短信通知未开启”，两个状态按钮均为 disabled，console warning/error 为 0 | 后续只有接入短信或邮件通道时才需要新增保存写动作验收。 |
| P2 部分关闭 | 同意退款外部 sandbox 路径 | 已获授权并实测 `POST /api/payment/refunds/985009/approve`；链路真实触发 Alipay refund，但出现退款失败态和 Gateway 504，实测后已 re-seed 恢复待审核基线 | 保留为外部 sandbox 不稳定项；常规演示仍优先使用拒绝退款或只读待审核样本。 |
| P2 已关闭 | 支付弹窗二维码获取不及时 | 前端三个支付入口已切到 `createAlipayPagePay()`；弹窗保留但二维码区域改为“打开支付宝沙盒支付页面”链接，浏览器验收确认无 QR canvas/QR SVG | 后续支付完成仍通过同步接口确认，不在前端假设支付成功。 |

## 结论

阶段 9 全角色入口审计第一轮通过：6 类账号默认落点和主要只读能力均可达，前端入口、RBAC 权限和 real-demo seed 大体一致。

两个直接影响演示的 P1 seed 缺口已关闭。第一批可回滚写动作、普通用户 `/notifications/settings` 浏览器复测、授权同意退款实测和支付宝 page-pay 弹窗改造已完成；后续重点转向外部 sandbox 稳定性、剩余高风险写路径和生产前默认配置清理。
