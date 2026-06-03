package com.omni.ticket.search;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ActivitySearchIndexServiceTest {

    @Test
    void ensureIndexCreatesConcreteIndexAndAlias() {
        FakeElasticsearchClient client = new FakeElasticsearchClient();
        ActivitySearchIndexService service =
                new ActivitySearchIndexService(client, new FakeDocumentSource(), "omni_activity_search_current");

        service.ensureIndex();

        assertTrue(client.paths.contains("/omni_activity_search_v1"));
        assertTrue(client.paths.contains("/_aliases"));
    }

    @Test
    void ensureIndexDoesNotSendUnsupportedIgnoreUnavailableWhenAliasMissing() throws JsonProcessingException {
        FakeElasticsearchClient client = new FakeElasticsearchClient();
        ActivitySearchIndexService service =
                new ActivitySearchIndexService(client, new FakeDocumentSource(), "omni_activity_search_current");

        service.ensureIndex();

        String aliasJson = new ObjectMapper().writeValueAsString(client.lastAliasBody);
        assertFalse(aliasJson.contains("ignore_unavailable"));
        assertTrue(aliasJson.contains("\"add\""));
    }

    @Test
    void rebuildAllBulkIndexesDocumentsFromDatabaseProjection() {
        FakeElasticsearchClient client = new FakeElasticsearchClient();
        FakeDocumentSource source = new FakeDocumentSource(document(10L), document(11L));
        ActivitySearchIndexService service =
                new ActivitySearchIndexService(client, source, "omni_activity_search_current");

        int count = service.rebuildAll();

        assertEquals(2, count);
        assertEquals("/_bulk", client.lastBulkPath);
        assertTrue(client.lastBulkBody.contains("activity:10"));
        assertTrue(client.lastBulkBody.contains("activity:11"));
        assertTrue(client.lastBulkBody.contains("\"omni_activity_search_current\""));
    }

    @Test
    void rebuildAllRecreatesConcreteIndexBeforeBulkIndexing() {
        FakeElasticsearchClient client = new FakeElasticsearchClient();
        client.existingPaths.add("/omni_activity_search_v1");
        FakeDocumentSource source = new FakeDocumentSource(document(10L));
        ActivitySearchIndexService service =
                new ActivitySearchIndexService(client, source, "omni_activity_search_current");

        service.rebuildAll();

        assertTrue(client.paths.contains("DELETE /omni_activity_search_v1"));
        assertTrue(client.paths.indexOf("DELETE /omni_activity_search_v1") < client.paths.indexOf("POST /_bulk"));
    }

    @Test
    void upsertActivityDeletesOldDocumentWhenSourceIsNotPublic() {
        FakeElasticsearchClient client = new FakeElasticsearchClient();
        ActivitySearchIndexService service =
                new ActivitySearchIndexService(client, new FakeDocumentSource(), "omni_activity_search_current");

        service.upsertActivity(10L);

        assertTrue(client.paths.contains("DELETE /omni_activity_search_current/_doc/activity:10"));
    }

    private static ActivitySearchDocument document(Long id) {
        ActivitySearchDocument document = new ActivitySearchDocument();
        document.setId(id);
        document.setDocumentId("activity:" + id);
        document.setItemType("activity");
        document.setName("演唱会" + id);
        document.setArtistName("歌手");
        document.setVenueCity("上海");
        document.setCities(List.of("上海"));
        document.setStartTime(LocalDateTime.of(2026, 6, 20, 19, 30));
        document.setMinPrice(new BigDecimal("380.00"));
        document.setSeatMapVisibility("published");
        document.setRealNameRequired(true);
        document.setTicketTransferAllowed(true);
        document.setStatus(1);
        document.setPublishStatus("published");
        document.setSaleStatus("on_sale");
        document.setSearchText("演唱会 歌手 上海");
        return document;
    }

    private static class FakeDocumentSource implements ActivitySearchDocumentSource {
        private final List<ActivitySearchDocument> documents;

        FakeDocumentSource(ActivitySearchDocument... documents) {
            this.documents = List.of(documents);
        }

        @Override
        public List<ActivitySearchDocument> listAllSearchDocuments() {
            return documents;
        }

        @Override
        public Optional<ActivitySearchDocument> findActivityDocument(Long activityId) {
            return documents.stream().filter(document -> activityId.equals(document.getId())).findFirst();
        }

        @Override
        public Optional<ActivitySearchDocument> findTourDocument(Long tourId) {
            return Optional.empty();
        }
    }

    private static class FakeElasticsearchClient implements ElasticsearchClient {
        private final List<String> paths = new ArrayList<>();
        private final List<String> existingPaths = new ArrayList<>();
        private String lastBulkPath;
        private String lastBulkBody;
        private Map<String, Object> lastAliasBody;

        @Override
        public boolean isAvailable() {
            return true;
        }

        @Override
        public boolean exists(String path) {
            return existingPaths.contains(path);
        }

        @Override
        public Map<String, Object> search(String indexAlias, Map<String, Object> body) {
            return Map.of();
        }

        @Override
        public void putJson(String path, Map<String, Object> body) {
            paths.add(path);
        }

        @Override
        public void postJson(String path, Map<String, Object> body) {
            paths.add(path);
            if ("/_aliases".equals(path)) {
                lastAliasBody = body;
            }
        }

        @Override
        public void postNdjson(String path, String body) {
            this.lastBulkPath = path;
            this.lastBulkBody = body;
            paths.add("POST " + path);
        }

        @Override
        public void delete(String path) {
            existingPaths.remove(path);
            paths.add("DELETE " + path);
        }
    }
}
