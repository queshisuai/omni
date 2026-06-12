package com.omni.ticket.search;

import java.time.LocalDateTime;

public class ActivitySearchRebuildResult {

    private Long indexedCount;
    private String indexName;
    private String aliasName;
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;

    public Long getIndexedCount() { return indexedCount; }
    public void setIndexedCount(Long indexedCount) { this.indexedCount = indexedCount; }
    public String getIndexName() { return indexName; }
    public void setIndexName(String indexName) { this.indexName = indexName; }
    public String getAliasName() { return aliasName; }
    public void setAliasName(String aliasName) { this.aliasName = aliasName; }
    public LocalDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(LocalDateTime startedAt) { this.startedAt = startedAt; }
    public LocalDateTime getFinishedAt() { return finishedAt; }
    public void setFinishedAt(LocalDateTime finishedAt) { this.finishedAt = finishedAt; }
}
