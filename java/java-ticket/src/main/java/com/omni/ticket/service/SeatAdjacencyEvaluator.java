package com.omni.ticket.service;

import com.omni.ticket.entity.SessionSeat;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Component
public class SeatAdjacencyEvaluator {

    public boolean hasAdjacentSeats(List<SessionSeat> seats, Integer quantity) {
        if (quantity == null || quantity < 1 || seats == null || seats.isEmpty()) {
            return false;
        }
        Map<String, List<SessionSeat>> groups = new HashMap<>();
        for (SessionSeat seat : seats) {
            if (!isAvailable(seat) || seat.getRowNo() == null || seat.getSeatNo() == null) {
                continue;
            }
            String groupKey = physicalGroupKey(seat);
            if (groupKey != null) {
                groups.computeIfAbsent(groupKey, ignored -> new java.util.ArrayList<>()).add(seat);
            }
        }
        return groups.values().stream()
                .filter(row -> !row.isEmpty())
                .anyMatch(row -> hasConsecutiveSeats(row, quantity));
    }

    private String physicalGroupKey(SessionSeat seat) {
        if (seat.getSeatBlockId() != null) {
            return "block:" + seat.getSeatBlockId()
                    + ":layout:" + Objects.toString(seat.getLayoutSectionId(), "null")
                    + ":row:" + seat.getRowNo();
        }
        if (seat.getLayoutSectionId() != null) {
            return "layout:" + seat.getLayoutSectionId() + ":row:" + seat.getRowNo();
        }
        return null;
    }

    private boolean hasConsecutiveSeats(List<SessionSeat> row, int quantity) {
        List<SessionSeat> sorted = row.stream()
                .sorted(Comparator.comparing(SessionSeat::getSeatNo)
                        .thenComparing(SessionSeat::getId, Comparator.nullsLast(Long::compareTo)))
                .collect(Collectors.toList());
        int run = 0;
        Integer previous = null;
        for (SessionSeat seat : sorted) {
            if (previous != null && seat.getSeatNo() == previous + 1) {
                run++;
            } else {
                run = 1;
            }
            if (run >= quantity) {
                return true;
            }
            previous = seat.getSeatNo();
        }
        return false;
    }

    private boolean isAvailable(SessionSeat seat) {
        return seat != null
                && Integer.valueOf(1).equals(seat.getStatus())
                && seat.getOrderId() == null
                && seat.getLockExpireTime() == null
                && seat.getLockRequestId() == null;
    }
}
