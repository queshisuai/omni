package com.omni.ticket.dto;

import java.time.LocalDateTime;

public class SearchTrendingKeywordRow {

    private String keyword;
    private Long searchCount;
    private LocalDateTime lastSearchedAt;

    public String getKeyword() { return keyword; }
    public void setKeyword(String keyword) { this.keyword = keyword; }
    public Long getSearchCount() { return searchCount; }
    public void setSearchCount(Long searchCount) { this.searchCount = searchCount; }
    public LocalDateTime getLastSearchedAt() { return lastSearchedAt; }
    public void setLastSearchedAt(LocalDateTime lastSearchedAt) { this.lastSearchedAt = lastSearchedAt; }
}
