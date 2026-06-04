package com.omni.user.service;

import java.util.Optional;
import java.util.function.Consumer;

@FunctionalInterface
public interface SupportLocalModelClient {

    Optional<String> answer(String question, String projectKnowledge);

    default Optional<String> streamAnswer(String question, String projectKnowledge, Consumer<String> onChunk) {
        Optional<String> answer = answer(question, projectKnowledge);
        if (answer.isPresent() && onChunk != null) {
            onChunk.accept(answer.get());
        }
        return answer;
    }
}
