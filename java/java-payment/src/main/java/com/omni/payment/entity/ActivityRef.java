package com.omni.payment.entity;

import com.baomidou.mybatisplus.annotation.TableName;

@TableName("activity")
public class ActivityRef {

    private Long id;
    private Long organizerId;
    private String name;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizerId() { return organizerId; }
    public void setOrganizerId(Long organizerId) { this.organizerId = organizerId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
}
