package com.omni.ticket.ai;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public class TicketIntentModelOutput {
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
    private List<String> clarificationQuestions;

    public TicketIntent toIntent() {
        return TicketIntent.builder()
                .keyword(keyword)
                .city(city)
                .dateFrom(dateFrom)
                .dateTo(dateTo)
                .preferredDate(preferredDate)
                .minPrice(minPrice)
                .maxPrice(maxPrice)
                .peopleCount(peopleCount)
                .needAdjacentSeats(needAdjacentSeats)
                .saleStatus(saleStatus)
                .isSupportSeat(isSupportSeat)
                .realNameRequired(realNameRequired)
                .sortPreference(sortPreference)
                .build();
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
    public List<String> getClarificationQuestions() { return clarificationQuestions; }
    public void setClarificationQuestions(List<String> clarificationQuestions) {
        this.clarificationQuestions = clarificationQuestions;
    }
}
