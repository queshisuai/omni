package com.omni.ticket.service;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.ticket.dto.ActivityVO;
import com.omni.ticket.dto.SearchHistoryRequest;
import com.omni.ticket.dto.SearchTrendingItem;
import com.omni.ticket.dto.SearchTrendingKeywordRow;
import com.omni.ticket.entity.SearchHistory;
import com.omni.ticket.mapper.SearchHistoryMapper;
import com.omni.ticket.search.ActivitySearchProvider;
import com.omni.ticket.search.ActivitySearchRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SearchHistoryServiceTest {

    @Mock
    private SearchHistoryMapper historyMapper;
    @Mock
    private ActivitySearchProvider searchProvider;

    @Test
    void addHistoryDeduplicatesAndReturnsTenNewestTerms() {
        SearchHistoryService service = new SearchHistoryService(historyMapper, searchProvider);
        SearchHistory existing = history(7L, 2004L, "交响音乐会", 2, LocalDateTime.now().minusMinutes(3));
        when(historyMapper.selectOne(any())).thenReturn(existing);
        when(historyMapper.updateById(any())).thenReturn(1);
        when(historyMapper.selectList(any())).thenReturn(historyRows(12));

        List<String> result = service.addHistory(2004L, request(" 交响音乐会 "));

        assertEquals(10, result.size());
        assertEquals("关键词1", result.get(0));
        ArgumentCaptor<SearchHistory> captor = ArgumentCaptor.forClass(SearchHistory.class);
        verify(historyMapper).updateById(captor.capture());
        assertEquals(7L, captor.getValue().getId());
        assertEquals("交响音乐会", captor.getValue().getKeyword());
        assertEquals(3, captor.getValue().getSearchCount());
    }

    @Test
    void clearHistoryDeletesOnlyCurrentUserRows() {
        SearchHistoryService service = new SearchHistoryService(historyMapper, searchProvider);

        service.clearHistory(2004L);

        verify(historyMapper).delete(any());
    }

    @Test
    void trendingUsesSearchHistoryAndResolvesBestElasticActivityTarget() {
        SearchHistoryService service = new SearchHistoryService(historyMapper, searchProvider);
        SearchTrendingKeywordRow row = new SearchTrendingKeywordRow();
        row.setKeyword("成都音乐节");
        row.setSearchCount(12L);
        row.setLastSearchedAt(LocalDateTime.now());
        when(historyMapper.selectTrendingKeywords(10)).thenReturn(List.of(row));
        when(searchProvider.search(any(ActivitySearchRequest.class)))
                .thenReturn(page(List.of(activity(900001L, "成都音乐节", "activity"))));

        List<SearchTrendingItem> result = service.listTrending();

        assertEquals(1, result.size());
        assertEquals(1, result.get(0).getRank());
        assertEquals("成都音乐节", result.get(0).getKeyword());
        assertEquals("BURST", result.get(0).getTagType());
        assertEquals("EVENT", result.get(0).getTargetType());
        assertEquals(900001L, result.get(0).getTargetId());

        ArgumentCaptor<ActivitySearchRequest> requestCaptor = ArgumentCaptor.forClass(ActivitySearchRequest.class);
        verify(searchProvider).search(requestCaptor.capture());
        assertEquals("成都音乐节", requestCaptor.getValue().getKeyword());
        assertEquals("relevance", requestCaptor.getValue().getSort());
        assertEquals(1, requestCaptor.getValue().getSize());
    }

    @Test
    void emptyTrendingUsesElasticsearchRecommendedActivitiesWithoutStaticWords() {
        SearchHistoryService service = new SearchHistoryService(historyMapper, searchProvider);
        when(historyMapper.selectTrendingKeywords(10)).thenReturn(List.of());
        when(searchProvider.search(any(ActivitySearchRequest.class)))
                .thenReturn(page(List.of(
                        activity(900001L, "海边音乐会", "activity"),
                        activity(5L, "年度巡演项目", "tour")
                )));

        List<SearchTrendingItem> result = service.listTrending();

        assertEquals(2, result.size());
        assertEquals("海边音乐会", result.get(0).getKeyword());
        assertEquals("activity", result.get(0).getItemType());
        assertEquals("年度巡演项目", result.get(1).getKeyword());
        assertEquals("tour", result.get(1).getItemType());
        ArgumentCaptor<ActivitySearchRequest> requestCaptor = ArgumentCaptor.forClass(ActivitySearchRequest.class);
        verify(searchProvider).search(requestCaptor.capture());
        assertEquals(10, requestCaptor.getValue().getSize());
        assertEquals("recommend", requestCaptor.getValue().getSort());
    }

    private SearchHistoryRequest request(String keyword) {
        SearchHistoryRequest request = new SearchHistoryRequest();
        request.setKeyword(keyword);
        return request;
    }

    private List<SearchHistory> historyRows(int count) {
        List<SearchHistory> rows = new ArrayList<>();
        for (long i = 1; i <= count; i++) {
            rows.add(history(i, 2004L, "关键词" + i, 1, LocalDateTime.now().minusMinutes(i)));
        }
        return rows;
    }

    private SearchHistory history(Long id, Long userId, String keyword, Integer searchCount, LocalDateTime lastSearchedAt) {
        SearchHistory history = new SearchHistory();
        history.setId(id);
        history.setUserId(userId);
        history.setKeyword(keyword);
        history.setSearchCount(searchCount);
        history.setLastSearchedAt(lastSearchedAt);
        return history;
    }

    private ActivityVO activity(Long id, String name, String itemType) {
        ActivityVO vo = new ActivityVO();
        vo.setId(id);
        vo.setName(name);
        vo.setItemType(itemType);
        return vo;
    }

    private Page<ActivityVO> page(List<ActivityVO> records) {
        Page<ActivityVO> page = new Page<>(1, records.size(), records.size());
        page.setRecords(records);
        return page;
    }
}

