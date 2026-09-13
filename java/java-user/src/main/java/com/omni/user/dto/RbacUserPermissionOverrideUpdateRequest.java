package com.omni.user.dto;

import java.util.ArrayList;
import java.util.List;

public class RbacUserPermissionOverrideUpdateRequest {
    private List<String> allowPermissionCodes = new ArrayList<>();
    private List<String> denyPermissionCodes = new ArrayList<>();
    private String reason;

    public List<String> getAllowPermissionCodes() { return allowPermissionCodes; }
    public void setAllowPermissionCodes(List<String> allowPermissionCodes) {
        this.allowPermissionCodes = allowPermissionCodes == null ? new ArrayList<>() : allowPermissionCodes;
    }

    public List<String> getDenyPermissionCodes() { return denyPermissionCodes; }
    public void setDenyPermissionCodes(List<String> denyPermissionCodes) {
        this.denyPermissionCodes = denyPermissionCodes == null ? new ArrayList<>() : denyPermissionCodes;
    }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
