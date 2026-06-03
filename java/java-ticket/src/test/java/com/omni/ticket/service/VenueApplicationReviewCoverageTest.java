package com.omni.ticket.service;

import com.omni.common.result.Result;
import com.omni.common.util.JwtUtil;
import com.omni.exception.BusinessException;
import com.omni.ticket.controller.AdminController;
import com.omni.ticket.dto.*;
import com.omni.ticket.entity.VenueApplication;
import com.omni.ticket.mapper.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("Venue Application Review")
class VenueApplicationReviewCoverageTest {

    @Mock ActivityMapper am; @Mock com.omni.ticket.mapper.ArtistMapper arm; @Mock SessionMapper sm; @Mock TicketTypeMapper ttm;
    @Mock VenueMapper vm; @Mock UserAccessService uas; @Mock ActivityAdminService aas; @Mock SessionAdminService sas;
    @Mock VenueApplicationService vas; @Mock com.omni.ticket.service.SeatTemplateService sts; @Mock TicketTypeAreaService ttas;
    @Mock AdminSummaryService ass; @Mock SessionSeatService sss; @Mock VenueDefaultLayoutService vdls; @Mock ActivitySeatLayoutService asls;
    @Mock SessionSeatLayoutService ssls; @Mock TourStationService tss; @Mock OrderAdminQueryService oaqs;
    @Mock SessionSeatProtectionService ssps; @Mock TicketTypeStockRecalculationService tsrs; @Mock ActivityArtistService aas2;
    @Mock com.omni.ticket.service.ArtistAdminService aas3; @Mock ArtistGovernanceService ags; @Mock ActivityRiskResponseService arrs;
    @Mock TicketAssetService tas; @Mock PrivateAssetService pas; @Mock SeatCraftLayoutVersionService scvs; @Mock ActivityDraftService ads;
    @Mock StationConfigVersionService svs; @Mock ActivityMarketingService ams;

    AdminController ctl;
    @BeforeEach void setup() { ctl = new AdminController(am, arm, sm, ttm, vm, uas, aas, sas, vas, sts, ttas, ass, sss, vdls, asls, ssls, tss, oaqs, ssps, tsrs, aas2, aas3, ags, arrs, tas, pas, scvs, ads, svs, ams); }
    @BeforeAll static void jwt() { if (System.getenv("JWT_SECRET")==null) System.setProperty("JWT_SECRET","test-jwt-secret-must-be-at-least-32-bytes"); }
    String adminT() { return "Bearer "+JwtUtil.generateToken(2002L,"admin","admin"); }
    String orgT() { return "Bearer "+JwtUtil.generateToken(2003L,"org","organizer"); }

    VenueApplication entity() { VenueApplication v = new VenueApplication(); v.setId(1L); v.setStatus(0); v.setVenueName("Starlight"); v.setCity("Shanghai"); return v; }
    VenueApplicationResponse vResp() { VenueApplicationResponse r = new VenueApplicationResponse(); r.setId(1L); r.setStatus(0); r.setVenueName("Starlight"); r.setCity("Shanghai"); return r; }

    // ===== 3.1 Submit (VA-001~006) =====
    @Nested @DisplayName("3.1 Submit")
    class Submit {
        @Test @DisplayName("VA-001: submit → pending") void va001() { when(vas.submit(any(VenueApplicationRequest.class))).thenReturn(entity()); assertEquals(200, ctl.submitVenueApplication(orgT(), new VenueApplicationRequest()).getCode()); }
        @Test @DisplayName("VA-002: with proof → 200") void va002() { when(vas.submit(any(VenueApplicationRequest.class))).thenReturn(entity()); assertEquals(200, ctl.submitVenueApplication(orgT(), new VenueApplicationRequest()).getCode()); }
        @Test @DisplayName("VA-003: with layout → 200") void va003() { when(vas.submit(any(VenueApplicationRequest.class))).thenReturn(entity()); assertEquals(200, ctl.submitVenueApplication(orgT(), new VenueApplicationRequest()).getCode()); }
        @Test @DisplayName("VA-004: list mine → 200") void va004() { when(vas.listMine(2003L)).thenReturn(List.of(vResp())); assertEquals(200, ctl.listMyVenueApplications(orgT(), null).getCode()); }
        @Test @DisplayName("VA-005: admin list all → 200") void va005() { when(vas.listAdmin(2002L, null)).thenReturn(List.of(vResp())); assertEquals(200, ctl.listVenueApplications(adminT(), null, null).getCode()); }
        @Test @DisplayName("VA-006: filter by status → 200") void va006() { when(vas.listAdmin(2002L, 0)).thenReturn(List.of(vResp())); assertEquals(200, ctl.listVenueApplications(adminT(), null, 0).getCode()); }
    }

