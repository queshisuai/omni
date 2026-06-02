package com.omni.user.service;

import com.omni.common.dto.InternalAuthContextResponse;
import com.omni.exception.BusinessException;
import com.omni.user.dto.SupportAccountRequest;
import com.omni.user.dto.SupportAccountResponse;
import com.omni.user.entity.SupportAccount;
import com.omni.user.entity.User;
import com.omni.user.mapper.SupportAccountMapper;
import com.omni.user.mapper.UserMapper;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SupportAccountServiceTest {

    private final UserMapper userMapper = mock(UserMapper.class);
    private final SupportAccountMapper supportAccountMapper = mock(SupportAccountMapper.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final RbacService rbacService = mock(RbacService.class);
    private final OperationAuditService auditService = mock(OperationAuditService.class);
    private final SupportAccountService service = new SupportAccountService(userMapper, supportAccountMapper, passwordEncoder, rbacService, auditService);

    @Test
    void adminCreatesSupportAccountWithSupportRoleAndSupportAccountRow() {
        when(userMapper.selectById(1L)).thenReturn(user(1L, "admin", 1));
        when(rbacService.getInternalAuthContext(1L)).thenReturn(authContextWithPermission("support.account.manage"));
        when(userMapper.selectOne(any())).thenReturn(null);
        when(passwordEncoder.encode("support123")).thenReturn("encoded-support123");
        when(userMapper.insert(any(User.class))).thenAnswer(invocation -> {
            User inserted = invocation.getArgument(0);
            inserted.setId(3L);
            return 1;
        });

        SupportAccountResponse response = service.create(1L, request("13900000002", "客服一号", "support123"));

        assertEquals(3L, response.getId());
        assertEquals("13900000002", response.getPhone());
        assertEquals("客服一号", response.getNickname());
        assertEquals("support", response.getRole());
        assertEquals(1, response.getStatus());
        verify(userMapper).insert(any(User.class));
        verify(supportAccountMapper).insert(org.mockito.ArgumentMatchers.argThat(account ->
                Long.valueOf(3L).equals(account.getUserId())
                        && "13900000002".equals(account.getPhone())
                        && "客服一号".equals(account.getNickname())
                        && Integer.valueOf(1).equals(account.getStatus())
        ));
    }

    @Test
    void nonAdminCannotCreateSupportAccount() {
        when(userMapper.selectById(2L)).thenReturn(user(2L, "organizer", 1));
        when(rbacService.getInternalAuthContext(2L)).thenReturn(authContextWithoutPermission("support.account.manage"));

        BusinessException error = assertThrows(
                BusinessException.class,
                () -> service.create(2L, request("13900000002", "客服一号", "support123"))
        );

        assertEquals("无权限", error.getMessage());
        verify(userMapper, never()).insert(any());
        verify(supportAccountMapper, never()).insert(any());
    }

    @Test
    void adminDeactivatesSupportAccountWithoutDeletingHistory() {
        User support = user(3L, "support", 1);
        SupportAccount account = supportAccount(3L, "13900000003", "客服三号", 1);
        when(userMapper.selectById(1L)).thenReturn(user(1L, "admin", 1));
        when(rbacService.getInternalAuthContext(1L)).thenReturn(authContextWithPermission("support.account.manage"));
        when(userMapper.selectById(3L)).thenReturn(support);
        when(supportAccountMapper.selectById(3L)).thenReturn(account);

        SupportAccountResponse response = service.deactivate(1L, 3L);

        assertEquals(0, response.getStatus());
        assertEquals("support", response.getRole());
        verify(userMapper).updateById(support);
        verify(supportAccountMapper).updateById(account);
    }

    @Test
    void listOnlyReturnsRowsFromSupportAccountTableForAdmin() {
        when(userMapper.selectById(1L)).thenReturn(user(1L, "admin", 1));
        when(rbacService.getInternalAuthContext(1L)).thenReturn(authContextWithPermission("support.account.manage"));
        when(supportAccountMapper.selectList(any())).thenReturn(List.of(supportAccount(3L, "13900000003", "客服三号", 1)));

        List<SupportAccountResponse> accounts = service.list(1L);

        assertEquals(1, accounts.size());
        assertEquals(3L, accounts.get(0).getId());
        assertEquals("客服三号", accounts.get(0).getNickname());
        verify(userMapper, never()).selectList(any());
    }

    @Test
    void adminUpdatesSupportAccountAndLinkedLoginUser() {
        User support = user(3L, "support", 1);
        support.setPhone("13900000003");
        support.setNickname("客服三号");
        SupportAccount account = supportAccount(3L, "13900000003", "客服三号", 1);
        when(userMapper.selectById(1L)).thenReturn(user(1L, "admin", 1));
        when(rbacService.getInternalAuthContext(1L)).thenReturn(authContextWithPermission("support.account.manage"));
        when(userMapper.selectById(3L)).thenReturn(support);
        when(supportAccountMapper.selectById(3L)).thenReturn(account);
        when(userMapper.selectOne(any())).thenReturn(null);
        when(passwordEncoder.encode("newpass123")).thenReturn("encoded-newpass123");

        SupportAccountRequest request = request("13900000004", "客服四号", "newpass123");
        request.setStatus(1);
        request.setSupportRole("support_manager");
        SupportAccountResponse response = service.update(1L, 3L, request);

        assertEquals("13900000004", response.getPhone());
        assertEquals("客服四号", response.getNickname());
        assertEquals("support_manager", response.getSupportRole());
        assertEquals(1, response.getStatus());
        assertEquals("13900000004", support.getPhone());
        assertEquals("客服四号", support.getNickname());
        assertEquals("encoded-newpass123", support.getPassword());
        assertEquals("13900000004", account.getPhone());
        assertEquals("客服四号", account.getNickname());
        assertEquals("support_manager", account.getSupportRole());
        verify(userMapper).updateById(support);
        verify(supportAccountMapper).updateById(account);
    }

    @Test
    void rejectsUnknownSupportRoleWhenCreatingSupportAccount() {
        when(userMapper.selectById(1L)).thenReturn(user(1L, "admin", 1));
        when(rbacService.getInternalAuthContext(1L)).thenReturn(authContextWithPermission("support.account.manage"));

        SupportAccountRequest request = request("13900000002", "客服一号", "support123");
        request.setSupportRole("support_admin");

        BusinessException error = assertThrows(
                BusinessException.class,
                () -> service.create(1L, request)
        );

        assertEquals("客服业务角色不正确", error.getMessage());
        verify(userMapper, never()).insert(any());
        verify(supportAccountMapper, never()).insert(any());
    }

    @Test
    void supportAgentCannotManageSupportAccounts() {
        when(userMapper.selectById(2L)).thenReturn(user(2L, "support_agent", 1));
        when(rbacService.getInternalAuthContext(2L)).thenReturn(authContextWithoutPermission("support.account.manage"));

        BusinessException error = assertThrows(
                BusinessException.class,
                () -> service.create(2L, request("13900000002", "客服一号", "support123"))
        );

        assertEquals("无权限", error.getMessage());
    }

    @Test
    void auditWrittenWhenCreateFailsDueToDuplicatePhone() {
        when(userMapper.selectById(1L)).thenReturn(user(1L, "admin", 1));
        when(rbacService.getInternalAuthContext(1L)).thenReturn(authContextWithPermission("support.account.manage"));
        when(userMapper.selectOne(any())).thenReturn(new User());

        BusinessException error = assertThrows(
                BusinessException.class,
                () -> service.create(1L, request("13900000002", "客服一号", "support123"))
        );

        assertEquals("该手机号已存在", error.getMessage());
        verify(auditService).write(org.mockito.ArgumentMatchers.argThat(req ->
                "support.account.create".equals(req.getAction())
                        && Boolean.FALSE.equals(req.getSuccess())
        ));
    }

    private InternalAuthContextResponse authContextWithPermission(String permissionCode) {
        InternalAuthContextResponse auth = new InternalAuthContextResponse();
        auth.setPermissionCodes(List.of(permissionCode));
        return auth;
    }

    private InternalAuthContextResponse authContextWithoutPermission(String permissionCode) {
        InternalAuthContextResponse auth = new InternalAuthContextResponse();
        auth.setPermissionCodes(List.of());
        return auth;
    }

    private SupportAccountRequest request(String phone, String nickname, String password) {
        SupportAccountRequest request = new SupportAccountRequest();
        request.setPhone(phone);
        request.setNickname(nickname);
        request.setPassword(password);
        return request;
    }

    private User user(Long id, String role, Integer status) {
        User user = new User();
        user.setId(id);
        user.setRole(role);
        user.setStatus(status);
        return user;
    }

    private SupportAccount supportAccount(Long userId, String phone, String nickname, Integer status) {
        SupportAccount account = new SupportAccount();
        account.setUserId(userId);
        account.setPhone(phone);
        account.setNickname(nickname);
        account.setStatus(status);
        return account;
    }
}
