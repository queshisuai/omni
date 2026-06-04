package com.omni.user.service;

import com.omni.user.dto.HelpFaqResponse;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class HelpCenterService {

    public List<HelpFaqResponse> listFaqs() {
        return SupportKnowledgeBase.listFaqs();
    }
}
