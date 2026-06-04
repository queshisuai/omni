package com.omni.user.service;

import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.omni.common.dto.InternalAuthContextResponse;
import com.omni.exception.BusinessException;
import com.omni.user.dto.OrganizerApplicationRequest;
import com.omni.user.dto.OrganizerApplicationResponse;
import com.omni.user.entity.OrganizerApplication;
import com.omni.user.entity.User;
import com.omni.user.mapper.OrganizerApplicationMapper;
import com.omni.user.mapper.UserMapper;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.apache.ibatis.session.Configuration;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

class OrganizerApplicationServiceTest {

    @BeforeAll
    static void initMybatisPlusMetadata() {
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new Configuration(), ""), OrganizerApplication.class);
    }

    private final OrganizerApplicationMapper organizerApplicationMapper = mock(OrganizerApplicationMapper.class);
    private final UserMapper userMapper = mock(UserMapper.class);
    private final PlatformTransactionManager transactionManager = mock(PlatformTransactionManager.class);
    private final RbacService rbacService = mock(RbacService.class);
    private final OrganizerApplicationService service = new OrganizerApplicationService(
            organizerApplicationMapper,
            userMapper,
            transactionManager,
            rbacService
    );

    @Test
    void listForAdminIncludesUserOrganizerStatusAndRole() {
        User admin = new User();
        admin.setId(2002L);
        admin.setRole("admin");
        User cancelledOrganizer = new User();
        cancelledOrganizer.setId(2003L);
        cancelledOrganizer.setPhone("13800000002");
        cancelledOrganizer.setNickname("主办方");
        cancelledOrganizer.setRole("user");
        cancelledOrganizer.setOrganizerStatus(3);

        OrganizerApplication application = new OrganizerApplication();
        application.setId(1L);
        application.setUserId(2003L);
        application.setOrganizerName("已取消主办方");
        application.setSubjectType("enterprise");
        application.setContactName("联系人");
        application.setContactPhone("13800000002");
        application.setStatus(1);

        when(userMapper.selectById(2002L)).thenReturn(admin);
        when(rbacService.getInternalAuthContext(2002L)).thenReturn(authContext(List.of("organizer.review")));
        when(organizerApplicationMapper.selectList(any())).thenReturn(List.of(application));
        when(userMapper.selectBatchIds(List.of(2003L))).thenReturn(List.of(cancelledOrganizer));

        OrganizerApplicationResponse response = service.listForAdmin(2002L, null).get(0);

        assertEquals(3, response.getOrganizerStatus());
        assertEquals("user", response.getRole());
    }

    @Test
    void listForAdminRequiresOrganizerReviewPermissionInsteadOfAdminRoleBypass() {
        RbacService rbacService = mock(RbacService.class);
        OrganizerApplicationService serviceWithRbac = new OrganizerApplicationService(
                organizerApplicationMapper,
                userMapper,
                transactionManager,
                rbacService
        );
        User admin = new User();
        admin.setId(2002L);
        admin.setRole("admin");
        when(userMapper.selectById(2002L)).thenReturn(admin);
        when(rbacService.getInternalAuthContext(2002L)).thenReturn(authContext(List.of("rbac.manage")));

        assertThrows(BusinessException.class, () -> serviceWithRbac.listForAdmin(2002L, null));

        verify(organizerApplicationMapper, never()).selectList(any());
    }

    @Test
    void cancelledOrganizerCanResubmitApprovedApplication() {
        User user = new User();
        user.setId(2003L);
        user.setRole("user");
        user.setOrganizerStatus(3);

        OrganizerApplication application = new OrganizerApplication();
        application.setId(1L);
        application.setUserId(2003L);
        application.setOrganizerName("旧主办方");
        application.setSubjectType("enterprise");
        application.setContactName("旧联系人");
        application.setContactPhone("13800000002");
        application.setStatus(1);

        OrganizerApplicationRequest request = new OrganizerApplicationRequest();
        request.setOrganizerName("重新申请主办方");
        request.setSubjectType("enterprise");
        request.setContactName("新联系人");
        request.setContactPhone("13800000002");

        when(userMapper.selectById(2003L)).thenReturn(user);
        when(organizerApplicationMapper.selectOne(any())).thenReturn(application);
        when(organizerApplicationMapper.update(any(), any(LambdaUpdateWrapper.class))).thenReturn(1);
        when(userMapper.updateById(any(User.class))).thenReturn(1);

        OrganizerApplicationResponse response = service.submitOrUpdate(2003L, request);

        assertEquals(0, response.getStatus());
        assertEquals(0, response.getOrganizerStatus());
        assertEquals("user", response.getRole());
        verify(organizerApplicationMapper).update(any(), any(LambdaUpdateWrapper.class));
    }

    private InternalAuthContextResponse authContext(List<String> permissionCodes) {
        InternalAuthContextResponse auth = new InternalAuthContextResponse();
        auth.setPermissionCodes(permissionCodes);
        auth.setScopeType("platform");
        return auth;
    }
}
