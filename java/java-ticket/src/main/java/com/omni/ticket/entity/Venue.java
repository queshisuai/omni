package com.omni.ticket.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

/**
 * 场馆
 */
@TableName("venue")
public class Venue {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String name;
    private String venueNameEn;
    private String venueType;
    private String city;
    private String province;
    private String district;
    private String address;
    private Integer capacity;
    private Integer status;
    private LocalDateTime createTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getVenueNameEn() { return venueNameEn; }
    public void setVenueNameEn(String venueNameEn) { this.venueNameEn = venueNameEn; }
    public String getVenueType() { return venueType; }
    public void setVenueType(String venueType) { this.venueType = venueType; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getProvince() { return province; }
    public void setProvince(String province) { this.province = province; }
    public String getDistrict() { return district; }
    public void setDistrict(String district) { this.district = district; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public Integer getCapacity() { return capacity; }
    public void setCapacity(Integer capacity) { this.capacity = capacity; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
}
