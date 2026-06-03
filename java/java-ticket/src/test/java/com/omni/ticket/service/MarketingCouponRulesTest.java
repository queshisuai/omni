package com.omni.ticket.service;

import com.omni.common.result.Result;
import com.omni.common.util.JwtUtil;
import com.omni.exception.BusinessException;
import com.omni.ticket.client.OrderInternalClient;
import com.omni.ticket.controller.AdminController;
import com.omni.ticket.dto.ActivityMarketingOverviewResponse;
import com.omni.ticket.dto.ActivityMarketingRuleRequest;
import com.omni.ticket.dto.InternalUserRefResponse;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.ActivityMarketingRule;
import com.omni.ticket.mapper.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Marketing Coupon Rules")
class MarketingCouponRulesTest {

    @Mock ActivityMapper am;
    @Mock SessionMapper sm;
    @Mock ActivityMarketingRuleMapper mm;
    @Mock PerformanceSubscriptionMapper pm;
    @Mock UserAccessService uas;
    @Mock OrderInternalClient oic;

    // --- Controller mocks ---
    @Mock com.omni.ticket.mapper.ArtistMapper arm;
    @Mock com.omni.ticket.mapper.TicketTypeMapper ttm;
    @Mock com.omni.ticket.mapper.VenueMapper vm;

    ActivityMarketingService svc;

    @BeforeEach void setup() {
        svc = new ActivityMarketingService(am, sm, mm, pm, uas, oic, "t");
    }

    @BeforeAll static void jwt() {
        if (System.getenv("JWT_SECRET") == null || System.getenv("JWT_SECRET").isBlank())
            System.setProperty("JWT_SECRET", "test-jwt-secret-must-be-at-least-32-bytes");
    }

    void givenOrganizerOwns(Long uid, Long aid) {
        when(uas.requireAdminOrOrganizer(uid)).thenReturn(u(uid, "organizer"));
        when(am.selectById(aid)).thenReturn(a(aid, uid, "Activity"));
        when(mm.selectOne(any())).thenReturn(null);
        when(sm.selectList(any())).thenReturn(Collections.emptyList());
        when(pm.selectCount(any())).thenReturn(0L);
    }

    // ===== 2.1 Rule Config (MK-001~005) =====
    @Nested @DisplayName("Rule Config")
    class RuleConfig {
        @Test @DisplayName("MK-001: full reduction → 200")
        void mk001() {
            givenOrganizerOwns(2003L, 101L);
            ActivityMarketingRuleRequest r = new ActivityMarketingRuleRequest();
            r.setEnabled(true); r.setCouponName("Full"); r.setDiscountType("FULL_REDUCTION");
            r.setThresholdAmount(bd("300")); r.setDiscountAmount(bd("30")); r.setMaxCouponCount(500); r.setPerUserLimit(1);
            ActivityMarketingOverviewResponse resp = svc.saveMarketing(2003L, 101L, r);
            assertEquals(101L, resp.getActivityId());
            assertEquals("FULL_REDUCTION", resp.getRule().getDiscountType());
            verify(mm).insert(any());
        }

        @Test @DisplayName("MK-002: direct reduction → 200")
        void mk002() {
            givenOrganizerOwns(2003L, 101L);
            ActivityMarketingRuleRequest r = new ActivityMarketingRuleRequest();
            r.setEnabled(true); r.setCouponName("Direct"); r.setDiscountType("DIRECT_REDUCTION");
            r.setDiscountAmount(bd("30")); r.setMaxCouponCount(500); r.setPerUserLimit(1);
            ActivityMarketingOverviewResponse resp = svc.saveMarketing(2003L, 101L, r);
            assertEquals("DIRECT_REDUCTION", resp.getRule().getDiscountType());
        }

