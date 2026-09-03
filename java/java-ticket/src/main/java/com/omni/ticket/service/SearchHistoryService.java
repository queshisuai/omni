package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.ActivityVO;
import com.omni.ticket.dto.SearchHistoryRequest;
import com.omni.ticket.dto.SearchTrendingItem;
import com.omni.ticket.dto.SearchTrendingKeywordRow;
import com.omni.ticket.entity.SearchHistory;
import com.omni.ticket.mapper.SearchHistoryMapper;
import com.omni.ticket.search.ActivitySearchProvider;
import com.omni.ticket.search.ActivitySearchRequest;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Service
public class SearchHistoryService {

    private static final int HISTORY_LIMIT = 10;
    private static final String TARGET_TYPE_EVENT = "EVENT";
    private static final String TARGET_TYPE_KEYWORD = "KEYWORD";

    private final SearchHistoryMapper historyMapper;
    private final ActivitySearchProvider searchProvider;

    public SearchHistoryService(SearchHistoryMapper historyMapper, ActivitySearchProvider searchProvider) {
        this.historyMapper = historyMapper;
        this.searchProvider = searchProvider;
    }

    public List<String> listHistory(Long userId) {
        if (userId == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }
        List<SearchHistory> rows = historyMapper.selectList(new LambdaQueryWrapper<SearchHistory>()
                .eq(SearchHistory::getUserId, userId)
                .orderByDesc(SearchHistory::getLastSearchedAt)
                .last("LIMIT " + HISTORY_LIMIT));
        if (rows == null) {
            return Collections.emptyList();
        }
        return rows.stream()
                .map(SearchHistory::getKeyword)
                .filter(StringUtils::hasText)
                .limit(HISTORY_LIMIT)
                .collect(Collectors.toList());
    }

    public List<String> addHistory(Long userId, SearchHistoryRequest request) {
        if (userId == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }
        String keyword = request == null ? "" : request.getKeyword();
        String normalized = keyword == null ? "" : keyword.trim();
        if (!StringUtils.hasText(normalized)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "搜索关键词不能为空");
        }

        LocalDateTime now = LocalDateTime.now();
        SearchHistory existing = historyMapper.selectOne(new LambdaQueryWrapper<SearchHistory>()
                .eq(SearchHistory::getUserId, userId)
                .eq(SearchHistory::getKeyword, normalized)
                .last("LIMIT 1"));
        if (existing == null) {
            SearchHistory history = new SearchHistory();
            history.setUserId(userId);
            history.setKeyword(normalized);
            history.setSearchCount(1);
            history.setLastSearchedAt(now);
            history.setCreateTime(now);
            history.setUpdateTime(now);
            historyMapper.insert(history);
        } else {
            existing.setKeyword(normalized);
            existing.setSearchCount((existing.getSearchCount() == null ? 0 : existing.getSearchCount()) + 1);
            existing.setLastSearchedAt(now);
            existing.setUpdateTime(now);
            historyMapper.updateById(existing);
        }
        return listHistory(userId);
    }

    public void clearHistory(Long userId) {
        if (userId == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }
        historyMapper.delete(new LambdaQueryWrapper<SearchHistory>()
                .eq(SearchHistory::getUserId, userId));
    }

    public List<SearchTrendingItem> listTrending() {
        List<SearchTrendingKeywordRow> rows = historyMapper.selectTrendingKeywords(HISTORY_LIMIT);
        if (rows != null && !rows.isEmpty()) {
            List<SearchTrendingItem> items = new ArrayList<>();
            int rank = 1;
            for (SearchTrendingKeywordRow row : rows) {
                if (row == null || !StringUtils.hasText(row.getKeyword())) {
                    continue;
                }
                items.add(toTrendingKeywordItem(rank, row.getKeyword().trim()));
                rank++;
                if (rank > HISTORY_LIMIT) {
                    break;
                }
            }
            return items;
        }
        Page<ActivityVO> page = searchProvider.search(ActivitySearchRequest.builder()
                .page(1)
                .size(HISTORY_LIMIT)
                .sort("recommend")
                .build());
        List<ActivityVO> records = page == null || page.getRecords() == null ? Collections.emptyList() : page.getRecords();
        List<SearchTrendingItem> items = new ArrayList<>();
        int rank = 1;
        for (ActivityVO activity : records) {
            if (activity == null || !StringUtils.hasText(activity.getName())) {
                continue;
            }
            items.add(toTrendingActivityItem(rank, activity.getName().trim(), activity));
            rank++;
            if (rank > HISTORY_LIMIT) {
                break;
            }
        }
        return items;
    }

    private SearchTrendingItem toTrendingKeywordItem(int rank, String keyword) {
        ActivityVO target = resolveBestActivityTarget(keyword);
        if (target == null) {
            return toTrendingBaseItem(rank, keyword, TARGET_TYPE_KEYWORD, null, null);
        }
        return toTrendingActivityItem(rank, keyword, target);
    }

    private ActivityVO resolveBestActivityTarget(String keyword) {
        Page<ActivityVO> page = searchProvider.search(ActivitySearchRequest.builder()
                .page(1)
                .size(1)
                .keyword(keyword)
                .sort("relevance")
                .build());
        if (page == null || page.getRecords() == null || page.getRecords().isEmpty()) {
            return null;
        }
        return page.getRecords().get(0);
    }

    private SearchTrendingItem toTrendingActivityItem(int rank, String keyword, ActivityVO activity) {
        String itemType = normalizeItemType(activity.getItemType());
        Long targetId = activity.getId();
        return toTrendingBaseItem(rank, keyword, targetId == null ? TARGET_TYPE_KEYWORD : TARGET_TYPE_EVENT, targetId, itemType);
    }

    private SearchTrendingItem toTrendingBaseItem(int rank, String keyword, String targetType, Long targetId, String itemType) {
        SearchTrendingItem item = new SearchTrendingItem();
        item.setId(targetId == null ? (long) rank : targetId);
        item.setRank(rank);
        item.setKeyword(keyword);
        item.setTagType(tagType(rank));
        item.setTargetType(targetType);
        item.setTargetId(targetId);
        item.setItemType(itemType);
        return item;
    }

    private String normalizeItemType(String itemType) {
        String normalized = itemType == null ? "" : itemType.trim().toLowerCase(Locale.ROOT);
        return "tour".equals(normalized) ? "tour" : "activity";
    }

    private String tagType(int rank) {
        if (rank == 1) return "BURST";
        if (rank <= 3) return "HOT";
        if (rank <= 5) return "NEW";
        return "NONE";
    }
}
