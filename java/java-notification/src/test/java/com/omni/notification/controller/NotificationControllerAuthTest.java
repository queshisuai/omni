package com.omni.notification.controller;

import com.omni.common.result.Result;
import com.omni.notification.entity.Notification;
import com.omni.notification.service.NotificationService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class NotificationControllerAuthTest {

    private static final String SECRET = "omni-jwt-secretomni-jwt-secretomni-jwt-secret";

    @Test
    void listNotificationsUsesJwtUserId() {
        NotificationService service = mock(NotificationService.class);
        NotificationController controller = new NotificationController(service, "internal-token", SECRET);

        controller.listNotifications(bearer(2004L));

        verify(service).listNotifications(2004L);
    }

    @Test
    void listNotificationsRejectsMissingJwt() {
        NotificationService service = mock(NotificationService.class);
        NotificationController controller = new NotificationController(service, "internal-token", SECRET);

        Result<List<Notification>> result = controller.listNotifications(null);

        assertEquals(401, result.getCode());
        verify(service, never()).listNotifications(any());
    }

    @Test
    void markAllReadUsesJwtUserId() {
        NotificationService service = mock(NotificationService.class);
        NotificationController controller = new NotificationController(service, "internal-token", SECRET);

        controller.markAllRead(bearer(2004L));

        verify(service).markAllRead(2004L);
    }

    @Test
    void deleteReadRejectsMissingJwt() {
        NotificationService service = mock(NotificationService.class);
        NotificationController controller = new NotificationController(service, "internal-token", SECRET);

        Result<?> result = controller.deleteRead(null);

        assertEquals(401, result.getCode());
        verify(service, never()).deleteRead(any());
    }

    @Test
    void markSingleReadUsesJwtUserIdAndPathId() {
        NotificationService service = mock(NotificationService.class);
        NotificationController controller = new NotificationController(service, "internal-token", SECRET);

        controller.markRead(99L, bearer(2004L));

        verify(service).markRead(2004L, 99L);
    }

    @Test
    void sendSmsUsesJwtUserId() {
        NotificationService service = mock(NotificationService.class);
        NotificationController controller = new NotificationController(service, "internal-token", SECRET);

        controller.sendSms(bearer(2004L), Map.of(
                "userId", 9999L,
                "orderId", 10L,
                "content", "hi"
        ));

        verify(service).sendSms(2004L, 10L, "hi");
        verify(service, never()).sendSms(9999L, 10L, "hi");
    }

    @Test
    void sendSmsRejectsMissingJwt() {
        NotificationService service = mock(NotificationService.class);
        NotificationController controller = new NotificationController(service, "internal-token", SECRET);

        Result<Void> result = controller.sendSms(null, Map.of(
                "userId", 9999L,
                "orderId", 10L,
                "content", "hi"
        ));

        assertEquals(401, result.getCode());
        verify(service, never()).sendSms(any(), any(), any());
    }

    @Test
    void sendEmailUsesJwtUserId() {
        NotificationService service = mock(NotificationService.class);
        NotificationController controller = new NotificationController(service, "internal-token", SECRET);

        controller.sendEmail(bearer(2004L), Map.of(
                "userId", 9999L,
                "orderId", 10L,
                "content", "hi"
        ));

        verify(service).sendEmail(2004L, 10L, "hi");
        verify(service, never()).sendEmail(9999L, 10L, "hi");
    }

    @Test
    void sendEmailRejectsMissingJwt() {
        NotificationService service = mock(NotificationService.class);
        NotificationController controller = new NotificationController(service, "internal-token", SECRET);

        Result<Void> result = controller.sendEmail(null, Map.of(
                "userId", 9999L,
                "orderId", 10L,
                "content", "hi"
        ));

        assertEquals(401, result.getCode());
        verify(service, never()).sendEmail(any(), any(), any());
    }

    private static String bearer(Long userId) {
        Key key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        String token = Jwts.builder()
                .claim("userId", userId)
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
        return "Bearer " + token;
    }
}
