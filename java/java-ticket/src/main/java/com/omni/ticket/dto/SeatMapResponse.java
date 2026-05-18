package com.omni.ticket.dto;

import com.omni.ticket.entity.SessionSeat;
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.entity.VenueArea;

import java.math.BigDecimal;
import java.util.List;

public class SeatMapResponse {
    private Long sessionId;
    private Long ticketTypeId;
    private String ticketTypeName;
    private BigDecimal price;
    private String stageLabel;
    private List<VenueArea> areas;
    private List<SessionSeat> seats;

    public static SeatMapResponse of(Long sessionId, TicketType ticketType, List<VenueArea> areas, List<SessionSeat> seats) {
        SeatMapResponse response = new SeatMapResponse();
        response.setSessionId(sessionId);
        response.setTicketTypeId(ticketType.getId());
        response.setTicketTypeName(ticketType.getName());
        response.setPrice(ticketType.getPrice());
        response.setStageLabel("舞台方向");
        response.setAreas(areas);
        response.setSeats(seats);
        return response;
    }

    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
    public Long getTicketTypeId() { return ticketTypeId; }
    public void setTicketTypeId(Long ticketTypeId) { this.ticketTypeId = ticketTypeId; }
    public String getTicketTypeName() { return ticketTypeName; }
    public void setTicketTypeName(String ticketTypeName) { this.ticketTypeName = ticketTypeName; }
    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal price) { this.price = price; }
    public String getStageLabel() { return stageLabel; }
    public void setStageLabel(String stageLabel) { this.stageLabel = stageLabel; }
    public List<VenueArea> getAreas() { return areas; }
    public void setAreas(List<VenueArea> areas) { this.areas = areas; }
    public List<SessionSeat> getSeats() { return seats; }
    public void setSeats(List<SessionSeat> seats) { this.seats = seats; }
}
