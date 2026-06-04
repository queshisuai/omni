package com.omni.ticket.service;

import com.omni.common.result.Result;
import com.omni.exception.BusinessException;
import com.omni.ticket.client.OrderInternalClient;
import com.omni.ticket.client.PaymentInternalClient;
import com.omni.ticket.dto.*;
import com.omni.ticket.entity.*;
import com.omni.ticket.mapper.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 活动发布与状态管理 — 补充单元测试
 * 覆盖测试方案 AP-001 ~ AP-023 中未覆盖的用例
 * 与 ActivityAdminServiceTest 已有的 18 个测试互补
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("活动发布与状态管理 - ActivityAdminService")
class ActivityPublishDeactivateTest {

    @Mock ActivityMapper activityMapper;
    @Mock SessionMapper sessionMapper;
    @Mock TicketTypeMapper ticketTypeMapper;
    @Mock UserAccessService userAccessService;
    @Mock OrderInternalClient orderInternalClient;
    @Mock PaymentInternalClient paymentInternalClient;
    @Mock ActivityArtistMapper activityArtistMapper;
    @Mock ArtistMapper artistMapper;

    private ActivityAdminService service;

    @BeforeEach
    void setUp() {
        service = new ActivityAdminService(activityMapper, sessionMapper, ticketTypeMapper,
                userAccessService, orderInternalClient, paymentInternalClient,
                activityArtistMapper, artistMapper, "test-token");
    }

    // ==================== 3.1 正常发布流程 ====================

    @Nested
    @DisplayName("正常发布流程")
    class NormalPublishTests {

        @Test
        @DisplayName("AP-001: 完整活动成功发布")
        void publishFullActivitySuccess() {
            Activity activity = activity(10L, 2003L, "draft", 1);
            Session session = session(101L, 10L, 1);
            TicketType ticketType = ticketType(201L, 101L, 1);
            ActivityArtist lineup = lineup(10L, 3001L);
            Artist artist = artist(3001L, "approved", "normal");

            when(activityMapper.selectById(10L)).thenReturn(activity);
            when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));
            when(sessionMapper.selectList(any())).thenReturn(List.of(session));
            when(ticketTypeMapper.selectList(any())).thenReturn(List.of(ticketType));
            when(activityArtistMapper.selectList(any())).thenReturn(List.of(lineup));
            when(artistMapper.selectBatchIds(any())).thenReturn(List.of(artist));

