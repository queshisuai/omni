package com.omni.ticket.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.omni.exception.BusinessException;
import com.omni.ticket.entity.SeatBlock;
import com.omni.ticket.entity.SeatOverride;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class SeatBlockGeometryService {
    private static final double EPSILON = 0.000001;
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final String GRID = "gridBlock";
    private static final String ARC = "arcBlock";
    private static final String STANDING = "standingBlock";
    private static final String FREE = "freeBlock";
    private static final String POLYGON = "polygonBlock";

    public List<GeneratedSeat> generateSeats(SeatBlock block, List<SeatOverride> overrides) {
        requireBlock(block);
        if (STANDING.equals(block.getBlockType())) {
            return Collections.emptyList();
        }
        Map<String, SeatOverride> overrideMap = toOverrideMap(overrides);
        if (GRID.equals(block.getBlockType())) {
            return generateGridSeats(block, overrideMap);
        }
        if (ARC.equals(block.getBlockType())) {
            return generateArcSeats(block, overrideMap);
        }
        if (FREE.equals(block.getBlockType())) {
            return generateFreeSeats(block, overrideMap);
        }
        if (POLYGON.equals(block.getBlockType())) {
            return generatePolygonSeats(block, overrideMap);
        }
        throw new BusinessException(400, "座位块类型不正确");
    }

    public int countSellableSeats(SeatBlock block, List<SeatOverride> overrides) {
        requireBlock(block);
        if (STANDING.equals(block.getBlockType())) {
            return requirePositive(block.getCapacity(), "站区容量必须大于0");
        }
        return generateSeats(block, overrides).size();
    }

    private List<GeneratedSeat> generateGridSeats(SeatBlock block, Map<String, SeatOverride> overrideMap) {
        int rows = requirePositive(block.getRows(), "方阵排数必须大于0");
        int cols = requirePositive(block.getCols(), "方阵座数必须大于0");
        double baseX = decimal(block.getX(), 0);
        double baseY = decimal(block.getY(), 0);
        double rowSpacing = decimal(block.getRowSpacing(), 24);
        double seatSpacing = decimal(block.getSeatSpacing(), 24);
        List<GeneratedSeat> seats = new java.util.ArrayList<>();
        for (int row = 1; row <= rows; row++) {
            for (int seat = 1; seat <= cols; seat++) {
                SeatOverride override = overrideMap.get(key(row, seat));
                if (isExcluded(override)) {
                    continue;
                }
                seats.add(buildSeat(block, row, seat,
                        baseX + (seat - 1) * seatSpacing,
                        baseY + (row - 1) * rowSpacing,
                        override));
            }
        }
        return seats;
    }

    private List<GeneratedSeat> generateArcSeats(SeatBlock block, Map<String, SeatOverride> overrideMap) {
        int rows = requirePositive(block.getRows(), "扇形排数必须大于0");
        int seatsPerRow = requirePositive(block.getSeatsPerRow(), "扇形每排座数必须大于0");
        double centerX = decimal(block.getX(), 0);
        double centerY = decimal(block.getY(), 0);
        double innerRadius = decimal(block.getInnerRadius(), 80);
        double rowSpacing = decimal(block.getRowSpacing(), 24);
        double startAngle = decimal(block.getArcStartAngle(), 0);
        double endAngle = decimal(block.getArcEndAngle(), 180);
        double rotation = decimal(block.getRotation(), 0);
        List<GeneratedSeat> seats = new java.util.ArrayList<>();
        for (int row = 1; row <= rows; row++) {
            double radius = innerRadius + (row - 1) * rowSpacing;
            for (int seat = 1; seat <= seatsPerRow; seat++) {
                SeatOverride override = overrideMap.get(key(row, seat));
                if (isExcluded(override)) {
                    continue;
                }
                double t = seatsPerRow == 1 ? 0.5 : (double) (seat - 1) / (double) (seatsPerRow - 1);
                double angle = Math.toRadians(startAngle + (endAngle - startAngle) * t + rotation);
                seats.add(buildSeat(block, row, seat,
                        centerX + radius * Math.cos(angle),
                        centerY + radius * Math.sin(angle),
                        override));
            }
        }
        return seats;
    }

    private List<GeneratedSeat> generateFreeSeats(SeatBlock block, Map<String, SeatOverride> overrideMap) {
        double baseX = decimal(block.getX(), 0);
        double baseY = decimal(block.getY(), 0);
        List<GeneratedSeat> seats = new java.util.ArrayList<>();
        for (SeatOverride override : overrideMap.values()) {
            if (isExcluded(override)) {
                continue;
            }
            seats.add(buildSeat(block, override.getRowNo(), override.getSeatNo(),
                    baseX, baseY, override));
        }
        return seats;
    }

    private List<GeneratedSeat> generatePolygonSeats(SeatBlock block, Map<String, SeatOverride> overrideMap) {
        List<PolygonPoint> points = parsePolygonPoints(block.getPolygonPoints());
        if (points.size() < 3) {
            throw new BusinessException(400, "多边形座位块至少需要3个顶点");
        }
        if (Math.abs(area(points)) <= EPSILON) {
            throw new BusinessException(400, "多边形座位块面积必须大于0");
        }

        double minX = points.stream().mapToDouble(PolygonPoint::getX).min().orElse(0);
        double maxX = points.stream().mapToDouble(PolygonPoint::getX).max().orElse(0);
        double minY = points.stream().mapToDouble(PolygonPoint::getY).min().orElse(0);
        double maxY = points.stream().mapToDouble(PolygonPoint::getY).max().orElse(0);
        double centerX = (minX + maxX) / 2.0;
        double centerY = (minY + maxY) / 2.0;
        double rowSpacing = requirePositiveSpacing(decimal(block.getRowSpacing(), 24));
        double seatSpacing = requirePositiveSpacing(decimal(block.getSeatSpacing(), 24));
        double baseX = decimal(block.getX(), 0);
        double baseY = decimal(block.getY(), 0);
        double rotation = Math.toRadians(decimal(block.getRotation(), 0));

        List<GeneratedSeat> seats = new java.util.ArrayList<>();
        int rowNo = 1;
        for (double localY = minY; localY <= maxY + EPSILON; localY += rowSpacing) {
            int seatNo = 1;
            for (double localX = minX; localX <= maxX + EPSILON; localX += seatSpacing) {
                if (!isInsidePolygon(localX, localY, points)) {
                    continue;
                }
                SeatOverride override = overrideMap.get(key(rowNo, seatNo));
                if (!isExcluded(override)) {
                    double[] rotated = rotate(localX, localY, centerX, centerY, rotation);
                    seats.add(buildSeat(block, rowNo, seatNo, baseX + rotated[0], baseY + rotated[1], override));
                }
                seatNo++;
            }
            rowNo++;
        }
        return seats;
    }

    private List<PolygonPoint> parsePolygonPoints(String polygonPoints) {
        try {
            List<PolygonPoint> points = OBJECT_MAPPER.readValue(polygonPoints, new TypeReference<List<PolygonPoint>>() {});
            if (points == null) {
                throw new BusinessException(400, "多边形座位块顶点不正确");
            }
            for (PolygonPoint point : points) {
                if (point == null || !isFinite(point.getX()) || !isFinite(point.getY())) {
                    throw new BusinessException(400, "多边形座位块顶点不正确");
                }
            }
            return points;
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BusinessException(400, "多边形座位块顶点不正确");
        }
    }

    private double area(List<PolygonPoint> points) {
        double sum = 0;
        for (int i = 0; i < points.size(); i++) {
            PolygonPoint current = points.get(i);
            PolygonPoint next = points.get((i + 1) % points.size());
            sum += current.getX() * next.getY() - next.getX() * current.getY();
        }
        return sum / 2.0;
    }

    private boolean isInsidePolygon(double x, double y, List<PolygonPoint> points) {
        boolean inside = false;
        for (int i = 0, j = points.size() - 1; i < points.size(); j = i++) {
            PolygonPoint a = points.get(i);
            PolygonPoint b = points.get(j);
            if (isOnSegment(x, y, a, b)) {
                return true;
            }
            boolean crosses = (a.getY() > y) != (b.getY() > y);
            if (crosses) {
                double intersectX = (b.getX() - a.getX()) * (y - a.getY()) / (b.getY() - a.getY()) + a.getX();
                if (x < intersectX + EPSILON) {
                    inside = !inside;
                }
            }
        }
        return inside;
    }

    private boolean isOnSegment(double x, double y, PolygonPoint a, PolygonPoint b) {
        double cross = (x - a.getX()) * (b.getY() - a.getY()) - (y - a.getY()) * (b.getX() - a.getX());
        if (Math.abs(cross) > EPSILON) {
            return false;
        }
        return x >= Math.min(a.getX(), b.getX()) - EPSILON
                && x <= Math.max(a.getX(), b.getX()) + EPSILON
                && y >= Math.min(a.getY(), b.getY()) - EPSILON
                && y <= Math.max(a.getY(), b.getY()) + EPSILON;
    }

    private double[] rotate(double x, double y, double centerX, double centerY, double rotation) {
        if (Math.abs(rotation) <= EPSILON) {
            return new double[] {x, y};
        }
        double dx = x - centerX;
        double dy = y - centerY;
        double cos = Math.cos(rotation);
        double sin = Math.sin(rotation);
        return new double[] {centerX + dx * cos - dy * sin, centerY + dx * sin + dy * cos};
    }

    private GeneratedSeat buildSeat(SeatBlock block, int row, int seat, double x, double y, SeatOverride override) {
        double dx = override == null ? 0 : decimal(override.getDx(), 0);
        double dy = override == null ? 0 : decimal(override.getDy(), 0);
        String label = override != null && trim(override.getCustomLabel()) != null
                ? trim(override.getCustomLabel())
                : row + "排" + seat + "座";
        return new GeneratedSeat(row, seat, label, x + dx, y + dy,
                block.getId(), block.getBlockKey(), block.getTicketGroupKey());
    }

    private Map<String, SeatOverride> toOverrideMap(List<SeatOverride> overrides) {
        if (overrides == null || overrides.isEmpty()) {
            return Collections.emptyMap();
        }
        return overrides.stream()
                .filter(item -> item.getRowNo() != null && item.getSeatNo() != null)
                .collect(Collectors.toMap(item -> key(item.getRowNo(), item.getSeatNo()), item -> item, (a, b) -> b, HashMap::new));
    }

    private boolean isExcluded(SeatOverride override) {
        return override != null && ("hidden".equals(override.getStatus()) || "deleted".equals(override.getStatus()));
    }

    private String key(int row, int seat) {
        return row + ":" + seat;
    }

    private void requireBlock(SeatBlock block) {
        if (block == null) {
            throw new BusinessException(400, "座位块不能为空");
        }
    }

    private int requirePositive(Integer value, String message) {
        if (value == null || value <= 0) {
            throw new BusinessException(400, message);
        }
        return value;
    }

    private double requirePositiveSpacing(double value) {
        if (value <= 0) {
            throw new BusinessException(400, "多边形座位块间距必须大于0");
        }
        return value;
    }

    private boolean isFinite(Double value) {
        return value != null && Double.isFinite(value);
    }

    private double decimal(BigDecimal value, double fallback) {
        return value == null ? fallback : value.doubleValue();
    }

    private String trim(String value) {
        if (value == null) {
            return null;
        }
        String text = value.trim();
        return text.isEmpty() ? null : text;
    }

    public static class PolygonPoint {
        private Double x;
        private Double y;

        public Double getX() { return x; }
        public void setX(Double x) { this.x = x; }
        public Double getY() { return y; }
        public void setY(Double y) { this.y = y; }
    }

    public static class GeneratedSeat {
        private final int rowNo;
        private final int seatNo;
        private final String label;
        private final double x;
        private final double y;
        private final Long blockId;
        private final String blockKey;
        private final String ticketGroupKey;

        public GeneratedSeat(int rowNo, int seatNo, String label, double x, double y, Long blockId, String blockKey, String ticketGroupKey) {
            this.rowNo = rowNo;
            this.seatNo = seatNo;
            this.label = label;
            this.x = x;
            this.y = y;
            this.blockId = blockId;
            this.blockKey = blockKey;
            this.ticketGroupKey = ticketGroupKey;
        }

        public int getRowNo() { return rowNo; }
        public int getSeatNo() { return seatNo; }
        public String getLabel() { return label; }
        public double getX() { return x; }
        public double getY() { return y; }
        public Long getBlockId() { return blockId; }
        public String getBlockKey() { return blockKey; }
        public String getTicketGroupKey() { return ticketGroupKey; }
    }
}
