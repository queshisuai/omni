package com.omni.ticket.search;

import org.junit.jupiter.api.Test;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class RestTemplateElasticsearchClientTest {

    @Test
    void postNdjsonThrowsWhenBulkResponseContainsItemErrors() {
        SearchProperties properties = new SearchProperties();
        properties.getEs().setUris("http://localhost:9200");
        RestTemplateElasticsearchClient client =
                new RestTemplateElasticsearchClient(properties, new RestTemplateBuilder());
        RestTemplate restTemplate = (RestTemplate) ReflectionTestUtils.getField(client, "restTemplate");
        MockRestServiceServer server = MockRestServiceServer.bindTo(restTemplate).build();
        server.expect(requestTo("http://localhost:9200/_bulk"))
                .andExpect(content().contentType(MediaType.parseMediaType("application/x-ndjson")))
                .andRespond(withSuccess("{\"errors\":true,\"items\":[]}", MediaType.APPLICATION_JSON));

        assertThrows(IllegalStateException.class, () -> client.postNdjson("/_bulk", "{}\n{}\n"));
        server.verify();
    }

    @Test
    void deleteIgnoresNotFoundForIdempotentIndexMessages() {
        SearchProperties properties = new SearchProperties();
        properties.getEs().setUris("http://localhost:9200");
        RestTemplateElasticsearchClient client =
                new RestTemplateElasticsearchClient(properties, new RestTemplateBuilder());
        RestTemplate restTemplate = (RestTemplate) ReflectionTestUtils.getField(client, "restTemplate");
        MockRestServiceServer server = MockRestServiceServer.bindTo(restTemplate).build();
        server.expect(requestTo("http://localhost:9200/omni_activity_search_current/_doc/activity:10"))
                .andRespond(withStatus(HttpStatus.NOT_FOUND));

        assertDoesNotThrow(() -> client.delete("/omni_activity_search_current/_doc/activity:10"));
        server.verify();
    }
}
