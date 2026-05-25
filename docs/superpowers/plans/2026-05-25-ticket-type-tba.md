# 票档待公布最小模型实施记录

## 目标

- 支持活动或巡演城市站先公布场次，票档稍后补充。
- 不修改 `ticket_type` 表结构，不引入 nullable 价格或库存。
- 无票档时不展示购买入口，后续通过场次管理补齐票档。

## 方案

- 后端以“场次存在但没有有效票档记录”表示票档待公布。
- 巡演站点汇总状态新增 `ticket_tba / 票档待公布`。
- 普通活动详情无票档时展示“票档待公布”。
- 新建活动页允许票档行整行留空；部分填写时提示补完整。

## 验证

- `mvn test -pl java-ticket "-Dtest=TourStationServiceTest"`
- `pnpm typecheck`
- `git diff --check -- <本轮相关文件>`
