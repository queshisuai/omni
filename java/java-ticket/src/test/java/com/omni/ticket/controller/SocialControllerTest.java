package com.omni.ticket.controller;

import com.omni.common.result.Result;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SocialControllerTest {

    @Test
    void socialControllerDoesNotDependOnRemovedSocialPersistence() {
        for (Constructor<?> constructor : SocialController.class.getDeclaredConstructors()) {
            for (Class<?> parameterType : constructor.getParameterTypes()) {
                assertEquals(false, isRemovedSocialPersistenceType(parameterType),
                        "SocialController must not inject removed social persistence");
            }
        }

        for (Field field : SocialController.class.getDeclaredFields()) {
            assertEquals(false, isRemovedSocialPersistenceType(field.getType()),
                    "SocialController must not hold removed social persistence fields");
        }
    }

    @Test
    void removedSocialPersistenceTypesAreNotPresent() {
        assertClassNotFound("com.omni.ticket.mapper.ReviewMapper");
        assertClassNotFound("com.omni.ticket.mapper.MomentMapper");
        assertClassNotFound("com.omni.ticket.entity.Review");
        assertClassNotFound("com.omni.ticket.entity.Moment");
    }

    @Test
    void reviewAndMomentEndpointsReturnRemovedMessage() throws Exception {
        SocialController controller = new SocialController();

        assertRemoved(controller.listReviews(1L, 1, 10));
        assertRemoved(controller.createReview(Map.of("content", "ok")));
        assertRemoved(controller.deleteReview(1L));
        assertRemoved(controller.listMoments(1L, 1, 10));
        assertRemoved(controller.createMoment(Map.of("content", "ok")));
        assertRemoved(controller.deleteMoment(1L));

        for (Method method : SocialController.class.getDeclaredMethods()) {
            assertEquals(false, method.getName().toLowerCase().contains("mapper"),
                    "SocialController must not expose mapper helper methods");
        }
    }

    private static boolean isRemovedSocialPersistenceType(Class<?> type) {
        String name = type.getName();
        return name.equals("com.omni.ticket.mapper.ReviewMapper")
                || name.equals("com.omni.ticket.mapper.MomentMapper")
                || name.equals("com.omni.ticket.entity.Review")
                || name.equals("com.omni.ticket.entity.Moment");
    }

    private static void assertClassNotFound(String className) {
        assertThrows(ClassNotFoundException.class, () -> Class.forName(className));
    }

    private static void assertRemoved(Result<Void> result) {
        assertEquals(404, result.getCode());
        assertEquals("评价和动态功能已移除", result.getMessage());
    }
}
