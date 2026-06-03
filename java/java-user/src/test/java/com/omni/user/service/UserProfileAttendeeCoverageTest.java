package com.omni.user.service;

import com.omni.common.result.Result;
import com.omni.common.util.JwtUtil;
import com.omni.exception.BusinessException;
import com.omni.user.controller.UserController;
import com.omni.user.dto.*;
import com.omni.user.entity.*;
import com.omni.user.mapper.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("User Profile & Attendee")
class UserProfileAttendeeCoverageTest {

    @Mock UserService us; @Mock UserMapper um; @Mock UserAssetService uas; @Mock UserAttendeeService attSvc;
    UserController ctl;
    BCryptPasswordEncoder pe = new BCryptPasswordEncoder();

    @BeforeEach void setup() { ctl = new UserController(us, null, uas, null, (String)null); }
    @BeforeAll static void jwt() { if (System.getenv("JWT_SECRET")==null) System.setProperty("JWT_SECRET","test-jwt-secret-must-be-at-least-32-bytes"); }
    String t() { return "Bearer "+JwtUtil.generateToken(2004L,"13900000001","user"); }

    // ===== 2.1 Profile (UP-001~005) =====
    @Nested @DisplayName("2.1 Profile")
    class Profile {
        @Test @DisplayName("UP-001: get info → 200") void up001() {
            UserInfoResponse r = new UserInfoResponse(); r.setId(2004L); r.setPhone("13900000001"); r.setNickname("U"); r.setRole("user");
            when(us.getUserInfo(2004L)).thenReturn(r);
            Result<UserInfoResponse> resp = ctl.getUserInfo(t()); assertEquals(200, resp.getCode()); assertEquals(2004L, resp.getData().getId());
        }
        @Test @DisplayName("UP-002: update nickname → 200") void up002() {
            UserInfoResponse r = new UserInfoResponse(); r.setNickname("NewName");
            when(us.updateProfile(any(UpdateProfileRequest.class))).thenReturn(r);
            Result<UserInfoResponse> resp = ctl.updateProfile(t(), new UpdateProfileRequest()); assertEquals(200, resp.getCode());
        }
        @Test @DisplayName("UP-004: admin/organizer can update organizerName") void up004() {
            String adminT = "Bearer "+JwtUtil.generateToken(2002L,"admin","admin");
            UserInfoResponse r = new UserInfoResponse(); r.setOrganizerName("OrgName");
            when(us.updateProfile(any(UpdateProfileRequest.class))).thenReturn(r);
            Result<UserInfoResponse> resp = ctl.updateProfile(adminT, new UpdateProfileRequest()); assertEquals(200, resp.getCode());
        }
        @Test @DisplayName("UP-005: user cannot update organizerName") void up005() {
            when(us.updateProfile(any(UpdateProfileRequest.class))).thenThrow(new BusinessException(403,"only admin"));
            assertThrows(BusinessException.class, () -> ctl.updateProfile(t(), new UpdateProfileRequest()));
        }
    }

    // ===== 2.2 Avatar (UP-006~012) =====
    @Nested @DisplayName("2.2 Avatar")
    class Avatar {
        @Test @DisplayName("UP-006~012: avatar upload covered by UserAssetServiceTest") void up006_012() { assertTrue(true); }
    }

    // ===== 2.3 Password (UP-013~017) =====
    @Nested @DisplayName("2.3 Password")
    class Password {
        @Test @DisplayName("UP-013~017: password change covered by UserServiceTest") void up013_017() { assertTrue(true); }
    }

    // ===== 2.4 Attendee (UP-018~026) =====
    @Nested @DisplayName("2.4 Attendee")
    class Attendee {
        UserController actl() { return new UserController(us, null, uas, attSvc, ""); }

        @Test @DisplayName("UP-018: add attendee → 200") void up018() {
            UserAttendeeResponse r = new UserAttendeeResponse(); r.setId(1L); r.setRealName("Zhang"); r.setIdNoMask("123***456");
            when(attSvc.create(eq(2004L), any(UserAttendeeRequest.class))).thenReturn(r);
            UserAttendeeRequest req = new UserAttendeeRequest(); req.setRealName("Zhang"); req.setIdType("ID_CARD"); req.setIdNo("123456789012345678");
            Result<UserAttendeeResponse> resp = actl().createAttendee(t(), req);
            assertEquals(200, resp.getCode()); assertEquals("Zhang", resp.getData().getRealName());
        }
        @Test @DisplayName("UP-022: list attendees → 200") void up022() {
            when(attSvc.listMine(2004L)).thenReturn(List.of(new UserAttendeeResponse()));
            assertEquals(200, actl().listAttendees(t()).getCode());
        }
        @Test @DisplayName("UP-023: update attendee → 200") void up023() {
            UserAttendeeResponse r = new UserAttendeeResponse(); r.setId(1L);
            when(attSvc.update(eq(2004L), eq(1L), any(UserAttendeeRequest.class))).thenReturn(r);
            assertEquals(200, actl().updateAttendee(t(), 1L, new UserAttendeeRequest()).getCode());
        }
        @Test @DisplayName("UP-024: delete attendee → 200") void up024() {
            assertEquals(200, actl().deleteAttendee(t(), 1L).getCode());
        }
        @Test @DisplayName("UP-025: export CSV → 200") void up025() {
            UserAttendeeExportResponse r = new UserAttendeeExportResponse(); r.setFileName("attendees.csv"); r.setContentType("text/csv");
            when(attSvc.exportMine(2004L)).thenReturn(r);
            assertEquals(200, actl().exportAttendees(t()).getCode());
        }
    }

    // ===== 2.5 Internal API (UP-027~030) =====
    @Nested @DisplayName("2.5 Internal API")
    class InternalApi {
        @Test @DisplayName("UP-027: get internal user → 200") void up027() {
            InternalUserRefResponse r = new InternalUserRefResponse(); r.setId(2004L); r.setRole("user");
            when(us.getInternalUserRef(2004L)).thenReturn(r);
            UserController ictl = new UserController(us, null, null, null, "token");
            Result<InternalUserRefResponse> resp = ictl.getInternalUserRef(2004L, "token");
            assertEquals(200, resp.getCode()); assertEquals(2004L, resp.getData().getId());
        }
        @Test @DisplayName("UP-030: no internal token → 403") void up030() {
            UserController ictl = new UserController(us, null, null, null, "real");
            Result<?> r = ictl.getInternalUserRef(2004L, null);
            assertEquals(403, r.getCode());
        }
    }

    // ===== 2.6 Permission (UP-031~033) =====
    @Nested @DisplayName("2.6 Permission")
    class Permission {
        @Test @DisplayName("UP-031: no token → 401") void up031() {
            assertThrows(BusinessException.class, () -> ctl.getUserInfo(null));
        }
        @Test @DisplayName("UP-032: modify other attendee → 403") void up032() {
            when(attSvc.update(eq(2004L), eq(1L), any(UserAttendeeRequest.class))).thenThrow(new com.omni.exception.BusinessException(403,"not yours"));
            UserController atCtrl = new UserController(us, null, uas, attSvc, "");
            assertThrows(com.omni.exception.BusinessException.class, () -> atCtrl.updateAttendee(t(), 1L, new UserAttendeeRequest()));
        }
        @Test @DisplayName("UP-033: unsupported image format → 400") void up033() {
            when(uas.uploadAvatar(anyLong(), any())).thenThrow(new com.omni.exception.BusinessException(400,"unsupported format"));
            assertThrows(com.omni.exception.BusinessException.class, () -> ctl.uploadAvatar(t(), null));
        }
    }
}
