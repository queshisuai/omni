package com.omni.ticket.controller;

import com.omni.common.result.Result;
import com.omni.common.util.JwtUtil;
import com.omni.ticket.dto.OrganizerOnsaleSummaryRequest;
import com.omni.ticket.service.OrganizerOnsaleSummaryService;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

class OrganizerOnsaleSummaryControllerTest {

    @Test
    void returnsBatchSummaryForAuthenticatedOperator() {
        OrganizerOnsaleSummaryService service = mock(OrganizerOnsaleSummaryService.class);
        when(service.batchSummary(2002L, List.of(2003L, 2005L)))
                .thenReturn(Map.of(2003L, 4L, 2005L, 1L));
        OrganizerOnsaleSummaryController controller = new OrganizerOnsaleSummaryController(service);
        OrganizerOnsaleSummaryRequest request = new OrganizerOnsaleSummaryRequest();
        request.setOrganizerIds(List.of(2003L, 2005L));

        Result<?> result = controller.batchSummary(
                "Bearer " + JwtUtil.generateToken(2002L, "13800000001", "admin"), request);

        assertEquals(200, result.getCode());
        verify(service).batchSummary(2002L, List.of(2003L, 2005L));
    }

    @Test
    void rejectsMissingAuthorization() {
        OrganizerOnsaleSummaryService service = mock(OrganizerOnsaleSummaryService.class);
        OrganizerOnsaleSummaryController controller = new OrganizerOnsaleSummaryController(service);

        Result<?> result = controller.batchSummary(null, new OrganizerOnsaleSummaryRequest());

        assertEquals(401, result.getCode());
        verifyNoInteractions(service);
    }
}
