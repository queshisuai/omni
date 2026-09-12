package com.omni.ticket.dto;

import java.util.List;

public class OrganizerOnsaleSummaryRequest {

    private List<Long> organizerIds;

    public List<Long> getOrganizerIds() { return organizerIds; }
    public void setOrganizerIds(List<Long> organizerIds) { this.organizerIds = organizerIds; }
}
