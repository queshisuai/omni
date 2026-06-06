package com.omni.order.service;

import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.order.dto.TicketEntryCodeResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Base64;

@Component
public class TicketEntryCodeCodec {
    private static final String CODE_VERSION = "v1";

    private final String entryCodeSecret;

    public TicketEntryCodeCodec(@Value("${omni.ticket.entry-code-secret:${OMNI_TICKET_ENTRY_CODE_SECRET:omni-ticket-entry-code-secret}}") String entryCodeSecret) {
        this.entryCodeSecret = entryCodeSecret;
    }

    public TicketEntryCodeResponse create(Long ticketId, Long userId, long ttlSeconds) {
        long expiresAt = Instant.now().plusSeconds(ttlSeconds).getEpochSecond();
        String payload = CODE_VERSION + ":" + ticketId + ":" + userId + ":" + expiresAt;
        TicketEntryCodeResponse response = new TicketEntryCodeResponse();
        response.setTicketId(ticketId);
        response.setExpiresAt(LocalDateTime.ofInstant(Instant.ofEpochSecond(expiresAt), ZoneId.systemDefault()));
        response.setEntryCode(payload + ":" + sign(payload));
        return response;
    }

    public CodePayload parseAndVerify(String entryCode) {
        if (!StringUtils.hasText(entryCode)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "入场码无效");
        }
        String[] parts = entryCode.split(":");
        if (parts.length != 5 || !CODE_VERSION.equals(parts[0])) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "入场码无效");
        }
        String payload = parts[0] + ":" + parts[1] + ":" + parts[2] + ":" + parts[3];
        if (!sign(payload).equals(parts[4])) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "入场码无效");
        }
        long expiresAt;
        try {
            expiresAt = Long.parseLong(parts[3]);
        } catch (NumberFormatException e) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "入场码无效");
        }
        if (Instant.now().getEpochSecond() > expiresAt) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "入场码已过期");
        }
        return new CodePayload(parseLong(parts[1]), parseLong(parts[2]));
    }

    private Long parseLong(String value) {
        try {
            return Long.valueOf(value);
        } catch (NumberFormatException e) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "入场码无效");
        }
    }

    private String sign(String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(entryCodeSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "入场码生成失败");
        }
    }

    public static class CodePayload {
        private final Long ticketId;
        private final Long userId;

        private CodePayload(Long ticketId, Long userId) {
            this.ticketId = ticketId;
            this.userId = userId;
        }

        public Long getTicketId() {
            return ticketId;
        }

        public Long getUserId() {
            return userId;
        }
    }
}
