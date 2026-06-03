package com.omni.ticket.search;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class ActivitySearchIndexService {

    private static final String DEFAULT_INDEX_ALIAS = "omni_activity_search_current";
    private static final String CONCRETE_INDEX = "omni_activity_search_v1";

    private final ElasticsearchClient elasticsearchClient;
    private final ActivitySearchDocumentSource documentSource;
    private final String indexAlias;
    private final ObjectMapper objectMapper;

    @Autowired
    public ActivitySearchIndexService(ElasticsearchClient elasticsearchClient,
                                      ActivitySearchDocumentSource documentSource,
                                      SearchProperties searchProperties,
                                      ObjectMapper objectMapper) {
        this(elasticsearchClient,
                documentSource,
                searchProperties == null ? DEFAULT_INDEX_ALIAS : searchProperties.getEs().getIndexAlias(),
                objectMapper);
    }

    public ActivitySearchIndexService(ElasticsearchClient elasticsearchClient,
                                      ActivitySearchDocumentSource documentSource,
                                      String indexAlias) {
        this(elasticsearchClient, documentSource, indexAlias, new ObjectMapper());
    }

    public ActivitySearchIndexService(ElasticsearchClient elasticsearchClient,
                                      ActivitySearchDocumentSource documentSource,
                                      String indexAlias,
                                      ObjectMapper objectMapper) {
        this.elasticsearchClient = elasticsearchClient;
        this.documentSource = documentSource;
        this.indexAlias = StringUtils.hasText(indexAlias) ? indexAlias : DEFAULT_INDEX_ALIAS;
        this.objectMapper = searchObjectMapper(objectMapper);
    }

    public void ensureIndex() {
        if (!elasticsearchClient.exists("/" + CONCRETE_INDEX)) {
            elasticsearchClient.putJson("/" + CONCRETE_INDEX, Map.of("mappings", mappings()));
        }
        List<Object> actions = new java.util.ArrayList<>();
        if (elasticsearchClient.exists("/_alias/" + indexAlias)) {
            actions.add(Map.of("remove", Map.of("index", "*", "alias", indexAlias)));
        }
        actions.add(Map.of("add", Map.of("index", CONCRETE_INDEX, "alias", indexAlias)));
        elasticsearchClient.postJson("/_aliases", Map.of("actions", actions));
    }

    public int rebuildAll() {
        recreateIndex();
        List<ActivitySearchDocument> documents = documentSource.listAllSearchDocuments();
        bulkIndex(documents);
        return documents.size();
    }

    public void upsertActivity(Long activityId) {
        if (activityId == null) {
            return;
        }
        documentSource.findActivityDocument(activityId)
                .ifPresentOrElse(this::indexDocument, () -> deleteDocument("activity", activityId));
    }

    public void upsertTour(Long tourId) {
        if (tourId == null) {
            return;
        }
        documentSource.findTourDocument(tourId)
                .ifPresentOrElse(this::indexDocument, () -> deleteDocument("tour", tourId));
    }

    public void deleteDocument(String itemType, Long itemId) {
        if (!StringUtils.hasText(itemType) || itemId == null) {
            return;
        }
        elasticsearchClient.delete("/" + indexAlias + "/_doc/" + itemType.trim() + ":" + itemId);
    }

    private void bulkIndex(List<ActivitySearchDocument> documents) {
        if (documents == null || documents.isEmpty()) {
            return;
        }
        StringBuilder ndjson = new StringBuilder();
        for (ActivitySearchDocument document : documents) {
            appendJsonLine(ndjson, Map.of("index", Map.of("_index", indexAlias, "_id", document.getDocumentId())));
            appendJsonLine(ndjson, document);
        }
        elasticsearchClient.postNdjson("/_bulk", ndjson.toString());
    }

    private void recreateIndex() {
        if (elasticsearchClient.exists("/" + CONCRETE_INDEX)) {
            elasticsearchClient.delete("/" + CONCRETE_INDEX);
        }
        ensureIndex();
    }

    private void indexDocument(ActivitySearchDocument document) {
        elasticsearchClient.putJson("/" + indexAlias + "/_doc/" + document.getDocumentId(), toMap(document));
    }

    private void appendJsonLine(StringBuilder ndjson, Object value) {
        try {
            ndjson.append(objectMapper.writeValueAsString(value)).append('\n');
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("搜索索引文档序列化失败", e);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> toMap(ActivitySearchDocument document) {
        return objectMapper.convertValue(document, Map.class);
    }

    private Map<String, Object> mappings() {
        Map<String, Object> keyword = Map.of("type", "keyword");
        Map<String, Object> text = Map.of("type", "text", "fields", Map.of("keyword", keyword));
        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("id", Map.of("type", "long"));
        properties.put("documentId", keyword);
        properties.put("itemType", keyword);
        properties.put("name", text);
        properties.put("description", text);
        properties.put("poster", keyword);
        properties.put("categoryId", Map.of("type", "long"));
        properties.put("categoryName", text);
        properties.put("artistId", Map.of("type", "long"));
        properties.put("artistName", text);
        properties.put("artistNames", text);
        properties.put("venueCity", text);
        properties.put("cities", text);
        properties.put("startTime", Map.of("type", "date"));
        properties.put("minPrice", Map.of("type", "scaled_float", "scaling_factor", 100));
        properties.put("seatMapVisibility", keyword);
        properties.put("realNameRequired", Map.of("type", "boolean"));
        properties.put("ticketTransferAllowed", Map.of("type", "boolean"));
        properties.put("status", Map.of("type", "integer"));
        properties.put("publishStatus", keyword);
        properties.put("saleStatus", keyword);
        properties.put("updatedAt", Map.of("type", "date"));
        properties.put("searchText", Map.of("type", "text"));
        return Map.of("properties", properties);
    }

    private static ObjectMapper searchObjectMapper(ObjectMapper objectMapper) {
        ObjectMapper mapper = objectMapper == null ? new ObjectMapper() : objectMapper.copy();
        mapper.findAndRegisterModules();
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        return mapper;
    }
}
