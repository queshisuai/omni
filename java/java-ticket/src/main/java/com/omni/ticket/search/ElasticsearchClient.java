package com.omni.ticket.search;

import java.util.Map;

public interface ElasticsearchClient {
    boolean isAvailable();

    default boolean exists(String path) {
        throw new UnsupportedOperationException("暂不支持 ES 资源存在性检查");
    }

    Map<String, Object> search(String indexAlias, Map<String, Object> body);

    void putJson(String path, Map<String, Object> body);

    void postJson(String path, Map<String, Object> body);

    default void postNdjson(String path, String body) {
        throw new UnsupportedOperationException("暂不支持 ES NDJSON 写入");
    }

    void delete(String path);
}
