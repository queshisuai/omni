package com.omni.user.service;

import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Optional;
import java.util.function.Consumer;

@Service
public class SupportAiService {

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
        Consumer<String> safeConsumer = onChunk == null ? chunk -> { } : onChunk;
        Optional<String> indexedAnswer = SupportKnowledgeBase.answerKnownQuestion(question);
        if (indexedAnswer.isPresent()) {
            String answer = indexedAnswer.get();
            emitInChunks(answer, safeConsumer);
            return answer;
        }

        Optional<String> modelAnswer = localModelClient.streamAnswer(question, PROJECT_KNOWLEDGE, safeConsumer);
        if (modelAnswer.isPresent() && StringUtils.hasText(modelAnswer.get())) {
            return modelAnswer.get().trim();
        }

        String answer = SupportKnowledgeBase.defaultAnswer();
        emitInChunks(answer, safeConsumer);
        return answer;
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
}
