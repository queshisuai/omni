package com.omni.ticket.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("venue_default_layout_section")
public class VenueDefaultLayoutSection {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long layoutId;
    private String sectionKey;
    private String name;
    private Integer rows;
    private Integer cols;
    private Integer x;
    private Integer y;
    private String color;
    private String type;
    private String layout;
    private Integer radius;
    private Integer arcSpan;
    private Integer rotation;
    private Integer primeRowStart;
    private Integer primeRowEnd;
    private Integer primeColStart;
    private Integer primeColEnd;
    private Integer sort;
    private Integer status;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getLayoutId() { return layoutId; }
    public void setLayoutId(Long layoutId) { this.layoutId = layoutId; }
    public String getSectionKey() { return sectionKey; }
    public void setSectionKey(String sectionKey) { this.sectionKey = sectionKey; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Integer getRows() { return rows; }
    public void setRows(Integer rows) { this.rows = rows; }
    public Integer getCols() { return cols; }
    public void setCols(Integer cols) { this.cols = cols; }
    public Integer getX() { return x; }
    public void setX(Integer x) { this.x = x; }
    public Integer getY() { return y; }
    public void setY(Integer y) { this.y = y; }
    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getLayout() { return layout; }
    public void setLayout(String layout) { this.layout = layout; }
    public Integer getRadius() { return radius; }
    public void setRadius(Integer radius) { this.radius = radius; }
    public Integer getArcSpan() { return arcSpan; }
    public void setArcSpan(Integer arcSpan) { this.arcSpan = arcSpan; }
    public Integer getRotation() { return rotation; }
    public void setRotation(Integer rotation) { this.rotation = rotation; }
    public Integer getPrimeRowStart() { return primeRowStart; }
    public void setPrimeRowStart(Integer primeRowStart) { this.primeRowStart = primeRowStart; }
    public Integer getPrimeRowEnd() { return primeRowEnd; }
    public void setPrimeRowEnd(Integer primeRowEnd) { this.primeRowEnd = primeRowEnd; }
    public Integer getPrimeColStart() { return primeColStart; }
    public void setPrimeColStart(Integer primeColStart) { this.primeColStart = primeColStart; }
    public Integer getPrimeColEnd() { return primeColEnd; }
    public void setPrimeColEnd(Integer primeColEnd) { this.primeColEnd = primeColEnd; }
    public Integer getSort() { return sort; }
    public void setSort(Integer sort) { this.sort = sort; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public LocalDateTime getUpdateTime() { return updateTime; }
    public void setUpdateTime(LocalDateTime updateTime) { this.updateTime = updateTime; }
}
