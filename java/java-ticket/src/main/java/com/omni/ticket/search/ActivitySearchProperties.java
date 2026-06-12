package com.omni.ticket.search;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "omni.search")
public class ActivitySearchProperties {

    private String provider = "db";
    private boolean requireElasticsearch = false;
    private String indexName = "omni_activity_v1";
    private String aliasName = "omni_activity_current";

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
    public boolean isRequireElasticsearch() { return requireElasticsearch; }
    public void setRequireElasticsearch(boolean requireElasticsearch) { this.requireElasticsearch = requireElasticsearch; }
    public String getIndexName() { return indexName; }
    public void setIndexName(String indexName) { this.indexName = indexName; }
    public String getAliasName() { return aliasName; }
    public void setAliasName(String aliasName) { this.aliasName = aliasName; }
}
