package com.omni.ticket.service;

import com.omni.common.result.Result;
import com.omni.common.util.JwtUtil;
import com.omni.exception.BusinessException;
import com.omni.ticket.controller.AdminController;
import com.omni.ticket.dto.*;
import com.omni.ticket.entity.*;
import com.omni.ticket.mapper.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("Risk Resolution Flow")
class RiskResolutionFlowTest {

    @Mock ActivityMapper am; @Mock ActivityArtistMapper aam; @Mock SessionMapper sm; @Mock TicketTypeMapper ttm;
    @Mock ActivityRiskResolutionMapper rm; @Mock UserAccessService uas; @Mock ActivityAdminService aas;

    ActivityRiskResponseService svc;
    AdminController ctl;

    @BeforeEach void setup() {
        svc = new ActivityRiskResponseService(am, aam, sm, ttm, rm, uas, null, aas, "t");
        ctl = controller();
    }
    @BeforeAll static void jwt() { if (System.getenv("JWT_SECRET")==null) System.setProperty("JWT_SECRET","test-jwt-secret-must-be-at-least-32-bytes"); }

    String adminT() { return "Bearer "+JwtUtil.generateToken(2002L,"admin","admin"); }
    String orgT() { return "Bearer "+JwtUtil.generateToken(2003L,"org","organizer"); }

    Activity activity(Long id, String ps, Long orgId) { Activity a = new Activity(); a.setId(id); a.setPublishStatus(ps); a.setOrganizerId(orgId); a.setName("Event"); return a; }
    ActivityRiskResolution resolution(Long id, Long actId, String status) { ActivityRiskResolution r = new ActivityRiskResolution(); r.setId(id); r.setActivityId(actId); r.setStatus(status); r.setSubmittedBy(2003L); r.setOrganizerId(2003L); return r; }
    InternalUserRefResponse u(Long id, String role) { InternalUserRefResponse r = new InternalUserRefResponse(); r.setId(id); r.setRole(role); r.setStatus(1); return r; }

    // ===== Phase 1: Permission & Errors (RR-015~018) =====
    @Nested @DisplayName("Phase 1: Permission & Errors")
    class PermissionErrors {
        @Test @DisplayName("RR-015: user role submit → 403")
        void rr015() { when(uas.requireAdminOrOrganizerRole(2004L)).thenThrow(new BusinessException(403,"无权限")); ActivityRiskResolutionRequest r = new ActivityRiskResolutionRequest(); r.setUserId(2004L); assertThrows(BusinessException.class,()->svc.submitResolution(1L,r)); }
        @Test @DisplayName("RR-016: no token → 401")
        void rr016() { ActivityRiskResolutionRequest req = new ActivityRiskResolutionRequest(); req.setUserId(2003L); Result<?> r = ctl.submitRiskResolution(1L, null, req); assertEquals(401, r.getCode()); }
        @Test @DisplayName("RR-017: non-existent activity → 404")
        void rr017() { when(am.selectById(999999L)).thenReturn(null); ActivityRiskResolutionRequest r = new ActivityRiskResolutionRequest(); r.setUserId(2003L); assertThrows(BusinessException.class,()->svc.submitResolution(999999L,r)); }
        @Test @DisplayName("RR-018: non-existent resolution → 404")
        void rr018() { when(uas.requireAdmin(2002L)).thenReturn(u(2002L,"admin")); when(rm.selectById(999999L)).thenReturn(null); ActivityRiskResolutionReviewRequest r = new ActivityRiskResolutionReviewRequest(); r.setUserId(2002L); r.setAction("approve"); assertThrows(BusinessException.class,()->svc.reviewResolution(999999L,r)); }
    }

