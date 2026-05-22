# 活动多艺人 Phase 1 设计

## 目标

Phase 1 先解决活动可以关联多个艺人、后台可以用标签式体验维护阵容、现有种子活动编辑时能正常回填艺人信息的问题。

本阶段不实现艺人审核、风险艺人发布拦截、消息/待办、阵容变更退款。这些能力在后续阶段实现，但表结构会为风险字段预留默认正常状态，避免后续再次重构核心模型。

## 当前问题

现有模型是 `activity.artist_id -> artist.id` 单艺人关系。后台编辑活动原来暴露 `artistId`，这不符合业务语义；真实活动可能有主艺人、联合艺人、参演艺人、邀请嘉宾和保密嘉宾。

现有 `sql/seed.sql` 里活动与艺人是一对一关系，无法演示多艺人、嘉宾、主艺人排序和保密嘉宾。

## 范围

Phase 1 包含：

- 活动支持多个艺人。
- 后台新建/编辑活动使用标签式艺人选择器。
- 可搜索平台艺人库。
- 可拖拽排序。
- 可设置一个主艺人；主艺人强制排第一。
- 可以不设置主艺人，所有艺人按排序展示。
- 支持内置角色和自定义角色名。
- 支持公开/保密可见性；保密嘉宾后台可见、C 端不显示。
- 种子数据升级为真实艺人 + 真实巡演/剧目风格 + 模拟未来档期。
- 现有活动回填 `activity_artist`，编辑时显示艺人标签，不再要求重新填写艺人姓名。

Phase 1 不包含：

- 主办方提交新艺人信息后的 admin 审核流程。
- 风险/劣迹艺人标记和发布拦截。
- 已发布活动因风险艺人停止售票。
- 消息中心、待办消息。
- 阵容变更特殊退款。

## 数据模型

### `artist` 扩展

`artist` 是平台正式艺人档案。Phase 1 允许 admin/种子数据维护更完整的公开资料，主办方通过活动表单搜索选择。

新增字段：

- `alias`：别名、英文名、简称。
- `birth_date`：出生日期，个人艺人可填。
- `birth_year`：出生年份；若只有年份信息则填此字段。
- `gender`：性别或展示性别，个人艺人可填。
- `artist_type`：个人、乐队、组合、剧团、制作团队、运动员、主持人、策展团队等。
- `country_or_region`：国家/地区。
- `agency`：经纪公司或所属机构。
- `representative_works`：代表作品，文本保存。
- `category_tags`：分类标签，逗号分隔文本保存，例如 `歌手,流行,创作人`。
- `external_links`：外部资料链接，文本或 JSON 字符串保存。
- `source_note`：资料来源备注。
- `risk_status`：预留，默认 `normal`。
- `risk_reason`：预留，默认空。
- `risk_marked_by`、`risk_marked_at`、`risk_cleared_by`、`risk_cleared_at`：预留审计字段。

Phase 1 不对 `name` 加唯一约束。同名艺人允许存在，搜索结果必须展示地区、类型、标签、代表作品等辅助信息，避免误选。

### 新增 `activity_artist`

`activity_artist` 表示活动阵容，不直接替代 `artist` 档案。

字段：

- `id`
- `activity_id`
- `artist_id`
- `sort`
- `is_primary`
- `role_type`
- `role_name`
- `visibility`
- `status`
- `create_time`
- `update_time`

约束：

- `activity_id` 引用 `activity(id)`。
- `artist_id` 引用 `artist(id)`。
- `visibility` 取值：`public`、`hidden`。
- `status` 取值第一版用 `1=active`、`0=removed`。
- 同一个活动的 active 阵容中同一个 `artist_id` 只允许出现一次。
- 每个活动最多一个 active `is_primary=true`。

主艺人规则：

- 主艺人可选。
- 有主艺人时，主艺人强制 `sort=1`。
- `activity.artist_id` 保留为兼容字段；有主艺人时同步主艺人 ID。
- 无主艺人时，`activity.artist_id` 不作为展示依据；可以保留旧值用于历史兼容。

角色规则：

- `role_type` 用于系统规则，内置值包括：`primary`、`co_headliner`、`performer`、`special_guest`、`flying_guest`、`host`、`band`、`production_team`、`custom`。
- `role_name` 用于展示，可自定义，例如“开场嘉宾”“返场嘉宾”“策展人”。
- 保密不是角色，而是 `visibility=hidden`。任意角色都可以保密。

## 后端接口

### 艺人搜索

新增：`GET /api/ticket/admin/artists/search?keyword=...`

返回艺人列表，包含：

- `id`
- `name`
- `alias`
- `artistType`
- `countryOrRegion`
- `categoryTags`
- `avatar`
- `representativeWorks`
- `riskStatus`

搜索字段：`name`、`alias`、`category_tags`、`representative_works`。

### 艺人详情

新增：`GET /api/ticket/admin/artists/{id}`

用于后台标签详情或同名艺人确认。

### 活动详情

更新：`GET /api/ticket/admin/activities/{id}`

返回 `artists[]`，包含后台完整阵容，包括保密嘉宾。

同时保留 `artistName` 作为展示摘要：

