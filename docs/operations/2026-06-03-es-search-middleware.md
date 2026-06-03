# ES Search Middleware Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 C 端活动/巡演搜索从 DB 内存过滤升级为 `java-ticket` 内嵌 ES 搜索中间层，并保留 DB 降级能力。

**Architecture:** PostgreSQL 继续作为事实数据源，Elasticsearch 作为搜索读模型。`java-ticket` 暴露现有 `/api/ticket/activities` 合约不变，查询时优先走 ES，ES 未启用、不可达或查询失败时自动回退现有 DB 搜索逻辑。增量同步通过 RabbitMQ 在事务提交后发布搜索索引事件，由 `java-ticket` 消费后重建单个活动或巡演文档。

**Tech Stack:** Java 11, Spring Boot 2.7, MyBatis-Plus, PostgreSQL, RabbitMQ, Elasticsearch 7.17.x HTTP API, Jackson, Next.js/TypeScript existing search UI.

---

## Scope

本计划第一期只覆盖 C 端 `/search` 使用的活动/巡演搜索：

- `frontend/src/app/search/page.tsx`
- `frontend/src/lib/api.ts`
- `java/java-ticket/src/main/java/com/omni/ticket/controller/ActivityController.java`
- `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityService.java`

后台艺人搜索 `AdminController.searchArtists(...)` 暂不改，避免把活动搜索索引和艺人治理索引混在一起。

---

## Download Note

实现阶段会修改 Docker 编排以新增 Elasticsearch。实际运行 `docker compose up elasticsearch` 会拉取 ES 镜像，体积较大，执行前需要单独确认。

本计划推荐 `java-ticket` 通过 HTTP API 调用 ES，不新增 Spring Data Elasticsearch Maven 依赖，减少 Maven 下载和 Spring Boot 2.7 客户端版本冲突风险。

---

## File Structure

- Modify: `docker-compose.yml`
  - 新增 `elasticsearch` 服务、`omni-es-data` volume、`9200` 端口。
- Modify: `scripts/start-infra.ps1`
  - 增加 ES 和 RabbitMQ 端口占用检查、启动和等待。
- Modify: `java/java-ticket/src/main/resources/application.yml`
  - 增加 `omni.search.es.*` 配置，默认关闭 ES 查询。
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/SearchProperties.java`
  - 读取 ES 开关、地址、索引别名、超时。
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/ActivitySearchDocument.java`
  - 活动/巡演搜索文档。
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/ActivitySearchRequest.java`
  - 后端搜索请求对象，替代长参数列表在内部流转。
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/ActivitySearchDocumentBuilder.java`
  - 从 DB 聚合活动、巡演、场次、票档、分类、艺人、城市字段。
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/DatabaseActivitySearchRepository.java`
  - 承接当前 DB 内存过滤逻辑，作为 ES 降级路径。
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/ElasticsearchClient.java`
  - ES HTTP 客户端接口，便于单测替身。
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/RestTemplateElasticsearchClient.java`
  - 使用现有 Spring Web/Jackson 调用 ES HTTP API。
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/ElasticsearchActivitySearchRepository.java`
  - 构造 ES query DSL，执行检索并返回 `Page<ActivityVO>`。
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/ActivitySearchIndexService.java`
  - 创建索引、全量重建、单文档 upsert/delete。
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/ActivitySearchFacade.java`
  - 查询入口，负责 ES 优先和 DB 降级。
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/SearchIndexMqProducer.java`
  - 发布搜索索引增量事件。
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/SearchIndexMessageListener.java`
  - 消费搜索索引事件，失败进入重试/DLQ。
- Create: `java/java-common/src/main/java/com/omni/common/mq/message/SearchIndexMessage.java`
  - 搜索索引事件消息体。
- Modify: `java/java-common/src/main/java/com/omni/common/mq/MqConstants.java`
  - 新增 `omni.search` exchange、routing key、queue、retry、DLQ 常量。
- Modify: `java/java-common/src/main/java/com/omni/common/mq/MqConfig.java`
  - 声明搜索索引队列、重试队列、死信队列。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityService.java`
  - `searchActivities(...)` 委托 `ActivitySearchFacade`；保留原 DB 行为给降级仓库。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityAdminService.java`
  - 活动上下架、删除、下架批处理后发布索引事件。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/TourStationService.java`
  - 巡演城市公告、发布站点、删除草稿、下架巡演后发布索引事件。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/SessionAdminService.java`
  - 场次创建、修改、删除后发布活动索引事件。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/TicketTypeAreaService.java`
  - 票档创建后发布活动索引事件。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/TicketTypeStockRecalculationService.java`
  - 票档库存重算后发布活动索引事件。
- Test: `java/java-common/src/test/java/com/omni/common/mq/MqConfigTest.java`
  - 覆盖搜索索引 MQ 队列声明。