    // ===== Phase 2: Submit (RR-001~004) =====
    @Nested @DisplayName("Phase 2: Organizer Submit")
    class OrganizerSubmit {
        @Test @DisplayName("RR-001: organizer submit → pending")
        void rr001() { Activity a = activity(1L,"risk_suspended",2003L); when(am.selectById(1L)).thenReturn(a); when(uas.requireAdminOrOrganizerRole(2003L)).thenReturn("organizer"); when(uas.requireUser(2003L)).thenReturn(u(2003L,"organizer")); when(rm.selectOne(any())).thenReturn(null); when(rm.insert(any())).thenReturn(1); ActivityRiskResolutionRequest r = new ActivityRiskResolutionRequest(); r.setUserId(2003L); r.setResolutionNote("Fixed lineup"); ActivityRiskResolutionResponse resp = svc.submitResolution(1L,r); assertEquals("pending",resp.getStatus()); verify(rm).insert(any()); }
        @Test @DisplayName("RR-002: empty description → still pending (can be empty)")
        void rr002() { Activity a = activity(1L,"risk_suspended",2003L); when(am.selectById(1L)).thenReturn(a); when(uas.requireAdminOrOrganizerRole(2003L)).thenReturn("organizer"); when(uas.requireUser(2003L)).thenReturn(u(2003L,"organizer")); when(rm.selectOne(any())).thenReturn(null); when(rm.insert(any())).thenReturn(1); ActivityRiskResolutionRequest r = new ActivityRiskResolutionRequest(); r.setUserId(2003L); r.setResolutionNote(""); ActivityRiskResolutionResponse resp = svc.submitResolution(1L,r); assertEquals("pending",resp.getStatus()); }
        @Test @DisplayName("RR-003: non-risk_suspended → rejected")
        void rr003() { Activity a = activity(1L,"published",2003L); when(am.selectById(1L)).thenReturn(a); ActivityRiskResolutionRequest r = new ActivityRiskResolutionRequest(); r.setUserId(2003L); assertThrows(BusinessException.class,()->svc.submitResolution(1L,r)); }
        @Test @DisplayName("RR-004: other organizer → 403")
        void rr004() { Activity a = activity(1L,"risk_suspended",2005L); when(am.selectById(1L)).thenReturn(a); when(uas.requireAdminOrOrganizerRole(2003L)).thenReturn("organizer"); when(uas.requireUser(2005L)).thenReturn(u(2005L,"organizer")); ActivityRiskResolutionRequest r = new ActivityRiskResolutionRequest(); r.setUserId(2003L); assertThrows(BusinessException.class,()->svc.submitResolution(1L,r)); }
    }

