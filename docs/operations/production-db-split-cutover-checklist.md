# 生产物理拆库 Cutover Checklist

## 前置确认

- [ ] 已完成 staging 预演。
- [ ] `powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1` 通过。
- [ ] `powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1` 通过。
- [ ] 已确认 `sql/local/*` 未进入生产迁移链路。
- [ ] 已确认五个目标 PostgreSQL 实例可连接。
- [ ] 已准备原共享库完整备份目录。
- [ ] 已确认维护窗口内不会开放写入流量。

## 停机和备份

- [ ] 公告维护开始。
- [ ] 阻断前端和网关外部流量。
- [ ] 停止 `java-user`、`java-ticket`、`java-order`、`java-payment`、`java-notification`。
- [ ] 对原共享库执行完整备份。
- [ ] 在非生产库验证备份可恢复。

## 导出和导入

- [ ] 执行 `powershell -ExecutionPolicy Bypass -File scripts/export-production-split.ps1` 生成 artifact。
- [ ] 人工确认五个服务 artifact 均包含 `001_pre_data.sql` 和 `002_data.sql`。
- [ ] 执行 `powershell -ExecutionPolicy Bypass -File scripts/import-production-split.ps1` 导入五个目标数据库。
- [ ] 执行 `powershell -ExecutionPolicy Bypass -File scripts/verify-production-split-runtime.ps1`。
- [ ] 对比迁移表行数。
- [ ] 检查 sequence 当前值不小于主键最大值。
- [ ] 检查目标库不存在 cross-owner FK。

## Seata 检查

- [ ] Seata Server 使用固定版本镜像，不使用 latest。
- [ ] 生产 Seata Server 不使用 file store。
- [ ] Seata Server 元数据库与业务库分离。
- [ ] `omni_order`、`omni_ticket_split`、`omni_payment` 已执行 PostgreSQL undo_log DDL。
- [ ] order/ticket/payment 已使用同一 `omni_tx_group`。
- [ ] 已验证 XID 在 `order -> ticket` 和 `payment -> order -> ticket` 传播。
- [ ] 已验证失败回滚链路。

## 配置和启动

- [ ] 设置五个服务的 `SPRING_PROFILES_ACTIVE=prod-split`。
- [ ] 设置五个服务各自的 `SPRING_DATASOURCE_URL`。
- [ ] 设置五个服务各自的 `SPRING_DATASOURCE_USERNAME`。
- [ ] 设置五个服务各自的 `SPRING_DATASOURCE_PASSWORD`。
- [ ] 设置统一的 `OMNI_INTERNAL_TOKEN`。
- [ ] 启动五个业务服务。
- [ ] 确认没有服务连接旧共享库。

## 业务冒烟

- [ ] 用户登录成功。
- [ ] 活动列表和活动详情成功。
- [ ] 场次和票档查询成功。
- [ ] 创建订单成功。
- [ ] 支付二维码或页面支付创建成功。
- [ ] 支付同步后订单变为已支付。
- [ ] 订单详情和订单列表成功。
- [ ] 通知发送和通知列表成功。
- [ ] 管理端活动管理可加载。
- [ ] 管理端场次管理可加载。
- [ ] 管理端订单查看可加载。

## 开放流量

- [ ] 负责人确认所有检查通过。
- [ ] 重新开放网关和前端流量。
- [ ] 观察服务日志和数据库连接 15 分钟。

## 回滚

- [ ] 如果开放流量前失败，停止拆分库服务。
- [ ] 恢复旧 datasource 配置。
- [ ] 重新启动服务连接原共享库。
- [ ] 验证登录、票务浏览、订单列表和管理端。
- [ ] 如果开放流量后失败，先停止写入流量，再决定人工对账或前滚修复。
