package com.omni.order.service;

import com.omni.order.dto.CreateOrderRequest;
import com.omni.order.dto.LockSeatsRequest;
import io.seata.spring.annotation.GlobalTransactional;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OrderSeataCreateOrderTest {

    @Test
    void createOrderHasGlobalTransactionalRollbackForException() throws Exception {
        Method method = OrderService.class.getMethod("createOrder", CreateOrderRequest.class);

        GlobalTransactional annotation = method.getAnnotation(GlobalTransactional.class);

        assertNotNull(annotation);
        assertTrue(Arrays.asList(annotation.rollbackFor()).contains(Exception.class));
    }

    @Test
    void createOrderWithSeatsHasGlobalTransactionalRollbackForException() throws Exception {
        Method method = OrderService.class.getMethod("createOrderWithSeats", LockSeatsRequest.class);

        GlobalTransactional annotation = method.getAnnotation(GlobalTransactional.class);

        assertNotNull(annotation);
        assertTrue(Arrays.asList(annotation.rollbackFor()).contains(Exception.class));
    }
}
