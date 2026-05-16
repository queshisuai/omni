package com.damai.ticket.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

/**
 * 用户引用（ticket服务跨模块查询）
 */
@TableName("\"user\"")
public class UserRef {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String phone;
    private String password;
    private String nickname;
    private String email;
    private String avatar;
    private String role;
    private Integer organizerStatus;
    private String organizerName;
    private Integer status;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public Integer getOrganizerStatus() { return organizerStatus; }
    public void setOrganizerStatus(Integer organizerStatus) { this.organizerStatus = organizerStatus; }
    public String getOrganizerName() { return organizerName; }
    public void setOrganizerName(String organizerName) { this.organizerName = organizerName; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
}
