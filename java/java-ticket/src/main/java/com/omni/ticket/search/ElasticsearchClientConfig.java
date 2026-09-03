package com.omni.ticket.search;

import org.apache.http.impl.nio.client.HttpAsyncClientBuilder;
import org.apache.http.impl.nio.reactor.IOReactorConfig;
import org.elasticsearch.client.RestClientBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.elasticsearch.RestClientBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConditionalOnProperty(prefix = "omni.search", name = "provider", havingValue = "elasticsearch")
public class ElasticsearchClientConfig {

    @Bean
    public RestClientBuilderCustomizer elasticsearchRestClientThreadCustomizer(
            @Value("${omni.search.elasticsearch.io-thread-count:1}") int ioThreadCount) {
        int safeIoThreadCount = normalizeIoThreadCount(ioThreadCount);
        return new RestClientBuilderCustomizer() {
            @Override
            public void customize(RestClientBuilder builder) {
            }

            @Override
            public void customize(HttpAsyncClientBuilder builder) {
                builder.setDefaultIOReactorConfig(IOReactorConfig.custom()
                        .setIoThreadCount(safeIoThreadCount)
                        .build());
            }
        };
    }

    static int normalizeIoThreadCount(int ioThreadCount) {
        return Math.max(1, ioThreadCount);
    }
}
