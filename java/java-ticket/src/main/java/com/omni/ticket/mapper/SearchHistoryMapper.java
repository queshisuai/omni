package com.omni.ticket.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.omni.ticket.dto.SearchTrendingKeywordRow;
import com.omni.ticket.entity.SearchHistory;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface SearchHistoryMapper extends BaseMapper<SearchHistory> {

    @Select("SELECT keyword, SUM(search_count) AS search_count, MAX(last_searched_at) AS last_searched_at " +
            "FROM search_history " +
            "GROUP BY keyword " +
            "ORDER BY SUM(search_count) DESC, MAX(last_searched_at) DESC " +
            "LIMIT #{limit}")
    List<SearchTrendingKeywordRow> selectTrendingKeywords(@Param("limit") int limit);
}
