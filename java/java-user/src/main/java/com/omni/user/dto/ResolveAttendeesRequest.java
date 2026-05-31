package com.omni.user.dto;

import java.util.List;

public class ResolveAttendeesRequest {
    private Long userId;
    private List<Long> attendeeIds;

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public List<Long> getAttendeeIds() { return attendeeIds; }
    public void setAttendeeIds(List<Long> attendeeIds) { this.attendeeIds = attendeeIds; }
}
