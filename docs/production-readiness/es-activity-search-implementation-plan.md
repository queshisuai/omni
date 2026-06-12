# ES 活动搜索 Implementation Plan

> **给执行代理：** REQUIRED SUB-SKILL: Use `executing-plans` 按任务逐项实施；涉及生产代码改动时先用 `test-driven-development`。步骤使用 checkbox（`- [ ]`）跟踪。本项目规则要求不要自动提交和推送，因此本计划不包含 commit step。

**Goal:** 将 C 端活动搜索从 `ActivityService.searchActivities()` 的内存过滤分页迁移到 Elasticsearch，同时保留 PostgreSQL 作为权威数据源。

**Architecture:** `java-ticket` 新增搜索抽象层，DB provider 用于本地和 ES 降级，ES provider 作为生产前主路径；活动、场次、票档、艺人、场馆变更通过 MQ 投递索引更新事件，全量重建由受控 admin/internal 接口触发。前端搜索页移除 mock 降级，ES 或后端不可用时展示真实中文失败态。

**Tech Stack:** Spring Boot 2.7.18、Spring Data Elasticsearch 4.4.x、Elasticsearch 7.17.x、RabbitMQ、PostgreSQL、Next.js、TypeScript。

---

## 版本口径

- 当前父 POM 使用 Spring Boot `2.7.18`，优先使用 `spring-boot-starter-data-elasticsearch`，避免手写未托管版本。
- 官方 Spring Data Elasticsearch 版本矩阵显示 Spring Data `2021.2` 对应 Spring Data Elasticsearch `4.4.x` 和 Elasticsearch `7.17.3`，因此第一阶段按 ES 7.17.x 设计。
- 不直接跳 ES 8/9；如果后续要用 ES 8/9，应先升级 Spring Boot / Spring Data，或单独验证新版 Java API Client 兼容性。
- 本计划涉及新增 Maven 依赖和本地 ES 服务，执行前需要用户确认下载依赖或准备本地 ES 7.17.x。

参考：
- https://docs.spring.io/spring-data/elasticsearch/reference/elasticsearch/versions.html
- https://docs.spring.io/spring-data/elasticsearch/docs/4.4.0/reference/html/

## 非目标

- 不用 ES 替代 PostgreSQL 主库。
- 不在 `java-order`、`java-user` 中直接查询 ticket 表。
- 不把搜索更新做成同步下单链路的一部分。
- 不在 ES 不可用时返回 mock 活动。
- 不一次性接 Pinecone、PostHog 或 Gateway 诊断页。

## 文件结构

### java-ticket

- Modify: `java/java-ticket/pom.xml`
- Modify: `java/java-ticket/src/main/resources/application.yml`
- Modify: `java/java-ticket/src/main/resources/application-prod-split.yml`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/ActivityController.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityAdminService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/SessionAdminService.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/ActivitySearchRequest.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/ActivitySearchProvider.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/ActivitySearchDocument.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/ActivitySearchDocumentBuilder.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/DbActivitySearchProvider.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/ElasticsearchActivitySearchProvider.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/ActivitySearchIndexService.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/ActivitySearchRebuildResult.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/ActivitySearchProperties.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/ActivitySearchIndexEventPublisher.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/ActivitySearchIndexEventListener.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/ActivitySearchIndexController.java`
- Create: `java/java-ticket/src/test/java/com/omni/ticket/search/DbActivitySearchProviderTest.java`
- Create: `java/java-ticket/src/test/java/com/omni/ticket/search/ActivitySearchDocumentBuilderTest.java`
- Create: `java/java-ticket/src/test/java/com/omni/ticket/search/ElasticsearchActivitySearchProviderTest.java`
- Create: `java/java-ticket/src/test/java/com/omni/ticket/search/ActivitySearchIndexServiceTest.java`
- Create: `java/java-ticket/src/test/java/com/omni/ticket/search/ActivitySearchPropertiesTest.java`
- Create: `java/java-ticket/src/test/java/com/omni/ticket/search/ActivitySearchIndexEventPublisherTest.java`
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/controller/ActivityControllerCEndTest.java`

### java-common

- Modify: `java/java-common/src/main/java/com/omni/common/mq/MqConstants.java`
- Create: `java/java-common/src/main/java/com/omni/common/mq/message/ActivitySearchIndexMessage.java`
- Test: `java/java-common/src/test/java/com/omni/common/mq/MqConfigTest.java`