- Create: `java/java-ticket/src/test/java/com/omni/ticket/search/ActivitySearchDocumentBuilderTest.java`
- Create: `java/java-ticket/src/test/java/com/omni/ticket/search/DatabaseActivitySearchRepositoryTest.java`
- Create: `java/java-ticket/src/test/java/com/omni/ticket/search/ElasticsearchActivitySearchRepositoryTest.java`
- Create: `java/java-ticket/src/test/java/com/omni/ticket/search/ActivitySearchFacadeTest.java`
- Create: `java/java-ticket/src/test/java/com/omni/ticket/search/ActivitySearchIndexServiceTest.java`
- Create: `java/java-ticket/src/test/java/com/omni/ticket/search/SearchIndexMessageListenerTest.java`

---

## Index Design

Index alias: `omni_activity_search_current`

Concrete index: `omni_activity_search_v1`

Document id:

```text
activity:{activityId}
tour:{tourId}
```

Document fields:

```json
{
  "id": 10,
  "documentId": "activity:10",
  "itemType": "activity",
  "name": "周末演唱会",
  "description": "活动描述",
  "poster": "/background.png",
  "categoryId": 1,
  "categoryName": "演唱会",
  "artistId": 99,
  "artistName": "周杰伦",
  "artistNames": ["周杰伦", "五月天"],
  "venueCity": "上海",
  "cities": ["上海"],
  "startTime": "2026-06-20T19:30:00",
  "minPrice": 380.00,
  "seatMapVisibility": "published",
  "realNameRequired": true,
  "ticketTransferAllowed": true,
  "status": 1,
  "publishStatus": "published",
  "saleStatus": "on_sale",
  "updatedAt": "2026-06-03T10:00:00",
  "searchText": "周末演唱会 周杰伦 演唱会 上海"
}
```

Mapping uses built-in analyzers only in phase 1. Chinese search uses `searchText` plus keyword subfields. IK or ICU analyzer requires custom ES image/plugin download and is a later enhancement.

---

### Task 1: ES Infrastructure And Search Config

**Files:**
- Modify: `docker-compose.yml`
- Modify: `scripts/start-infra.ps1`
- Modify: `java/java-ticket/src/main/resources/application.yml`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/SearchProperties.java`

- [ ] **Step 1: Add failing config binding test**

Create `java/java-ticket/src/test/java/com/omni/ticket/search/SearchPropertiesTest.java`:

```java
package com.omni.ticket.search;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.source.ConfigurationPropertySources;
import org.springframework.mock.env.MockEnvironment;

import static org.junit.jupiter.api.Assertions.*;

class SearchPropertiesTest {
    @Test
    void bindsElasticsearchSettingsWithSafeDefaults() {
        MockEnvironment env = new MockEnvironment()
                .withProperty("omni.search.es.enabled", "true")
                .withProperty("omni.search.es.uris", "http://localhost:9200")
                .withProperty("omni.search.es.index-alias", "omni_activity_search_current")
                .withProperty("omni.search.es.connect-timeout-ms", "800")
                .withProperty("omni.search.es.read-timeout-ms", "1200");

        SearchProperties properties = Binder.get(env)
                .bind("omni.search", SearchProperties.class)
                .orElseThrow();

        assertTrue(properties.getEs().isEnabled());
        assertEquals("http://localhost:9200", properties.getEs().getUris());
        assertEquals("omni_activity_search_current", properties.getEs().getIndexAlias());
        assertEquals(800, properties.getEs().getConnectTimeoutMs());
        assertEquals(1200, properties.getEs().getReadTimeoutMs());
    }
}
```

- [ ] **Step 2: Run RED**

Run:

```powershell
cd java
mvn -pl java-ticket "-Dtest=SearchPropertiesTest" test
```

Expected: compile failure because `SearchProperties` does not exist.

- [ ] **Step 3: Add config class**

Create `SearchProperties.java`:

```java
package com.omni.ticket.search;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "omni.search")
public class SearchProperties {
    private Es es = new Es();

    public Es getEs() { return es; }
    public void setEs(Es es) { this.es = es == null ? new Es() : es; }

