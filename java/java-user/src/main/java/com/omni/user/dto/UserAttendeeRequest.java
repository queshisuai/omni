package com.omni.user.dto;

public class UserAttendeeRequest {
    private String realName;
    private String idType;
    private String idNo;
    private String phone;
    private Boolean isDefault;

    public String getRealName() { return realName; }
    public void setRealName(String realName) { this.realName = realName; }
    public String getIdType() { return idType; }
    public void setIdType(String idType) { this.idType = idType; }
    public String getIdNo() { return idNo; }
    public void setIdNo(String idNo) { this.idNo = idNo; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public Boolean getIsDefault() { return isDefault; }
    public void setIsDefault(Boolean isDefault) { this.isDefault = isDefault; }
}
