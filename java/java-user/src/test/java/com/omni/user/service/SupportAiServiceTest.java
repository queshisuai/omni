package com.omni.user.service;

import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SupportAiServiceTest {

    private final SupportAiService service = new SupportAiService((question, projectKnowledge) -> Optional.empty());

    @Test
    void answersTicketWalletQuestionsWithProjectKnowledge() {
        String answer = service.answer("电子票二维码在哪里看，能不能转赠？");

        assertTrue(answer.contains("我的票夹"));
        assertTrue(answer.contains("动态入场码"));
        assertTrue(answer.contains("转赠"));
    }

    @Test
    void answersRefundQuestionsWithTimelineAndHumanHandoffHint() {
        String answer = service.answer("退款不到账怎么办？");

        assertTrue(answer.contains("退款进度"));
        assertTrue(answer.contains("人工客服"));
    }

    @Test
    void answersOrderPaymentQuestionsWithOrderStatusGuidance() {
        String answer = service.answer("支付后订单还是待支付怎么办？");

        assertTrue(answer.contains("订单页"));
        assertTrue(answer.contains("同步"));
        assertTrue(answer.contains("出票状态"));
    }

    @Test
    void answersWaitlistQuestionsWithQueueAndTimedPaymentRules() {
        String answer = service.answer("候补成功后什么时候生成订单？");

        assertTrue(answer.contains("排队资格"));
        assertTrue(answer.contains("待支付订单"));
        assertTrue(answer.contains("限时支付"));
    }

    @Test
    void answersTeamGrabQuestionsWithInviteAndMemberStatusRules() {
        String answer = service.answer("怎么加入小队抢票，邀请码在哪里用？");

        assertTrue(answer.contains("小队 ID"));
        assertTrue(answer.contains("邀请码"));
        assertTrue(answer.contains("成员状态"));
    }

    @Test
    void answersNotificationQuestionsWithRelevantStatusPages() {
        String answer = service.answer("候补释放通知没收到怎么办？");

        assertTrue(answer.contains("通知中心"));
        assertTrue(answer.contains("候补页"));
        assertTrue(answer.contains("订单页"));
    }

    @Test
    void prefersLocalModelAnswerWhenAvailable() {
        SupportAiService modelBackedService = new SupportAiService((question, projectKnowledge) -> Optional.of("这是本地大模型根据项目规则给出的回答。"));

        String answer = modelBackedService.answer("电子票二维码在哪里看？");

        assertEquals("这是本地大模型根据项目规则给出的回答。", answer);
    }

    @Test
    void passesProjectKnowledgeToLocalModel() {
        AtomicReference<String> promptRef = new AtomicReference<>();
        SupportAiService modelBackedService = new SupportAiService((question, projectKnowledge) -> {
            promptRef.set(projectKnowledge);
            return Optional.empty();
        });

        modelBackedService.answer("我想问票夹和转赠规则");

        assertTrue(promptRef.get().contains("票夹"));
        assertTrue(promptRef.get().contains("人工客服"));
        assertTrue(promptRef.get().contains("平台规则"));
        assertTrue(promptRef.get().contains("小队抢票"));
        assertTrue(promptRef.get().contains("候补"));
        assertTrue(promptRef.get().contains("通知中心"));
        assertTrue(promptRef.get().contains("订单"));
    }
}
