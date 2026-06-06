package com.omni.order.service;

import com.omni.exception.BusinessException;
import com.omni.order.dto.TicketEntryCodeResponse;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class TicketEntryCodeCodecTest {

    @Test
    void parsesSignedEntryCode() {
        TicketEntryCodeCodec codec = new TicketEntryCodeCodec("test-secret");
        TicketEntryCodeResponse response = codec.create(3001L, 2004L, 60);

        TicketEntryCodeCodec.CodePayload payload = codec.parseAndVerify(response.getEntryCode());

        assertEquals(3001L, response.getTicketId());
        assertNotNull(response.getExpiresAt());
        assertEquals(3001L, payload.getTicketId());
        assertEquals(2004L, payload.getUserId());
    }

    @Test
    void rejectsTamperedEntryCode() {
        TicketEntryCodeCodec codec = new TicketEntryCodeCodec("test-secret");
        String code = codec.create(3001L, 2004L, 60).getEntryCode() + "x";

        BusinessException error = assertThrows(BusinessException.class, () -> codec.parseAndVerify(code));

        assertEquals("入场码无效", error.getMessage());
    }

    @Test
    void rejectsExpiredEntryCode() {
        TicketEntryCodeCodec codec = new TicketEntryCodeCodec("test-secret");
        String code = codec.create(3001L, 2004L, -1).getEntryCode();

        BusinessException error = assertThrows(BusinessException.class, () -> codec.parseAndVerify(code));

        assertEquals("入场码已过期", error.getMessage());
    }

    @Test
    void rejectsBlankEntryCode() {
        TicketEntryCodeCodec codec = new TicketEntryCodeCodec("test-secret");

        BusinessException error = assertThrows(BusinessException.class, () -> codec.parseAndVerify(" "));

        assertEquals("入场码无效", error.getMessage());
    }
}
