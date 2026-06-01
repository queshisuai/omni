package com.omni.user.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.user.dto.UserBrowseHistoryRequest;
import com.omni.user.dto.UserBrowseHistoryResponse;
import com.omni.user.entity.UserBrowseHistory;
import com.omni.user.mapper.UserBrowseHistoryMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserBrowseHistoryServiceTest {

    private final UserBrowseHistoryMapper mapper = mock(UserBrowseHistoryMapper.class);
    private final UserBrowseHistoryService service = new UserBrowseHistoryService(mapper);

    @Test
    void recordCreatesHistoryForFirstActivityView() {
        UserBrowseHistoryRequest request = request(9L, "夏日演唱会");
        when(mapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);

        UserBrowseHistoryResponse response = service.record(2004L, request);

        assertEquals(9L, response.getActivityId());
        assertEquals("夏日演唱会", response.getActivityName());
        ArgumentCaptor<UserBrowseHistory> captor = ArgumentCaptor.forClass(UserBrowseHistory.class);
        verify(mapper).insert(captor.capture());
        assertEquals(2004L, captor.getValue().getUserId());
        assertEquals(9L, captor.getValue().getActivityId());
    }

    @Test
    void recordUpdatesExistingActivityViewInsteadOfDuplicating() {
        UserBrowseHistory existing = history(88L, 2004L, 9L, "旧标题");
        when(mapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(existing);

        service.record(2004L, request(9L, "新标题"));

        assertEquals("新标题", existing.getActivityName());
        verify(mapper).updateById(existing);
    }

    @Test
    void listMineReturnsLatestHistoryRows() {
        when(mapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(history(88L, 2004L, 9L, "夏日演唱会")));

        List<UserBrowseHistoryResponse> response = service.listMine(2004L);

        assertEquals(1, response.size());
        assertEquals(9L, response.get(0).getActivityId());
        assertEquals("夏日演唱会", response.get(0).getActivityName());
    }

    @Test
    void clearMineDeletesOnlyCurrentUserHistory() {
        service.clearMine(2004L);

        verify(mapper).delete(any(LambdaQueryWrapper.class));
    }

    private UserBrowseHistoryRequest request(Long activityId, String activityName) {
        UserBrowseHistoryRequest request = new UserBrowseHistoryRequest();
        request.setActivityId(activityId);
        request.setActivityName(activityName);
        request.setPoster("/poster.jpg");
        request.setCategory("演唱会");
        request.setArtist("A");
        request.setCity("上海");
        return request;
    }

    private UserBrowseHistory history(Long id, Long userId, Long activityId, String activityName) {
        UserBrowseHistory history = new UserBrowseHistory();
        history.setId(id);
        history.setUserId(userId);
        history.setActivityId(activityId);
        history.setActivityName(activityName);
        history.setPoster("/poster.jpg");
        history.setCategory("演唱会");
        history.setArtist("A");
        history.setCity("上海");
        return history;
    }
}
