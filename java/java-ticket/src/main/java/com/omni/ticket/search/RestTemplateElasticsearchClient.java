package com.omni.ticket.search;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.Map;

@Component
public class RestTemplateElasticsearchClient implements ElasticsearchClient {

    private final SearchProperties searchProperties;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public RestTemplateElasticsearchClient(SearchProperties searchProperties, RestTemplateBuilder builder) {
        this.searchProperties = searchProperties;
        this.objectMapper = new ObjectMapper();
        SearchProperties.Es es = searchProperties.getEs();
        this.restTemplate = builder
                .setConnectTimeout(Duration.ofMillis(es.getConnectTimeoutMs()))
                .setReadTimeout(Duration.ofMillis(es.getReadTimeoutMs()))
                .build();
    }

    @Override
    public boolean isAvailable() {
        try {
            ResponseEntity<Map> response = restTemplate.getForEntity(baseUri(), Map.class);
            return response.getStatusCode().is2xxSuccessful();
        } catch (RuntimeException e) {
            return false;
        }
    }

    @Override
    public boolean exists(String path) {
        try {
            ResponseEntity<Void> response = restTemplate.exchange(
                    baseUri() + normalizePath(path),
                    HttpMethod.HEAD,
                    HttpEntity.EMPTY,
                    Void.class);
            return response.getStatusCode().is2xxSuccessful();
        } catch (HttpClientErrorException.NotFound e) {
            return false;
        } catch (RuntimeException e) {
            throw new IllegalStateException("ES资源检查失败", e);
        }
    }

    @Override
    @SuppressWarnings("unchecked")
    public Map<String, Object> search(String indexAlias, Map<String, Object> body) {
        ResponseEntity<Map> response = restTemplate.postForEntity(baseUri() + "/" + indexAlias + "/_search", body, Map.class);
        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new IllegalStateException("ES搜索请求失败");
        }
        return (Map<String, Object>) response.getBody();
    }

    @Override
    public void putJson(String path, Map<String, Object> body) {
        exchange(path, HttpMethod.PUT, body);
    }

    @Override
    public void postJson(String path, Map<String, Object> body) {
        exchange(path, HttpMethod.POST, body);
    }

    @Override
    public void postNdjson(String path, String body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("application/x-ndjson"));
        ResponseEntity<String> response = restTemplate.exchange(
                baseUri() + normalizePath(path),
                HttpMethod.POST,
                new HttpEntity<>(body, headers),
                String.class);
        if (!response.getStatusCode().is2xxSuccessful()) {
            throw new IllegalStateException("ES批量写入请求失败");
        }
        verifyBulkResponse(response.getBody());
    }

    @Override
    public void delete(String path) {
        try {
            exchange(path, HttpMethod.DELETE, null);
        } catch (HttpClientErrorException.NotFound e) {
        }
    }

    private void exchange(String path, HttpMethod method, Map<String, Object> body) {
        ResponseEntity<String> response = restTemplate.exchange(baseUri() + normalizePath(path), method, new HttpEntity<>(body), String.class);
        if (!response.getStatusCode().is2xxSuccessful()) {
            throw new IllegalStateException("ES写入请求失败");
        }
    }

    private String baseUri() {
        String uris = searchProperties.getEs().getUris();
        String first = StringUtils.hasText(uris) ? uris.split(",")[0].trim() : "http://localhost:9200";
        return first.endsWith("/") ? first.substring(0, first.length() - 1) : first;
    }

    private String normalizePath(String path) {
        if (!StringUtils.hasText(path)) {
            return "/";
        }
        return path.startsWith("/") ? path : "/" + path;
    }

    @SuppressWarnings("unchecked")
    private void verifyBulkResponse(String responseBody) {
        if (!StringUtils.hasText(responseBody)) {
            return;
        }
        try {
            Map<String, Object> response = objectMapper.readValue(responseBody, Map.class);
            if (Boolean.TRUE.equals(response.get("errors"))) {
                throw new IllegalStateException("ES鎵归噺鍐欏叆閮ㄥ垎澶辫触");
            }
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("ES鎵归噺鍐欏叆鍝嶅簲瑙ｆ瀽澶辫触", e);
        }
    }
}
