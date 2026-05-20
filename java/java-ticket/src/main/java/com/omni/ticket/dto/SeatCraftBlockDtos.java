package com.omni.ticket.dto;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public class SeatCraftBlockDtos {
    public static class LayoutRequest {
        private String name;
        private Integer canvasWidth;
        private Integer canvasHeight;
        private List<BlockRequest> blocks = new ArrayList<>();
        private List<OverrideRequest> overrides = new ArrayList<>();
        private List<TicketGroupRequest> ticketGroups = new ArrayList<>();

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public Integer getCanvasWidth() { return canvasWidth; }
        public void setCanvasWidth(Integer canvasWidth) { this.canvasWidth = canvasWidth; }
        public Integer getCanvasHeight() { return canvasHeight; }
        public void setCanvasHeight(Integer canvasHeight) { this.canvasHeight = canvasHeight; }
        public List<BlockRequest> getBlocks() { return blocks; }
        public void setBlocks(List<BlockRequest> blocks) { this.blocks = blocks; }
        public List<OverrideRequest> getOverrides() { return overrides; }
        public void setOverrides(List<OverrideRequest> overrides) { this.overrides = overrides; }
        public List<TicketGroupRequest> getTicketGroups() { return ticketGroups; }
        public void setTicketGroups(List<TicketGroupRequest> ticketGroups) { this.ticketGroups = ticketGroups; }
    }

    public static class BlockRequest {
        private String blockKey;
        private String name;
        private String blockType;
        private String ticketGroupKey;
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
        private String color;
        private Integer sort;

        public String getBlockKey() { return blockKey; }
        public void setBlockKey(String blockKey) { this.blockKey = blockKey; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getBlockType() { return blockType; }
        public void setBlockType(String blockType) { this.blockType = blockType; }
        public String getTicketGroupKey() { return ticketGroupKey; }
        public void setTicketGroupKey(String ticketGroupKey) { this.ticketGroupKey = ticketGroupKey; }
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
        public String getColor() { return color; }
        public void setColor(String color) { this.color = color; }
        public Integer getSort() { return sort; }
        public void setSort(Integer sort) { this.sort = sort; }
    }

    public static class OverrideRequest {
        private String blockKey;
        private Integer rowNo;
        private Integer seatNo;
        private String status;
        private BigDecimal dx;
        private BigDecimal dy;
        private String customLabel;

        public String getBlockKey() { return blockKey; }
        public void setBlockKey(String blockKey) { this.blockKey = blockKey; }
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
    }

    public static class TicketGroupRequest {
        private String groupKey;
        private String name;
        private BigDecimal defaultPrice;
        private BigDecimal activityPrice;
        private List<String> sourceBlockKeys = new ArrayList<>();
        private Integer sort;

        public String getGroupKey() { return groupKey; }
        public void setGroupKey(String groupKey) { this.groupKey = groupKey; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public BigDecimal getDefaultPrice() { return defaultPrice; }
        public void setDefaultPrice(BigDecimal defaultPrice) { this.defaultPrice = defaultPrice; }
        public BigDecimal getActivityPrice() { return activityPrice; }
        public void setActivityPrice(BigDecimal activityPrice) { this.activityPrice = activityPrice; }
        public List<String> getSourceBlockKeys() { return sourceBlockKeys; }
        public void setSourceBlockKeys(List<String> sourceBlockKeys) { this.sourceBlockKeys = sourceBlockKeys; }
        public Integer getSort() { return sort; }
        public void setSort(Integer sort) { this.sort = sort; }
    }
}
