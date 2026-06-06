package com.omni.ticket.controller;

import com.omni.common.result.Result;
import com.omni.common.util.JwtUtil;
import com.omni.ticket.dto.CheckInOverviewResponse;
import com.omni.ticket.dto.CheckInRecordResponse;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.ArtistMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import com.omni.ticket.mapper.VenueMapper;
import com.omni.ticket.service.ActivityAdminService;
import com.omni.ticket.service.ActivityArtistService;
import com.omni.ticket.service.ActivityDraftService;
import com.omni.ticket.service.ActivityMarketingService;
import com.omni.ticket.service.ActivityRiskResponseService;
import com.omni.ticket.service.ActivitySeatLayoutService;
import com.omni.ticket.service.AdminSummaryService;
import com.omni.ticket.service.ArtistAdminService;
import com.omni.ticket.service.ArtistGovernanceService;
import com.omni.ticket.service.CheckInAdminQueryService;
import com.omni.ticket.service.OrderAdminQueryService;
import com.omni.ticket.service.PrivateAssetService;
import com.omni.ticket.service.SeatCraftLayoutVersionService;
import com.omni.ticket.service.SeatTemplateService;
import com.omni.ticket.service.SessionAdminService;
import com.omni.ticket.service.SessionSeatLayoutService;
import com.omni.ticket.service.SessionSeatProtectionService;
import com.omni.ticket.service.SessionSeatService;
import com.omni.ticket.service.StationConfigVersionService;
import com.omni.ticket.service.TicketAssetService;
import com.omni.ticket.service.TicketTypeAreaService;
import com.omni.ticket.service.TicketTypeStockRecalculationService;
import com.omni.ticket.service.TourStationService;
import com.omni.ticket.service.UserAccessService;
import com.omni.ticket.service.VenueApplicationService;
import com.omni.ticket.service.VenueDefaultLayoutService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminControllerCheckInTest {
    private CheckInAdminQueryService checkInAdminQueryService;
    private AdminController controller;

    @BeforeEach
    void setUp() {
        checkInAdminQueryService = mock(CheckInAdminQueryService.class);
        controller = new AdminController(
                mock(ActivityMapper.class),
                mock(ArtistMapper.class),
                mock(SessionMapper.class),
                mock(TicketTypeMapper.class),
                mock(VenueMapper.class),
                mock(UserAccessService.class),
                mock(ActivityAdminService.class),
                mock(SessionAdminService.class),
                mock(VenueApplicationService.class),
                mock(SeatTemplateService.class),
                mock(TicketTypeAreaService.class),
                mock(AdminSummaryService.class),
                mock(SessionSeatService.class),
                mock(VenueDefaultLayoutService.class),
                mock(ActivitySeatLayoutService.class),
                mock(SessionSeatLayoutService.class),
                mock(TourStationService.class),
                mock(OrderAdminQueryService.class),
                checkInAdminQueryService,
                mock(SessionSeatProtectionService.class),
                mock(TicketTypeStockRecalculationService.class),
                mock(ActivityArtistService.class),
                mock(ArtistAdminService.class),
                mock(ArtistGovernanceService.class),
                mock(ActivityRiskResponseService.class),
                mock(TicketAssetService.class),
                mock(PrivateAssetService.class),
                mock(SeatCraftLayoutVersionService.class),
                mock(ActivityDraftService.class),
                mock(StationConfigVersionService.class),
                mock(ActivityMarketingService.class));
    }

    @Test
    void getCheckInOverviewRejectsMissingToken() {
        Result<CheckInOverviewResponse> result = controller.getCheckInOverview(null, 101L);

        assertEquals(401, result.getCode());
        verify(checkInAdminQueryService, never()).getOverview(2002L, 101L);
    }

    @Test
    void getCheckInOverviewDelegatesWithJwtOperator() {
        CheckInOverviewResponse response = new CheckInOverviewResponse();
        response.setSessionId(101L);
        when(checkInAdminQueryService.getOverview(2002L, 101L)).thenReturn(response);

        Result<CheckInOverviewResponse> result = controller.getCheckInOverview(adminToken(), 101L);

        assertEquals(200, result.getCode());
        assertEquals(response, result.getData());
        verify(checkInAdminQueryService).getOverview(2002L, 101L);
    }

    @Test
    void listCheckInRecordsDelegatesWithFilters() {
        CheckInRecordResponse record = new CheckInRecordResponse();
        record.setRequestId("REQ-1");
        when(checkInAdminQueryService.listRecords(2002L, 101L, "SUCCESS", 1, 20))
                .thenReturn(List.of(record));

        Result<List<CheckInRecordResponse>> result =
                controller.listCheckInRecords(adminToken(), 101L, "SUCCESS", 1, 20);

        assertEquals(200, result.getCode());
        assertEquals(List.of(record), result.getData());
        verify(checkInAdminQueryService).listRecords(2002L, 101L, "SUCCESS", 1, 20);
    }

    private String adminToken() {
        return "Bearer " + JwtUtil.generateToken(2002L, "13800000001", "admin");
    }
}
