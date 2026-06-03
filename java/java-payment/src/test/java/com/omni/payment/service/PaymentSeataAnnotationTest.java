package com.omni.payment.service;

import io.seata.spring.annotation.GlobalTransactional;
import org.junit.jupiter.api.*;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Seata Annotations — java-payment")
class PaymentSeataAnnotationTest {

    @Test @DisplayName("ST-010: @GlobalTransactional on confirmPayment")
    void st010() throws Exception {
        for (Method m : PaymentConfirmationService.class.getDeclaredMethods()) {
            if (m.getName().equals("confirmPayment")) {
                GlobalTransactional tx = m.getAnnotation(GlobalTransactional.class);
                assertNotNull(tx, "confirmPayment missing @GlobalTransactional");
                assertEquals("omni-confirm-payment", tx.name());
                assertTrue(tx.rollbackFor().length > 0, "missing rollbackFor");
                return;
            }
        }
        fail("confirmPayment method not found");
    }

    @Test @DisplayName("ST-019: Alipay calls NOT in @GlobalTransactional scope")
    void st019() {
        // AlipayService.createQrPay does NOT have @GlobalTransactional
        // Payment confirmation (Alipay notify → confirmPayment) IS @GlobalTransactional
        assertDoesNotThrow(() -> {
            for (Method m : AlipayService.class.getDeclaredMethods()) {
                if (m.getName().equals("createQrPay") || m.getName().equals("createPagePay")) {
                    assertNull(m.getAnnotation(GlobalTransactional.class),
                            m.getName() + " should NOT have @GlobalTransactional (Alipay not in Seata)");
                }
            }
        });
    }
}
