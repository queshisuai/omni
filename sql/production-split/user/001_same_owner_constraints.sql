-- owner: java-user

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_organizer_application_user') THEN
        ALTER TABLE organizer_application
            ADD CONSTRAINT fk_organizer_application_user
            FOREIGN KEY (user_id) REFERENCES "user"(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_organizer_application_reviewer') THEN
        ALTER TABLE organizer_application
            ADD CONSTRAINT fk_organizer_application_reviewer
            FOREIGN KEY (reviewer_id) REFERENCES "user"(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_auth_user') THEN
        ALTER TABLE user_auth
            ADD CONSTRAINT fk_user_auth_user
            FOREIGN KEY (user_id) REFERENCES "user"(id);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_phone ON "user"(phone);
CREATE INDEX IF NOT EXISTS idx_user_auth_user ON user_auth(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizer_application_user_id ON organizer_application(user_id);
CREATE INDEX IF NOT EXISTS idx_organizer_application_status ON organizer_application(status);
CREATE INDEX IF NOT EXISTS idx_organizer_application_create_time ON organizer_application(create_time DESC);
