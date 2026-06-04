package com.omni.order.mapper;

import org.apache.ibatis.annotations.Insert;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertTrue;

class ElectronicTicketMapperSqlTest {

    @Test
    void insertIgnoreTicketNoIncludesPrimaryKeyForSeataPostgresqlInsertParsing() throws Exception {
        Method method = ElectronicTicketMapper.class.getDeclaredMethod(
                "insertIgnoreTicketNo",
                com.omni.order.entity.ElectronicTicket.class
        );
        Insert insert = method.getAnnotation(Insert.class);
        String sql = String.join(" ", insert.value()).toLowerCase();

        assertTrue(sql.contains("insert into electronic_ticket (id, ticket_no"), sql);
        assertTrue(sql.contains("values (#{id}, #{ticketno}"), sql);
    }
}
