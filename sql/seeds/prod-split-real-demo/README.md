# prod-split 真实演示 seed

这套 seed 只用于本地 prod-split 联调，不属于生产迁移链路。

## 覆盖范围

- 12 个城市 x 10 个分类，共 120 条活动。
- 覆盖有票、售罄、座位图显示/隐藏、实名观演人必填/非必填、候补和通知消息。
- 补齐入场核验演示数据：启用/停用闸机、成功/重复/失败核验记录，以及未入场、已验票、作废、转赠原票四类电子票状态。
- 补齐后台看板、活动发布/多站点草稿、艺人档案审核、恢复售票审核、风险案例、场馆资料审核、站点变更审核、异常任务、日结对账。

## 文件到数据库

- 01-ticket.sql -> omni_ticket_split
- 02-order.sql -> omni_order
- 03-payment.sql -> omni_payment
- 04-user-ops.sql -> omni_user
- 05-notification.sql -> omni_notification
- 06-grab.sql -> omni_grab

## 使用

先运行只读校验：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\verify-prod-split-real-demo-seed.ps1
```

如需写入本机数据库，必须显式确认：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\apply-prod-split-real-demo-seed.ps1 -ConfirmApply
```

不运行 apply 脚本时，不会修改数据库。
