package com.damai.user.dto;

/**
 * 登录请求
 */
public class LoginRequest {

    /** 登录类型: password / sms */
    private String loginType;
    /** 手机号或邮箱 */
    private String account;
    /** 密码（密码登录时必填） */
    private String password;
    /** 短信验证码（短信登录时必填） */
    private String smsCode;

    public String getLoginType() { return loginType; }
    public void setLoginType(String loginType) { this.loginType = loginType; }

    public String getAccount() { return account; }
    public void setAccount(String account) { this.account = account; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getSmsCode() { return smsCode; }
    public void setSmsCode(String smsCode) { this.smsCode = smsCode; }
}
