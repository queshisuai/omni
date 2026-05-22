package com.omni.ticket.mapper;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertFalse;

class SessionSeatMapperSqlTest {

    @Test
    void mapperSqlDoesNotReferenceOrderOwnedTables() {
        String sql = Arrays.stream(SessionSeatMapper.class.getDeclaredMethods())
                .map(this::annotationSql)
                .collect(Collectors.joining("\n"))
                .toLowerCase();

        assertFalse(sql.contains("order_seat"), "ticket 服务 SQL 不能引用 order-owned order_seat 表");
    }

    private String annotationSql(Method method) {
        Select select = method.getAnnotation(Select.class);
        if (select != null) {
            return String.join(" ", select.value());
        }
        Update update = method.getAnnotation(Update.class);
        if (update != null) {
            return String.join(" ", update.value());
        }
        Delete delete = method.getAnnotation(Delete.class);
        if (delete != null) {
            return String.join(" ", delete.value());
        }
        return "";
    }
}
