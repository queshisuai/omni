package com.omni.ticket.controller;

import com.omni.common.result.Result;
import com.omni.ticket.ai.FinderQueryRequest;
import com.omni.ticket.ai.FinderResponse;
import com.omni.ticket.service.AiTicketFinderService;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class AiTicketFinderControllerTest {

    @BeforeAll
    static void ensureJwtSecret() {
        if (System.getenv("JWT_SECRET") == null || System.getenv("JWT_SECRET").isBlank()) {
            System.setProperty("JWT_SECRET", "test-jwt-secret-must-be-at-least-32-bytes");
        }
    }

    @Test
    void rejectsUnauthenticatedFinderRequest() {
        AiTicketFinderService service = mock(AiTicketFinderService.class);
        Result<FinderResponse> result = new AiTicketFinderController(service)
                .search(null, new FinderQueryRequest("东京演唱会"));

        assertEquals(401, result.getCode());
        verifyNoInteractions(service);
    }
}
