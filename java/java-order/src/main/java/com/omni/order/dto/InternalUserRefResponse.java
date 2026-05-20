package com.omni.order.dto;

public class InternalUserRefResponse {
    private Long id;
    private String phone;
    private String role;
    private Integer status;
    private Integer organizerStatus;
    private String organizerName;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public Integer getOrganizerStatus() { return organizerStatus; }
    public void setOrganizerStatus(Integer organizerStatus) { this.organizerStatus = organizerStatus; }
    public String getOrganizerName() { return organizerName; }
    public void setOrganizerName(String organizerName) { this.organizerName = organizerName; }
}
