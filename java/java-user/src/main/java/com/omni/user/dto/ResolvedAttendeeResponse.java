package com.omni.user.dto;

public class ResolvedAttendeeResponse {
    private Long id;
    private String realName;
    private String idType;
    private String idNoHash;
    private String idNoMask;
    private String phone;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getRealName() { return realName; }
    public void setRealName(String realName) { this.realName = realName; }
    public String getIdType() { return idType; }
    public void setIdType(String idType) { this.idType = idType; }
    public String getIdNoHash() { return idNoHash; }
    public void setIdNoHash(String idNoHash) { this.idNoHash = idNoHash; }
    public String getIdNoMask() { return idNoMask; }
    public void setIdNoMask(String idNoMask) { this.idNoMask = idNoMask; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
}
