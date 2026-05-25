package com.omni.ticket.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@TableName("seat_layout_version_override")
public class SeatLayoutVersionOverride {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long versionBlockId;
    private Integer rowNo;
    private Integer seatNo;
    private String status;
    private BigDecimal dx;
    private BigDecimal dy;
    private String customLabel;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getVersionBlockId() { return versionBlockId; }
    public void setVersionBlockId(Long versionBlockId) { this.versionBlockId = versionBlockId; }
    public Integer getRowNo() { return rowNo; }
    public void setRowNo(Integer rowNo) { this.rowNo = rowNo; }
    public Integer getSeatNo() { return seatNo; }
    public void setSeatNo(Integer seatNo) { this.seatNo = seatNo; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public BigDecimal getDx() { return dx; }
    public void setDx(BigDecimal dx) { this.dx = dx; }
    public BigDecimal getDy() { return dy; }
    public void setDy(BigDecimal dy) { this.dy = dy; }
    public String getCustomLabel() { return customLabel; }
    public void setCustomLabel(String customLabel) { this.customLabel = customLabel; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public LocalDateTime getUpdateTime() { return updateTime; }
    public void setUpdateTime(LocalDateTime updateTime) { this.updateTime = updateTime; }
}