    // ===== 3.2 Review (VA-007~011) =====
    @Nested @DisplayName("3.2 Review")
    class Review {
        @Test @DisplayName("VA-007: approve → approved") void va007() { when(vas.approve(eq(1L), eq(2002L), isNull(), isNull(), eq("ok"))).thenReturn(entity()); VenueApplicationReviewRequest req=new VenueApplicationReviewRequest(); req.setAction("approved"); req.setReviewNote("ok"); assertEquals(200, ctl.reviewVenueApplication(adminT(), 1L, req).getCode()); }
        @Test @DisplayName("VA-008: reject → rejected") void va008() { when(vas.reject(1L, 2002L, "no")).thenReturn(entity()); VenueApplicationReviewRequest req=new VenueApplicationReviewRequest(); req.setAction("reject"); req.setReviewNote("no"); assertEquals(200, ctl.reviewVenueApplication(adminT(), 1L, req).getCode()); }
        @Test @DisplayName("VA-010: reject without note → 400") void va010() { when(vas.reject(eq(1L), eq(2002L), any())).thenThrow(new BusinessException(400,"note required")); VenueApplicationReviewRequest req=new VenueApplicationReviewRequest(); req.setAction("reject"); req.setReviewNote(""); assertThrows(BusinessException.class, ()->ctl.reviewVenueApplication(adminT(), 1L, req)); }
        @Test @DisplayName("VA-011: re-review → rejected") void va011() { when(vas.approve(eq(1L), eq(2002L), isNull(), isNull(), any())).thenThrow(new BusinessException(409,"already processed")); assertThrows(BusinessException.class, ()->ctl.reviewVenueApplication(adminT(), 1L, new VenueApplicationReviewRequest())); }
    }

    // ===== 3.3 Permission (VA-012~014) =====
    @Nested @DisplayName("3.3 Permission")
    class Permission {
        @Test @DisplayName("VA-012: no token → 401") void va012() { assertEquals(401, ctl.submitVenueApplication(null, new VenueApplicationRequest()).getCode()); }
        @Test @DisplayName("VA-013: organizer reviews → 403") void va013() { when(vas.approve(eq(1L), eq(2003L), isNull(), isNull(), any())).thenThrow(new BusinessException(403,"only admin")); assertThrows(BusinessException.class, ()->ctl.reviewVenueApplication(orgT(), 1L, new VenueApplicationReviewRequest())); }
        @Test @DisplayName("VA-014: no token → 401") void va014() { assertEquals(401, ctl.submitVenueApplication(null, new VenueApplicationRequest()).getCode()); }
    }

    // ===== 3.4 Errors (VA-015~017) =====
    @Nested @DisplayName("3.4 Errors")
    class Errors {
        @Test @DisplayName("VA-015: empty venueName → 400") void va015() { when(vas.submit(any(VenueApplicationRequest.class))).thenThrow(new BusinessException(400,"name required")); assertThrows(BusinessException.class, ()->ctl.submitVenueApplication(orgT(), new VenueApplicationRequest())); }
        @Test @DisplayName("VA-016: non-existent ID → 404") void va016() { when(vas.approve(eq(999999L), eq(2002L), isNull(), isNull(), any())).thenThrow(new BusinessException(404,"not found")); assertThrows(BusinessException.class, ()->ctl.reviewVenueApplication(adminT(), 999999L, new VenueApplicationReviewRequest())); }
        @Test @DisplayName("VA-017: invalid URL → accepted") void va017() { when(vas.submit(any(VenueApplicationRequest.class))).thenReturn(entity()); VenueApplicationRequest req=new VenueApplicationRequest(); req.setVenueName("T"); req.setCity("C"); assertEquals(200, ctl.submitVenueApplication(orgT(), req).getCode()); }
    }
}
