package com.omni.user.service;

import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.omni.common.dto.InternalAuthContextResponse;
import com.omni.common.util.JwtUtil;
import com.omni.exception.BusinessException;
import com.omni.user.controller.UserController;
import com.omni.user.dto.OrganizerApplicationRequest;
import com.omni.user.dto.OrganizerApplicationResponse;
import com.omni.user.entity.OrganizerApplication;
import com.omni.user.entity.User;
import com.omni.user.mapper.OrganizerApplicationMapper;
import com.omni.user.mapper.UserMapper;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.apache.ibatis.session.Configuration;
import org.junit.jupiter.api.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@DisplayName("Organizer Application — Full")
class OrganizerApplicationFullTest {
    OrganizerApplicationMapper am; UserMapper um; PlatformTransactionManager tm; TransactionStatus ts; RbacService rbac;
    OrganizerApplicationService svc;

    @BeforeAll static void init() {
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new Configuration(),""), OrganizerApplication.class);
    }
    @BeforeEach void setup() {
        am = mock(OrganizerApplicationMapper.class); um = mock(UserMapper.class); rbac = mock(RbacService.class);
        tm = mock(PlatformTransactionManager.class); ts = mock(TransactionStatus.class);
        when(tm.getTransaction(any(TransactionDefinition.class))).thenReturn(ts);
        lenient().when(rbac.getInternalAuthContext(anyLong())).thenAnswer(invocation ->
                Long.valueOf(2002L).equals(invocation.getArgument(0)) ? authContext("organizer.review") : null);
        svc = new OrganizerApplicationService(am, um, tm, rbac);
    }
    @BeforeAll static void jwt() { if (System.getenv("JWT_SECRET")==null) System.setProperty("JWT_SECRET","t"); }

    User u(Long id, String role) { User r = new User(); r.setId(id); r.setRole(role); r.setStatus(1); return r; }
    OrganizerApplication a(Long id, Long uid, int st) { OrganizerApplication r = new OrganizerApplication(); r.setId(id); r.setUserId(uid); r.setStatus(st); return r; }
    OrganizerApplicationRequest req() { OrganizerApplicationRequest r = new OrganizerApplicationRequest(); r.setOrganizerName("Org"); r.setSubjectType("enterprise"); r.setContactName("N"); r.setContactPhone("138"); r.setContactEmail("a@b.com"); return r; }
    InternalAuthContextResponse authContext(String permissionCode) { InternalAuthContextResponse r = new InternalAuthContextResponse(); r.setScopeType("platform"); r.setPermissionCodes(List.of(permissionCode)); return r; }

    // ===== 3.1 Submit (OA-001~006) =====
    @Nested @DisplayName("3.1 Submit")
    class Submit {
        @Test @DisplayName("OA-001: personal")
        void oa001() { when(um.selectById(2004L)).thenReturn(u(2004L,"user")); when(am.selectOne(any())).thenReturn(null); when(am.insert(any())).thenReturn(1); req().setSubjectType("personal"); assertEquals(0, svc.submitOrUpdate(2004L,req()).getStatus()); }
        @Test @DisplayName("OA-002: enterprise")
        void oa002() { when(um.selectById(2004L)).thenReturn(u(2004L,"user")); when(am.selectOne(any())).thenReturn(null); when(am.insert(any())).thenReturn(1); assertEquals(0, svc.submitOrUpdate(2004L,req()).getStatus()); }
        @Test @DisplayName("OA-003: organizer→rejected")
        void oa003() { when(um.selectById(2003L)).thenReturn(u(2003L,"organizer")); assertThrows(BusinessException.class,()->svc.submitOrUpdate(2003L,req())); }
        @Test @DisplayName("OA-004: admin→rejected")
        void oa004() { when(um.selectById(2002L)).thenReturn(u(2002L,"admin")); assertThrows(BusinessException.class,()->svc.submitOrUpdate(2002L,req())); }
        @Test @DisplayName("OA-005: pending→update")
        void oa005() { when(um.selectById(2004L)).thenReturn(u(2004L,"user")); when(am.selectOne(any())).thenReturn(a(10L,2004L,0)); when(am.update(any(),any())).thenReturn(1); assertEquals(0, svc.submitOrUpdate(2004L,req()).getStatus()); verify(am,never()).insert(any()); }
        @Test @DisplayName("OA-006: rejected→resubmit")
        void oa006() { when(um.selectById(2004L)).thenReturn(u(2004L,"user")); when(am.selectOne(any())).thenReturn(a(10L,2004L,2)); when(am.update(any(),any())).thenReturn(1); assertEquals(0, svc.submitOrUpdate(2004L,req()).getStatus()); }
    }

    // ===== 3.2 Query (OA-007~010) =====
    @Nested @DisplayName("3.2 Query")
    class Query {
        @Test @DisplayName("OA-007: get mine")
        void oa007() { when(am.selectOne(any())).thenReturn(a(10L,2004L,0)); when(um.selectById(2004L)).thenReturn(u(2004L,"user")); assertNotNull(svc.getMine(2004L)); }
        @Test @DisplayName("OA-008: admin list all")
        void oa008() { when(um.selectById(2002L)).thenReturn(u(2002L,"admin")); when(am.selectList(any())).thenReturn(List.of(a(1L,2004L,0),a(2L,2005L,0))); when(um.selectBatchIds(any())).thenReturn(List.of(u(2004L,"user"),u(2005L,"user"))); assertEquals(2, svc.listForAdmin(2002L,null).size()); }
        @Test @DisplayName("OA-009: filter by status")
        void oa009() { when(um.selectById(2002L)).thenReturn(u(2002L,"admin")); when(am.selectList(any())).thenReturn(List.of(a(1L,2004L,1))); when(um.selectBatchIds(any())).thenReturn(List.of(u(2004L,"user"))); assertEquals(1, svc.listForAdmin(2002L,1).get(0).getStatus()); }
        @Test @DisplayName("OA-010: user→403")
        void oa010() { when(um.selectById(2004L)).thenReturn(u(2004L,"user")); assertThrows(BusinessException.class,()->svc.listForAdmin(2004L,null)); }
    }

    // ===== 3.3 Review (OA-011~016) =====
    @Nested @DisplayName("3.3 Review")
    class Review {
        @Test @DisplayName("OA-011: approve→APPROVED")
        void oa011() { when(um.selectById(any())).thenReturn(u(2002L,"admin")); when(am.selectById(any())).thenReturn(a(10L,2004L,0)); when(am.update(isNull(),any())).thenReturn(1); assertEquals(1, svc.approve(10L,2002L,"ok").getStatus()); }
        @Test @DisplayName("OA-012: upgrade role")
        void oa012() { User applicant = u(2004L,"user"); when(um.selectById(any())).thenReturn(u(2002L,"admin"), applicant); OrganizerApplication ap = a(10L,2004L,0); ap.setOrganizerName("NewOrg"); when(am.selectById(any())).thenReturn(ap); when(am.update(isNull(),any())).thenReturn(1); svc.approve(10L,2002L,"ok"); assertEquals("organizer",applicant.getRole()); assertEquals(1,applicant.getOrganizerStatus()); assertEquals("NewOrg",applicant.getOrganizerName()); }
        @Test @DisplayName("OA-013: reject→REJECTED")
        void oa013() { when(um.selectById(any())).thenReturn(u(2002L,"admin")); when(am.selectById(any())).thenReturn(a(10L,2004L,0)); when(am.update(isNull(),any())).thenReturn(1); assertEquals(2, svc.reject(10L,2002L,"bad").getStatus()); }
        @Test @DisplayName("OA-014: reject no note→400")
        void oa014() { when(um.selectById(2002L)).thenReturn(u(2002L,"admin")); when(am.selectById(10L)).thenReturn(a(10L,2004L,0)); assertThrows(BusinessException.class,()->svc.reject(10L,2002L,"")); }
        @Test @DisplayName("OA-015: organizer→403")
        void oa015() { when(um.selectById(2003L)).thenReturn(u(2003L,"organizer")); assertThrows(BusinessException.class,()->svc.approve(10L,2003L,"try")); }
        @Test @DisplayName("OA-016: re-review→rejected")
        void oa016() { when(um.selectById(2002L)).thenReturn(u(2002L,"admin")); when(am.selectById(10L)).thenReturn(a(10L,2004L,1)); assertThrows(BusinessException.class,()->svc.approve(10L,2002L,"again")); }
    }

    // ===== 3.4 Permission (OA-017~019) =====
    @Nested @DisplayName("3.4 Permission")
    class Permission {
        @Test @DisplayName("OA-017: no token→401")
        void oa017() { assertThrows(BusinessException.class,()->new UserController(null,svc,null,"").submitOrganizerApplication(null,req())); }
        @Test @DisplayName("OA-018: empty name→400")
        void oa018() { when(um.selectById(2004L)).thenReturn(u(2004L,"user")); OrganizerApplicationRequest r=req(); r.setOrganizerName(""); assertThrows(BusinessException.class,()->svc.submitOrUpdate(2004L,r)); }
        @Test @DisplayName("OA-019: non-existent ID→404")
        void oa019() { when(um.selectById(2002L)).thenReturn(u(2002L,"admin")); when(am.selectById(999999L)).thenReturn(null); assertThrows(BusinessException.class,()->svc.approve(999999L,2002L,"ok")); }
    }
}
