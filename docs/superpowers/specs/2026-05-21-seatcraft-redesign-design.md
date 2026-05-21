# SeatCraft 推倒重建设计

## 目标

删除现有 SeatCraft 设计器及其旧分区兼容 UI，重建座位生成、座位图编辑、票档绑定和 C 端选座体验。业务逻辑不变：仍通过现有 ticket 服务 SeatCraft layout API 保存，仍由票档绑定区域，C 端仍按座位 id 创建订单。

## 删除范围

- 删除外部工具目录 `seatcraft/`，避免继续污染主项目实现。
- 删除主前端旧设计器内容：旧 `SeatLayoutDesigner`、旧 `SeatCanvas`、旧 `SeatLayoutControls`、旧 section 创建/编辑 UI、旧点阵 fallback。
- 不保留旧 section 创建入口；历史 section 数据不作为新设计器编辑对象。

## 保留边界

- 后端 API、数据库表和保存格式尽量保持不变。
- 前端 API 函数继续使用 `getVenueDefaultLayout/updateVenueDefaultLayout`、`getActivitySeatLayout/updateActivitySeatLayout`、`getSessionSeatLayout/updateSessionSeatLayout`。
- 票档创建、库存、下单、支付、退款等业务流程不改。
- 新设计器输出仍写入 layout 的 block layout 数据，C 端选座从同一数据生成座位。

## 新模型

新建只允许 3 类座位块：

- 方阵：规则行列座位，字段包括名称、排数、列数、排距、座距、位置、旋转、颜色。
- 剧场扇形：同心圆弧座席，字段包括名称、排数、每排座数、内半径、排距、起始角、结束角、位置、旋转、颜色。
- 站区：不生成单座，只记录容量、宽、高、位置、旋转、颜色。

生成规则：

- 方阵按 `rows * cols` 生成座位 id：`{blockKey}-{rowNo}-{seatNo}`。
- 剧场扇形按同心圆弧生成，后排半径递增，座位沿每排弧线均匀分布。
- 站区只参与区域展示和容量展示，不进入单座选择。
- 新增块默认放到画布中心附近，不自动排版、不吸附。
- 一键排版作为显式工具，只在用户点击时调整块位置。

## 编辑器交互

采用 A 方案：左工具箱、中画布、右属性面板。

左工具箱包含：

- 创建工具：方阵、剧场扇形、站区、文字/标注。
- 编辑工具：选择、拖拽、框选、多选移动、键盘微调。
- 快捷操作：一键排版、复制、镜像、对齐、撤销、重做。
- 图层列表：选中、重命名、删除、锁定座位块。

中画布包含：

- SVG 或 Canvas 坐标画布。
- 舞台可拖拽。
- 座位块可选中、拖拽、旋转。
- 支持缩放和平移。
- 不做隐式自动排版。

右属性面板包含：

- 当前选中块基础属性。
- 当前类型的生成参数。
- 票档绑定区域。
- 坐标、旋转、颜色等通用属性。

## C 端选座

- C 端只使用新生成器渲染座位。
- 用户选择票档后，画布自动聚焦该票档绑定的座位块。
- 用户点击或切换到某个票位/票档时，画布要像镜头拉近一样平滑缩放到对应方阵、剧场扇形或站区的 bounds。
- 方阵/剧场扇形支持单座选择。
- 站区显示容量与状态，但当前不生成单座；如后端不支持站区下单，前端提示该票档暂不支持选座购买。
- 无 layout 时仍提示缺少 SeatCraft 座位图，并提供后台创建入口。

## 票档绑定

- B 端票档绑定从旧 section 绑定改为 block 绑定。
- 票档可以绑定一个或多个座位块。
- 绑定结果继续通过现有 SeatCraft layout 数据携带，不新增跨服务访问。

## 迁移策略

- 不再维护旧 section 编辑能力。
- 当前未发布或测试活动建议重新创建 SeatCraft layout。
- 如读取到仅有旧 sections、没有 block layout 的数据，前端显示“旧座位图需重建”，并提供创建新 SeatCraft 的入口。
- 不自动转换旧 section，避免把旧脏数据带入新设计器。

## 测试

- 纯函数测试座位生成：方阵、剧场扇形、站区、一键排版。
- 前端类型检查：`pnpm typecheck`。
- ticket 后端测试：`mvn test -pl java-ticket -am`。
- 微服务边界检查：`scripts/verify-microservice-boundaries.ps1`。

## 非目标

- 不新增 MQ、outbox、CDC 或跨服务 SQL。
- 不修改支付、订单、退款业务逻辑。
- 不恢复旧点阵或旧 section 编辑器。
- 不在本次实现独立 seatcraft 子应用或 iframe。
