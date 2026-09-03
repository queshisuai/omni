package com.omni.ticket.dto;

public class SearchTrendingItem {

    private Long id;
    private Integer rank;
    private String keyword;
    private String tagType;
    private String targetType;
    private Long targetId;
    private String itemType;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Integer getRank() { return rank; }
    public void setRank(Integer rank) { this.rank = rank; }
    public String getKeyword() { return keyword; }
    public void setKeyword(String keyword) { this.keyword = keyword; }
    public String getTagType() { return tagType; }
    public void setTagType(String tagType) { this.tagType = tagType; }
    public String getTargetType() { return targetType; }
    public void setTargetType(String targetType) { this.targetType = targetType; }
    public Long getTargetId() { return targetId; }
    public void setTargetId(Long targetId) { this.targetId = targetId; }
    public String getItemType() { return itemType; }
    public void setItemType(String itemType) { this.itemType = itemType; }
}
