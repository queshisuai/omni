package com.omni.ticket.dto;

import com.omni.ticket.entity.VenueApplication;

import java.time.LocalDateTime;

public class VenueApplicationResponse {
    private Long id;
    private Long applicantId;
    private Long venueId;
    private String venueName;
    private String city;
    private String address;
    private Integer capacity;
    private String contactName;
    private String contactPhone;
    private String qualificationNo;
    private String businessScope;
    private String description;
    private Integer status;
    private Long reviewerId;
    private String reviewNote;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
    private LocalDateTime reviewTime;

    public static VenueApplicationResponse from(VenueApplication application) {
        VenueApplicationResponse response = new VenueApplicationResponse();
        response.setId(application.getId());
        response.setApplicantId(application.getApplicantId());
        response.setVenueId(application.getVenueId());
        response.setVenueName(application.getVenueName());
        response.setCity(application.getCity());
        response.setAddress(application.getAddress());
        response.setCapacity(application.getCapacity());
        response.setContactName(application.getContactName());
        response.setContactPhone(application.getContactPhone());
        response.setQualificationNo(application.getQualificationNo());
        response.setBusinessScope(application.getBusinessScope());
        response.setDescription(application.getDescription());
        response.setStatus(application.getStatus());
        response.setReviewerId(application.getReviewerId());
        response.setReviewNote(application.getReviewNote());
        response.setCreateTime(application.getCreateTime());
        response.setUpdateTime(application.getUpdateTime());
        response.setReviewTime(application.getReviewTime());
        return response;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getApplicantId() { return applicantId; }
    public void setApplicantId(Long applicantId) { this.applicantId = applicantId; }
    public Long getVenueId() { return venueId; }
    public void setVenueId(Long venueId) { this.venueId = venueId; }
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
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public Long getReviewerId() { return reviewerId; }
    public void setReviewerId(Long reviewerId) { this.reviewerId = reviewerId; }
    public String getReviewNote() { return reviewNote; }
    public void setReviewNote(String reviewNote) { this.reviewNote = reviewNote; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public LocalDateTime getUpdateTime() { return updateTime; }
    public void setUpdateTime(LocalDateTime updateTime) { this.updateTime = updateTime; }
    public LocalDateTime getReviewTime() { return reviewTime; }
    public void setReviewTime(LocalDateTime reviewTime) { this.reviewTime = reviewTime; }
}
