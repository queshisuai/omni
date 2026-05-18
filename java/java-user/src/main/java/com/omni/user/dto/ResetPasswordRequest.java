package com.omni.user.dto;

public class ResetPasswordRequest {

    private String phone;
    private String smsCode;
    private String newPassword;
    private String confirmPassword;

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getSmsCode() { return smsCode; }
    public void setSmsCode(String smsCode) { this.smsCode = smsCode; }

    public String getNewPassword() { return newPassword; }
    public void setNewPassword(String newPassword) { this.newPassword = newPassword; }

    public String getConfirmPassword() { return confirmPassword; }
    public void setConfirmPassword(String confirmPassword) { this.confirmPassword = confirmPassword; }
}
