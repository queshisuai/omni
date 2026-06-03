package com.omni.order.service;

import io.seata.spring.annotation.GlobalTransactional;
import org.junit.jupiter.api.*;
import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Seata Annotations — java-order")
class OrderSeataAnnotationTest {

    @Test @DisplayName("ST-008: @GlobalTransactional on createOrder")
    void st008() throws Exception { verifyTx("createOrder", 1, "omni-create-order"); }
    @Test @DisplayName("ST-008: @GlobalTransactional on createOrderWithSeats")
    void st008b() throws Exception { verifyTx("createOrderWithSeats", 1, "omni-create-order-with-seats"); }
    @Test @DisplayName("ST-008: @GlobalTransactional on createTeamOrderWithLockedSeats")
    void st008c() throws Exception { verifyTx("createTeamOrderWithLockedSeats", 1, "omni-create-team-order-with-locked-seats"); }
    @Test @DisplayName("ST-009: @GlobalTransactional on cancelOrder")
    void st009() throws Exception { verifyTx("cancelOrder", 1, "omni-cancel-order"); }
    @Test @DisplayName("ST-009: @GlobalTransactional on cancelUserOrder")
    void st009b() throws Exception { verifyTx("cancelUserOrder", 2, "omni-cancel-user-order"); }
    @Test @DisplayName("ST-014: @GlobalTransactional on markRefunded")
    void st014() throws Exception { verifyTx("markRefunded", 1, "omni-mark-refunded"); }
    @Test @DisplayName("ST-014: @GlobalTransactional on markPartialRefunded")
    void st014b() throws Exception { verifyTx("markPartialRefunded", 2, "omni-mark-partial-refunded"); }

    void verifyTx(String methodName, int paramCount, String txName) throws Exception {
        for (Method m : OrderService.class.getDeclaredMethods()) {
            if (m.getName().equals(methodName) && m.getParameterCount() == paramCount) {
                GlobalTransactional tx = m.getAnnotation(GlobalTransactional.class);
                assertNotNull(tx, methodName + " missing @GlobalTransactional");
                assertEquals(txName, tx.name());
                assertTrue(tx.rollbackFor().length > 0, methodName + " missing rollbackFor");
                return;
            }
        }
        fail(methodName + " method not found with " + paramCount + " params");
    }
}
