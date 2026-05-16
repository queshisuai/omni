package com.damai.user.dto;

/**
 * 注册请求
 */
public class RegisterRequest {

    private String phone;
    private String password;
    private String confirmPassword;

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getConfirmPassword() { return confirmPassword; }
    public void setConfirmPassword(String confirmPassword) { this.confirmPassword = confirmPassword; }
}
