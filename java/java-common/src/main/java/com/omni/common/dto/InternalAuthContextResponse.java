package com.omni.common.dto;

import java.util.List;

public class InternalAuthContextResponse {
    private Long userId;
    private String role;
    private String effectiveRole;
    private String supportRole;
    private List<String> permissionCodes;
    private String scopeType;
    private Long scopeId;

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getEffectiveRole() { return effectiveRole; }
    public void setEffectiveRole(String effectiveRole) { this.effectiveRole = effectiveRole; }

    public String getSupportRole() { return supportRole; }
    public void setSupportRole(String supportRole) { this.supportRole = supportRole; }

    public List<String> getPermissionCodes() { return permissionCodes; }
    public void setPermissionCodes(List<String> permissionCodes) { this.permissionCodes = permissionCodes; }

    public String getScopeType() { return scopeType; }
    public void setScopeType(String scopeType) { this.scopeType = scopeType; }

    public Long getScopeId() { return scopeId; }
    public void setScopeId(Long scopeId) { this.scopeId = scopeId; }
}
