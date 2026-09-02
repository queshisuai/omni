package com.omni.user.dto;

public class ChangePhoneRequest {

    private Long userId;
    private String currentSmsCode;
    private String newPhone;
    private String newSmsCode;

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getCurrentSmsCode() { return currentSmsCode; }
    public void setCurrentSmsCode(String currentSmsCode) { this.currentSmsCode = currentSmsCode; }

    public String getNewPhone() { return newPhone; }
    public void setNewPhone(String newPhone) { this.newPhone = newPhone; }

    public String getNewSmsCode() { return newSmsCode; }
    public void setNewSmsCode(String newSmsCode) { this.newSmsCode = newSmsCode; }
}
