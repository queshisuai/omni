package com.omni.ticket.search;

import java.math.BigDecimal;
import java.time.LocalDate;

public class ActivitySearchRequest {

    private Integer page;
    private Integer size;
    private Long categoryId;
    private String keyword;
    private String city;
    private LocalDate dateFrom;
    private LocalDate dateTo;
    private BigDecimal minPrice;
    private BigDecimal maxPrice;
    private String saleStatus;
    private Boolean seatMapOnly;
    private Boolean realNameRequired;
    private String sort;

    public static Builder builder() {
        return new Builder();
    }

    public Integer getPage() { return page; }
    public void setPage(Integer page) { this.page = page; }
    public Integer getSize() { return size; }
    public void setSize(Integer size) { this.size = size; }
    public Long getCategoryId() { return categoryId; }
    public void setCategoryId(Long categoryId) { this.categoryId = categoryId; }
    public String getKeyword() { return keyword; }
    public void setKeyword(String keyword) { this.keyword = keyword; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public LocalDate getDateFrom() { return dateFrom; }
    public void setDateFrom(LocalDate dateFrom) { this.dateFrom = dateFrom; }
    public LocalDate getDateTo() { return dateTo; }
    public void setDateTo(LocalDate dateTo) { this.dateTo = dateTo; }
    public BigDecimal getMinPrice() { return minPrice; }
    public void setMinPrice(BigDecimal minPrice) { this.minPrice = minPrice; }
    public BigDecimal getMaxPrice() { return maxPrice; }
    public void setMaxPrice(BigDecimal maxPrice) { this.maxPrice = maxPrice; }
    public String getSaleStatus() { return saleStatus; }
    public void setSaleStatus(String saleStatus) { this.saleStatus = saleStatus; }
    public Boolean getSeatMapOnly() { return seatMapOnly; }
    public void setSeatMapOnly(Boolean seatMapOnly) { this.seatMapOnly = seatMapOnly; }
    public Boolean getRealNameRequired() { return realNameRequired; }
    public void setRealNameRequired(Boolean realNameRequired) { this.realNameRequired = realNameRequired; }
    public String getSort() { return sort; }
    public void setSort(String sort) { this.sort = sort; }

    public static class Builder {
        private final ActivitySearchRequest request = new ActivitySearchRequest();

        public Builder page(Integer page) { request.setPage(page); return this; }
        public Builder size(Integer size) { request.setSize(size); return this; }
        public Builder categoryId(Long categoryId) { request.setCategoryId(categoryId); return this; }
        public Builder keyword(String keyword) { request.setKeyword(keyword); return this; }
        public Builder city(String city) { request.setCity(city); return this; }
        public Builder dateFrom(LocalDate dateFrom) { request.setDateFrom(dateFrom); return this; }
        public Builder dateTo(LocalDate dateTo) { request.setDateTo(dateTo); return this; }
        public Builder minPrice(BigDecimal minPrice) { request.setMinPrice(minPrice); return this; }
        public Builder maxPrice(BigDecimal maxPrice) { request.setMaxPrice(maxPrice); return this; }
        public Builder saleStatus(String saleStatus) { request.setSaleStatus(saleStatus); return this; }
        public Builder seatMapOnly(Boolean seatMapOnly) { request.setSeatMapOnly(seatMapOnly); return this; }
        public Builder realNameRequired(Boolean realNameRequired) { request.setRealNameRequired(realNameRequired); return this; }
        public Builder sort(String sort) { request.setSort(sort); return this; }
        public ActivitySearchRequest build() { return request; }
    }
}
