package com.omni.user.dto;

import java.util.ArrayList;
import java.util.List;

public class RbacRolePermissionUpdateRequest {
    private List<String> permissionCodes = new ArrayList<>();

    public List<String> getPermissionCodes() { return permissionCodes; }
    public void setPermissionCodes(List<String> permissionCodes) {
        this.permissionCodes = permissionCodes == null ? new ArrayList<>() : permissionCodes;
    }
}
