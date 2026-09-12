package com.omni.ticket.dto;

public class OrganizerOnsaleSummaryResponse {

    private Long organizerId;
    private Long onsaleActivityCount;
    private Boolean available;

    public Long getOrganizerId() { return organizerId; }
    public void setOrganizerId(Long organizerId) { this.organizerId = organizerId; }

    public Long getOnsaleActivityCount() { return onsaleActivityCount; }
    public void setOnsaleActivityCount(Long onsaleActivityCount) { this.onsaleActivityCount = onsaleActivityCount; }

    public Boolean getAvailable() { return available; }
    public void setAvailable(Boolean available) { this.available = available; }
}
