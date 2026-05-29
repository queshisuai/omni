package com.omni.order.entity;

import com.baomidou.mybatisplus.annotation.DbType;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.KeySequence;
import com.baomidou.mybatisplus.annotation.TableId;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class OrderSeataPostgresqlIdStrategyTest {

    @Test
    void orderInsertUsesExplicitPostgresqlSequenceIdForSeataAt() throws Exception {
        assertSeataCompatibleSequenceId(Order.class, "order_id_seq");
    }

    @Test
    void orderSnapshotInsertUsesExplicitPostgresqlSequenceIdForSeataAt() throws Exception {
        assertSeataCompatibleSequenceId(OrderSnapshot.class, "order_snapshot_id_seq");
    }

    @Test
    void orderSeatInsertUsesExplicitPostgresqlSequenceIdForSeataAt() throws Exception {
        assertSeataCompatibleSequenceId(OrderSeat.class, "order_seat_id_seq");
    }

    private static void assertSeataCompatibleSequenceId(Class<?> entityType, String sequenceName) throws Exception {
        KeySequence keySequence = entityType.getAnnotation(KeySequence.class);
        assertNotNull(keySequence);
        assertEquals(sequenceName, keySequence.value());
        assertEquals(DbType.POSTGRE_SQL, keySequence.dbType());

        Field id = entityType.getDeclaredField("id");
        TableId tableId = id.getAnnotation(TableId.class);
        assertNotNull(tableId);
        assertEquals(IdType.INPUT, tableId.type());
    }
}