        @Test @DisplayName("MK-003: update rule → 200")
        void mk003() {
            when(uas.requireAdminOrOrganizer(2003L)).thenReturn(u(2003L, "organizer"));
            when(am.selectById(101L)).thenReturn(a(101L, 2003L, "Activity"));
            ActivityMarketingRule existing = new ActivityMarketingRule();
            existing.setId(1L); existing.setActivityId(101L); existing.setDiscountType("FULL_REDUCTION");
            when(mm.selectOne(any())).thenReturn(existing);
            when(sm.selectList(any())).thenReturn(Collections.emptyList());
            when(pm.selectCount(any())).thenReturn(0L);

            ActivityMarketingRuleRequest r = new ActivityMarketingRuleRequest();
            r.setEnabled(true); r.setCouponName("Updated"); r.setDiscountType("FULL_REDUCTION");
            r.setThresholdAmount(bd("500")); r.setDiscountAmount(bd("50")); r.setMaxCouponCount(100); r.setPerUserLimit(2);
            svc.saveMarketing(2003L, 101L, r);
            verify(mm).updateById(any());
        }

        @Test @DisplayName("MK-004: disable rule → 200")
        void mk004() {
            when(uas.requireAdminOrOrganizer(2003L)).thenReturn(u(2003L, "organizer"));
            when(am.selectById(101L)).thenReturn(a(101L, 2003L, "Activity"));
            ActivityMarketingRule existing = new ActivityMarketingRule(); existing.setId(1L);
            when(mm.selectOne(any())).thenReturn(existing);
            when(sm.selectList(any())).thenReturn(Collections.emptyList());
            when(pm.selectCount(any())).thenReturn(0L);

            ActivityMarketingRuleRequest r = new ActivityMarketingRuleRequest(); r.setEnabled(false);
            ActivityMarketingOverviewResponse resp = svc.saveMarketing(2003L, 101L, r);
            assertFalse(resp.getRule().getEnabled());
            assertEquals(0, resp.getRule().getStatus());
        }

        @Test @DisplayName("MK-005: enable rule → 200")
        void mk005() {
            givenOrganizerOwns(2003L, 101L);
            ActivityMarketingRuleRequest r = new ActivityMarketingRuleRequest();
            r.setEnabled(true); r.setCouponName("On"); r.setDiscountType("FULL_REDUCTION");
            r.setThresholdAmount(bd("200")); r.setDiscountAmount(bd("20")); r.setMaxCouponCount(100); r.setPerUserLimit(1);
            ActivityMarketingOverviewResponse resp = svc.saveMarketing(2003L, 101L, r);
            assertTrue(resp.getRule().getEnabled()); assertEquals(1, resp.getRule().getStatus());
        }
    }

    // ===== 2.2 Validation & Boundary (MK-006~012) =====
    @Nested @DisplayName("Validation & Boundary")
    class ValidationBoundary {
        void setupActivity() {
            when(uas.requireAdminOrOrganizer(2003L)).thenReturn(u(2003L, "organizer"));
            when(am.selectById(101L)).thenReturn(a(101L, 2003L, "Activity"));
            when(mm.selectOne(any())).thenReturn(null);
        }

        @Test @DisplayName("MK-006: discount > threshold → 400")
        void mk006() { setupActivity();
            ActivityMarketingRuleRequest r = enabled("FULL_REDUCTION", bd("100"), bd("200"), 100);
            BusinessException ex = assertThrows(BusinessException.class, () -> svc.saveMarketing(2003L, 101L, r));
            assertTrue(ex.getMessage().contains("满减门槛必须大于优惠金额"));
        }

        @Test @DisplayName("MK-007: negative discount → 400")
        void mk007() { setupActivity();
            ActivityMarketingRuleRequest r = enabled("FULL_REDUCTION", bd("100"), bd("-10"), 100);
            BusinessException ex = assertThrows(BusinessException.class, () -> svc.saveMarketing(2003L, 101L, r));
            assertTrue(ex.getMessage().contains("优惠金额必须大于0"));
        }

