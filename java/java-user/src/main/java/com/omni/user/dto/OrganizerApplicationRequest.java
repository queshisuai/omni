package com.omni.user.dto;

public class OrganizerApplicationRequest {

    private Long userId;
    private String organizerName;
    private String subjectType;
    private String contactName;
    private String contactPhone;
    private String contactEmail;
    private String licenseNo;
    private String businessScope;
    private String description;

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getOrganizerName() { return organizerName; }
    public void setOrganizerName(String organizerName) { this.organizerName = organizerName; }

    public String getSubjectType() { return subjectType; }
    public void setSubjectType(String subjectType) { this.subjectType = subjectType; }

    public String getContactName() { return contactName; }
    public void setContactName(String contactName) { this.contactName = contactName; }

    public String getContactPhone() { return contactPhone; }
    public void setContactPhone(String contactPhone) { this.contactPhone = contactPhone; }

    public String getContactEmail() { return contactEmail; }
    public void setContactEmail(String contactEmail) { this.contactEmail = contactEmail; }

    public String getLicenseNo() { return licenseNo; }
    public void setLicenseNo(String licenseNo) { this.licenseNo = licenseNo; }

    public String getBusinessScope() { return businessScope; }
    public void setBusinessScope(String businessScope) { this.businessScope = businessScope; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
