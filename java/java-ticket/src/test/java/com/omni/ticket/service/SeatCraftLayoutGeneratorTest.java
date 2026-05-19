package com.omni.ticket.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SeatCraftLayoutGeneratorTest {

    @Test
    void countSeatsUsesRowsTimesColsForGridAndCurved() {
        SeatCraftLayoutGenerator generator = new SeatCraftLayoutGenerator();

        assertEquals(60, generator.countSeats(3, 20));
        assertEquals(96, generator.countSeats(8, 12));
    }

    @Test
    void buildSeatLabelUsesOneBasedRowAndSeatNo() {
        SeatCraftLayoutGenerator generator = new SeatCraftLayoutGenerator();

        assertEquals("2排8座", generator.buildSeatLabel(2, 8));
    }
}
