package com.omni.user.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Optional;
import java.util.function.Consumer;

@Service
public class SupportAiService {

    private static final Logger log = LoggerFactory.getLogger(SupportAiService.class);
    private static final String PROJECT_KNOWLEDGE = SupportKnowledgeBase.projectKnowledge();

    private final SupportLocalModelClient localModelClient;

    public SupportAiService(SupportLocalModelClient localModelClient) {
        this.localModelClient = localModelClient;
    }

    public String answer(String question) {
        Optional<String> indexedAnswer = SupportKnowledgeBase.answerKnownQuestion(question);
        if (indexedAnswer.isPresent()) {
            return indexedAnswer.get();
        }

        Optional<String> modelAnswer = localModelClient.answer(question, PROJECT_KNOWLEDGE);
        if (modelAnswer.isPresent() && StringUtils.hasText(modelAnswer.get())) {
            return modelAnswer.get().trim();
        }
        return SupportKnowledgeBase.defaultAnswer();
    }

    public String answerStreaming(String question, Consumer<String> onChunk) {
        return answerStreamingWithDiagnostics(question, onChunk).getAnswer();
    }

    public AnswerDiagnostics answerStreamingWithDiagnostics(String question, Consumer<String> onChunk) {
        long startedAt = System.nanoTime();
        FirstChunkRecorder firstChunkRecorder = new FirstChunkRecorder(onChunk, startedAt);
        Consumer<String> safeConsumer = firstChunkRecorder::accept;
        Optional<String> indexedAnswer = SupportKnowledgeBase.answerKnownQuestion(question);
        if (indexedAnswer.isPresent()) {
            String answer = indexedAnswer.get();
            emitInChunks(answer, safeConsumer);
            return logAndReturn(AnswerDiagnostics.faq(answer, firstChunkRecorder.firstChunkMillis(), elapsedMillis(startedAt)));
        }

        Optional<String> modelAnswer = localModelClient.streamAnswer(question, PROJECT_KNOWLEDGE, safeConsumer);
        if (modelAnswer.isPresent() && StringUtils.hasText(modelAnswer.get())) {
            return logAndReturn(AnswerDiagnostics.localModel(
                    modelAnswer.get().trim(),
                    firstChunkRecorder.firstChunkMillis(),
                    elapsedMillis(startedAt)
            ));
        }

        String answer = SupportKnowledgeBase.defaultAnswer();
        emitInChunks(answer, safeConsumer);
        return logAndReturn(AnswerDiagnostics.defaultFallback(
                answer,
                firstChunkRecorder.firstChunkMillis(),
                elapsedMillis(startedAt),
                "本地模型未返回可用回答"
        ));
    }

    private void emitInChunks(String answer, Consumer<String> onChunk) {
        if (!StringUtils.hasText(answer) || onChunk == null) {
            return;
        }
        int chunkSize = 8;
        for (int start = 0; start < answer.length(); start += chunkSize) {
            int end = Math.min(answer.length(), start + chunkSize);
            onChunk.accept(answer.substring(start, end));
        }
    }

    private long elapsedMillis(long startedAt) {
        return Math.max(0L, (System.nanoTime() - startedAt) / 1_000_000L);
    }

    private AnswerDiagnostics logAndReturn(AnswerDiagnostics diagnostics) {
        log.info("AI客服回复链路耗时: source={} modelAttempted={} fallbackReason={} firstChunkMs={} totalMs={}",
                diagnostics.getSource(),
                diagnostics.isModelAttempted(),
                diagnostics.getFallbackReason(),
                diagnostics.getFirstChunkMillis(),
                diagnostics.getTotalMillis());
        return diagnostics;
    }

    private static class FirstChunkRecorder {
        private final Consumer<String> delegate;
        private final long startedAt;
        private Long firstChunkMillis;

        private FirstChunkRecorder(Consumer<String> delegate, long startedAt) {
            this.delegate = delegate == null ? chunk -> { } : delegate;
            this.startedAt = startedAt;
        }

        private void accept(String chunk) {
            if (StringUtils.hasText(chunk) && firstChunkMillis == null) {
                firstChunkMillis = Math.max(0L, (System.nanoTime() - startedAt) / 1_000_000L);
            }
            delegate.accept(chunk);
        }

        private long firstChunkMillis() {
            return firstChunkMillis == null ? 0L : firstChunkMillis;
        }
    }

    public static class AnswerDiagnostics {
        public static final String SOURCE_FAQ = "faq";
        public static final String SOURCE_LOCAL_MODEL = "local-model";
        public static final String SOURCE_DEFAULT = "default";

        private final String answer;
        private final String source;
        private final boolean modelAttempted;
        private final String fallbackReason;
        private final long firstChunkMillis;
        private final long totalMillis;

        private AnswerDiagnostics(String answer,
                                  String source,
                                  boolean modelAttempted,
                                  String fallbackReason,
                                  long firstChunkMillis,
                                  long totalMillis) {
            this.answer = answer;
            this.source = source;
            this.modelAttempted = modelAttempted;
            this.fallbackReason = fallbackReason == null ? "" : fallbackReason;
            this.firstChunkMillis = Math.max(0L, firstChunkMillis);
            this.totalMillis = Math.max(this.firstChunkMillis, totalMillis);
        }

        private static AnswerDiagnostics faq(String answer, long firstChunkMillis, long totalMillis) {
            return new AnswerDiagnostics(answer, SOURCE_FAQ, false, "", firstChunkMillis, totalMillis);
        }

        private static AnswerDiagnostics localModel(String answer, long firstChunkMillis, long totalMillis) {
            return new AnswerDiagnostics(answer, SOURCE_LOCAL_MODEL, true, "", firstChunkMillis, totalMillis);
        }

        private static AnswerDiagnostics defaultFallback(String answer, long firstChunkMillis, long totalMillis, String fallbackReason) {
            return new AnswerDiagnostics(answer, SOURCE_DEFAULT, true, fallbackReason, firstChunkMillis, totalMillis);
        }

        public String getAnswer() {
            return answer;
        }

        public String getSource() {
            return source;
        }

        public boolean isModelAttempted() {
            return modelAttempted;
        }

        public String getFallbackReason() {
            return fallbackReason;
        }

        public long getFirstChunkMillis() {
            return firstChunkMillis;
        }

        public long getTotalMillis() {
            return totalMillis;
        }
    }
}
