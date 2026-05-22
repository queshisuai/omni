ALTER TABLE activity ADD COLUMN IF NOT EXISTS venue_approval_no VARCHAR(120);
ALTER TABLE activity ADD COLUMN IF NOT EXISTS venue_approval_file_url VARCHAR(500);
ALTER TABLE activity ADD COLUMN IF NOT EXISTS venue_approval_note TEXT;

COMMENT ON COLUMN activity.venue_approval_no IS '场地审批凭证编号';
COMMENT ON COLUMN activity.venue_approval_file_url IS '场地审批凭证附件URL';
COMMENT ON COLUMN activity.venue_approval_note IS '场地审批凭证说明';
