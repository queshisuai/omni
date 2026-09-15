package com.omni.ticket.service;

import com.omni.ticket.entity.SessionSeat;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SeatAdjacencyEvaluatorTest {

    private final SeatAdjacencyEvaluator evaluator = new SeatAdjacencyEvaluator();

    @Test
    void findsContiguousAvailableSeatsOnSameRowWithoutMutatingSeats() {
        SessionSeat first = seat(1L, 2, 1, 1, 10L, 20L);
        SessionSeat second = seat(2L, 2, 2, 1, 10L, 20L);
        SessionSeat sold = seat(3L, 2, 3, 3, 10L, 20L);

        assertTrue(evaluator.hasAdjacentSeats(List.of(first, second, sold), 2));
        assertEquals(1, first.getStatus());
        assertEquals(1, second.getStatus());
    }

    @Test
    void rejectsSeatsSeparatedByUnavailableSeatOrDifferentRow() {
        assertFalse(evaluator.hasAdjacentSeats(List.of(
                seat(1L, 1, 1, 1, 10L, 20L),
                seat(2L, 1, 3, 1, 10L, 20L)
        ), 2));
        assertFalse(evaluator.hasAdjacentSeats(List.of(
                seat(1L, 1, 1, 1, 10L, 20L),
                seat(2L, 2, 2, 1, 10L, 20L)
        ), 2));
    }

    @Test
    void rejectsAdjacentNumbersAcrossDifferentSeatBlocks() {
        assertFalse(evaluator.hasAdjacentSeats(List.of(
                seat(1L, 1, 1, 1, 10L, 20L),
                seat(2L, 1, 2, 1, 11L, 20L)
        ), 2));
    }

    @Test
    void rejectsAdjacentNumbersAcrossDifferentLayoutSections() {
        assertFalse(evaluator.hasAdjacentSeats(List.of(
                seat(1L, 1, 1, 1, 10L, 20L),
                seat(2L, 1, 2, 1, 10L, 21L)
        ), 2));
    }

    @Test
    void rejectsSeatsWithoutPhysicalLayoutProof() {
        assertFalse(evaluator.hasAdjacentSeats(List.of(
                seat(1L, 1, 1, 1, null, null),
                seat(2L, 1, 2, 1, null, null)
        ), 2));
        assertFalse(evaluator.hasAdjacentSeats(List.of(
                seat(1L, null, 1, 1, 10L, 20L),
                seat(2L, null, 2, 1, 10L, 20L)
        ), 2));
        assertFalse(evaluator.hasAdjacentSeats(List.of(
                seat(1L, 1, null, 1, 10L, 20L),
                seat(2L, 1, 2, 1, 10L, 20L)
        ), 2));
    }

    @Test
    void excludesLockedAndSoldSeatsFromAdjacentEvaluation() {
        SessionSeat available = seat(1L, 1, 1, 1, 10L, 20L);
        SessionSeat locked = seat(2L, 1, 2, 1, 10L, 20L);
        locked.setLockRequestId("lock-1");
        SessionSeat sold = seat(3L, 1, 3, 3, 10L, 20L);
        sold.setOrderId(99L);

        assertFalse(evaluator.hasAdjacentSeats(List.of(available, locked, sold), 2));
    }

    private SessionSeat seat(Long id, Integer row, Integer number, int status, Long blockId, Long layoutId) {
        SessionSeat seat = new SessionSeat();
        seat.setId(id);
        seat.setRowNo(row);
        seat.setSeatNo(number);
        seat.setStatus(status);
        seat.setSeatBlockId(blockId);
        seat.setLayoutSectionId(layoutId);
        return seat;
    }

    private void assertEquals(Object expected, Object actual) {
        org.junit.jupiter.api.Assertions.assertEquals(expected, actual);
    }
}
