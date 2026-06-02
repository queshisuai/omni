package com.omni.common.mq.message;

import java.io.Serializable;
import java.util.List;

/**
 * 候补释放消息 — 替代 WaitlistInternalClient.released() Feign 调用
 */
public class WaitlistReleasedMessage implements Serializable {
    private static final long serialVersionUID = 1L;

    private String eventKey;
    private String source;
    private Long sourceOrderId;
    private Long sessionId;
    private Long ticketTypeId;
    private Integer quantity;
    private List<Long> seatIds;

    public WaitlistReleasedMessage() {}

    public String getEventKey() { return eventKey; }
    public void setEventKey(String eventKey) { this.eventKey = eventKey; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public Long getSourceOrderId() { return sourceOrderId; }
    public void setSourceOrderId(Long sourceOrderId) { this.sourceOrderId = sourceOrderId; }
    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
    public Long getTicketTypeId() { return ticketTypeId; }
    public void setTicketTypeId(Long ticketTypeId) { this.ticketTypeId = ticketTypeId; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public List<Long> getSeatIds() { return seatIds; }
    public void setSeatIds(List<Long> seatIds) { this.seatIds = seatIds; }
}