### frontend

- Modify: `frontend/src/app/search/page.tsx`
- Modify: `frontend/src/lib/api.test.ts`
- Modify: `frontend/src/lib/search-experience.ts`
- Modify: `frontend/src/lib/search-experience.test.ts`
- Modify: `frontend/src/types/api.ts`

### scripts / docs

- Create: `scripts/rebuild-activity-search-index.ps1`
- Modify: `docs/production-readiness/frontend-entry-audit.md`
- Modify: `docs/production-readiness/seed-data-audit.md`

---

## Task 1: 搜索抽象和 DB provider 基线

**Files:**
- Create: `ActivitySearchRequest.java`
- Create: `ActivitySearchProvider.java`
- Create: `DbActivitySearchProvider.java`
- Modify: `ActivityService.java`
- Test: `DbActivitySearchProviderTest.java`
- Test: `ActivityControllerCEndTest.java`

- [x] **Step 1: 写 provider 合同测试**

测试目标：保留当前搜索行为，但把内存过滤封装到 provider 中，为 ES 替换留接口。

```java
@Test
void dbProviderFiltersKeywordCityDatePriceAndSorts() {
    ActivitySearchRequest request = ActivitySearchRequest.builder()
            .page(1)
            .size(10)
            .keyword("周杰伦")
            .city("北京")
            .minPrice(new BigDecimal("300"))
            .maxPrice(new BigDecimal("1000"))
            .sort("price_asc")
            .build();

    Page<ActivityVO> result = provider.search(request);

    assertEquals(1, result.getRecords().size());
    assertEquals("周杰伦「嘉年华」世界巡回演唱会 北京站", result.getRecords().get(0).getName());
    assertEquals(1, result.getTotal());
}
```

- [x] **Step 2: 运行红灯**

Run:

```powershell
cd java
mvn -pl java-ticket test "-Dtest=DbActivitySearchProviderTest"
```

Expected:

- 编译失败，原因是 `ActivitySearchRequest`、`ActivitySearchProvider`、`DbActivitySearchProvider` 不存在。

- [x] **Step 3: 增加请求模型**

`ActivitySearchRequest` 使用静态 builder，字段与当前 `/api/ticket/activities` 查询参数一致：

```java
public class ActivitySearchRequest {
    private Integer page;
    private Integer size;
    private Long categoryId;
    private String keyword;
    private String city;
    private LocalDate dateFrom;
    private LocalDate dateTo;
    private BigDecimal minPrice;
    private BigDecimal maxPrice;
    private String saleStatus;
    private Boolean seatMapOnly;
    private Boolean realNameRequired;
    private String sort;

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private final ActivitySearchRequest request = new ActivitySearchRequest();

        public Builder page(Integer page) { request.setPage(page); return this; }
        public Builder size(Integer size) { request.setSize(size); return this; }
        public Builder categoryId(Long categoryId) { request.setCategoryId(categoryId); return this; }
        public Builder keyword(String keyword) { request.setKeyword(keyword); return this; }
        public Builder city(String city) { request.setCity(city); return this; }
        public Builder dateFrom(LocalDate dateFrom) { request.setDateFrom(dateFrom); return this; }
        public Builder dateTo(LocalDate dateTo) { request.setDateTo(dateTo); return this; }
        public Builder minPrice(BigDecimal minPrice) { request.setMinPrice(minPrice); return this; }
        public Builder maxPrice(BigDecimal maxPrice) { request.setMaxPrice(maxPrice); return this; }
        public Builder saleStatus(String saleStatus) { request.setSaleStatus(saleStatus); return this; }
        public Builder seatMapOnly(Boolean seatMapOnly) { request.setSeatMapOnly(seatMapOnly); return this; }
        public Builder realNameRequired(Boolean realNameRequired) { request.setRealNameRequired(realNameRequired); return this; }
        public Builder sort(String sort) { request.setSort(sort); return this; }
        public ActivitySearchRequest build() { return request; }
    }
}
```

- [x] **Step 4: 增加 provider 接口**

```java
public interface ActivitySearchProvider {
    Page<ActivityVO> search(ActivitySearchRequest request);
}
```

- [x] **Step 5: 迁移当前 DB 搜索逻辑**

把 `ActivityService.searchActivities()` 中的过滤、排序、分页逻辑迁移到 `DbActivitySearchProvider`。`ActivityService.searchActivities()` 改为构造 `ActivitySearchRequest` 并委托 provider。

