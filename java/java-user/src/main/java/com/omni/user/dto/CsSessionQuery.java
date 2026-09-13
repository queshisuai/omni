package com.omni.user.dto;

public class CsSessionQuery {
    private Long groupId;
    private Long agentId;
    private String status;
    private Boolean slaTimeoutOnly;
    private String keyword;
    private Integer page = 1;
    private Integer size = 30;
    private String sort = "latest";
    private Boolean unassignedOnly;
    private String sourceType;

    public Long getGroupId() { return groupId; }
    public void setGroupId(Long groupId) { this.groupId = groupId; }
    public Long getAgentId() { return agentId; }
    public void setAgentId(Long agentId) { this.agentId = agentId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Boolean getSlaTimeoutOnly() { return slaTimeoutOnly; }
    public void setSlaTimeoutOnly(Boolean slaTimeoutOnly) { this.slaTimeoutOnly = slaTimeoutOnly; }
    public String getKeyword() { return keyword; }
    public void setKeyword(String keyword) { this.keyword = keyword; }
    public Integer getPage() { return page; }
    public void setPage(Integer page) { this.page = page; }
    public Integer getSize() { return size; }
    public void setSize(Integer size) { this.size = size; }
    public String getSort() { return sort; }
    public void setSort(String sort) { this.sort = sort; }
    public Boolean getUnassignedOnly() { return unassignedOnly; }
    public void setUnassignedOnly(Boolean unassignedOnly) { this.unassignedOnly = unassignedOnly; }
    public String getSourceType() { return sourceType; }
    public void setSourceType(String sourceType) { this.sourceType = sourceType; }
}
