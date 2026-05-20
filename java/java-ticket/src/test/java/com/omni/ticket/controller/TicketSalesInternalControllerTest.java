package com.omni.ticket.controller;

import com.omni.common.result.Result;
import com.omni.ticket.dto.TicketSalesQuoteRequest;
import com.omni.ticket.dto.TicketSalesQuoteResponse;
import com.omni.ticket.service.TicketSalesInternalService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class TicketSalesInternalControllerTest {
    private final TicketSalesInternalService service = mock(TicketSalesInternalService.class);
    private final TicketSalesInternalController controller = new TicketSalesInternalController(service, "test-internal-token");

    @Test
    void quoteRejectsMissingToken() {
        Result<TicketSalesQuoteResponse> result = controller.quote(new TicketSalesQuoteRequest(), null);

        assertEquals(403, result.getCode());
        verifyNoInteractions(service);
    }

    @Test
    void quoteDelegatesWhenTokenMatches() {
        TicketSalesQuoteRequest request = new TicketSalesQuoteRequest();
        TicketSalesQuoteResponse response = new TicketSalesQuoteResponse();
        response.setTicketTypeId(4001L);
        when(service.quote(request)).thenReturn(response);

        Result<TicketSalesQuoteResponse> result = controller.quote(request, "test-internal-token");

        assertEquals(200, result.getCode());
        assertEquals(4001L, result.getData().getTicketTypeId());
    }

    @Test
    void lockStockRejectsMissingToken() {
        Result<Void> result = controller.lockStock(null, null);

        assertEquals(403, result.getCode());
        verifyNoInteractions(service);
    }
}
