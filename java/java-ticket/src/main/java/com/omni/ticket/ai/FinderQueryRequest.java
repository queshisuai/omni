package com.omni.ticket.ai;

public class FinderQueryRequest {
    private String query;

    public FinderQueryRequest() {
    }

    public FinderQueryRequest(String query) {
        this.query = query;
    }

    public String getQuery() { return query; }
    public void setQuery(String query) { this.query = query; }
}
