package com.omni.ticket.search;

import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.Document;

import java.math.BigDecimal;
@Document(indexName = "omni_activity_v1", createIndex = false)
public class ActivitySearchDocument {

    @Id
    private String id;
    private Long activityId;
    private Long tourId;
    private Long organizerId;
    private String itemType;
    private String activityName;
    private String artistName;
    private Long categoryId;
    private String categoryName;
    private String city;
    private String venueName;
    private String startTime;
    private BigDecimal minPrice;
    private BigDecimal maxPrice;
    private String saleStatus;
    private String seatMapVisibility;
    private Boolean realNameRequired;
    private Boolean ticketTransferAllowed;
    private Long subscriptionCount;
    private Long paidOrderCount;
    private Double hotScore;
    private String updatedAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public Long getActivityId() { return activityId; }
    public void setActivityId(Long activityId) { this.activityId = activityId; }
    public Long getTourId() { return tourId; }
    public void setTourId(Long tourId) { this.tourId = tourId; }
    public Long getOrganizerId() { return organizerId; }
    public void setOrganizerId(Long organizerId) { this.organizerId = organizerId; }
    public String getItemType() { return itemType; }
    public void setItemType(String itemType) { this.itemType = itemType; }
    public String getActivityName() { return activityName; }
    public void setActivityName(String activityName) { this.activityName = activityName; }
    public String getArtistName() { return artistName; }
    public void setArtistName(String artistName) { this.artistName = artistName; }
    public Long getCategoryId() { return categoryId; }
    public void setCategoryId(Long categoryId) { this.categoryId = categoryId; }
    public String getCategoryName() { return categoryName; }
    public void setCategoryName(String categoryName) { this.categoryName = categoryName; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getVenueName() { return venueName; }
    public void setVenueName(String venueName) { this.venueName = venueName; }
    public String getStartTime() { return startTime; }
    public void setStartTime(String startTime) { this.startTime = startTime; }
    public BigDecimal getMinPrice() { return minPrice; }
    public void setMinPrice(BigDecimal minPrice) { this.minPrice = minPrice; }
    public BigDecimal getMaxPrice() { return maxPrice; }
    public void setMaxPrice(BigDecimal maxPrice) { this.maxPrice = maxPrice; }
    public String getSaleStatus() { return saleStatus; }
    public void setSaleStatus(String saleStatus) { this.saleStatus = saleStatus; }
    public String getSeatMapVisibility() { return seatMapVisibility; }
    public void setSeatMapVisibility(String seatMapVisibility) { this.seatMapVisibility = seatMapVisibility; }
    public Boolean getRealNameRequired() { return realNameRequired; }
    public void setRealNameRequired(Boolean realNameRequired) { this.realNameRequired = realNameRequired; }
    public Boolean getTicketTransferAllowed() { return ticketTransferAllowed; }
    public void setTicketTransferAllowed(Boolean ticketTransferAllowed) { this.ticketTransferAllowed = ticketTransferAllowed; }
    public Long getSubscriptionCount() { return subscriptionCount; }
    public void setSubscriptionCount(Long subscriptionCount) { this.subscriptionCount = subscriptionCount; }
    public Long getPaidOrderCount() { return paidOrderCount; }
    public void setPaidOrderCount(Long paidOrderCount) { this.paidOrderCount = paidOrderCount; }
    public Double getHotScore() { return hotScore; }
    public void setHotScore(Double hotScore) { this.hotScore = hotScore; }
    public String getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(String updatedAt) { this.updatedAt = updatedAt; }
}
