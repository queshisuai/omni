package com.omni.ticket.controller;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertThrows;

class SocialControllerTest {

    @Test
    void removedSocialRuntimeTypesAreNotPresent() {
        assertClassNotFound("com.omni.ticket.controller.SocialController");
        assertClassNotFound("com.omni.ticket.mapper.ReviewMapper");
        assertClassNotFound("com.omni.ticket.mapper.MomentMapper");
        assertClassNotFound("com.omni.ticket.entity.Review");
        assertClassNotFound("com.omni.ticket.entity.Moment");
    }

    private static void assertClassNotFound(String className) {
        assertThrows(ClassNotFoundException.class, () -> Class.forName(className));
    }
}