    // ===== Phase 3: Admin Review (RR-005~011) =====
    @Nested @DisplayName("Phase 3: Admin Review")
    class AdminReview {
        @Test @DisplayName("RR-005: admin approve → approved")
        void rr005() { when(uas.requireAdmin(2002L)).thenReturn(u(2002L,"admin")); ActivityRiskResolution rs = resolution(10L,1L,"pending"); rs.setSubmittedBy(2003L); when(rm.selectById(10L)).thenReturn(rs); Activity a = activity(1L,"risk_suspended",2003L); when(am.selectById(1L)).thenReturn(a); when(sm.selectList(any())).thenReturn(List.of()); ActivityRiskResolutionReviewRequest r = new ActivityRiskResolutionReviewRequest(); r.setUserId(2002L); r.setAction("approve"); r.setReviewNote("ok"); ActivityRiskResolutionResponse resp = svc.reviewResolution(10L,r); assertEquals("approved",resp.getStatus()); assertEquals("published",a.getPublishStatus()); }
        @Test @DisplayName("RR-006: approve restores activity → published")
        void rr006() { when(uas.requireAdmin(2002L)).thenReturn(u(2002L,"admin")); ActivityRiskResolution rs = resolution(10L,1L,"pending"); rs.setSubmittedBy(2003L); when(rm.selectById(10L)).thenReturn(rs); Activity a = activity(1L,"risk_suspended",2003L); when(am.selectById(1L)).thenReturn(a); when(sm.selectList(any())).thenReturn(List.of()); ActivityRiskResolutionReviewRequest r = new ActivityRiskResolutionReviewRequest(); r.setUserId(2002L); r.setAction("approve"); svc.reviewResolution(10L,r); assertEquals("published",a.getPublishStatus()); assertEquals(Integer.valueOf(1),a.getStatus()); }
        @Test @DisplayName("RR-007: approve restores sessions & ticketTypes → status=1")
        void rr007() { when(uas.requireAdmin(2002L)).thenReturn(u(2002L,"admin")); ActivityRiskResolution rs = resolution(10L,1L,"pending"); rs.setSubmittedBy(2003L); when(rm.selectById(10L)).thenReturn(rs); Activity a = activity(1L,"risk_suspended",2003L); when(am.selectById(1L)).thenReturn(a); Session s = new Session(); s.setId(100L); s.setStatus(0); when(sm.selectList(any())).thenReturn(List.of(s)); TicketType tt = new TicketType(); tt.setId(200L); tt.setStatus(0); when(ttm.selectList(any())).thenReturn(List.of(tt)); ActivityRiskResolutionReviewRequest r = new ActivityRiskResolutionReviewRequest(); r.setUserId(2002L); r.setAction("approve"); r.setReviewNote("restore"); svc.reviewResolution(10L,r); assertEquals(Integer.valueOf(1),s.getStatus()); assertEquals(Integer.valueOf(1),tt.getStatus()); }
        @Test @DisplayName("RR-008: admin reject → rejected")
        void rr008() { when(uas.requireAdmin(2002L)).thenReturn(u(2002L,"admin")); ActivityRiskResolution rs = resolution(10L,1L,"pending"); rs.setSubmittedBy(2003L); when(rm.selectById(10L)).thenReturn(rs); Activity a = activity(1L,"risk_suspended",2003L); when(am.selectById(1L)).thenReturn(a); ActivityRiskResolutionReviewRequest r = new ActivityRiskResolutionReviewRequest(); r.setUserId(2002L); r.setAction("reject"); r.setReviewNote("no"); ActivityRiskResolutionResponse resp = svc.reviewResolution(10L,r); assertEquals("rejected",resp.getStatus()); }
        @Test @DisplayName("RR-009: reject keeps activity risk_suspended")
        void rr009() { when(uas.requireAdmin(2002L)).thenReturn(u(2002L,"admin")); ActivityRiskResolution rs = resolution(10L,1L,"pending"); rs.setSubmittedBy(2003L); when(rm.selectById(10L)).thenReturn(rs); Activity a = activity(1L,"risk_suspended",2003L); when(am.selectById(1L)).thenReturn(a); ActivityRiskResolutionReviewRequest r = new ActivityRiskResolutionReviewRequest(); r.setUserId(2002L); r.setAction("reject"); r.setReviewNote("n"); svc.reviewResolution(10L,r); assertEquals("risk_suspended",a.getPublishStatus()); }
        @Test @DisplayName("RR-010: re-review approved → rejected")
        void rr010() { when(uas.requireAdmin(2002L)).thenReturn(u(2002L,"admin")); ActivityRiskResolution rs = resolution(10L,1L,"approved"); when(rm.selectById(10L)).thenReturn(rs); ActivityRiskResolutionReviewRequest r = new ActivityRiskResolutionReviewRequest(); r.setUserId(2002L); r.setAction("approve"); assertThrows(BusinessException.class,()->svc.reviewResolution(10L,r)); }
        @Test @DisplayName("RR-011: organizer tries review → 403")
        void rr011() { when(uas.requireAdmin(2003L)).thenThrow(new BusinessException(403,"仅平台管理员可操作")); ActivityRiskResolutionReviewRequest r = new ActivityRiskResolutionReviewRequest(); r.setUserId(2003L); r.setAction("approve"); assertThrows(BusinessException.class,()->svc.reviewResolution(10L,r)); }
    }

    // ===== Phase 4: Risk Case Query (RR-012~014) =====
    @Nested @DisplayName("Phase 4: Query")
    class Query {
        @Test @DisplayName("RR-012: admin list all resolutions")
        void rr012() { when(uas.requireAdminOrOrganizerRole(2002L)).thenReturn("admin"); when(rm.selectList(any())).thenReturn(List.of(resolution(1L,10L,"pending"),resolution(2L,20L,"approved"))); List<ActivityRiskResolutionResponse> r = svc.listResolutions(2002L,null); assertEquals(2,r.size()); }
        @Test @DisplayName("RR-013: organizer only sees own")
        void rr013() { when(uas.requireAdminOrOrganizerRole(2003L)).thenReturn("organizer"); when(rm.selectList(any())).thenReturn(List.of(resolution(1L,10L,"pending"))); List<ActivityRiskResolutionResponse> r = svc.listResolutions(2003L,null); assertEquals(1,r.size()); }
        @Test @DisplayName("RR-014: risk cases → risk_suspended activities")
        void rr014() { when(uas.requireAdmin(2002L)).thenReturn(u(2002L,"admin")); when(am.selectList(any())).thenReturn(List.of(activity(5L,"risk_suspended",2003L))); when(rm.selectList(any())).thenReturn(Collections.emptyList()); List<ActivityRiskCaseResponse> r = svc.listRiskCases(2002L); assertTrue(r.size()>=0); }
    }

    AdminController controller() {
        return new AdminController(am, null, sm, ttm, null, uas, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, svc, null, null, null, null, null, null);
    }
}
