package com.omni.user.dto;

public class SupportAccountRequest {

    private String phone;
    private String nickname;
    private String password;
    private Integer status;
    private String supportRole;

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getNickname() { return nickname; }
    public void setNickname(String nickname) { this.nickname = nickname; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }

    public String getSupportRole() { return supportRole; }
    public void setSupportRole(String supportRole) { this.supportRole = supportRole; }
}
