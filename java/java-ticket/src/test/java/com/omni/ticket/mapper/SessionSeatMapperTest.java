package com.omni.ticket.mapper;

import org.apache.ibatis.annotations.Select;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertTrue;

class SessionSeatMapperTest {

    @Test
    void selectSeatLabelsByIdsPrefixesSeatCraftBlockName() throws Exception {
        Method method = SessionSeatMapper.class.getMethod("selectSeatLabelsByIds", java.util.List.class);
        Select select = method.getAnnotation(Select.class);
        String sql = String.join(" ", Arrays.asList(select.value()));

        assertTrue(sql.contains("seat_block"), sql);
        assertTrue(sql.contains("sb.name"), sql);
    }
}
