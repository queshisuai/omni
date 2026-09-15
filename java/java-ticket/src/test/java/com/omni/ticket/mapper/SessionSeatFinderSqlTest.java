package com.omni.ticket.mapper;

import org.apache.ibatis.annotations.Select;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertTrue;

class SessionSeatFinderSqlTest {

    @Test
    void finderSeatQueryIsReadOnlyAndExcludesLockedOrSoldSeats() throws Exception {
        Method method = SessionSeatMapper.class.getMethod(
                "selectAvailableSeatsForFinder", Long.class, Long.class);
        String sql = String.join(" ", Arrays.asList(method.getAnnotation(Select.class).value())).toLowerCase();

        assertTrue(sql.contains("status = 1"), sql);
        assertTrue(sql.contains("order_id is null"), sql);
        assertTrue(sql.contains("lock_expire_time is null"), sql);
        assertTrue(sql.contains("lock_request_id is null"), sql);
        assertTrue(!sql.contains("update ") && !sql.contains("for update"), sql);
    }
}
