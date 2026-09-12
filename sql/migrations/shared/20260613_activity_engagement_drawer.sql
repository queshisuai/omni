-- owner: java-ticket
-- 评价问答后台抽屉管理：记录购前问答回复主体

ALTER TABLE activity_question
    ADD COLUMN IF NOT EXISTS reply_identity VARCHAR(32);

UPDATE activity_question
SET reply_identity = 'ORGANIZER_PROXY'
WHERE answer IS NOT NULL
  AND reply_identity IS NULL;
