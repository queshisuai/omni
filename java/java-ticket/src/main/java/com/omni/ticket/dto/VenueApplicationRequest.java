package com.omni.ticket.dto;

public class VenueApplicationRequest {
    private Long userId;
    private String venueName;
    private String city;
    private String address;
    private Integer capacity;
    private String contactName;
    private String contactPhone;
    private String qualificationNo;
    private String businessScope;
    private String description;

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getVenueName() { return venueName; }
    public void setVenueName(String venueName) { this.venueName = venueName; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public Integer getCapacity() { return capacity; }
    public void setCapacity(Integer capacity) { this.capacity = capacity; }
    public String getContactName() { return contactName; }
    public void setContactName(String contactName) { this.contactName = contactName; }
    public String getContactPhone() { return contactPhone; }
    public void setContactPhone(String contactPhone) { this.contactPhone = contactPhone; }
    public String getQualificationNo() { return qualificationNo; }
    public void setQualificationNo(String qualificationNo) { this.qualificationNo = qualificationNo; }
    public String getBusinessScope() { return businessScope; }
    public void setBusinessScope(String businessScope) { this.businessScope = businessScope; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
