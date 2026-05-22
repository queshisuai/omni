package com.omni.ticket.dto;

import java.time.LocalDateTime;

public class SeatLayoutTemplateCandidateResponse {
    private String sourceType;
    private Long sourceId;
    private String name;
    private LocalDateTime createTime;
    private SeatCraftLayoutDtos.LayoutResponse layout;

    public String getSourceType() { return sourceType; }
    public void setSourceType(String sourceType) { this.sourceType = sourceType; }
    public Long getSourceId() { return sourceId; }
    public void setSourceId(Long sourceId) { this.sourceId = sourceId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public SeatCraftLayoutDtos.LayoutResponse getLayout() { return layout; }
    public void setLayout(SeatCraftLayoutDtos.LayoutResponse layout) { this.layout = layout; }
}
