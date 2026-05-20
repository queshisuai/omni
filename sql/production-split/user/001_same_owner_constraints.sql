-- owner: java-user

ALTER TABLE organizer_application
    ADD CONSTRAINT fk_organizer_application_user
    FOREIGN KEY (user_id) REFERENCES "user"(id);

ALTER TABLE organizer_application
    ADD CONSTRAINT fk_organizer_application_reviewer
    FOREIGN KEY (reviewer_id) REFERENCES "user"(id);

ALTER TABLE user_auth
    ADD CONSTRAINT fk_user_auth_user
    FOREIGN KEY (user_id) REFERENCES "user"(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_phone ON "user"(phone);
CREATE INDEX IF NOT EXISTS idx_user_auth_user ON user_auth(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizer_application_user_id ON organizer_application(user_id);
CREATE INDEX IF NOT EXISTS idx_organizer_application_status ON organizer_application(status);
CREATE INDEX IF NOT EXISTS idx_organizer_application_create_time ON organizer_application(create_time DESC);
