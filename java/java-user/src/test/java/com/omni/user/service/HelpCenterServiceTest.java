package com.omni.user.service;

import com.omni.user.dto.HelpFaqResponse;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;

class HelpCenterServiceTest {

    private final HelpCenterService service = new HelpCenterService();

    @Test
    void listsProjectFaqsUsedBySupportFastIndex() {
        List<HelpFaqResponse> faqs = service.listFaqs();

        assertTrue(faqs.size() >= 10);
        assertTrue(contains(faqs, "订单支付", "支付后订单"));
        assertTrue(contains(faqs, "选座实名", "实名观演人"));
        assertTrue(contains(faqs, "抢票与候补", "候补"));
        assertTrue(contains(faqs, "小队抢票", "邀请码"));
        assertTrue(contains(faqs, "通知与客服", "通知"));
    }

    private boolean contains(List<HelpFaqResponse> faqs, String category, String questionKeyword) {
        return faqs.stream().anyMatch(faq ->
                category.equals(faq.getCategory())
                        && faq.getQuestion() != null
                        && faq.getQuestion().contains(questionKeyword));
    }
}