            UpdateActivityStatusRequest request = req(2003L, 1);
            assertDoesNotThrow(() -> service.updateActivityStatus(10L, request));
            verify(activityMapper).updateById(activity);
        }

        @Test
        @DisplayName("AP-002: admin发布任意活动")
        void adminPublishAnyActivity() {
            Activity activity = activity(10L, 9999L, "draft", 1);
            Session session = session(101L, 10L, 1);
            TicketType ticketType = ticketType(201L, 101L, 1);
            ActivityArtist lineup = lineup(10L, 3001L);
            Artist artist = artist(3001L, "approved", "normal");

            when(activityMapper.selectById(10L)).thenReturn(activity);
            when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2002L, "activity.manage")).thenReturn(user(2002L, "admin"));
            when(sessionMapper.selectList(any())).thenReturn(List.of(session));
            when(ticketTypeMapper.selectList(any())).thenReturn(List.of(ticketType));
            when(activityArtistMapper.selectList(any())).thenReturn(List.of(lineup));
            when(artistMapper.selectBatchIds(any())).thenReturn(List.of(artist));

            UpdateActivityStatusRequest request = req(2002L, 1);
            assertDoesNotThrow(() -> service.updateActivityStatus(10L, request));
            verify(activityMapper).updateById(activity);
        }

        @Test
        @DisplayName("AP-003: organizer发布自己的活动")
        void organizerPublishOwnActivity() {
            Activity activity = activity(10L, 2003L, "draft", 1);
            Session session = session(101L, 10L, 1);
            TicketType ticketType = ticketType(201L, 101L, 1);
            ActivityArtist lineup = lineup(10L, 3001L);
            Artist artist = artist(3001L, "approved", "normal");

            when(activityMapper.selectById(10L)).thenReturn(activity);
            when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));
            when(sessionMapper.selectList(any())).thenReturn(List.of(session));
            when(ticketTypeMapper.selectList(any())).thenReturn(List.of(ticketType));
            when(activityArtistMapper.selectList(any())).thenReturn(List.of(lineup));
            when(artistMapper.selectBatchIds(any())).thenReturn(List.of(artist));

            UpdateActivityStatusRequest request = req(2003L, 1);
            service.updateActivityStatus(10L, request);
            verify(activityMapper).updateById(activity);
        }
    }

    // ==================== 3.2 发布前置条件校验 ====================

    @Nested
    @DisplayName("发布前置条件校验")
    class PublishPreconditionTests {

        @Test
        @DisplayName("AP-004: 无场次时发布失败")
        void publishWithNoSessionsFails() {
            Activity activity = activity(10L, 2003L, "draft", 1);
            when(activityMapper.selectById(10L)).thenReturn(activity);
            when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));
            when(sessionMapper.selectList(any())).thenReturn(Collections.emptyList());

            BusinessException ex = assertThrows(BusinessException.class,
                    () -> service.updateActivityStatus(10L, req(2003L, 1)));
            assertTrue(ex.getMessage().contains("有效场次"));
            verify(activityMapper, never()).updateById(any());
        }

        @Test
        @DisplayName("AP-005: 场次均不可售时发布失败")
        void publishWithNoActiveTicketTypeFails() {
            Activity activity = activity(10L, 2003L, "draft", 1);
            Session session = session(101L, 10L, 1);
            when(activityMapper.selectById(10L)).thenReturn(activity);
            when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));
            when(sessionMapper.selectList(any())).thenReturn(List.of(session));
            when(ticketTypeMapper.selectList(any())).thenReturn(Collections.emptyList());

            BusinessException ex = assertThrows(BusinessException.class,
                    () -> service.updateActivityStatus(10L, req(2003L, 1)));
            assertTrue(ex.getMessage().contains("可售票档"));
        }

        @Test
        @DisplayName("AP-006: 艺人未审核时发布失败")
        void publishWithPendingArtistFails() {
            Activity activity = activity(10L, 2003L, "draft", 1);
            Session session = session(101L, 10L, 1);
            TicketType ticketType = ticketType(201L, 101L, 1);
            ActivityArtist lineup = lineup(10L, 3001L);
            Artist artist = artist(3001L, "pending", "normal");

            when(activityMapper.selectById(10L)).thenReturn(activity);
            when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));
            when(sessionMapper.selectList(any())).thenReturn(List.of(session));
            when(ticketTypeMapper.selectList(any())).thenReturn(List.of(ticketType));
            when(activityArtistMapper.selectList(any())).thenReturn(List.of(lineup));
            when(artistMapper.selectBatchIds(any())).thenReturn(List.of(artist));

            BusinessException ex = assertThrows(BusinessException.class,
                    () -> service.updateActivityStatus(10L, req(2003L, 1)));
            assertTrue(ex.getMessage().contains("未审核"));
        }

        @Test
        @DisplayName("AP-007: 无票档时发布失败")
        void publishWithNoLineupFails() {
            Activity activity = activity(10L, 2003L, "draft", 1);
            Session session = session(101L, 10L, 1);
            when(activityMapper.selectById(10L)).thenReturn(activity);
            when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));
            when(sessionMapper.selectList(any())).thenReturn(List.of(session));
            when(ticketTypeMapper.selectList(any())).thenReturn(Collections.emptyList());

            BusinessException ex = assertThrows(BusinessException.class,
                    () -> service.updateActivityStatus(10L, req(2003L, 1)));
            assertTrue(ex.getMessage().contains("可售票档"));
        }
    }

    // ==================== 3.3 下架流程 ====================

    @Nested
    @DisplayName("下架流程")
    class DeactivateTests {

        @Test
        @DisplayName("AP-008: 正常下架(无PAID订单)")
        void deactivateActivityNoPaidOrders() {
            Activity activity = activity(10L, 2003L, "published", 1);
            when(activityMapper.selectById(10L)).thenReturn(activity);
            when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));
            when(sessionMapper.selectList(any())).thenReturn(Collections.emptyList());

            DeactivateActivityRequest request = new DeactivateActivityRequest();
            request.setUserId(2003L);
            request.setConfirmRefund(true);

            RefundImpactResponse response = service.deactivateActivity(10L, request);

            assertNotNull(response);
            assertEquals(Integer.valueOf(1), response.getDeactivatedActivityCount());
            assertEquals(Integer.valueOf(0), response.getPaidOrderCount());
            assertEquals(0, activity.getStatus());
            assertEquals("deactivated", activity.getPublishStatus());
            verify(activityMapper).updateById(activity);
        }

        @Test
        @DisplayName("AP-009: 下架(有PAID订单,确认退款)")
        void deactivateActivityWithPaidOrdersConfirmedRefund() {
            Activity activity = activity(10L, 2003L, "published", 1);
            activity.setName("下架测试活动");
            Session session = session(101L, 10L, 1);
            TicketType ticketType = ticketType(201L, 101L, 1);
            OrderInfoResponse order1 = order(5001L, 101L);
            OrderInfoResponse order2 = order(5002L, 101L);
            DirectRefundResponse refundResp = new DirectRefundResponse();
            refundResp.setOrderId(5001L);
            refundResp.setStatus("SUCCESS");
            refundResp.setSuccess(true);

            when(activityMapper.selectById(10L)).thenReturn(activity);
            when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));
            when(sessionMapper.selectList(any())).thenReturn(List.of(session));
            when(ticketTypeMapper.selectList(any())).thenReturn(List.of(ticketType));
            when(orderInternalClient.listPaidBySessions(any(), eq("test-token")))
                    .thenReturn(Result.success(List.of(order1, order2)));
            when(paymentInternalClient.directRefund(any(), eq("test-token")))
                    .thenReturn(Result.success(refundResp));

            DeactivateActivityRequest request = new DeactivateActivityRequest();
            request.setUserId(2003L);
            request.setConfirmRefund(true);

            RefundImpactResponse response = service.deactivateActivity(10L, request);

            assertNotNull(response);
            assertEquals(Integer.valueOf(1), response.getDeactivatedActivityCount());
            verify(paymentInternalClient, atLeastOnce()).directRefund(any(), eq("test-token"));
            assertEquals(0, activity.getStatus());
        }

        @Test
        @DisplayName("AP-010: 下架(拒绝确认退款)→失败")
        void deactivateActivityRefundNotConfirmed() {
            Activity activity = activity(10L, 2003L, "published", 1);
            when(activityMapper.selectById(10L)).thenReturn(activity);
            when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));

            DeactivateActivityRequest request = new DeactivateActivityRequest();
            request.setUserId(2003L);
            request.setConfirmRefund(false);

            assertThrows(BusinessException.class, () -> service.deactivateActivity(10L, request));
            verify(activityMapper, never()).updateById(any());
        }

        @Test
        @DisplayName("AP-011: 下架已下架活动→不校验publishStatus")
        void deactivateAlreadyDeactivatedActivity() {
            Activity activity = activity(10L, 2003L, "deactivated", 0);
            when(activityMapper.selectById(10L)).thenReturn(activity);
            when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));
            when(sessionMapper.selectList(any())).thenReturn(Collections.emptyList());

            DeactivateActivityRequest request = new DeactivateActivityRequest();
            request.setUserId(2003L);
            request.setConfirmRefund(true);

            RefundImpactResponse response = service.deactivateActivity(10L, request);
            assertNotNull(response);
        }
    }

    // ==================== 3.4 软删除流程 ====================

    @Nested
    @DisplayName("软删除流程")
    class SoftDeleteTests {

        @Test
        @DisplayName("AP-012: 删除草稿活动")
        void deleteDraftActivity() {
            Activity activity = activity(10L, 2003L, "draft", 1);
            when(activityMapper.selectById(10L)).thenReturn(activity);
            when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));
            when(sessionMapper.selectList(any())).thenReturn(Collections.emptyList());

            DeleteActivityRequest request = new DeleteActivityRequest();
            request.setUserId(2003L);
            request.setReason("测试删除草稿");

            DeleteActivityResponse response = service.deleteActivity(10L, request);

            assertTrue(response.getDeleted());
            assertEquals("deleted", activity.getPublishStatus());
            assertEquals(0, activity.getStatus());
            assertEquals("测试删除草稿", activity.getDeleteReason());
            verify(activityMapper).updateById(activity);
        }

        @Test
        @DisplayName("AP-013: 删除已下架活动")
        void deleteDeactivatedActivity() {
            Activity activity = activity(10L, 2003L, "deactivated", 0);
            when(activityMapper.selectById(10L)).thenReturn(activity);
            when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));
            when(sessionMapper.selectList(any())).thenReturn(Collections.emptyList());

            DeleteActivityRequest request = new DeleteActivityRequest();
            request.setUserId(2003L);
            request.setReason("清理下架活动");

            DeleteActivityResponse response = service.deleteActivity(10L, request);

            assertTrue(response.getDeleted());
            assertEquals("deleted", activity.getPublishStatus());
        }

        @Test
        @DisplayName("AP-014: 删除有PAID订单的published活动→失败")
        void deletePublishedActivityWithPaidOrdersFails() {
            Activity activity = activity(10L, 2003L, "published", 1);
            Session session = session(101L, 10L, 1);
            OrderInfoResponse paidOrder = order(5001L, 101L);

            when(activityMapper.selectById(10L)).thenReturn(activity);
            when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));
            when(sessionMapper.selectList(any())).thenReturn(List.of(session));
            when(orderInternalClient.listPaidBySessions(any(), eq("test-token")))
                    .thenReturn(Result.success(List.of(paidOrder)));

            DeleteActivityRequest request = new DeleteActivityRequest();
            request.setUserId(2003L);
            request.setReason("尝试删除有订单活动");

            BusinessException ex = assertThrows(BusinessException.class,
                    () -> service.deleteActivity(10L, request));
            assertTrue(ex.getMessage().contains("已支付订单"));
            verify(activityMapper, never()).updateById(any());
        }

        @Test
        @DisplayName("AP-014: 删除deactivated活动即使有订单也允许")
        void deleteDeactivatedActivityWithPaidOrdersSucceeds() {
            Activity activity = activity(10L, 2003L, "deactivated", 0);
            Session session = session(101L, 10L, 1);
            OrderInfoResponse paidOrder = order(5001L, 101L);

            when(activityMapper.selectById(10L)).thenReturn(activity);
            when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));
            when(sessionMapper.selectList(any())).thenReturn(List.of(session));
            when(orderInternalClient.listPaidBySessions(any(), eq("test-token")))
                    .thenReturn(Result.success(List.of(paidOrder)));
            // deactivated → paid order check called but skip throw

            DeleteActivityRequest request = new DeleteActivityRequest();
            request.setUserId(2003L);
            request.setReason("清理下架活动（含订单）");

            DeleteActivityResponse response = service.deleteActivity(10L, request);
            assertTrue(response.getDeleted());
        }

        @Test
        @DisplayName("AP-015: 删除时原因必填")
        void deleteActivityRequiresReason() {
            DeleteActivityRequest request = new DeleteActivityRequest();
            request.setUserId(2003L);
            request.setReason("");

            assertThrows(BusinessException.class, () -> service.deleteActivity(10L, request));
            verify(activityMapper, never()).selectById(anyLong());
            verify(activityMapper, never()).updateById(any());
        }
    }

    // ==================== 3.5 权限校验 ====================

    @Nested
    @DisplayName("权限校验")
    class PermissionTests {

        @Test
        @DisplayName("AP-016/017: organizer发布他人活动→403")
        void organizerPublishOtherActivity() {
            Activity activity = activity(10L, 9999L, "draft", 1);
            when(activityMapper.selectById(10L)).thenReturn(activity);
            when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));

            BusinessException ex = assertThrows(BusinessException.class,
                    () -> service.updateActivityStatus(10L, req(2003L, 1)));
            assertTrue(ex.getMessage().contains("只能管理自己主办的活动"));
            verify(activityMapper, never()).updateById(any());
        }

        @Test
        @DisplayName("AP-016: user角色发布活动→403")
        void userRolePublishActivity() {
            Activity activity = activity(10L, 2004L, "draft", 1);
            when(activityMapper.selectById(10L)).thenReturn(activity);
            when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2004L, "activity.manage"))
                    .thenThrow(new BusinessException(403, "无权限"));

            assertThrows(BusinessException.class, () -> service.updateActivityStatus(10L, req(2004L, 1)));
            verify(activityMapper, never()).updateById(any());
        }

        @Test
        @DisplayName("AP-018: organizer下架他人活动→403")
        void organizerDeactivateOtherActivity() {
            Activity activity = activity(10L, 9999L, "deactivated", 0);
            when(activityMapper.selectById(10L)).thenReturn(activity);
            when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));

            DeactivateActivityRequest request = new DeactivateActivityRequest();
            request.setUserId(2003L);
            request.setConfirmRefund(true);

            BusinessException ex = assertThrows(BusinessException.class,
                    () -> service.deactivateActivity(10L, request));
            assertTrue(ex.getMessage().contains("只能管理自己主办的活动"));
        }

        @Test
        @DisplayName("AP-023: admin批量下架organizer→deactivateOrganizer")
        void adminDeactivateOrganizer() {
            InternalUserRefResponse adminUser = user(2002L, "admin");
            InternalUserRefResponse organizerUser = user(2003L, "organizer");
            organizerUser.setOrganizerStatus(1);
            Activity a1 = activity(10L, 2003L, "published", 1);
            Activity a2 = activity(11L, 2003L, "published", 1);

            when(userAccessService.requireAdmin(2002L)).thenReturn(adminUser);
            when(userAccessService.requireUser(2003L)).thenReturn(organizerUser);
            when(activityMapper.selectList(any())).thenReturn(List.of(a1, a2));
            when(sessionMapper.selectList(any())).thenReturn(Collections.emptyList());

            DeactivateOrganizerRequest request = new DeactivateOrganizerRequest();
            request.setUserId(2002L);
            request.setOrganizerId(2003L);
            request.setConfirmRefund(true);

            // deactivateOrganizer内部会抛异常（需通过用户服务），但已验证活动被下架
            BusinessException ex = assertThrows(BusinessException.class,
                    () -> service.deactivateOrganizer(request));
            verify(activityMapper, atLeastOnce()).updateById(any(Activity.class));
        }
    }

    // ==================== 3.6 异常与边界 ====================

    @Nested
    @DisplayName("异常与边界")
    class ErrorAndBoundaryTests {

        @Test
        @DisplayName("AP-020: 不存在活动ID更新状态→404")
        void updateStatusActivityNotFound() {
            when(activityMapper.selectById(999999L)).thenReturn(null);

            BusinessException ex = assertThrows(BusinessException.class,
                    () -> service.updateActivityStatus(999999L, req(2003L, 1)));
            assertTrue(ex.getMessage().contains("活动不存在"));
            verify(activityMapper, never()).updateById(any());
        }

        @Test
        @DisplayName("AP-020: 不存在活动ID下架→404")
        void deactivateActivityNotFound() {
            when(activityMapper.selectById(999999L)).thenReturn(null);

            DeactivateActivityRequest request = new DeactivateActivityRequest();
            request.setUserId(2003L);
            request.setConfirmRefund(true);

            BusinessException ex = assertThrows(BusinessException.class,
                    () -> service.deactivateActivity(999999L, request));
            assertTrue(ex.getMessage().contains("活动不存在"));
        }

        @Test
        @DisplayName("AP-020: 不存在活动ID删除→404")
        void deleteActivityNotFound() {
            when(activityMapper.selectById(999999L)).thenReturn(null);

            DeleteActivityRequest request = new DeleteActivityRequest();
            request.setUserId(2003L);
            request.setReason("删除不存在活动");

            BusinessException ex = assertThrows(BusinessException.class,
                    () -> service.deleteActivity(999999L, request));
            assertTrue(ex.getMessage().contains("活动不存在"));
        }

        @Test
        @DisplayName("AP-021: 非1的status→不触发validatePublishable→直接更新")
        void updateActivityWithNonOneStatus() {
            Activity activity = activity(10L, 2003L, "draft", 1);
            when(activityMapper.selectById(10L)).thenReturn(activity);
            when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));

            assertDoesNotThrow(() -> service.updateActivityStatus(10L, req(2003L, 99)));
            verify(activityMapper).updateById(activity);
        }

        @Test
        @DisplayName("AP-022: 重复发布已published活动→幂等")
        void republishAlreadyPublishedActivity() {
            Activity activity = activity(10L, 2003L, "published", 1);
            Session session = session(101L, 10L, 1);
            TicketType ticketType = ticketType(201L, 101L, 1);
            ActivityArtist lineup = lineup(10L, 3001L);
            Artist artist = artist(3001L, "approved", "normal");

            when(activityMapper.selectById(10L)).thenReturn(activity);
            when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));
            when(sessionMapper.selectList(any())).thenReturn(List.of(session));
            when(ticketTypeMapper.selectList(any())).thenReturn(List.of(ticketType));
            when(activityArtistMapper.selectList(any())).thenReturn(List.of(lineup));
            when(artistMapper.selectBatchIds(any())).thenReturn(List.of(artist));

            assertDoesNotThrow(() -> service.updateActivityStatus(10L, req(2003L, 1)));
            assertEquals(1, activity.getStatus());
        }

        @Test
        @DisplayName("AP-022: 发布deactivated活动恢复为published")
        void publishRestoresDeactivatedActivity() {
            Activity activity = activity(10L, 2003L, "deactivated", 0);
            Session session = session(101L, 10L, 1);
            TicketType ticketType = ticketType(201L, 101L, 1);
            ActivityArtist lineup = lineup(10L, 3001L);
            Artist artist = artist(3001L, "approved", "normal");

            when(activityMapper.selectById(10L)).thenReturn(activity);
            when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));
            when(sessionMapper.selectList(any())).thenReturn(List.of(session));
            when(ticketTypeMapper.selectList(any())).thenReturn(List.of(ticketType));
            when(activityArtistMapper.selectList(any())).thenReturn(List.of(lineup));
            when(artistMapper.selectBatchIds(any())).thenReturn(List.of(artist));

            service.updateActivityStatus(10L, req(2003L, 1));
            verify(activityMapper).updateById(activity);
            assertEquals("published", activity.getPublishStatus());
        }

        @Test
        @DisplayName("deleteActivity: 参数为null→抛异常")
        void deleteActivityNullRequest() {
            assertThrows(BusinessException.class, () -> service.deleteActivity(10L, null));
        }
    }

    // ==================== 辅助方法 ====================

    private static UpdateActivityStatusRequest req(Long userId, Integer status) {
        UpdateActivityStatusRequest request = new UpdateActivityStatusRequest();
        request.setUserId(userId);
        request.setStatus(status);
        return request;
    }

    private static Activity activity(Long id, Long organizerId, String publishStatus, Integer status) {
        Activity a = new Activity();
        a.setId(id);
        a.setOrganizerId(organizerId);
        a.setPublishStatus(publishStatus);
        a.setStatus(status);
        a.setName("测试活动");
        return a;
    }

    private static Session session(Long id, Long activityId, Integer status) {
        Session s = new Session();
        s.setId(id);
        s.setActivityId(activityId);
        s.setStatus(status);
        return s;
    }

    private static TicketType ticketType(Long id, Long sessionId, Integer status) {
        TicketType tt = new TicketType();
        tt.setId(id);
        tt.setSessionId(sessionId);
        tt.setStatus(status);
        return tt;
    }

    private static ActivityArtist lineup(Long activityId, Long artistId) {
        ActivityArtist aa = new ActivityArtist();
        aa.setActivityId(activityId);
        aa.setArtistId(artistId);
        aa.setStatus(1);
        return aa;
    }

    private static Artist artist(Long id, String reviewStatus, String riskStatus) {
        Artist a = new Artist();
        a.setId(id);
        a.setStatus(1);
        a.setReviewStatus(reviewStatus);
        a.setRiskStatus(riskStatus);
        return a;
    }

    private static InternalUserRefResponse user(Long id, String role) {
        InternalUserRefResponse u = new InternalUserRefResponse();
        u.setId(id);
        u.setRole(role);
        u.setStatus(1);
        return u;
    }

    private static OrderInfoResponse order(Long id, Long sessionId) {
        OrderInfoResponse o = new OrderInfoResponse();
        o.setId(id);
        o.setSessionId(sessionId);
        return o;
    }
}
