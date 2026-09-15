package com.omni.ticket.ai;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.math.BigDecimal;
import java.time.LocalDate;

@JsonInclude(JsonInclude.Include.ALWAYS)
public class TicketIntent {
    public static final int MAX_PEOPLE_COUNT = 6;
    public static final BigDecimal MAX_PRICE = new BigDecimal("1000000.00");

    private String keyword;
    private String city;
    private LocalDate dateFrom;
    private LocalDate dateTo;
    private LocalDate preferredDate;
    private BigDecimal minPrice;
    private BigDecimal maxPrice;
    private Integer peopleCount;
    private Boolean needAdjacentSeats;
    private String saleStatus;
    private Boolean isSupportSeat;
    private Boolean realNameRequired;
    private String sortPreference;

    public static Builder builder() {
        return new Builder();
    }

    public void validate() {
        validateText(keyword, "keyword");
        validateText(city, "city");
        if (peopleCount != null && (peopleCount < 1 || peopleCount > MAX_PEOPLE_COUNT)) {
            throw new IllegalArgumentException("peopleCount 超出允许范围");
        }
        validatePrice(minPrice);
        validatePrice(maxPrice);
        if (minPrice != null && maxPrice != null && minPrice.compareTo(maxPrice) > 0) {
            throw new IllegalArgumentException("价格范围不合法");
        }
        if (dateFrom != null && dateTo != null && dateFrom.isAfter(dateTo)) {
            throw new IllegalArgumentException("日期范围不合法");
        }
        if (saleStatus != null && !java.util.Set.of("on_sale", "coming_soon", "sold_out").contains(saleStatus)) {
            throw new IllegalArgumentException("销售状态不合法");
        }
        if (sortPreference != null
                && !java.util.Set.of("RECOMMENDED", "PRICE_ASC", "TIME_ASC").contains(sortPreference)) {
            throw new IllegalArgumentException("排序偏好不合法");
        }
    }

    private void validatePrice(BigDecimal value) {
        if (value == null || value.scale() > 2 || value.signum() < 0 || value.compareTo(MAX_PRICE) > 0) {
            if (value != null) {
                throw new IllegalArgumentException("价格不合法");
            }
        }
    }

    private void validateText(String value, String field) {
        if (value == null) {
            return;
        }
        if (value.length() > 100 || containsUnsafeInstruction(value)) {
            throw new IllegalArgumentException(field + " 内容不合法");
        }
    }

    private boolean containsUnsafeInstruction(String value) {
        String normalized = value.toLowerCase(java.util.Locale.ROOT);
        return normalized.contains("http://")
                || normalized.contains("https://")
                || normalized.contains("jdbc:")
                || normalized.matches(".*\\b(select|insert|update|delete|drop)\\b.*");
    }

    public String getKeyword() { return keyword; }
    public void setKeyword(String keyword) { this.keyword = keyword; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public LocalDate getDateFrom() { return dateFrom; }
    public void setDateFrom(LocalDate dateFrom) { this.dateFrom = dateFrom; }
    public LocalDate getDateTo() { return dateTo; }
    public void setDateTo(LocalDate dateTo) { this.dateTo = dateTo; }
    public LocalDate getPreferredDate() { return preferredDate; }
    public void setPreferredDate(LocalDate preferredDate) { this.preferredDate = preferredDate; }
    public BigDecimal getMinPrice() { return minPrice; }
    public void setMinPrice(BigDecimal minPrice) { this.minPrice = minPrice; }
    public BigDecimal getMaxPrice() { return maxPrice; }
    public void setMaxPrice(BigDecimal maxPrice) { this.maxPrice = maxPrice; }
    public Integer getPeopleCount() { return peopleCount; }
    public void setPeopleCount(Integer peopleCount) { this.peopleCount = peopleCount; }
    public Boolean getNeedAdjacentSeats() { return needAdjacentSeats; }
    public void setNeedAdjacentSeats(Boolean needAdjacentSeats) { this.needAdjacentSeats = needAdjacentSeats; }
    public String getSaleStatus() { return saleStatus; }
    public void setSaleStatus(String saleStatus) { this.saleStatus = saleStatus; }
    public Boolean getIsSupportSeat() { return isSupportSeat; }
    public void setIsSupportSeat(Boolean supportSeat) { isSupportSeat = supportSeat; }
    public Boolean getRealNameRequired() { return realNameRequired; }
    public void setRealNameRequired(Boolean realNameRequired) { this.realNameRequired = realNameRequired; }
    public String getSortPreference() { return sortPreference; }
    public void setSortPreference(String sortPreference) { this.sortPreference = sortPreference; }

    public LocalDate effectiveDateFrom() {
        return preferredDate == null ? dateFrom : preferredDate;
    }

    public LocalDate effectiveDateTo() {
        return preferredDate == null ? dateTo : preferredDate;
    }

    public static class Builder {
        private final TicketIntent intent = new TicketIntent();
        public Builder keyword(String value) { intent.setKeyword(value); return this; }
        public Builder city(String value) { intent.setCity(value); return this; }
        public Builder dateFrom(LocalDate value) { intent.setDateFrom(value); return this; }
        public Builder dateTo(LocalDate value) { intent.setDateTo(value); return this; }
        public Builder preferredDate(LocalDate value) { intent.setPreferredDate(value); return this; }
        public Builder minPrice(BigDecimal value) { intent.setMinPrice(value); return this; }
        public Builder maxPrice(BigDecimal value) { intent.setMaxPrice(value); return this; }
        public Builder peopleCount(Integer value) { intent.setPeopleCount(value); return this; }
        public Builder needAdjacentSeats(Boolean value) { intent.setNeedAdjacentSeats(value); return this; }
        public Builder saleStatus(String value) { intent.setSaleStatus(value); return this; }
        public Builder isSupportSeat(Boolean value) { intent.setIsSupportSeat(value); return this; }
        public Builder realNameRequired(Boolean value) { intent.setRealNameRequired(value); return this; }
        public Builder sortPreference(String value) { intent.setSortPreference(value); return this; }
        public TicketIntent build() { return intent; }
    }
}
