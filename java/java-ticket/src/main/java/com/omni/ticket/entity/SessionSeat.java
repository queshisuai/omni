package com.omni.ticket.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

@TableName("session_seat")
public class SessionSeat {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long sessionId;
    private Long venueId;
    private Long areaId;
    private Long venueSeatId;
    private Long layoutSectionId;
    private Long seatBlockId;
    private String ticketGroupKey;
    private Integer generatedRowNo;
    private Integer generatedSeatNo;
    private Integer rowNo;
    private Integer seatNo;
    private String seatLabel;
    private Integer status;
    private LocalDateTime lockExpireTime;
    private String lockRequestId;
    private Long orderId;
    private Long ticketTypeId;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
    public Long getVenueId() { return venueId; }
    public void setVenueId(Long venueId) { this.venueId = venueId; }
    public Long getAreaId() { return areaId; }
    public void setAreaId(Long areaId) { this.areaId = areaId; }
    public Long getVenueSeatId() { return venueSeatId; }
    public void setVenueSeatId(Long venueSeatId) { this.venueSeatId = venueSeatId; }
    public Long getLayoutSectionId() { return layoutSectionId; }
    public void setLayoutSectionId(Long layoutSectionId) { this.layoutSectionId = layoutSectionId; }
    public Long getSeatBlockId() { return seatBlockId; }
    public void setSeatBlockId(Long seatBlockId) { this.seatBlockId = seatBlockId; }
    public String getTicketGroupKey() { return ticketGroupKey; }
    public void setTicketGroupKey(String ticketGroupKey) { this.ticketGroupKey = ticketGroupKey; }
    public Integer getGeneratedRowNo() { return generatedRowNo; }
    public void setGeneratedRowNo(Integer generatedRowNo) { this.generatedRowNo = generatedRowNo; }
    public Integer getGeneratedSeatNo() { return generatedSeatNo; }
    public void setGeneratedSeatNo(Integer generatedSeatNo) { this.generatedSeatNo = generatedSeatNo; }
    public Integer getRowNo() { return rowNo; }
    public void setRowNo(Integer rowNo) { this.rowNo = rowNo; }
    public Integer getSeatNo() { return seatNo; }
    public void setSeatNo(Integer seatNo) { this.seatNo = seatNo; }
    public String getSeatLabel() { return seatLabel; }
    public void setSeatLabel(String seatLabel) { this.seatLabel = seatLabel; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public LocalDateTime getLockExpireTime() { return lockExpireTime; }
    public void setLockExpireTime(LocalDateTime lockExpireTime) { this.lockExpireTime = lockExpireTime; }
    public String getLockRequestId() { return lockRequestId; }
    public void setLockRequestId(String lockRequestId) { this.lockRequestId = lockRequestId; }
    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
    public Long getTicketTypeId() { return ticketTypeId; }
    public void setTicketTypeId(Long ticketTypeId) { this.ticketTypeId = ticketTypeId; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public LocalDateTime getUpdateTime() { return updateTime; }
    public void setUpdateTime(LocalDateTime updateTime) { this.updateTime = updateTime; }
}
