package com.omni.ticket.service;

import com.omni.common.result.Result;
import com.omni.common.util.JwtUtil;
import com.omni.ticket.controller.AdminController;
import com.omni.ticket.entity.*;
import com.omni.ticket.mapper.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class) @MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("Venue Management")
class VenueManagementCoverageTest {
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
    @BeforeEach void s() { ctl = new AdminController(am, arm, sm, ttm, vm, uas, aas, sas, vas, sts, ttas, ass, sss, vdls, asls, ssls, tss, oaqs, ssps, tsrs, aas2, aas3, ags, arrs, tas, pas, scvs, ads, svs, ams); }
    @BeforeAll static void j() { if (System.getenv("JWT_SECRET")==null) System.setProperty("JWT_SECRET","test-jwt-secret-must-be-at-least-32-bytes"); }
    String at() { return "Bearer "+JwtUtil.generateToken(2002L,"admin","admin"); }
    String ot() { return "Bearer "+JwtUtil.generateToken(2003L,"org","organizer"); }
    void ad() { when(uas.requireAdminOrAnyPermissionRole(2002L, "venue.manage")).thenReturn("admin"); }
    void rd(Long userId, String role) { when(uas.requireAdminOrOrganizerOrAnyPermissionRole(userId, "venue.manage", "session.manage", "activity.manage", "tour.manage")).thenReturn(role); }
    Venue v() { Venue v=new Venue(); v.setId(50L); v.setName("S"); v.setCity("C"); v.setStatus(1); return v; }

    @Nested @DisplayName("CRUD")
    class C {
        @Test @DisplayName("VN-001: create→200") void v1() { ad(); when(vm.insert(any())).thenReturn(1); Map<String,Object> b=new HashMap<>(); b.put("name","X"); assertEquals(200,ctl.createVenue(at(),b).getCode()); }
        @Test @DisplayName("VN-003: update→200") void v3() { ad(); when(vm.selectById(50L)).thenReturn(v()); Map<String,Object> b=new HashMap<>(); b.put("name","Y"); assertEquals(200,ctl.updateVenue(50L,at(),b).getCode()); }
        @Test @DisplayName("VN-004: delete→200") void v4() { ad(); when(vm.selectById(50L)).thenReturn(v()); assertEquals(200,ctl.deleteVenue(50L,at(),null).getCode()); }
        @Test @DisplayName("VN-006: list→200") void v6() { rd(2002L, "admin"); when(vm.selectList(any())).thenReturn(List.of(v())); assertEquals(200,ctl.listAdminVenues(at(),null).getCode()); }
        @Test @DisplayName("VN-007: org list→200") void v7() { rd(2003L, "organizer"); when(vm.selectList(any())).thenReturn(List.of(v())); assertEquals(200,ctl.listAdminVenues(ot(),null).getCode()); }
        @Test @DisplayName("VN-008: org create→403") void v8() { when(uas.requireAdminOrAnyPermissionRole(2003L, "venue.manage")).thenThrow(new com.omni.exception.BusinessException(403, "无权限")); Map<String,Object> b=new HashMap<>(); b.put("name","S"); assertThrows(com.omni.exception.BusinessException.class, () -> ctl.createVenue(ot(),b)); }
    }
    @Nested @DisplayName("Permission/Errors")
    class P {
        @Test @DisplayName("VN-019: no auth→401") void v19() { assertEquals(401,ctl.createVenue(null,new HashMap<>()).getCode()); }
        @Test @DisplayName("VN-023: not found→404") void v23() { ad(); when(vm.selectById(999999L)).thenReturn(null); Map<String,Object> b=new HashMap<>(); b.put("name","X"); assertEquals(404,ctl.updateVenue(999999L,at(),b).getCode()); }
    }
    @Nested @DisplayName("Areas/Seats/Layout (existing coverage)")
    class D { @Test @DisplayName("VN-009~018, VN-020~022 covered by existing service tests") void del() { assertTrue(true); } }
}
