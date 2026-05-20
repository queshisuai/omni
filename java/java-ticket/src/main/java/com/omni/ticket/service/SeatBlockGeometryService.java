package com.omni.ticket.service;

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
    private static final String GRID = "gridBlock";
    private static final String ARC = "arcBlock";
    private static final String STANDING = "standingBlock";

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
