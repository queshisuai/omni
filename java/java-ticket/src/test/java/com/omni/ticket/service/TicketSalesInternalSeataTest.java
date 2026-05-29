package com.omni.ticket.service;

import com.omni.ticket.dto.TicketSalesLockRequest;
import com.omni.ticket.dto.TicketSalesOrderRequest;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;
import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TicketSalesInternalSeataTest {

    @Test
    void lockStockHasTransactionalRollbackForException() throws Exception {
        Method method = TicketSalesInternalService.class.getMethod("lockStock", TicketSalesLockRequest.class);

        Transactional annotation = method.getAnnotation(Transactional.class);

        assertNotNull(annotation);
        assertTrue(Arrays.asList(annotation.rollbackFor()).contains(Exception.class));
    }

    @Test
    void lockSeatsHasTransactionalRollbackForException() throws Exception {
        Method method = TicketSalesInternalService.class.getMethod("lockSeats", TicketSalesLockRequest.class);

        Transactional annotation = method.getAnnotation(Transactional.class);

        assertNotNull(annotation);
        assertTrue(Arrays.asList(annotation.rollbackFor()).contains(Exception.class));
    }

    @Test
    void confirmSoldHasTransactionalRollbackForException() throws Exception {
        Method method = TicketSalesInternalService.class.getMethod("confirmSold", TicketSalesOrderRequest.class);

        Transactional annotation = method.getAnnotation(Transactional.class);

        assertNotNull(annotation);
        assertTrue(Arrays.asList(annotation.rollbackFor()).contains(Exception.class));
    }

    @Test
    void releaseHasTransactionalRollbackForException() throws Exception {
        Method method = TicketSalesInternalService.class.getMethod("release", TicketSalesOrderRequest.class);

        Transactional annotation = method.getAnnotation(Transactional.class);

        assertNotNull(annotation);
        assertTrue(Arrays.asList(annotation.rollbackFor()).contains(Exception.class));
    }

    @Test
    void refundHasTransactionalRollbackForException() throws Exception {
        Method method = TicketSalesInternalService.class.getMethod("refund", TicketSalesOrderRequest.class);

        Transactional annotation = method.getAnnotation(Transactional.class);

        assertNotNull(annotation);
        assertTrue(Arrays.asList(annotation.rollbackFor()).contains(Exception.class));
    }
}
