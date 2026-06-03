package com.omni.ticket.search;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "omni.search")
public class SearchProperties {

    private Es es = new Es();

    public Es getEs() {
        return es;
    }

    public void setEs(Es es) {
        this.es = es == null ? new Es() : es;
    }

    public static class Es {
        private boolean enabled = false;
        private String uris = "http://localhost:9200";
        private String indexAlias = "omni_activity_search_current";
        private int connectTimeoutMs = 1000;
        private int readTimeoutMs = 1500;

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public String getUris() {
            return uris;
        }

        public void setUris(String uris) {
            this.uris = uris;
        }

        public String getIndexAlias() {
            return indexAlias;
        }

        public void setIndexAlias(String indexAlias) {
            this.indexAlias = indexAlias;
        }

        public int getConnectTimeoutMs() {
            return connectTimeoutMs;
        }

        public void setConnectTimeoutMs(int connectTimeoutMs) {
            this.connectTimeoutMs = connectTimeoutMs;
        }

        public int getReadTimeoutMs() {
            return readTimeoutMs;
        }

        public void setReadTimeoutMs(int readTimeoutMs) {
            this.readTimeoutMs = readTimeoutMs;
        }
    }
}
