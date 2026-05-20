package com.omni.ticket.dto;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public class SeatCraftLayoutDtos {
    public static class LayoutResponse {
        private Long id;
        private Long venueId;
        private Long activityId;
        private Long sessionId;
        private String name;
        private String templateType;
        private String stageTitle;
        private Integer stageX;
        private Integer stageY;
        private Integer canvasWidth;
        private Integer canvasHeight;
        private List<SectionResponse> sections = new ArrayList<>();
        private SeatCraftBlockDtos.LayoutRequest blockLayout;

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public Long getVenueId() { return venueId; }
        public void setVenueId(Long venueId) { this.venueId = venueId; }
        public Long getActivityId() { return activityId; }
        public void setActivityId(Long activityId) { this.activityId = activityId; }
        public Long getSessionId() { return sessionId; }
        public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getTemplateType() { return templateType; }
        public void setTemplateType(String templateType) { this.templateType = templateType; }
        public String getStageTitle() { return stageTitle; }
        public void setStageTitle(String stageTitle) { this.stageTitle = stageTitle; }
        public Integer getStageX() { return stageX; }
        public void setStageX(Integer stageX) { this.stageX = stageX; }
        public Integer getStageY() { return stageY; }
        public void setStageY(Integer stageY) { this.stageY = stageY; }
        public Integer getCanvasWidth() { return canvasWidth; }
        public void setCanvasWidth(Integer canvasWidth) { this.canvasWidth = canvasWidth; }
        public Integer getCanvasHeight() { return canvasHeight; }
        public void setCanvasHeight(Integer canvasHeight) { this.canvasHeight = canvasHeight; }
        public List<SectionResponse> getSections() { return sections; }
        public void setSections(List<SectionResponse> sections) { this.sections = sections; }
        public SeatCraftBlockDtos.LayoutRequest getBlockLayout() { return blockLayout; }
        public void setBlockLayout(SeatCraftBlockDtos.LayoutRequest blockLayout) { this.blockLayout = blockLayout; }
    }

    public static class SectionResponse {
        private Long id;
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
        private Integer seatCount;
        private Long ticketTypeId;
        private BigDecimal price;

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
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
        public Integer getSeatCount() { return seatCount; }
        public void setSeatCount(Integer seatCount) { this.seatCount = seatCount; }
        public Long getTicketTypeId() { return ticketTypeId; }
        public void setTicketTypeId(Long ticketTypeId) { this.ticketTypeId = ticketTypeId; }
        public BigDecimal getPrice() { return price; }
        public void setPrice(BigDecimal price) { this.price = price; }
    }

    public static class LayoutSaveRequest {
        private Long userId;
        private LayoutResponse layout;

        public Long getUserId() { return userId; }
        public void setUserId(Long userId) { this.userId = userId; }
        public LayoutResponse getLayout() { return layout; }
        public void setLayout(LayoutResponse layout) { this.layout = layout; }
    }
}
