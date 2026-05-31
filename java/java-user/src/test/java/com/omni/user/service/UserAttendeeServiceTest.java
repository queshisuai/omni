package com.omni.user.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.user.dto.ResolvedAttendeeResponse;
import com.omni.user.dto.UserAttendeeRequest;
import com.omni.user.dto.UserAttendeeResponse;
import com.omni.user.entity.UserAttendee;
import com.omni.user.mapper.UserAttendeeMapper;
import com.omni.exception.BusinessException;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.stream.Collectors;
import java.lang.reflect.Field;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserAttendeeServiceTest {

    private final UserAttendeeMapper mapper = mock(UserAttendeeMapper.class);
    private final UserAttendeeService service = new UserAttendeeService(mapper);

    @Test
    void createHashesAndMasksIdCard() {
        UserAttendeeRequest request = new UserAttendeeRequest();
        request.setRealName("Zhang San");
        request.setIdType("ID_CARD");
        request.setIdNo("11010119900307001X");
        request.setPhone("13900000001");

        UserAttendeeResponse response = service.create(2004L, request);

        assertEquals("Zhang San", response.getRealName());
        assertEquals("110***********01X", response.getIdNoMask());
        verify(mapper).insert(any(UserAttendee.class));
    }

    @Test
    void resolveKeepsRequestedOrderAndReturnsHashOnly() {
        UserAttendee first = attendee(11L, 2004L, "Alice", "hash-a", "110***********011");
        UserAttendee second = attendee(12L, 2004L, "Bob", "hash-b", "110***********022");
        when(mapper.selectBatchIds(List.of(12L, 11L))).thenReturn(List.of(first, second));

        List<ResolvedAttendeeResponse> resolved = service.resolve(2004L, List.of(12L, 11L));

        assertEquals(List.of(12L, 11L), resolved.stream().map(ResolvedAttendeeResponse::getId).collect(Collectors.toList()));
        assertEquals(List.of("hash-b", "hash-a"), resolved.stream().map(ResolvedAttendeeResponse::getIdNoHash).collect(Collectors.toList()));
        assertNotNull(resolved.get(0).getIdNoMask());
    }

    @Test
    void listMineOnlyReturnsActiveUserAttendees() {
        service.listMine(2004L);

        verify(mapper).selectList(any(LambdaQueryWrapper.class));
    }

    @Test
    void resolveRejectsMissingAttendeeWithChineseMessage() {
        when(mapper.selectBatchIds(List.of(99L))).thenReturn(List.of());

        BusinessException error = assertThrows(BusinessException.class, () -> service.resolve(2004L, List.of(99L)));

        assertEquals("实名观演人不属于当前用户或已被删除", error.getMessage());
    }

    @Test
    void deleteStatusMatchesDatabaseConstraint() throws Exception {
        Field field = UserAttendeeService.class.getDeclaredField("STATUS_DELETED");
        field.setAccessible(true);

        assertEquals(0, field.getInt(null));
    }

    private UserAttendee attendee(Long id, Long userId, String name, String hash, String mask) {
        UserAttendee attendee = new UserAttendee();
        attendee.setId(id);
        attendee.setUserId(userId);
        attendee.setRealName(name);
        attendee.setIdType("ID_CARD");
        attendee.setIdNoHash(hash);
        attendee.setIdNoMask(mask);
        attendee.setStatus(1);
        return attendee;
    }
}
