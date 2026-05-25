package com.omni.ticket.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.omni.ticket.typehandler.JsonbStringTypeHandler;
import org.apache.ibatis.type.JdbcType;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@TableName(value = "seat_layout_version_block", autoResultMap = true)
public class SeatLayoutVersionBlock {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long versionId;
    private String blockKey;
    private String name;
    private String blockType;
    private BigDecimal x;
    private BigDecimal y;
    private BigDecimal rotation;
    private BigDecimal scale;
    private Integer rows;
    private Integer cols;
    private Integer seatsPerRow;
    private BigDecimal rowSpacing;
    private BigDecimal seatSpacing;
    private BigDecimal innerRadius;
    private BigDecimal arcStartAngle;
    private BigDecimal arcEndAngle;
    private BigDecimal width;
    private BigDecimal height;
    private Integer capacity;
    @TableField(typeHandler = JsonbStringTypeHandler.class, jdbcType = JdbcType.OTHER)
    private String polygonPoints;
    private String color;
    private Integer sort;
    private Integer status;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getVersionId() { return versionId; }
    public void setVersionId(Long versionId) { this.versionId = versionId; }
    public String getBlockKey() { return blockKey; }
    public void setBlockKey(String blockKey) { this.blockKey = blockKey; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getBlockType() { return blockType; }
    public void setBlockType(String blockType) { this.blockType = blockType; }
    public BigDecimal getX() { return x; }
    public void setX(BigDecimal x) { this.x = x; }
    public BigDecimal getY() { return y; }
    public void setY(BigDecimal y) { this.y = y; }
    public BigDecimal getRotation() { return rotation; }
    public void setRotation(BigDecimal rotation) { this.rotation = rotation; }
    public BigDecimal getScale() { return scale; }
    public void setScale(BigDecimal scale) { this.scale = scale; }
    public Integer getRows() { return rows; }
    public void setRows(Integer rows) { this.rows = rows; }
    public Integer getCols() { return cols; }
    public void setCols(Integer cols) { this.cols = cols; }
    public Integer getSeatsPerRow() { return seatsPerRow; }
    public void setSeatsPerRow(Integer seatsPerRow) { this.seatsPerRow = seatsPerRow; }
    public BigDecimal getRowSpacing() { return rowSpacing; }
    public void setRowSpacing(BigDecimal rowSpacing) { this.rowSpacing = rowSpacing; }
    public BigDecimal getSeatSpacing() { return seatSpacing; }
    public void setSeatSpacing(BigDecimal seatSpacing) { this.seatSpacing = seatSpacing; }
    public BigDecimal getInnerRadius() { return innerRadius; }
    public void setInnerRadius(BigDecimal innerRadius) { this.innerRadius = innerRadius; }
    public BigDecimal getArcStartAngle() { return arcStartAngle; }
    public void setArcStartAngle(BigDecimal arcStartAngle) { this.arcStartAngle = arcStartAngle; }
    public BigDecimal getArcEndAngle() { return arcEndAngle; }
    public void setArcEndAngle(BigDecimal arcEndAngle) { this.arcEndAngle = arcEndAngle; }
    public BigDecimal getWidth() { return width; }
    public void setWidth(BigDecimal width) { this.width = width; }
    public BigDecimal getHeight() { return height; }
    public void setHeight(BigDecimal height) { this.height = height; }
    public Integer getCapacity() { return capacity; }
    public void setCapacity(Integer capacity) { this.capacity = capacity; }
    public String getPolygonPoints() { return polygonPoints; }
    public void setPolygonPoints(String polygonPoints) { this.polygonPoints = polygonPoints; }
    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
    public Integer getSort() { return sort; }
    public void setSort(Integer sort) { this.sort = sort; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public LocalDateTime getUpdateTime() { return updateTime; }
    public void setUpdateTime(LocalDateTime updateTime) { this.updateTime = updateTime; }
}
