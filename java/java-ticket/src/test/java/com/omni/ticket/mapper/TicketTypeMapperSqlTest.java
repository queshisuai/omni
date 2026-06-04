package com.omni.ticket.mapper;

import org.apache.ibatis.annotations.Update;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;

class TicketTypeMapperSqlTest {

    @Test
    void increaseRemainStockCapsAtTotalStock() throws Exception {
        String sql = String.join(" ", TicketTypeMapper.class
                .getDeclaredMethod("increaseRemainStock", Long.class, int.class)
                .getAnnotation(Update.class)
                .value())
                .toLowerCase();

        assertTrue(sql.contains("least(total_stock"), sql);
    }
}
