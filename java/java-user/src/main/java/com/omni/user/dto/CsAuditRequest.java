package com.omni.user.dto;

public class CsAuditRequest {
    private Integer score;
    private String comments;
    private Boolean isResolved;

    public Integer getScore() { return score; }
    public void setScore(Integer score) { this.score = score; }
    public String getComments() { return comments; }
    public void setComments(String comments) { this.comments = comments; }
    public Boolean getIsResolved() { return isResolved; }
    public void setIsResolved(Boolean resolved) { isResolved = resolved; }
}
