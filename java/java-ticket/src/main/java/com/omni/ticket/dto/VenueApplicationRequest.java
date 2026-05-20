package com.omni.ticket.dto;

import java.time.LocalDateTime;

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
    private LocalDateTime validFrom;
    private LocalDateTime validTo;
    private String proofNote;
    private String proofFileUrl;
    private String layoutSnapshot;
    private SeatCraftBlockDtos.LayoutRequest layout;
    private Boolean setAsRecommendedLayout;

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
    public LocalDateTime getValidFrom() { return validFrom; }
    public void setValidFrom(LocalDateTime validFrom) { this.validFrom = validFrom; }
    public LocalDateTime getValidTo() { return validTo; }
    public void setValidTo(LocalDateTime validTo) { this.validTo = validTo; }
    public String getProofNote() { return proofNote; }
    public void setProofNote(String proofNote) { this.proofNote = proofNote; }
    public String getProofFileUrl() { return proofFileUrl; }
    public void setProofFileUrl(String proofFileUrl) { this.proofFileUrl = proofFileUrl; }
    public String getLayoutSnapshot() { return layoutSnapshot; }
    public void setLayoutSnapshot(String layoutSnapshot) { this.layoutSnapshot = layoutSnapshot; }
    public SeatCraftBlockDtos.LayoutRequest getLayout() { return layout; }
    public void setLayout(SeatCraftBlockDtos.LayoutRequest layout) { this.layout = layout; }
    public Boolean getSetAsRecommendedLayout() { return setAsRecommendedLayout; }
    public void setSetAsRecommendedLayout(Boolean setAsRecommendedLayout) { this.setAsRecommendedLayout = setAsRecommendedLayout; }
}
