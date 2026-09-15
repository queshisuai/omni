package com.omni.ai.prompt;

import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class PromptTemplateTest {
    @Test
    void rendersOnlyOriginalPlaceholdersWithoutExpandingInput() {
        PromptTemplate template = new PromptTemplate("support", "v1", "你好 ${name}，${name}，${topic}", Set.of("name", "topic"));
        assertEquals("你好 ${topic}，${topic}，$\\退款", template.render(Map.of("name", "${topic}", "topic", "$\\退款")));
    }

    @Test
    void rejectsUndeclaredTemplateVariablesAndUnexpectedInput() {
        assertThrows(IllegalArgumentException.class,
                () -> new PromptTemplate("support", "v1", "${password}", Set.of("name")));
        PromptTemplate template = new PromptTemplate("support", "v1", "${name}", Set.of("name"));
        assertThrows(IllegalArgumentException.class, () -> template.render(Map.of("name", "客户", "password", "secret")));
        assertThrows(IllegalArgumentException.class, () -> template.render(Map.of()));
        Map<String, String> nullable = new HashMap<>();
        nullable.put("name", null);
        assertThrows(IllegalArgumentException.class, () -> template.render(nullable));
    }

    @Test
    void readsUtf8ResourceWithoutChangingWhitespace() {
        PromptTemplate template = PromptTemplate.fromResource(getClass(), "/prompts/test-v1.txt", "resource", "v1", Set.of("name"));
        assertEquals("你好，客户。\n保持换行。\n", template.render(Map.of("name", "客户")));
        assertThrows(IllegalArgumentException.class,
                () -> PromptTemplate.fromResource(getClass(), "/missing.txt", "resource", "v1", Set.of()));
    }

    @Test
    void rejectsMalformedPlaceholdersAndInvalidIdentity() {
        assertThrows(IllegalArgumentException.class, () -> new PromptTemplate("", "v1", "模板", Set.of()));
        assertThrows(IllegalArgumentException.class, () -> new PromptTemplate("support", " ", "模板", Set.of()));
        assertThrows(IllegalArgumentException.class, () -> new PromptTemplate("support", "v1", "${missing", Set.of()));
    }
}
