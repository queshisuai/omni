package com.omni.user.service;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
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
    void answersIndexedFaqWithoutWaitingForLocalModel() {
        AtomicInteger modelCalls = new AtomicInteger();
        SupportAiService fastService = new SupportAiService((question, projectKnowledge) -> {
            modelCalls.incrementAndGet();
            return Optional.of("这是慢模型回答。");
        });
        StringBuilder streamed = new StringBuilder();

        String answer = fastService.answerStreaming("哪些票可以转赠？", streamed::append);

        assertEquals(0, modelCalls.get());
        assertTrue(answer.contains("活动规则"));
        assertTrue(answer.contains("我的票夹"));
        assertEquals(answer, streamed.toString());
    }

    @Test
    void streamingDiagnosticsRecordFaqSourceWithoutModelFallback() {
        AtomicInteger modelCalls = new AtomicInteger();
        SupportAiService fastService = new SupportAiService((question, projectKnowledge) -> {
            modelCalls.incrementAndGet();
            return Optional.of("这是慢模型回答。");
        });
        StringBuilder streamed = new StringBuilder();

        SupportAiService.AnswerDiagnostics diagnostics =
                fastService.answerStreamingWithDiagnostics("哪些票可以转赠？", streamed::append);

        assertEquals(SupportAiService.AnswerDiagnostics.SOURCE_FAQ, diagnostics.getSource());
        assertEquals(0, modelCalls.get());
        assertFalse(diagnostics.isModelAttempted());
        assertEquals("", diagnostics.getFallbackReason());
        assertEquals(diagnostics.getAnswer(), streamed.toString());
        assertTrue(diagnostics.getFirstChunkMillis() >= 0);
        assertTrue(diagnostics.getTotalMillis() >= diagnostics.getFirstChunkMillis());
    }

    @Test
    void streamingDiagnosticsRecordLocalModelSource() {
        SupportAiService modelBackedService = new SupportAiService((question, projectKnowledge) -> Optional.of("这是本地模型回答。"));
        StringBuilder streamed = new StringBuilder();

        SupportAiService.AnswerDiagnostics diagnostics =
                modelBackedService.answerStreamingWithDiagnostics("我想咨询一个暂未覆盖在常见问题里的特殊场景。", streamed::append);

        assertEquals(SupportAiService.AnswerDiagnostics.SOURCE_LOCAL_MODEL, diagnostics.getSource());
        assertTrue(diagnostics.isModelAttempted());
        assertEquals("", diagnostics.getFallbackReason());
        assertEquals("这是本地模型回答。", diagnostics.getAnswer());
        assertEquals(diagnostics.getAnswer(), streamed.toString());
        assertTrue(diagnostics.getFirstChunkMillis() >= 0);
        assertTrue(diagnostics.getTotalMillis() >= diagnostics.getFirstChunkMillis());
    }

    @Test
    void streamingDiagnosticsRecordDefaultFallbackWhenLocalModelReturnsEmpty() {
        AtomicInteger modelCalls = new AtomicInteger();
        SupportAiService fallbackService = new SupportAiService((question, projectKnowledge) -> {
            modelCalls.incrementAndGet();
            return Optional.empty();
        });
        StringBuilder streamed = new StringBuilder();

        SupportAiService.AnswerDiagnostics diagnostics =
                fallbackService.answerStreamingWithDiagnostics("我想咨询一个暂未覆盖在常见问题里的特殊场景。", streamed::append);

        assertEquals(SupportAiService.AnswerDiagnostics.SOURCE_DEFAULT, diagnostics.getSource());
        assertEquals(1, modelCalls.get());
        assertTrue(diagnostics.isModelAttempted());
        assertEquals("本地模型未返回可用回答", diagnostics.getFallbackReason());
        assertEquals(diagnostics.getAnswer(), streamed.toString());
        assertTrue(diagnostics.getFirstChunkMillis() >= 0);
        assertTrue(diagnostics.getTotalMillis() >= diagnostics.getFirstChunkMillis());
    }

    @Test
    void streamingDiagnosticsLogsLatencyAndFallbackReason() {
        SupportAiService fallbackService = new SupportAiService((question, projectKnowledge) -> Optional.empty());
        ch.qos.logback.classic.Logger logger = (ch.qos.logback.classic.Logger) LoggerFactory.getLogger(SupportAiService.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        logger.setLevel(Level.INFO);
        try {
            fallbackService.answerStreamingWithDiagnostics("我想咨询一个暂未覆盖在常见问题里的特殊场景。", chunk -> { });
        } finally {
            logger.detachAppender(appender);
        }

        String message = appender.list.stream()
                .map(ILoggingEvent::getFormattedMessage)
                .filter(line -> line.contains("AI客服回复链路耗时"))
                .findFirst()
                .orElse("");

        assertTrue(message.contains("source=default"));
        assertTrue(message.contains("modelAttempted=true"));
        assertTrue(message.contains("fallbackReason=本地模型未返回可用回答"));
        assertTrue(message.contains("firstChunkMs="));
        assertTrue(message.contains("totalMs="));
    }

    @Test
    void prefersLocalModelAnswerWhenAvailable() {
        SupportAiService modelBackedService = new SupportAiService((question, projectKnowledge) -> Optional.of("这是本地大模型根据项目规则给出的回答。"));

        String answer = modelBackedService.answer("我想咨询一个暂未覆盖在常见问题里的特殊场景。");

        assertEquals("这是本地大模型根据项目规则给出的回答。", answer);
    }

    @Test
    void passesProjectKnowledgeToLocalModel() {
        AtomicReference<String> promptRef = new AtomicReference<>();
        SupportAiService modelBackedService = new SupportAiService((question, projectKnowledge) -> {
            promptRef.set(projectKnowledge);
            return Optional.empty();
        });

        modelBackedService.answer("我想咨询一个暂未覆盖在常见问题里的特殊场景。");

        assertTrue(promptRef.get().contains("票夹"));
        assertTrue(promptRef.get().contains("人工客服"));
        assertTrue(promptRef.get().contains("平台规则"));
        assertTrue(promptRef.get().contains("小队抢票"));
        assertTrue(promptRef.get().contains("候补"));
        assertTrue(promptRef.get().contains("通知中心"));
        assertTrue(promptRef.get().contains("订单"));
    }
}
