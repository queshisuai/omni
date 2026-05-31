package com.omni.order.mapper;

import org.apache.ibatis.annotations.Select;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OrderMapperSqlTest {

    @Test
    void advisoryLockSqlReturnsMappableScalarInsteadOfPostgresVoid() throws Exception {
        Method method = OrderMapper.class.getDeclaredMethod("acquireAdvisoryTransactionLock", String.class);
        Select select = method.getAnnotation(Select.class);
        String sql = String.join(" ", select.value()).toLowerCase();

        assertTrue(sql.contains("pg_advisory_xact_lock"), sql);
        assertTrue(sql.contains("from pg_advisory_xact_lock"), sql);
        assertFalse(sql.startsWith("select pg_advisory_xact_lock"), sql);
    }
}