    public static class Es {
        private boolean enabled = false;
        private String uris = "http://localhost:9200";
        private String indexAlias = "omni_activity_search_current";
        private int connectTimeoutMs = 1000;
        private int readTimeoutMs = 1500;

        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
        public String getUris() { return uris; }
        public void setUris(String uris) { this.uris = uris; }
        public String getIndexAlias() { return indexAlias; }
        public void setIndexAlias(String indexAlias) { this.indexAlias = indexAlias; }
        public int getConnectTimeoutMs() { return connectTimeoutMs; }
        public void setConnectTimeoutMs(int connectTimeoutMs) { this.connectTimeoutMs = connectTimeoutMs; }
        public int getReadTimeoutMs() { return readTimeoutMs; }
        public void setReadTimeoutMs(int readTimeoutMs) { this.readTimeoutMs = readTimeoutMs; }
    }
}
```

Enable binding in `TicketApplication.java`:

```java
@EnableConfigurationProperties(SearchProperties.class)
```

Add to `application.yml`:

```yaml
omni:
  mq:
    enabled: true
  search:
    es:
      enabled: ${OMNI_SEARCH_ES_ENABLED:false}
      uris: ${OMNI_SEARCH_ES_URIS:http://localhost:9200}
      index-alias: ${OMNI_SEARCH_ES_INDEX_ALIAS:omni_activity_search_current}
      connect-timeout-ms: ${OMNI_SEARCH_ES_CONNECT_TIMEOUT_MS:1000}
      read-timeout-ms: ${OMNI_SEARCH_ES_READ_TIMEOUT_MS:1500}
```

- [ ] **Step 4: Add Docker service**

Add to `docker-compose.yml`:

```yaml
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:7.17.15
    container_name: omni-elasticsearch
    environment:
      discovery.type: single-node
      xpack.security.enabled: "false"
      ES_JAVA_OPTS: "-Xms512m -Xmx512m"
    ports:
      - "9200:9200"
    volumes:
      - omni-es-data:/usr/share/elasticsearch/data
    healthcheck:
      test: ["CMD-SHELL", "curl -fsS http://localhost:9200 >/dev/null || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 30
```

Add volume:

```yaml
  omni-es-data:
```

Update `scripts/start-infra.ps1` port checks and compose command:

```powershell
Assert-PortAvailableOrOwned -Name "RabbitMQ" -Port 5672 -ContainerName "omni-rabbitmq"
Assert-PortAvailableOrOwned -Name "Elasticsearch" -Port 9200 -ContainerName "omni-elasticsearch"
docker compose up -d postgres redis nacos rabbitmq elasticsearch
Wait-Port -Name "RabbitMQ" -HostName "localhost" -Port 5672 -TimeoutSeconds $TimeoutSeconds
Wait-Port -Name "Elasticsearch" -HostName "localhost" -Port 9200 -TimeoutSeconds $TimeoutSeconds
```

- [ ] **Step 5: Run GREEN**

Run:

```powershell
cd java
mvn -pl java-ticket "-Dtest=SearchPropertiesTest" test
```

Expected: PASS.

---

### Task 2: Search Request And DB Fallback Repository

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/ActivitySearchRequest.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/DatabaseActivitySearchRepository.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityService.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/search/DatabaseActivitySearchRepositoryTest.java`
- Existing test: `java/java-ticket/src/test/java/com/omni/ticket/service/ActivityServiceArtistLineupTest.java`

- [ ] **Step 1: Write failing DB fallback test**

Create `DatabaseActivitySearchRepositoryTest.java` with a fixture list of `ActivityVO` and assert keyword/city/price/real-name filters produce the same result as current service behavior:

```java
@Test
void filtersByKeywordCityPriceRealNameAndSortsByPrice() {
    DatabaseActivitySearchRepository repository = new DatabaseActivitySearchRepository();
    ActivityVO match = activity(10L, "周末演唱会", "周杰伦", "上海", "演唱会", "2026-06-20T19:30:00", "380.00", 1, true);
    ActivityVO miss = activity(11L, "话剧", "剧团", "北京", "话剧", "2026-06-21T19:30:00", "180.00", 1, false);

    Page<ActivityVO> result = repository.filter(
            new Page<ActivityVO>(1, 10, 2).setRecords(List.of(match, miss)),
            ActivitySearchRequest.builder()
                    .page(1).size(10).keyword("周杰伦").city("上海")
                    .minPrice(new BigDecimal("300")).maxPrice(new BigDecimal("500"))
                    .realNameRequired(true).sort("price_asc").build());

    assertEquals(1, result.getTotal());
    assertEquals(10L, result.getRecords().get(0).getId());
}
```

- [ ] **Step 2: Run RED**

Run:

```powershell
cd java
mvn -pl java-ticket "-Dtest=DatabaseActivitySearchRepositoryTest" test
```

Expected: compile failure because repository/request do not exist.

- [ ] **Step 3: Implement request and fallback repository**

Create `ActivitySearchRequest` as a plain Java class with builder methods for the existing search parameters:

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
    // getters, setters, static builder()
}
```

Move the current filtering helpers from `ActivityService` into `DatabaseActivitySearchRepository.filter(...)`:

```java
public Page<ActivityVO> filter(Page<ActivityVO> source, ActivitySearchRequest request) {
    int safePage = request.getPage() == null || request.getPage() <= 0 ? 1 : request.getPage();
    int safeSize = request.getSize() == null || request.getSize() <= 0 ? 10 : request.getSize();
    List<ActivityVO> filtered = source.getRecords().stream()
            .filter(vo -> matchesKeyword(vo, request.getKeyword()))
            .filter(vo -> matchesCity(vo, request.getCity()))
            .filter(vo -> matchesDate(vo, request.getDateFrom(), request.getDateTo()))
            .filter(vo -> matchesPrice(vo, request.getMinPrice(), request.getMaxPrice()))
            .filter(vo -> matchesSaleStatus(vo, request.getSaleStatus()))
            .filter(vo -> !Boolean.TRUE.equals(request.getSeatMapOnly()) || "published".equals(vo.getSeatMapVisibility()))
            .filter(vo -> request.getRealNameRequired() == null || Boolean.valueOf(request.getRealNameRequired()).equals(Boolean.TRUE.equals(vo.getRealNameRequired())))
            .collect(Collectors.toList());
    filtered.sort(searchComparator(request.getSort()));
    int from = Math.min((safePage - 1) * safeSize, filtered.size());
    int to = Math.min(from + safeSize, filtered.size());
    Page<ActivityVO> result = new Page<>(safePage, safeSize, filtered.size());
    result.setRecords(new ArrayList<>(filtered.subList(from, to)));
    result.setTotal(filtered.size());
    result.setPages((filtered.size() + safeSize - 1L) / safeSize);
    return result;
}
```

- [ ] **Step 4: Wire ActivityService to fallback repository**

Keep the public method signature unchanged. Build `ActivitySearchRequest`, call `listActivities(1, fetchSize, categoryId)`, and pass it to the fallback repository.

- [ ] **Step 5: Run GREEN and existing regression**

Run:

```powershell
cd java
mvn -pl java-ticket "-Dtest=DatabaseActivitySearchRepositoryTest,ActivityServiceArtistLineupTest#searchActivitiesFiltersByKeywordCityPriceAndRealName" test
```

Expected: PASS.

---

### Task 3: Search Document Builder

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/ActivitySearchDocument.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/ActivitySearchDocumentBuilder.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/search/ActivitySearchDocumentBuilderTest.java`

- [ ] **Step 1: Write failing document builder tests**

Test an activity document:

```java
@Test
void buildsActivityDocumentWithSearchTextAndFilters() {
    ActivityVO vo = activity(10L, "周末演唱会", "周杰伦", "上海", "演唱会", "2026-06-20T19:30:00", "380.00", 1, true);

    ActivitySearchDocument document = ActivitySearchDocumentBuilder.fromActivityVo(vo);

    assertEquals("activity:10", document.getDocumentId());
    assertEquals("activity", document.getItemType());
    assertEquals("周末演唱会", document.getName());
    assertEquals("上海", document.getVenueCity());
    assertTrue(document.getSearchText().contains("周杰伦"));
    assertEquals("on_sale", document.getSaleStatus());
}
```

Test a tour document:

```java
@Test
void buildsTourDocumentWithTourDocumentId() {
    ActivityVO vo = activity(31L, "巡演", "歌手", "北京 / 上海", "演唱会", null, null, 2, false);
    vo.setItemType("tour");

    ActivitySearchDocument document = ActivitySearchDocumentBuilder.fromActivityVo(vo);

    assertEquals("tour:31", document.getDocumentId());
    assertEquals(List.of("北京", "上海"), document.getCities());
    assertEquals("coming_soon", document.getSaleStatus());
}
```

- [ ] **Step 2: Run RED**

Run:

```powershell
cd java
mvn -pl java-ticket "-Dtest=ActivitySearchDocumentBuilderTest" test
```

Expected: compile failure because document classes do not exist.

- [ ] **Step 3: Implement document and builder**

`ActivitySearchDocument` is a plain Java object mirroring the JSON fields in the Index Design section.

`ActivitySearchDocumentBuilder.fromActivityVo(ActivityVO vo)` must:

- Use `activity:{id}` or `tour:{id}`.
- Split `venueCity` by `/` into `cities`.
- Build `searchText` from name, artist, category, city.
- Map status to `saleStatus`: `1 -> on_sale`, `2 or minPrice null -> coming_soon`, `0/3 -> sold_out`.

- [ ] **Step 4: Run GREEN**

Run:

```powershell
cd java
mvn -pl java-ticket "-Dtest=ActivitySearchDocumentBuilderTest" test
```

Expected: PASS.

---

### Task 4: ES HTTP Client And Query Repository

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/ElasticsearchClient.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/RestTemplateElasticsearchClient.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/ElasticsearchActivitySearchRepository.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/search/ElasticsearchActivitySearchRepositoryTest.java`

- [ ] **Step 1: Write failing ES repository tests**

Use a fake client that captures request JSON and returns one hit. The test must assert filters and sorting are sent to ES:

```java
@Test
void buildsBoolQueryWithKeywordFiltersAndRelevanceSort() {
    FakeElasticsearchClient client = new FakeElasticsearchClient(searchHit("activity:10", document()));
    ElasticsearchActivitySearchRepository repository =
            new ElasticsearchActivitySearchRepository(client, "omni_activity_search_current");

    Page<ActivityVO> result = repository.search(ActivitySearchRequest.builder()
            .page(1).size(20).keyword("周杰伦").city("上海")
            .minPrice(new BigDecimal("180")).maxPrice(new BigDecimal("580"))
            .realNameRequired(true).seatMapOnly(true).sort("relevance").build());

    assertEquals(1, result.getTotal());
    assertEquals(10L, result.getRecords().get(0).getId());
    assertTrue(client.lastSearchJson.contains("\"multi_match\""));
    assertTrue(client.lastSearchJson.contains("\"venueCity.keyword\""));
    assertTrue(client.lastSearchJson.contains("\"realNameRequired\""));
}
```

- [ ] **Step 2: Run RED**

Run:

```powershell
cd java
mvn -pl java-ticket "-Dtest=ElasticsearchActivitySearchRepositoryTest" test
```

Expected: compile failure because ES repository classes do not exist.

- [ ] **Step 3: Implement ES client interface**

```java
public interface ElasticsearchClient {
    boolean isAvailable();
    Map<String, Object> search(String indexAlias, Map<String, Object> body);
    void putJson(String path, Map<String, Object> body);
    void postJson(String path, Map<String, Object> body);
    void delete(String path);
}
```

`RestTemplateElasticsearchClient` should:

- Use `SearchProperties.Es.uris`.
- Set connect/read timeout.
- Throw `IllegalStateException` with Chinese message on non-2xx responses.
- Never log request bodies containing sensitive fields. Search docs do not include credentials or ID numbers.

- [ ] **Step 4: Implement ES query repository**

Query rules:

- `keyword`: `multi_match` against `name`, `artistName`, `artistNames`, `categoryName`, `venueCity`, `searchText`.
- `city`: exact filter on `cities.keyword` or `venueCity.keyword`.
- `categoryId`: term filter.
- `dateFrom/dateTo`: range filter on `startTime`.
- `minPrice/maxPrice`: range filter on `minPrice`.
- `saleStatus`: term filter.
- `seatMapOnly`: `seatMapVisibility=published`.
- `realNameRequired`: term filter.
- `sort=relevance`: `_score desc`, `startTime asc`.
- `sort=recent`: `startTime asc`.
- `sort=newest`: `id desc`.
- `sort=price_asc/price_desc`: `minPrice asc/desc`.
- default: `status desc/on_sale first`, then `startTime asc`.

- [ ] **Step 5: Run GREEN**

Run:

```powershell
cd java
mvn -pl java-ticket "-Dtest=ElasticsearchActivitySearchRepositoryTest" test
```

Expected: PASS.

---

### Task 5: ES Facade With DB Degradation

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/ActivitySearchFacade.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityService.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/search/ActivitySearchFacadeTest.java`

- [ ] **Step 1: Write failing fallback tests**

```java
@Test
void fallsBackToDatabaseWhenEsDisabled() {
    SearchProperties properties = new SearchProperties();
    properties.getEs().setEnabled(false);
    ActivitySearchFacade facade = new ActivitySearchFacade(properties, esRepository, dbRepository);
    when(dbRepository.search(any())).thenReturn(pageOf(10L));

    Page<ActivityVO> result = facade.search(request());

    assertEquals(10L, result.getRecords().get(0).getId());
    verifyNoInteractions(esRepository);
}

@Test
void fallsBackToDatabaseWhenEsThrows() {
    SearchProperties properties = enabledProperties();
    when(esRepository.search(any())).thenThrow(new IllegalStateException("ES不可用"));
    when(dbRepository.search(any())).thenReturn(pageOf(11L));

    Page<ActivityVO> result = facade.search(request());

    assertEquals(11L, result.getRecords().get(0).getId());
}
```

- [ ] **Step 2: Run RED**

Run:

```powershell
cd java
mvn -pl java-ticket "-Dtest=ActivitySearchFacadeTest" test
```

Expected: compile failure because facade does not exist.

- [ ] **Step 3: Implement facade**

```java
public Page<ActivityVO> search(ActivitySearchRequest request) {
    if (!properties.getEs().isEnabled()) {
        return databaseRepository.search(request);
    }
    try {
        return elasticsearchRepository.search(request);
    } catch (RuntimeException e) {
        log.warn("ES搜索失败，已降级到数据库搜索: {}", e.getMessage());
        return databaseRepository.search(request);
    }
}
```

- [ ] **Step 4: Wire ActivityService**

`ActivityService.searchActivities(...)` should build `ActivitySearchRequest` and call `ActivitySearchFacade`. Keep `listActivities(...)` unchanged for home/list fallback and document rebuild.

- [ ] **Step 5: Run GREEN**

Run:

```powershell
cd java
mvn -pl java-ticket "-Dtest=ActivitySearchFacadeTest,ActivityServiceArtistLineupTest#searchActivitiesFiltersByKeywordCityPriceAndRealName" test
```

Expected: PASS.

---

### Task 6: Index Creation And Rebuild

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/ActivitySearchIndexService.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/search/ActivitySearchIndexServiceTest.java`

- [ ] **Step 1: Write failing index service tests**

```java
@Test
void ensureIndexCreatesConcreteIndexAndAlias() {
    FakeElasticsearchClient client = new FakeElasticsearchClient();
    ActivitySearchIndexService service = new ActivitySearchIndexService(client, documentSource, "omni_activity_search_current");

    service.ensureIndex();

    assertTrue(client.paths.contains("/omni_activity_search_v1"));
    assertTrue(client.paths.contains("/_aliases"));
}

@Test
void rebuildAllIndexesDocumentsFromDatabaseProjection() {
    FakeElasticsearchClient client = new FakeElasticsearchClient();
    when(documentSource.listAllSearchDocuments()).thenReturn(List.of(document(10L), document(11L)));
    ActivitySearchIndexService service = new ActivitySearchIndexService(client, documentSource, "omni_activity_search_current");

    int count = service.rebuildAll();

    assertEquals(2, count);
    assertTrue(client.bulkBody.contains("activity:10"));
    assertTrue(client.bulkBody.contains("activity:11"));
}
```

- [ ] **Step 2: Run RED**

Run:

```powershell
cd java
mvn -pl java-ticket "-Dtest=ActivitySearchIndexServiceTest" test
```

Expected: compile failure because index service does not exist.

- [ ] **Step 3: Implement index service**

Responsibilities:

- `ensureIndex()`: create `omni_activity_search_v1` if missing, then attach `omni_activity_search_current` alias.
- `rebuildAll()`: load all public activity/tour documents from DB and bulk index.
- `upsertActivity(Long activityId)`: rebuild one `activity:{id}` doc, delete if not public.
- `upsertTour(Long tourId)`: rebuild one `tour:{id}` doc, delete if not public/announced.
- `deleteDocument(String itemType, Long itemId)`: delete `activity:{id}` or `tour:{id}`.

- [ ] **Step 4: Run GREEN**

Run:

```powershell
cd java
mvn -pl java-ticket "-Dtest=ActivitySearchIndexServiceTest" test
```

Expected: PASS.

---

### Task 7: RabbitMQ Search Index Events

**Files:**
- Create: `java/java-common/src/main/java/com/omni/common/mq/message/SearchIndexMessage.java`
- Modify: `java/java-common/src/main/java/com/omni/common/mq/MqConstants.java`
- Modify: `java/java-common/src/main/java/com/omni/common/mq/MqConfig.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/SearchIndexMqProducer.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/search/SearchIndexMessageListener.java`
- Test: `java/java-common/src/test/java/com/omni/common/mq/MqConfigTest.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/search/SearchIndexMessageListenerTest.java`

- [ ] **Step 1: Write failing MQ config tests**

Add to `MqConfigTest`:

```java
@Test
void searchIndexRetryQueueReturnsToMainExchangeAfterDelay() {
    MqConfig config = new MqConfig();
    Queue queue = config.searchIndexRetryQueue();

    assertEquals(MqConstants.Q_SEARCH_INDEX_RETRY, queue.getName());
    assertEquals(MqConstants.SEARCH_INDEX_EXCHANGE, queue.getArguments().get("x-dead-letter-exchange"));
    assertEquals(MqConstants.RK_SEARCH_INDEX_REFRESH, queue.getArguments().get("x-dead-letter-routing-key"));
}
```

- [ ] **Step 2: Run RED**

Run:

```powershell
cd java
mvn -pl java-common "-Dtest=MqConfigTest#searchIndexRetryQueueReturnsToMainExchangeAfterDelay" test
```

Expected: compile failure because search MQ constants and queues do not exist.

- [ ] **Step 3: Add MQ constants and config**

Add constants:

```java
public static final String SEARCH_INDEX_EXCHANGE = "omni.search";
public static final String SEARCH_INDEX_RETRY_EXCHANGE = "omni.search.retry";
public static final String SEARCH_INDEX_DLX = "omni.search.dlx";
public static final String RK_SEARCH_INDEX_REFRESH = "search.index.refresh";
public static final String RK_SEARCH_INDEX_REFRESH_RETRY = "search.index.refresh.retry";
public static final String RK_SEARCH_INDEX_REFRESH_DLQ = "search.index.refresh.dlq";
public static final String Q_SEARCH_INDEX = "search.index.queue";
public static final String Q_SEARCH_INDEX_RETRY = "search.index.retry.queue";
public static final String Q_SEARCH_INDEX_DLQ = "search.index.dlq";
```

Add queue declarations using the same retry/DLQ pattern as notification/waitlist.

- [ ] **Step 4: Add message body**

```java
public class SearchIndexMessage implements Serializable {
    private static final long serialVersionUID = 1L;
    private String itemType;
    private Long itemId;
    private String action;

    public SearchIndexMessage() {}
    public SearchIndexMessage(String itemType, Long itemId, String action) {
        this.itemType = itemType;
        this.itemId = itemId;
        this.action = action;
    }
    // getters and setters
}
```

Valid values:

- `itemType`: `activity`, `tour`
- `action`: `UPSERT`, `DELETE`

- [ ] **Step 5: Add producer and listener tests**

Listener test:

```java
@Test
void listenerUpsertsActivityDocument() {
    SearchIndexMessageListener listener = new SearchIndexMessageListener(indexService, rabbitTemplate);

    listener.onSearchIndexRefresh(new SearchIndexMessage("activity", 10L, "UPSERT"), emptyRawMessage());

    verify(indexService).upsertActivity(10L);
}

@Test
void listenerDeletesTourDocument() {
    SearchIndexMessageListener listener = new SearchIndexMessageListener(indexService, rabbitTemplate);

    listener.onSearchIndexRefresh(new SearchIndexMessage("tour", 31L, "DELETE"), emptyRawMessage());

    verify(indexService).deleteDocument("tour", 31L);
}
```

- [ ] **Step 6: Implement producer and listener**

Producer uses after-commit publishing:

```java
public void refreshActivity(Long activityId) {
    publish(new SearchIndexMessage("activity", activityId, "UPSERT"));
}

private void publish(SearchIndexMessage message) {
    MqPublishSupport.afterCommitOrNow(() ->
            rabbitTemplate.convertAndSend(MqConstants.SEARCH_INDEX_EXCHANGE, MqConstants.RK_SEARCH_INDEX_REFRESH, message));
}
```

Listener:

```java
@RabbitListener(queues = MqConstants.Q_SEARCH_INDEX)
public void onSearchIndexRefresh(SearchIndexMessage message, Message rawMessage) {
    try {
        if ("DELETE".equals(message.getAction())) {
            indexService.deleteDocument(message.getItemType(), message.getItemId());
        } else if ("tour".equals(message.getItemType())) {
            indexService.upsertTour(message.getItemId());
        } else {
            indexService.upsertActivity(message.getItemId());
        }
    } catch (Exception e) {
        // same retry/DLQ pattern as NotificationMessageListener
    }
}
```

- [ ] **Step 7: Run GREEN**

Run:

```powershell
cd java
mvn -pl java-common,java-ticket "-Dtest=MqConfigTest,SearchIndexMessageListenerTest" test
```

Expected: PASS.

---

### Task 8: Publish Incremental Events From Write Paths

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityAdminService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/TourStationService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/SessionAdminService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/TicketTypeAreaService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/TicketTypeStockRecalculationService.java`
- Test existing service tests touched by constructor changes.

- [ ] **Step 1: Add failing publisher interaction tests**

Extend focused tests for each write path:

- `ActivityAdminServiceTest`: update status publishes activity refresh.
- `ActivityAdminServiceTest`: delete activity publishes activity delete.
- `TourStationServiceTest`: publish station publishes activity refresh and tour refresh.
- `SessionAdminServiceTest`: update session publishes activity refresh.
- `TicketTypeAreaServiceTest`: create ticket type publishes activity refresh.

Example:

```java
@Test
void updateActivityStatusPublishesSearchRefreshAfterStatusChange() {
    when(activityMapper.selectById(10L)).thenReturn(activity(10L, 1, "published"));
    when(userAccessService.requireAdminOrOrganizer(1L)).thenReturn(admin(1L));

    service.updateActivityStatus(10L, new UpdateActivityStatusRequest(1L, 0));

    verify(searchIndexMqProducer).refreshActivity(10L);
}
```

- [ ] **Step 2: Run RED**

Run the focused service tests. Expected: compile failure or verification failure because producer is not wired.

- [ ] **Step 3: Wire optional producer into services**

Add constructor dependency where needed:

```java
private final SearchIndexMqProducer searchIndexMqProducer;
```

Use null-safe helper to preserve old unit-test constructors:

```java
private void refreshActivitySearchIndex(Long activityId) {
    if (searchIndexMqProducer != null && activityId != null) {
        searchIndexMqProducer.refreshActivity(activityId);
    }
}
```

Publish rules:

- Activity published/status changed: `refreshActivity(activityId)`
- Activity deleted/deactivated: `deleteActivity(activityId)` or `refreshActivity(activityId)` if deletion is handled by index service visibility check
- Tour announced/published/deactivated/deleted: `refreshTour(tourId)`
- Station publish creates/updates activity: refresh activity and tour
- Session create/update/delete: refresh related activity
- Ticket type create/update/stock recalculation: refresh related activity

- [ ] **Step 4: Run GREEN**

Run focused tests, then:

```powershell
cd java
mvn -pl java-ticket "-Dtest=ActivityAdminServiceTest,TourStationServiceTest,SessionAdminServiceTest,TicketTypeAreaServiceTest" test
```

Expected: PASS.

---

### Task 9: Frontend Contract Check

**Files:**
- No required frontend code change unless backend response shape changes.
- Test: `frontend/src/lib/search-experience.test.ts`

- [ ] **Step 1: Verify API contract remains unchanged**

Confirm `listActivities(...)` still accepts:

```ts
{
  page,
  size,
  categoryId,
  keyword,
  city,
  dateFrom,
  dateTo,
  minPrice,
  maxPrice,
  saleStatus,
  seatMapOnly,
  realNameRequired,
  sort,
}
```

Confirm response is still `PageResult<ActivityVO>`.

- [ ] **Step 2: Run frontend search utility tests**

Run:

```powershell
node --test frontend/src/lib/search-experience.test.ts
cd frontend
npm run typecheck
```

Expected: PASS. `npm run typecheck` must not introduce new frontend user-visible English copy.

---

### Task 10: Manual Smoke And Operational Checks

**Files:**
- No new files.

- [ ] **Step 1: Start middleware after download approval**

Run only after approving Docker image pull:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-infra.ps1
```

Expected:

- PostgreSQL reachable on `5432`
- Redis reachable on `6379`
- Nacos reachable on `8848`
- RabbitMQ reachable on `5672`
- Elasticsearch reachable on `9200`

- [ ] **Step 2: Rebuild index**

Use the internal rebuild endpoint or a service runner added in Task 6. Expected output includes indexed document count.

- [ ] **Step 3: Search with ES enabled**

Start `java-ticket` with:

```powershell
$env:OMNI_SEARCH_ES_ENABLED="true"
$env:OMNI_SEARCH_ES_URIS="http://localhost:9200"
cd java/java-ticket
mvn spring-boot:run
```

Call:

```powershell
Invoke-WebRequest "http://localhost:8082/api/ticket/activities?keyword=%E5%91%A8%E6%9D%B0%E4%BC%A6&city=%E4%B8%8A%E6%B5%B7&sort=relevance" -UseBasicParsing
```

Expected: HTTP 200, response shape matches existing activity page contract.

- [ ] **Step 4: Verify DB fallback**

Stop ES or set invalid URI:

```powershell
$env:OMNI_SEARCH_ES_URIS="http://localhost:19200"
```

Repeat search request. Expected: HTTP 200 from DB fallback, and `java-ticket` logs `ES搜索失败，已降级到数据库搜索` without exposing stack traces to users.

- [ ] **Step 5: Full regression**

Run:

```powershell
cd java
mvn -pl java-common,java-ticket test
node --test ../frontend/src/lib/search-experience.test.ts
cd ../frontend
npm run typecheck
cd ..
git diff --check
```

Expected: all pass. Maven may download dependencies only if the local cache lacks existing project artifacts; do not run without confirming dependency-download tolerance.

---

## Acceptance Criteria

- `/api/ticket/activities` API contract stays backward-compatible.
- ES enabled and healthy: keyword, city, date, price, sale status, seat map, real-name and sort filters are served by ES.
- ES disabled/unhealthy: the same request falls back to DB search and returns HTTP 200.
- Activity/tour/session/ticket-type writes publish search refresh events only after transaction commit.
- MQ retry and DLQ exist for search index events.
- Full rebuild can recreate `omni_activity_search_current` from PostgreSQL.
- No sensitive user credential, token, certificate number or ID number is written to ES.
- Frontend search page does not need behavior changes for phase 1.

---

## Known Risks

- Built-in ES analyzers are acceptable for phase 1 but not as strong as IK/ICU for Chinese relevance. If product requires advanced Chinese segmentation, build a custom ES image with analyzer plugin in a later phase.
- Index consistency is eventual. Recent write operations may take a short time to appear in search, depending on MQ processing and ES refresh interval.
- `scripts/start-infra.ps1` will start more middleware than before once ES/RabbitMQ are included. This is intentional for local search sync, but requires available ports `5672` and `9200`.
- ES image pull is a large network operation and must be approved before execution.