保留当前过滤函数的中文行为约束：

- keyword 匹配活动名、艺人名、城市、分类名。
- city 匹配 `venueCity`。
- price 使用 `minPrice`。
- `seatMapOnly=true` 只返回 `seatMapVisibility=published`。
- `realNameRequired` 精确匹配。

- [x] **Step 6: 跑绿灯**

Run:

```powershell
cd java
mvn -pl java-ticket test "-Dtest=DbActivitySearchProviderTest,ActivityControllerCEndTest"
```

Expected:

- 搜索行为测试通过。
- C 端活动列表接口测试通过。

## Task 2: ES 依赖、配置和启动保护

**Files:**
- Modify: `java/java-ticket/pom.xml`
- Modify: `application.yml`
- Modify: `application-prod-split.yml`
- Create: `ActivitySearchProperties.java`
- Test: `ActivitySearchPropertiesTest.java`

- [x] **Step 1: 写配置测试**

```java
@Test
void defaultsToDbProviderForLocalSafety() {
    ActivitySearchProperties properties = new ActivitySearchProperties();

    assertEquals("db", properties.getProvider());
    assertEquals("omni_activity_current", properties.getAliasName());
    assertFalse(properties.isRequireElasticsearch());
}
```

- [x] **Step 2: 运行红灯**

Run:

```powershell
cd java
mvn -pl java-ticket test "-Dtest=ActivitySearchPropertiesTest"
```

Expected:

- 编译失败，原因是 `ActivitySearchProperties` 不存在。

- [x] **Step 3: 增加 Maven 依赖**