        @Test @DisplayName("MK-008: maxCouponCount < perUserLimit → allowed (no validation)")
        void mk008() {
            // The service normalizes both but doesn't validate their relationship
            givenOrganizerOwns(2003L, 101L);
            ActivityMarketingRuleRequest r = enabled("FULL_REDUCTION", bd("200"), bd("20"), 5);
            r.setPerUserLimit(10); // maxCouponCount=5 < perUserLimit=10
            ActivityMarketingOverviewResponse resp = svc.saveMarketing(2003L, 101L, r);
            assertNotNull(resp); // No explicit validation, just passes through
        }

        @Test @DisplayName("MK-009: endTime < startTime → allowed (no time validation)")
        void mk009() {
            givenOrganizerOwns(2003L, 101L);
            ActivityMarketingRuleRequest r = enabled("FULL_REDUCTION", bd("200"), bd("20"), 100);
            r.setStartTime(java.time.LocalDateTime.now().plusDays(10));
            r.setEndTime(java.time.LocalDateTime.now()); // end before start
            ActivityMarketingOverviewResponse resp = svc.saveMarketing(2003L, 101L, r);
            assertNotNull(resp); // No explicit time validation in service
        }

        @Test @DisplayName("MK-010: past startTime → allowed (no validation)")
        void mk010() {
            givenOrganizerOwns(2003L, 101L);
            ActivityMarketingRuleRequest r = enabled("FULL_REDUCTION", bd("200"), bd("20"), 100);
            r.setStartTime(java.time.LocalDateTime.now().minusDays(1)); // yesterday
            ActivityMarketingOverviewResponse resp = svc.saveMarketing(2003L, 101L, r);
            assertNotNull(resp);
        }

        @Test @DisplayName("MK-011: large discount amount → allowed (no cap)")
        void mk011() {
            givenOrganizerOwns(2003L, 101L);
            ActivityMarketingRuleRequest r = new ActivityMarketingRuleRequest();
            r.setEnabled(true); r.setCouponName("Huge"); r.setDiscountType("DIRECT_REDUCTION");
            r.setDiscountAmount(new BigDecimal("99999999")); r.setMaxCouponCount(100); r.setPerUserLimit(1);
            ActivityMarketingOverviewResponse resp = svc.saveMarketing(2003L, 101L, r);
            assertEquals(0, new BigDecimal("99999999.00").compareTo(resp.getRule().getDiscountAmount()));
        }

        @Test @DisplayName("MK-012: maxCouponCount=0 → 400")
        void mk012() { setupActivity();
            ActivityMarketingRuleRequest r = enabled("FULL_REDUCTION", bd("200"), bd("20"), 0);
            BusinessException ex = assertThrows(BusinessException.class, () -> svc.saveMarketing(2003L, 101L, r));
            assertTrue(ex.getMessage().contains("发券数量必须大于0"));
        }
    }

    // ===== 2.3 Data Consistency (MK-013~015) =====
    @Nested @DisplayName("Data Consistency")
    class DataConsistency {
        @Test @DisplayName("MK-013: claimedCount preserved on update")
        void mk013() {
            when(uas.requireAdminOrOrganizer(2003L)).thenReturn(u(2003L, "organizer"));
            when(am.selectById(101L)).thenReturn(a(101L, 2003L, "Activity"));
            ActivityMarketingRule existing = new ActivityMarketingRule();
            existing.setId(1L); existing.setActivityId(101L); existing.setClaimedCount(50);
            when(mm.selectOne(any())).thenReturn(existing);
            when(sm.selectList(any())).thenReturn(List.of());
            when(pm.selectCount(any())).thenReturn(0L);

            ActivityMarketingRuleRequest r = enabled("FULL_REDUCTION", bd("300"), bd("30"), 100);
            svc.saveMarketing(2003L, 101L, r);
            assertEquals(Integer.valueOf(50), existing.getClaimedCount()); // preserved
        }

