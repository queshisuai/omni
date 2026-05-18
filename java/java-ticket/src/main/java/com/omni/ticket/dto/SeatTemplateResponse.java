package com.omni.ticket.dto;

import com.omni.ticket.entity.VenueArea;

public class SeatTemplateResponse {
    private VenueArea area;
    private Integer generatedSeatCount;

    public SeatTemplateResponse(VenueArea area, Integer generatedSeatCount) {
        this.area = area;
        this.generatedSeatCount = generatedSeatCount;
    }

    public VenueArea getArea() { return area; }
    public void setArea(VenueArea area) { this.area = area; }
    public Integer getGeneratedSeatCount() { return generatedSeatCount; }
    public void setGeneratedSeatCount(Integer generatedSeatCount) { this.generatedSeatCount = generatedSeatCount; }
}
