# Team Grab 运行时验证 Runbook

## 自动验证

在仓库根目录运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-team-grab-runtime-risk.ps1
```

脚本会验证：

- Postgres team-grab 事务、found-order 恢复和 fencing 行为。
- Redis queue、admission marker 和 team trigger lock 行为。
- 测试连接被强制固定到本机 PostgreSQL `localhost:5432` 和 Docker Redis `localhost:6379`。

如果 Redis 容器未运行，先执行：

```powershell
docker compose up -d redis
```

PostgreSQL 使用本机服务，不再由 Docker Compose 启动；请确认本机 `localhost:5432` 可连接。

## 浏览器 E2E 准备

这部分覆盖自动脚本无法证明的真实支付和页面恢复风险。建议使用本地服务：

- Frontend: `http://localhost:3000`
- Java API: `http://localhost:8088`
- Grab service: `http://localhost:3001`

准备条件：

- 2-6 个可登录测试账号，至少一个队长和一个队员。
- 一个有座位、同一票档库存足够的测试场次。
- 支付可使用本地沙箱、测试二维码，或可控的支付失败模拟；不要使用真实用户资金。

## 浏览器 E2E 步骤

1. 队长在活动详情页创建小队，选择同一场次和票档，策略选择优先连座，并允许同票档兜底。
2. 队员通过邀请信息加入并确认参与，小队人数达到 2-6。
3. 使用两个浏览器会话或无痕窗口，让队长和队员同时点击为小队抢票。
4. 期望只生成一个 team grab request；页面显示同一个抢票进度，其他触发者进入同一请求状态。
5. 锁票成功后，队长看到待支付入口，队员看到队长待支付状态。
6. 人为让第一次支付二维码创建或支付流程失败一次，确认页面提供重新发起支付或进入订单页支付的入口。
7. 刷新浏览器页面，确认仍能恢复小队、订单和支付入口。
8. 队长完成支付后，触发或等待支付同步，确认每个确认成员都有座位分配。
9. 重新创建一轮小队锁票但不支付，等待订单超时，确认座位释放，小队进入可重试状态。

## 验收证据

记录以下证据即可关闭人工验证：

- 并发点击后只有一个 `team_grab_request` 和一个关联 `grab_request`。
- 锁票后队伍状态为 `LOCKED`，订单为待支付。
- 支付失败后可重试；刷新后支付入口不丢失。
- 支付成功后队伍状态为 `PAID`，成员分配记录完整。
- 订单超时后队伍状态为 `EXPIRED` 或可重试失败态，座位不再被该 team request 持有。

## 清理

验证结束后取消未支付订单或等待超时释放，避免测试座位长期占用。不要手工修改库存；库存最终以 ticket/order 服务的锁票和订单结果为准。

## 库存展示说明

库存展示不是绝对实时数据，可能受到队列处理、锁票、订单状态同步等因素影响。前端只能展示可见库存或趋势，最终结果必须以锁票和订单结果为准。
