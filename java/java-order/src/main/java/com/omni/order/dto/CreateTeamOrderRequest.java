package com.omni.order.dto;

import java.math.BigDecimal;
import java.util.List;

public class CreateTeamOrderRequest {
    private Long teamId;
    private Long userId;
    private Long payerUserId;
    private Long sessionId;
    private Long ticketTypeId;
    private Integer quantity;
    private List<TeamOrderSeatItem> seats;
    private String teamGrabRequestId;
    private String grabRequestId;
    private String matchedStrategy;
    private BigDecimal authorizedMaxUnitPrice;

    public Long getTeamId() { return teamId; }
    public void setTeamId(Long teamId) { this.teamId = teamId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public Long getPayerUserId() { return payerUserId; }
    public void setPayerUserId(Long payerUserId) { this.payerUserId = payerUserId; }
    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
    public Long getTicketTypeId() { return ticketTypeId; }
    public void setTicketTypeId(Long ticketTypeId) { this.ticketTypeId = ticketTypeId; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public List<TeamOrderSeatItem> getSeats() { return seats; }
    public void setSeats(List<TeamOrderSeatItem> seats) { this.seats = seats; }
    public String getTeamGrabRequestId() { return teamGrabRequestId; }
    public void setTeamGrabRequestId(String teamGrabRequestId) { this.teamGrabRequestId = teamGrabRequestId; }
    public String getGrabRequestId() { return grabRequestId; }
    public void setGrabRequestId(String grabRequestId) { this.grabRequestId = grabRequestId; }
    public String getMatchedStrategy() { return matchedStrategy; }
    public void setMatchedStrategy(String matchedStrategy) { this.matchedStrategy = matchedStrategy; }
    public BigDecimal getAuthorizedMaxUnitPrice() { return authorizedMaxUnitPrice; }
    public void setAuthorizedMaxUnitPrice(BigDecimal authorizedMaxUnitPrice) { this.authorizedMaxUnitPrice = authorizedMaxUnitPrice; }

    public static class TeamOrderSeatItem {
        private Long sessionSeatId;
        private String seatLabel;

        public Long getSessionSeatId() { return sessionSeatId; }
        public void setSessionSeatId(Long sessionSeatId) { this.sessionSeatId = sessionSeatId; }
        public String getSeatLabel() { return seatLabel; }
        public void setSeatLabel(String seatLabel) { this.seatLabel = seatLabel; }
    }
}
