package com.omni.user.dto;

public class OrganizerDirectoryResponse {

    private Long organizerId;
    private String organizerName;
    private String subjectType;
    private String qualificationNo;
    private String contactName;
    private String contactPhone;
    private Long followUpOperatorId;
    private String followUpOperatorName;
    private Long onsaleActivityCount;
    private String cooperationStatus;

    public Long getOrganizerId() { return organizerId; }
    public void setOrganizerId(Long organizerId) { this.organizerId = organizerId; }

    public String getOrganizerName() { return organizerName; }
    public void setOrganizerName(String organizerName) { this.organizerName = organizerName; }

    public String getSubjectType() { return subjectType; }
    public void setSubjectType(String subjectType) { this.subjectType = subjectType; }

    public String getQualificationNo() { return qualificationNo; }
    public void setQualificationNo(String qualificationNo) { this.qualificationNo = qualificationNo; }

    public String getContactName() { return contactName; }
    public void setContactName(String contactName) { this.contactName = contactName; }

    public String getContactPhone() { return contactPhone; }
    public void setContactPhone(String contactPhone) { this.contactPhone = contactPhone; }

    public Long getFollowUpOperatorId() { return followUpOperatorId; }
    public void setFollowUpOperatorId(Long followUpOperatorId) { this.followUpOperatorId = followUpOperatorId; }

    public String getFollowUpOperatorName() { return followUpOperatorName; }
    public void setFollowUpOperatorName(String followUpOperatorName) { this.followUpOperatorName = followUpOperatorName; }

    public Long getOnsaleActivityCount() { return onsaleActivityCount; }
    public void setOnsaleActivityCount(Long onsaleActivityCount) { this.onsaleActivityCount = onsaleActivityCount; }

    public String getCooperationStatus() { return cooperationStatus; }
    public void setCooperationStatus(String cooperationStatus) { this.cooperationStatus = cooperationStatus; }
}
