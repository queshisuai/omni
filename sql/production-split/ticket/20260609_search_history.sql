-- owner: java-ticket
-- 搜索历史用于登录用户历史搜索和动态热门榜单聚合。

CREATE TABLE IF NOT EXISTS search_history (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    keyword VARCHAR(128) NOT NULL,
    search_count INTEGER NOT NULL DEFAULT 1,
    last_searched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE search_history
    ADD COLUMN IF NOT EXISTS user_id BIGINT NOT NULL,
    ADD COLUMN IF NOT EXISTS keyword VARCHAR(128) NOT NULL,
    ADD COLUMN IF NOT EXISTS search_count INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS last_searched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS uk_search_history_user_keyword
    ON search_history (user_id, keyword);

CREATE INDEX IF NOT EXISTS idx_search_history_user_last
    ON search_history (user_id, last_searched_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_search_history_keyword_heat
    ON search_history (keyword, search_count DESC, last_searched_at DESC);