- 有公开艺人时按 `sort` 拼接公开艺人名称。
- 如果后台详情需要完整摘要，可额外提供 `artistSummary`。

### 新建/编辑活动

更新：`POST /api/ticket/admin/activities`、`PUT /api/ticket/admin/activities/{id}`

请求体新增：

```json
{
  "artists": [
    {
      "artistId": 1,
      "isPrimary": true,
      "roleType": "primary",
      "roleName": "主艺人",
      "visibility": "public",
      "sort": 1
    }
  ]
}
```

后端校验：

- `artists` 可为空，但发布前后续阶段会校验；Phase 1 创建草稿允许为空。
- 所有 `artistId` 必须存在且启用。
- 同一活动内不能重复选择同一艺人。
- `isPrimary=true` 最多一个。
- 如果有主艺人，保存时强制主艺人排第一，并同步 `activity.artist_id`。
- `visibility` 只能为 `public` 或 `hidden`。

### C 端活动列表/详情

更新活动列表和详情 DTO：

- 返回公开艺人列表 `artists[]`。
- `artistName` 作为兼容展示字段，按公开艺人 `sort` 拼接。
- 保密艺人不返回给 C 端。

## 前端设计

### 后台艺人标签选择器

新增复用组件，例如 `ActivityArtistSelector`。

能力：

- 搜索艺人库。
- 选择艺人成为标签。
- 标签展示名称、角色、公开/保密、主艺人标记。
- 支持拖拽排序。
- 支持设置主艺人；主艺人自动移动到第一位。
- 支持角色下拉和自定义角色名。
- 支持公开/保密切换。
- 对同名艺人展示地区、类型、标签、代表作品用于区分。

Phase 1 不提供主办方“提交新艺人信息”完整审核表单；如果搜索不到，可以提示“请联系平台补充艺人档案”或先保留一个受控入口，具体在实施计划中确认。

### 新建活动页

- 将单个 `artistName` 输入升级为艺人标签选择器。
- 提交 `artists[]`。
- 仍保留基本活动、场次、票档和 SeatCraft 流程。

### 编辑活动页

- 加载 `artists[]` 回填标签。
- 可调整排序、主艺人、角色、公开/保密。
- 保存时提交完整 `artists[]`。
- 现有活动如果只有 `activity.artist_id`，后端迁移后会有 `activity_artist`，所以编辑页不再要求重新填写艺人姓名。

### C 端展示

- 活动详情展示公开艺人列表。
- 保密嘉宾不显示。
- 主艺人显示在第一位。
- 活动列表展示艺人摘要。

## 种子数据

`sql/seed.sql` 要改为符合新规则：

- 艺人数据使用真实公开艺人/团队名称和常识级资料。
- 活动名称使用真实巡演/剧目风格，但城市、场馆、时间为模拟未来档期。
- 不使用真实商业海报；继续使用安全占位图或通用演出图。
- 现有 30 个活动都写入 `activity_artist`。
- 增加多艺人演示：音乐节、拼盘演唱会、话剧联合主演、特邀嘉宾、保密嘉宾。
- Phase 1 不加风险/劣迹艺人样例，所有 `risk_status` 默认 `normal`。

示例演示数据方向：

- 演唱会：周杰伦、五月天、林俊杰、张学友等。
- 音乐节：多个乐队/歌手，支持无主艺人排序展示。
- 话剧：开心麻花、孟京辉戏剧作品、联合主演和特邀嘉宾。

## 迁移策略

新增 shared 与 prod-split ticket SQL：

- 扩展 `artist` 字段。
- 创建 `activity_artist`。
- 回填历史数据：对每条 `activity.artist_id IS NOT NULL` 的活动插入一条 `activity_artist`，`is_primary=true`、`sort=1`、`role_type='primary'`、`role_name='主艺人'`、`visibility='public'`。

本机 `omni_ticket_split` 需要应用 prod-split ticket 迁移。

## 微服务边界

- 所有艺人和活动阵容属于 ticket 服务。
- 不新增跨服务 Mapper 或 SQL join。
- notification、refund、risk 流程不在 Phase 1 实现。
- 后续 Phase 4 消息/待办将扩展现有 `java-notification`，不会新建重复消息服务。

## 测试

后端测试：

- 新建活动保存多个艺人。
- 编辑活动替换多个艺人。
- 主艺人最多一个且强制排序第一。
- 无主艺人活动按排序展示。
- 保密嘉宾不出现在 C 端 DTO。
- 管理后台详情返回完整阵容。
- 历史 `activity.artist_id` 回填到 `activity_artist` 的 SQL 可重复执行。

前端验证：

- 新建活动可搜索并添加多个艺人标签。
- 编辑现有活动自动回填标签，不提示重新填写。
- 拖拽排序和设置主艺人后提交 payload 正确。
- C 端详情只展示公开艺人。

## 后续阶段

Phase 2：艺人信息审核、风险艺人、发布拦截。

Phase 3：已发布活动风险处理、停止售票、主办方处理申请、admin 恢复售票审查。

Phase 4：notification 站内消息/待办、阵容变更通知、特殊退款入口。
