package com.omni.ticket.mapper;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
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

    @Test
    void teamSeatLockSelectUsesSkipLockedAndLifecycleSqlClearsOwner() throws Exception {
        String selectSql = annotationSql(SessionSeatMapper.class.getDeclaredMethod(
                "selectAvailableForTeamLock", Long.class, Long.class, Integer.class)).toLowerCase();
        String lockSql = annotationSql(SessionSeatMapper.class.getDeclaredMethod(
                "lockTeamSeatIds", Long.class, Long.class, List.class, String.class, LocalDateTime.class)).toLowerCase();
        String lockedByRequestSql = annotationSql(SessionSeatMapper.class.getDeclaredMethod(
                "selectLockedByRequest", Long.class, Long.class, List.class, String.class)).toLowerCase();
        String lockedByRequestIdSql = annotationSql(SessionSeatMapper.class.getDeclaredMethod(
                "selectLockedByRequestId", Long.class, Long.class, String.class)).toLowerCase();
        String releaseSql = annotationSql(SessionSeatMapper.class.getDeclaredMethod(
                "releaseLockedSeat", Long.class, Long.class)).toLowerCase();
        String releaseTeamSql = annotationSql(SessionSeatMapper.class.getDeclaredMethod(
                "releaseTeamSeatLockByRequest", String.class, List.class)).toLowerCase();
        String releaseTeamByRequestSql = annotationSql(SessionSeatMapper.class.getDeclaredMethod(
                "releaseTeamSeatLockByRequestId", String.class)).toLowerCase();
        String soldSql = annotationSql(SessionSeatMapper.class.getDeclaredMethod(
                "markSeatSold", Long.class, Long.class, Long.class)).toLowerCase();

        assertTrue(selectSql.contains("for update skip locked"), selectSql);
        assertTrue(selectSql.contains("limit #{limit}"), selectSql);
        assertTrue(selectSql.indexOf("seat_block_id") < selectSql.indexOf("layout_section_id"), selectSql);
        assertTrue(lockSql.contains("lock_request_id = #{lockrequestid}"), lockSql);
        assertTrue(lockedByRequestSql.contains("lock_expire_time > current_timestamp"), lockedByRequestSql);
        assertTrue(lockedByRequestIdSql.contains("lock_expire_time > current_timestamp"), lockedByRequestIdSql);
        assertTrue(releaseSql.contains("lock_request_id = null"), releaseSql);
        assertTrue(releaseTeamSql.contains("lock_request_id = null"), releaseTeamSql);
        assertTrue(releaseTeamByRequestSql.contains("lock_request_id = null"), releaseTeamByRequestSql);
        assertTrue(soldSql.contains("lock_request_id = null"), soldSql);
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
