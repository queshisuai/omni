package com.omni.order.dto;

public class OrderAttendeeResponse {
    private Long id;
    private Long orderId;
    private Long orderSeatId;
    private Long attendeeUserProfileId;
    private String realName;
    private String idType;
    private String idNoMask;
    private String phone;
    private Integer status;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
    public Long getOrderSeatId() { return orderSeatId; }
    public void setOrderSeatId(Long orderSeatId) { this.orderSeatId = orderSeatId; }
    public Long getAttendeeUserProfileId() { return attendeeUserProfileId; }
    public void setAttendeeUserProfileId(Long attendeeUserProfileId) { this.attendeeUserProfileId = attendeeUserProfileId; }
    public String getRealName() { return realName; }
    public void setRealName(String realName) { this.realName = realName; }
    public String getIdType() { return idType; }
    public void setIdType(String idType) { this.idType = idType; }
    public String getIdNoMask() { return idNoMask; }
    public void setIdNoMask(String idNoMask) { this.idNoMask = idNoMask; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
}
