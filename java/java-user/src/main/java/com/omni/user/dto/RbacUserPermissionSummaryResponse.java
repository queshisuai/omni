package com.omni.user.dto;

public class RbacUserPermissionSummaryResponse {
    private Long userId;
    private String nickname;
    private String phone;
    private String role;
    private String effectiveRole;
    private String baseRoleName;

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getNickname() { return nickname; }
    public void setNickname(String nickname) { this.nickname = nickname; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getEffectiveRole() { return effectiveRole; }
    public void setEffectiveRole(String effectiveRole) { this.effectiveRole = effectiveRole; }

    public String getBaseRoleName() { return baseRoleName; }
    public void setBaseRoleName(String baseRoleName) { this.baseRoleName = baseRoleName; }
}
