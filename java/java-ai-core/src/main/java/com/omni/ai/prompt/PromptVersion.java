package com.omni.ai.prompt;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/** 版本元数据中的摘要对应未渲染模板的原始 UTF-8 内容。 */
public final class PromptVersion {
    private final String templateId;
    private final String version;
    private final String sha256;

    PromptVersion(String templateId, String version, String template) {
        this.templateId = templateId;
        this.version = version;
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(template.getBytes(StandardCharsets.UTF_8));
            StringBuilder hash = new StringBuilder(64);
            for (byte value : digest) {
                hash.append(Character.forDigit((value >>> 4) & 0xf, 16));
                hash.append(Character.forDigit(value & 0xf, 16));
            }
            this.sha256 = hash.toString();
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("当前运行环境不支持模板摘要", exception);
        }
    }

    public String getTemplateId() {
        return templateId;
    }

    public String getVersion() {
        return version;
    }

    public String getSha256() {
        return sha256;
    }
}
