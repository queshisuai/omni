package com.omni.ticket.mapper;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SessionSeatMapperSqlTest {

    @Test
    void mapperSqlDoesNotReferenceOrderOwnedTables() {
        String sql = Arrays.stream(SessionSeatMapper.class.getDeclaredMethods())
                .map(this::annotationSql)
                .collect(Collectors.joining("\n"))
                .toLowerCase();

        assertFalse(sql.contains("order_seat"), "ticket 服务 SQL 不能引用 order-owned order_seat 表");
    }

    @Test
    void releasingSeatsKeepsTicketTypeBinding() throws Exception {
        String releaseSql = annotationSql(SessionSeatMapper.class.getDeclaredMethod("releaseLockedSeat", Long.class, Long.class)).toLowerCase();
        String restoreSql = annotationSql(SessionSeatMapper.class.getDeclaredMethod("restoreSoldSeat", Long.class, Long.class)).toLowerCase();

        assertFalse(releaseSql.contains("ticket_type_id = null"), "释放锁座不能清空票档绑定");
        assertFalse(restoreSql.contains("ticket_type_id = null"), "退款可二次销售不能清空票档绑定");
        assertTrue(releaseSql.contains("status = 1"));
        assertTrue(restoreSql.contains("status = 1"));
    }

    @Test
    void selectSessionSellableRequiresPublishedActivity() throws Exception {
        String sql = annotationSql(SessionSeatMapper.class.getDeclaredMethod("selectSessionSellable", Long.class)).toLowerCase();

        assertTrue(sql.contains("s.status = 1"), sql);
        assertTrue(sql.contains("a.status = 1"), sql);
        assertTrue(sql.contains("a.publish_status = 'published'"), sql);
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
