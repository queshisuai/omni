package com.omni.ticket.search;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.ticket.dto.ActivityVO;

public interface ActivitySearchProvider {
    Page<ActivityVO> search(ActivitySearchRequest request);
}
