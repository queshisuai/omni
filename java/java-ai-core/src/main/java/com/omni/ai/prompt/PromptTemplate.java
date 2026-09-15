package com.omni.ai.prompt;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** 不可变的版本化模板；变量值作为文本插入，不会再次解释为模板。 */
public final class PromptTemplate {
    private static final Pattern VARIABLE = Pattern.compile("\\$\\{([A-Za-z_][A-Za-z0-9_]*)}");

    private final String template;
    private final Set<String> allowedVariables;
    private final Set<String> requiredVariables;
    private final PromptVersion version;

    public PromptTemplate(String templateId, String version, String template, Set<String> allowedVariables) {
        if (templateId == null || templateId.isBlank() || version == null || version.isBlank()
                || template == null || template.isBlank() || allowedVariables == null) {
            throw new IllegalArgumentException("提示词模板及版本配置不能为空");
        }
        for (String variable : allowedVariables) {
            if (variable == null || !variable.matches("[A-Za-z_][A-Za-z0-9_]*")) {
                throw new IllegalArgumentException("提示词变量名称不合法");
            }
        }
        Matcher matcher = VARIABLE.matcher(template);
        Set<String> required = new HashSet<>();
        while (matcher.find()) {
            if (!allowedVariables.contains(matcher.group(1))) {
                throw new IllegalArgumentException("提示词模板包含未声明的变量");
            }
            required.add(matcher.group(1));
        }
        if (VARIABLE.matcher(template).replaceAll("").contains("${")) {
            throw new IllegalArgumentException("提示词占位符格式不合法");
        }
        this.template = template;
        this.allowedVariables = Set.copyOf(allowedVariables);
        this.requiredVariables = Set.copyOf(required);
        this.version = new PromptVersion(templateId, version, template);
    }

    public static PromptTemplate fromResource(Class<?> anchor, String resourcePath, String templateId,
                                              String version, Set<String> allowedVariables) {
        if (anchor == null || resourcePath == null || resourcePath.isBlank()) {
            throw new IllegalArgumentException("提示词资源配置不能为空");
        }
        try (InputStream input = anchor.getResourceAsStream(resourcePath)) {
            if (input == null) {
                throw new IllegalArgumentException("提示词资源不存在");
            }
            return new PromptTemplate(templateId, version,
                    new String(input.readAllBytes(), StandardCharsets.UTF_8), allowedVariables);
        } catch (IOException exception) {
            throw new IllegalArgumentException("提示词资源读取失败", exception);
        }
    }

    public String render(Map<String, String> variables) {
        if (variables == null || !allowedVariables.containsAll(variables.keySet())
                || !variables.keySet().containsAll(requiredVariables)
                || variables.values().stream().anyMatch(value -> value == null)) {
            throw new IllegalArgumentException("提示词变量缺失或不在允许范围内");
        }
        Matcher matcher = VARIABLE.matcher(template);
        StringBuffer rendered = new StringBuffer();
        while (matcher.find()) {
            matcher.appendReplacement(rendered, Matcher.quoteReplacement(variables.get(matcher.group(1))));
        }
        matcher.appendTail(rendered);
        return rendered.toString();
    }

    public PromptVersion getVersion() {
        return version;
    }
}
