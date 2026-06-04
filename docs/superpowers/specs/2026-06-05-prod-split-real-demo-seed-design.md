# Prod Split Real Demo Seed Design

## Goal

新增一套面向本地 `prod-split` 五库联调的真实演示种子数据，不直接写入当前数据库，不进入生产迁移链路。

## Scope

- 活动覆盖采用业务覆盖集：`12` 个城市 × `10` 个分类，共 `120` 条活动。
- 活动名称、海报和来源保持匹配；演出时间统一延后到未来日期。
- 状态均匀覆盖：有票、售罄、显示座位图、隐藏座位图、实名观演人必填、实名观演人非必填、候补、消息。
- 后台运营数据覆盖总票档数、已支付订单数、待处理异常、抢票失败原因分布、热门活动实时流量、候补转化率、支付超时率、风控命中率、退款异常率。
- 后台列表页覆盖活动发布/多站点草稿、艺人档案审核、恢复售票审核/记录、风险案例管理、场馆资料审核、站点变更审核、异常任务。

## Data Ownership

- `ticket`: category、artist、tour、station、activity、venue、venue_application、session、ticket_type、ticket_type_area、session_seat、SeatCraft 相关表、station_config_version。
- `order`: order、order_seat、order_snapshot、electronic_ticket。
- `payment`: payment、refund_request。
- `user`: operation_audit_log、exception_task、reconciliation_batch、reconciliation_detail、reconciliation_difference。
- `notification`: notification。
- `grab`: grab_request、waitlist_entry、waitlist_offer、waitlist_allocation_log。

## Files

- 海报资产：`frontend/public/seed-posters-real/`
- 资产清单：`sql/seeds/prod-split-real-demo/posters.json`
- 种子 SQL：`sql/seeds/prod-split-real-demo/*.sql`
- 覆盖校验：`scripts/verify-prod-split-real-demo-seed.ps1`
- 可选导入脚本：`scripts/apply-prod-split-real-demo-seed.ps1`

## Safety

- 不修改 `sql/production-split/manifest.json`。
- 不把 demo seed 放入 `sql/production-split/*` 迁移链路。
- 不执行导入脚本，不写入当前本机数据库。
- 不提交 git。