        @Test @DisplayName("MK-014: usedCount preserved and ≤ claimedCount")
        void mk014() {
            when(uas.requireAdminOrOrganizer(2003L)).thenReturn(u(2003L, "organizer"));
            when(am.selectById(101L)).thenReturn(a(101L, 2003L, "Activity"));
            ActivityMarketingRule existing = new ActivityMarketingRule();
            existing.setId(1L); existing.setActivityId(101L); existing.setClaimedCount(50); existing.setUsedCount(30);
            when(mm.selectOne(any())).thenReturn(existing);
            when(sm.selectList(any())).thenReturn(List.of());
            when(pm.selectCount(any())).thenReturn(0L);

            svc.saveMarketing(2003L, 101L, enabled("FULL_REDUCTION", bd("300"), bd("30"), 100));
            assertEquals(Integer.valueOf(50), existing.getClaimedCount());
            assertEquals(Integer.valueOf(30), existing.getUsedCount());
            assertTrue(existing.getUsedCount() <= existing.getClaimedCount());
        }

        @Test @DisplayName("MK-015: maxCouponCount floor validation")
        void mk015() {
            givenOrganizerOwns(2003L, 101L);
            ActivityMarketingRuleRequest r = enabled("FULL_REDUCTION", bd("200"), bd("20"), 1); // just 1 coupon
            ActivityMarketingOverviewResponse resp = svc.saveMarketing(2003L, 101L, r);
            assertEquals(Integer.valueOf(1), resp.getRule().getMaxCouponCount());
        }
    }

    // ===== 2.4 Permission & Errors (MK-016~019) =====
    @Nested @DisplayName("Permission & Errors")
    class PermissionErrors {
        @Test @DisplayName("MK-016: user role → 403")
        void mk016() {
            when(uas.requireAdminOrOrganizer(2004L)).thenThrow(new BusinessException(403, "无权限"));
            assertThrows(BusinessException.class, () -> svc.saveMarketing(2004L, 101L, new ActivityMarketingRuleRequest()));
        }

        @Test @DisplayName("MK-017: organizer editing other activity → 403")
        void mk017() {
            when(uas.requireAdminOrOrganizer(2003L)).thenReturn(u(2003L, "organizer"));
            when(am.selectById(101L)).thenReturn(a(101L, 9999L, "Other"));
            BusinessException ex = assertThrows(BusinessException.class,
                    () -> svc.saveMarketing(2003L, 101L, new ActivityMarketingRuleRequest()));
            assertTrue(ex.getMessage().contains("只能管理自己主办活动"));
        }

        @Test @DisplayName("MK-018: no token → 401")
        void mk018() {
            AdminController ctl = controller();
            Result<?> r = ctl.getActivityMarketing(101L, null);
            assertEquals(401, r.getCode());
        }

        @Test @DisplayName("MK-019: activity not found → 404")
        void mk019() {
            when(uas.requireAdminOrOrganizer(2003L)).thenReturn(u(2003L, "organizer"));
            when(am.selectById(999999L)).thenReturn(null);
            assertThrows(BusinessException.class, () -> svc.saveMarketing(2003L, 999999L, new ActivityMarketingRuleRequest()));
        }
    }

    // ===== Helpers =====
    static InternalUserRefResponse u(Long id, String role) {
        InternalUserRefResponse r = new InternalUserRefResponse(); r.setId(id); r.setRole(role); return r;
    }
    static Activity a(Long id, Long orgId, String name) {
        Activity a = new Activity(); a.setId(id); a.setOrganizerId(orgId); a.setName(name); a.setStatus(1); return a;
    }
    static BigDecimal bd(String v) { return new BigDecimal(v); }
    static ActivityMarketingRuleRequest enabled(String type, BigDecimal threshold, BigDecimal discount, int maxCoupons) {
        ActivityMarketingRuleRequest r = new ActivityMarketingRuleRequest();
        r.setEnabled(true); r.setCouponName("Test"); r.setDiscountType(type);
        r.setThresholdAmount(threshold); r.setDiscountAmount(discount); r.setMaxCouponCount(maxCoupons); r.setPerUserLimit(1);
        return r;
    }

    AdminController controller() {
        return new AdminController(am, arm, sm, ttm, vm, uas, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null,
                null, null, null, null, null, null, null,
                null, null, svc);
    }
}
