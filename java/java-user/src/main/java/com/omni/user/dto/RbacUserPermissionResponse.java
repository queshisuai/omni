package com.omni.user.dto;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

public class RbacUserPermissionResponse extends RbacUserPermissionSummaryResponse {
    private List<String> inheritedPermissionCodes = new ArrayList<>();
    private List<String> allowPermissionCodes = new ArrayList<>();
    private List<String> denyPermissionCodes = new ArrayList<>();
    private List<String> effectivePermissionCodes = new ArrayList<>();

    public List<String> getInheritedPermissionCodes() { return inheritedPermissionCodes; }
    public void setInheritedPermissionCodes(List<String> inheritedPermissionCodes) {
        this.inheritedPermissionCodes = inheritedPermissionCodes == null ? new ArrayList<>() : inheritedPermissionCodes;
    }

    public List<String> getAllowPermissionCodes() { return allowPermissionCodes; }
    public void setAllowPermissionCodes(List<String> allowPermissionCodes) {
        this.allowPermissionCodes = allowPermissionCodes == null ? new ArrayList<>() : allowPermissionCodes;
    }

    public List<String> getDenyPermissionCodes() { return denyPermissionCodes; }
    public void setDenyPermissionCodes(List<String> denyPermissionCodes) {
        this.denyPermissionCodes = denyPermissionCodes == null ? new ArrayList<>() : denyPermissionCodes;
    }

    public List<String> getEffectivePermissionCodes() { return effectivePermissionCodes; }
    public void setEffectivePermissionCodes(List<String> effectivePermissionCodes) {
        this.effectivePermissionCodes = effectivePermissionCodes == null ? new ArrayList<>() : effectivePermissionCodes;
    }

    public String toAuditSummary() {
        return "特许开放：" + formatCodes(allowPermissionCodes)
                + "；显式禁用：" + formatCodes(denyPermissionCodes)
                + "；生效权限数：" + effectivePermissionCodes.size();
    }

    private String formatCodes(List<String> codes) {
        if (codes == null || codes.isEmpty()) {
            return "无";
        }
        return codes.stream().collect(Collectors.joining("、"));
    }
}
