package com.omni.ticket.search;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class ActivitySearchDocument {

    private Long id;
    private String documentId;
    private String itemType;
    private String name;
    private String description;
    private String poster;
    private Long categoryId;
    private String categoryName;
    private Long artistId;
    private String artistName;
    private List<String> artistNames = new ArrayList<>();
    private String venueCity;
    private List<String> cities = new ArrayList<>();
    private LocalDateTime startTime;
    private BigDecimal minPrice;
    private String seatMapVisibility;
    private Boolean realNameRequired;
    private Boolean ticketTransferAllowed;
    private Integer status;
    private String publishStatus;
    private String saleStatus;
    private LocalDateTime updatedAt;
    private String searchText;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getDocumentId() { return documentId; }
    public void setDocumentId(String documentId) { this.documentId = documentId; }
    public String getItemType() { return itemType; }
    public void setItemType(String itemType) { this.itemType = itemType; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getPoster() { return poster; }
    public void setPoster(String poster) { this.poster = poster; }
    public Long getCategoryId() { return categoryId; }
    public void setCategoryId(Long categoryId) { this.categoryId = categoryId; }
    public String getCategoryName() { return categoryName; }
    public void setCategoryName(String categoryName) { this.categoryName = categoryName; }
    public Long getArtistId() { return artistId; }
    public void setArtistId(Long artistId) { this.artistId = artistId; }
    public String getArtistName() { return artistName; }
    public void setArtistName(String artistName) { this.artistName = artistName; }
    public List<String> getArtistNames() { return artistNames; }
    public void setArtistNames(List<String> artistNames) { this.artistNames = artistNames == null ? new ArrayList<>() : artistNames; }
    public String getVenueCity() { return venueCity; }
    public void setVenueCity(String venueCity) { this.venueCity = venueCity; }
    public List<String> getCities() { return cities; }
    public void setCities(List<String> cities) { this.cities = cities == null ? new ArrayList<>() : cities; }
    public LocalDateTime getStartTime() { return startTime; }
    public void setStartTime(LocalDateTime startTime) { this.startTime = startTime; }
    public BigDecimal getMinPrice() { return minPrice; }
    public void setMinPrice(BigDecimal minPrice) { this.minPrice = minPrice; }
    public String getSeatMapVisibility() { return seatMapVisibility; }
    public void setSeatMapVisibility(String seatMapVisibility) { this.seatMapVisibility = seatMapVisibility; }
    public Boolean getRealNameRequired() { return realNameRequired; }
    public void setRealNameRequired(Boolean realNameRequired) { this.realNameRequired = realNameRequired; }
    public Boolean getTicketTransferAllowed() { return ticketTransferAllowed; }
    public void setTicketTransferAllowed(Boolean ticketTransferAllowed) { this.ticketTransferAllowed = ticketTransferAllowed; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public String getPublishStatus() { return publishStatus; }
    public void setPublishStatus(String publishStatus) { this.publishStatus = publishStatus; }
    public String getSaleStatus() { return saleStatus; }
    public void setSaleStatus(String saleStatus) { this.saleStatus = saleStatus; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public String getSearchText() { return searchText; }
    public void setSearchText(String searchText) { this.searchText = searchText; }
}