需要用户确认后执行 Maven 依赖下载。确认后在 `java-ticket/pom.xml` 增加：

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-elasticsearch</artifactId>
</dependency>
```

- [x] **Step 4: 增加配置项**

`application.yml`：

```yaml
spring:
  elasticsearch:
    uris: ${ELASTICSEARCH_URIS:http://localhost:9200}

omni:
  search:
    provider: ${OMNI_SEARCH_PROVIDER:db}
    require-elasticsearch: ${OMNI_SEARCH_REQUIRE_ES:false}
    index-name: ${OMNI_ACTIVITY_SEARCH_INDEX:omni_activity_v1}
    alias-name: ${OMNI_ACTIVITY_SEARCH_ALIAS:omni_activity_current}
```

`application-prod-split.yml`：

```yaml
omni:
  search:
    provider: ${OMNI_SEARCH_PROVIDER:elasticsearch}
    require-elasticsearch: ${OMNI_SEARCH_REQUIRE_ES:true}
```

- [x] **Step 5: 跑配置测试**

Run:

```powershell
cd java
mvn -pl java-ticket test "-Dtest=ActivitySearchPropertiesTest"
```

Expected:

- 默认 provider 是 `db`。
- prod-split 可通过环境变量切到 `elasticsearch`。

## Task 3: ES 文档模型和映射构建

**Files:**
- Create: `ActivitySearchDocument.java`
- Create: `ActivitySearchDocumentBuilder.java`
- Test: `ActivitySearchDocumentBuilderTest.java`

- [x] **Step 1: 写文档构建测试**

```java
@Test
void buildsSearchDocumentFromActivityVo() {
    ActivityVO vo = new ActivityVO();
    vo.setId(900001L);
    vo.setName("周杰伦「嘉年华」世界巡回演唱会 北京站");
    vo.setCategoryName("演唱会");
    vo.setArtistName("周杰伦");
    vo.setVenueCity("北京");
    vo.setStartTime(LocalDateTime.parse("2026-06-22T19:30:00"));
    vo.setMinPrice(new BigDecimal("580"));
    vo.setSeatMapVisibility("published");
    vo.setRealNameRequired(true);
    vo.setStatus(1);

    ActivitySearchDocument document = builder.fromActivityVo(vo);

    assertEquals("900001", document.getId());
    assertEquals(900001L, document.getActivityId());
    assertEquals("activity", document.getItemType());
    assertEquals("北京", document.getCity());
    assertEquals(new BigDecimal("580"), document.getMinPrice());
}
```

- [x] **Step 2: 运行红灯**

Run:

```powershell
cd java
mvn -pl java-ticket test "-Dtest=ActivitySearchDocumentBuilderTest"
```

Expected:

- 编译失败，原因是文档模型和 builder 不存在。

- [x] **Step 3: 增加文档字段**

第一版 ES 文档字段：

```java
public class ActivitySearchDocument {
    private String id;
    private Long activityId;
    private Long tourId;
    private Long organizerId;
    private String itemType;
    private String activityName;
    private String artistName;
    private Long categoryId;
    private String categoryName;
    private String city;
    private String venueName;
    private LocalDateTime startTime;
    private BigDecimal minPrice;
    private BigDecimal maxPrice;
    private String saleStatus;
    private String seatMapVisibility;
    private Boolean realNameRequired;
    private Boolean ticketTransferAllowed;
    private Long subscriptionCount;
    private Long paidOrderCount;
    private Double hotScore;
    private LocalDateTime updatedAt;
}
```

- [x] **Step 4: 增加 ES mapping JSON**

mapping 放在 Java 常量或 `src/main/resources/search/omni_activity_v1_mapping.json`。字段类型建议：

```json
{
  "mappings": {
    "properties": {
      "activityId": { "type": "long" },
      "tourId": { "type": "long" },
      "organizerId": { "type": "long" },
      "itemType": { "type": "keyword" },
      "activityName": { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
      "artistName": { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
      "categoryId": { "type": "long" },
      "categoryName": { "type": "keyword" },
      "city": { "type": "keyword" },
      "venueName": { "type": "keyword" },
      "startTime": { "type": "date" },
      "minPrice": { "type": "scaled_float", "scaling_factor": 100 },
      "maxPrice": { "type": "scaled_float", "scaling_factor": 100 },
      "saleStatus": { "type": "keyword" },
      "seatMapVisibility": { "type": "keyword" },
      "realNameRequired": { "type": "boolean" },
      "ticketTransferAllowed": { "type": "boolean" },
      "subscriptionCount": { "type": "long" },
      "paidOrderCount": { "type": "long" },
      "hotScore": { "type": "double" },
      "updatedAt": { "type": "date" }
    }
  }
}
```

- [x] **Step 5: 跑绿灯**

Run:

```powershell
cd java
mvn -pl java-ticket test "-Dtest=ActivitySearchDocumentBuilderTest"
```

Expected:

- 文档构建测试通过。

## Task 4: ES provider 查询路径

**Files:**
- Create: `ElasticsearchActivitySearchProvider.java`
- Modify: `ActivityService.java`
- Test: `ElasticsearchActivitySearchProviderTest.java`

- [x] **Step 1: 写查询构造测试**

测试不连接真实 ES，用 mock `ElasticsearchOperations` 验证请求语义：

```java
@Test
void buildsKeywordAndFilterQuery() {
    ActivitySearchRequest request = ActivitySearchRequest.builder()
            .page(2)
            .size(20)
            .keyword("周杰伦")
            .city("北京")
            .saleStatus("on_sale")
            .seatMapOnly(true)
            .sort("price_desc")
            .build();

    provider.search(request);

    verify(operations).search(queryCaptor.capture(), eq(ActivitySearchDocument.class), any(IndexCoordinates.class));
    NativeSearchQuery query = (NativeSearchQuery) queryCaptor.getValue();
    assertEquals(20, query.getPageable().getPageSize());
    assertEquals(1, query.getPageable().getPageNumber());
}
```

- [x] **Step 2: 运行红灯**

Run:

```powershell
cd java
mvn -pl java-ticket test "-Dtest=ElasticsearchActivitySearchProviderTest"
```

Expected:

- 编译失败，原因是 ES provider 不存在。

- [x] **Step 3: 实现 ES 查询**

查询要求：

- keyword：`activityName`、`artistName`、`categoryName`、`venueName` 使用 `multi_match`。
- categoryId、city、saleStatus、seatMapVisibility、realNameRequired 使用 filter。
- dateFrom/dateTo 使用 `startTime` range。
- minPrice/maxPrice 使用 `minPrice` range。
- sort 映射：
  - `recent` -> `startTime ASC`
  - `newest` -> `updatedAt DESC`
  - `price_asc` -> `minPrice ASC`
  - `price_desc` -> `minPrice DESC`
  - 默认 -> `hotScore DESC, startTime ASC`

- [x] **Step 4: ES 不可用时返回受控错误**

当 `require-elasticsearch=true` 且 ES provider 抛异常时，返回业务错误文案：

```text
搜索服务暂时不可用，请稍后重试
```

本地 `provider=db` 时不触发这个错误。

- [x] **Step 5: 跑绿灯**

Run:

```powershell
cd java
mvn -pl java-ticket test "-Dtest=ElasticsearchActivitySearchProviderTest,ActivityControllerCEndTest"
```

Expected:

- ES provider 查询构造测试通过。
- Controller 错误映射保持中文。

## Task 5: 全量重建索引

**Files:**
- Create: `ActivitySearchIndexService.java`
- Create: `ActivitySearchRebuildResult.java`
- Create: `ActivitySearchIndexController.java`
- Create: `scripts/rebuild-activity-search-index.ps1`
- Test: `ActivitySearchIndexServiceTest.java`

- [x] **Step 1: 写重建测试**

```java
@Test
void rebuildCreatesIndexWritesDocumentsAndSwitchesAlias() {
    when(dbProvider.search(any())).thenReturn(pageWithTwoActivities()).thenReturn(emptyPage());

    ActivitySearchRebuildResult result = indexService.rebuildAll();

    assertEquals(2, result.getIndexedCount());
    verify(indexOperations).createWithMapping();
    verify(operations, times(2)).save(any(ActivitySearchDocument.class), any(IndexCoordinates.class));
}
```

- [x] **Step 2: 运行红灯**

Run:

```powershell
cd java
mvn -pl java-ticket test "-Dtest=ActivitySearchIndexServiceTest"
```

Expected:

- 编译失败，原因是索引服务不存在。

- [x] **Step 3: 实现重建服务**

行为：

- 使用 `dbProvider` 分页读取所有已发布活动。
- 写入 `omni_activity_v{timestamp}` 或配置中的 `index-name`。
- 写完后把 alias `omni_activity_current` 切到新 index。
- 记录 `indexedCount`、`indexName`、`aliasName`、`startedAt`、`finishedAt`。
- 失败时不切 alias。

- [x] **Step 4: 增加受控 rebuild 接口**

建议路径：

```text
POST /api/ticket/admin/search-index/rebuild
```

要求：

- 必须是平台管理员或具备 `activity.manage` / `rbac.manage` 等后台权限的账号。
- 不暴露 `X-Internal-Token` 给前端。
- 响应文案中文。

- [x] **Step 5: 增加脚本**

`scripts/rebuild-activity-search-index.ps1`：

```powershell
param(
  [string]$Gateway = "http://localhost:8088",
  [string]$Token
)

if (-not $Token) {
  throw "请传入后台登录 token：-Token <token>"
}

Invoke-RestMethod -Method Post `
  -Uri "$Gateway/api/ticket/admin/search-index/rebuild" `
  -Headers @{ Authorization = "Bearer $Token" }
```

- [x] **Step 6: 跑重建测试**

Run:

```powershell
cd java
mvn -pl java-ticket test "-Dtest=ActivitySearchIndexServiceTest,AdminControllerTest"
```

Expected:

- 重建服务测试通过。
- admin 权限测试通过。

## Task 6: MQ 增量索引事件

**Files:**
- Modify: `MqConstants.java`
- Create: `ActivitySearchIndexMessage.java`
- Create: `ActivitySearchIndexEventPublisher.java`
- Create: `ActivitySearchIndexEventListener.java`
- Modify: `ActivityAdminService.java`
- Modify: `SessionAdminService.java`
- Test: `MqConfigTest.java`
- Test: `ActivitySearchIndexEventPublisherTest.java`

- [x] **Step 1: 写 MQ 常量测试**

```java
@Test
void declaresSearchIndexExchangeAndQueue() {
    assertEquals("omni.search-index", MqConstants.SEARCH_INDEX_EXCHANGE);
    assertEquals("search.activity.changed", MqConstants.RK_SEARCH_ACTIVITY_CHANGED);
    assertEquals("search.activity.changed.queue", MqConstants.Q_SEARCH_ACTIVITY_CHANGED);
}
```

- [x] **Step 2: 运行红灯**

Run:

```powershell
cd java
mvn -pl java-common test "-Dtest=MqConfigTest"
```

Expected:

- 编译失败或断言失败，原因是 search-index 常量和队列尚未声明。

- [x] **Step 3: 增加 MQ 事件**

新增事件：

```java
public class ActivitySearchIndexMessage implements Serializable {
    private String eventId;
    private Long activityId;
    private String eventType; // UPSERT 或 DELETE
    private LocalDateTime occurredAt;
}
```

新增常量：

```java
public static final String SEARCH_INDEX_EXCHANGE = "omni.search-index";
public static final String RK_SEARCH_ACTIVITY_CHANGED = "search.activity.changed";
public static final String Q_SEARCH_ACTIVITY_CHANGED = "search.activity.changed.queue";
```

- [x] **Step 4: 在变更点发布事件**

第一阶段覆盖：

- 活动发布、下架、恢复、删除。
- 场次新增、修改、停用。
- 票档新增、修改、停用。
- 艺人阵容修改。
- 场馆城市或名称影响搜索展示时发布关联活动重建事件。

发布要求：

- 使用 `MqPublishSupport.afterCommitOrNow()`。
- eventId 使用 `activity-search:{activityId}:{eventType}:{timestamp}`。
- 发送失败只记录 warn，不回滚业务事务。

- [x] **Step 5: 实现监听器**

监听器行为：

- `UPSERT`：从 DB 重新构建单个 activity 文档并写入 alias。
- `DELETE`：从 alias 删除文档。
- ES 不可用：记录错误，消息进入 Rabbit 重试或 DLQ；不影响原业务。

- [x] **Step 6: 跑 MQ 测试**

Run:

```powershell
cd java
mvn -pl java-common,java-ticket test "-Dtest=MqConfigTest,ActivitySearchIndexEventPublisherTest"
```

Expected:

- 常量、队列声明、发布器测试通过。

## Task 7: 前端搜索真实失败态，移除 mock 降级

**Files:**
- Modify: `frontend/src/app/search/page.tsx`
- Modify: `frontend/src/lib/search-experience.ts`
- Modify: `frontend/src/lib/search-experience.test.ts`
- Modify: `frontend/src/lib/api.test.ts`

- [x] **Step 1: 写前端红灯测试**

`search-experience.test.ts` 增加：

```ts
test('formats real search load failure without mock fallback', () => {
  assert.deepEqual(formatSearchLoadFailure(new Error('搜索服务暂时不可用，请稍后重试')), {
    title: '搜索暂时不可用',
    description: '搜索服务暂时不可用，请稍后重试',
    retryLabel: '重新搜索',
  })
})
```

- [x] **Step 2: 运行红灯**

Run:

```powershell
cd frontend
node --test src/lib/search-experience.test.ts
```

Expected:

- 编译或断言失败，原因是 `formatSearchLoadFailure` 不存在。

- [x] **Step 3: 移除搜索页 mock 降级**

修改 `frontend/src/app/search/page.tsx`：

- 删除 `mockCategories`、`mockSections` 搜索失败降级路径。
- 保留空结果推荐，但只基于真实 API 返回的活动候选。
- catch 中设置 `errorMessage`，展示中文失败块和“重新搜索”按钮。
- 失败时不展示假活动，不更新 `total` 为 mock 数量。

- [x] **Step 4: 补 API 参数测试**

`api.test.ts` 已有 `listActivities` 参数覆盖，补齐：

```ts
assert.equal(
  requestedUrl,
  '/api/ticket/activities?page=2&size=20&keyword=%E5%91%A8%E6%9D%B0%E4%BC%A6&city=%E5%8C%97%E4%BA%AC&saleStatus=on_sale&seatMapOnly=true&realNameRequired=true&sort=price_asc'
)
```

- [x] **Step 5: 跑前端测试和类型检查**

Run:

```powershell
cd frontend
node --test src/lib/api.test.ts src/lib/search-experience.test.ts
pnpm typecheck
```

Expected:

- 前端测试通过。
- 类型检查通过。

## Task 8: 本地联调和验收

**Files:**
- No code-only task; verify implementation.

- [x] **Step 1: ES 准备**

执行前需要用户确认本机 ES 7.17.x 已启动，或确认允许拉取 Docker 镜像。不要自动拉镜像。

推荐本机确认命令：

```powershell
curl.exe http://localhost:9200
```

Expected:

- 返回 ES 版本信息，版本为 7.17.x。

- [x] **Step 2: 启动 java-ticket**

Run:

```powershell
cd java/java-ticket
mvn spring-boot:run -Dspring-boot.run.profiles=prod-split -Dspring-boot.run.arguments="--spring.datasource.url=jdbc:postgresql://localhost:5432/omni_ticket_split --spring.datasource.username=postgres --spring.datasource.password=123456 --internal.api.token=omni-local-internal-token --OMNI_SEARCH_PROVIDER=elasticsearch --OMNI_SEARCH_REQUIRE_ES=true --ELASTICSEARCH_URIS=http://localhost:9200"
```

Expected:

- 服务启动成功。
- 无 ES client 初始化错误。

- [x] **Step 3: 重建索引**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/rebuild-activity-search-index.ps1 -Gateway http://localhost:8088 -Token "<后台登录 token>"
```

Expected:

- 返回 `indexedCount > 0`。
- alias 指向最新 index。

- [x] **Step 4: API 验证**

Run:

```powershell
curl.exe --% -s "http://localhost:8088/api/ticket/activities?keyword=周杰伦&city=北京&page=1&size=20&sort=price_asc"
```

Expected:

- HTTP 200。
- `code=200`。
- `data.total` 准确。
- 返回活动来自 ES 查询路径。

- [x] **Step 5: 前端浏览器验证**

打开：

```text
http://localhost:3000/search?keyword=周杰伦&city=北京
```

Expected:

- 搜索结果显示真实活动。
- 筛选、排序、分页不回退 mock。
- ES 停止时显示“搜索暂时不可用”，不展示假活动。

- [x] **Step 6: 边界验证**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
cd java
mvn -pl java-ticket test "-Dtest=*Search*Test,ActivityControllerCEndTest"
cd ../frontend
node --test src/lib/api.test.ts src/lib/search-experience.test.ts
pnpm typecheck
git diff --check
```

Expected:

- 微服务边界通过。
- 后端搜索相关测试通过。
- 前端测试和类型检查通过。
- `git diff --check` 无错误；CRLF warning 可接受。

本机验收记录（2026-06-07）：

- Maven 真实依赖链已解析：`spring-boot-starter-data-elasticsearch:2.7.18` -> `spring-data-elasticsearch:4.4.18` -> `elasticsearch-rest-high-level-client:7.17.15`。
- 本机 ES 使用 Docker 容器 `omni-elasticsearch`，版本 `7.17.15`，未拉取新镜像。
- `java-ticket` 新版 ES 实例在 `18082` 验证通过；旧 `8082` 进程因 Windows 权限无法停止，本次在 Nacos 临时摘除旧 `8082` 实例，网关只路由新版实例。正式收尾时应使用管理员权限停止旧 `8082` 并以 ES 配置重启正式 `8082`。
- 通过网关重建索引成功：`indexedCount=144`；alias `omni_activity_current` 指向最新物理索引，ES `_count=144`。
- 网关连续请求 `/api/ticket/activities?page=1&size=1` 均返回 ES 结果；`keyword=周杰伦&city=北京` 返回 `total=2`。
- 前端 `http://localhost:3000/search?keyword=周杰伦&city=北京` 显示真实结果；停止 ES 时显示“搜索暂时不可用 / 搜索服务暂时不可用，请稍后重试 / 重新搜索”，不展示假活动，恢复 ES 后正常显示真实结果。
- 完整验证命令已通过：`scripts/verify-microservice-boundaries.ps1`、`mvn -pl java-ticket -am test "-Dtest=*Search*Test,ActivitySearchIndexControllerTest,ActivityControllerCEndTest" "-Dsurefire.failIfNoSpecifiedTests=false"`、`node --test src/lib/api.test.ts src/lib/search-experience.test.ts`、`pnpm typecheck`、`git diff --check`。

## 风险与回退

- ES 版本不匹配：保持 `OMNI_SEARCH_PROVIDER=db` 可回退 DB provider；生产前不允许静默返回 mock。
- 索引不一致：全量重建接口可重建 alias；单条变更事件失败进入 MQ 重试或 DLQ。
- 查询性能未达标：先记录 ES 查询耗时和 total，再优化 mapping、排序字段和 filter；不要把分页拉回内存。
- 中文分词不足：第一阶段先用标准 analyzer；如果中文召回质量不足，再评估 IK 分词或拼音插件，插件下载和 ES 节点安装需单独确认。
- 前端体验回退：失败态和空状态必须区分，空结果可以推荐真实候选，失败不能展示假活动。

## 完成标志

- `/api/ticket/activities` 在 `OMNI_SEARCH_PROVIDER=elasticsearch` 下走 ES。
- 活动搜索分页总数由 ES 返回。
- 变更事件能更新索引。
- ES 不可用时返回中文受控错误。
- 前端搜索页不再使用 mock 活动降级。
