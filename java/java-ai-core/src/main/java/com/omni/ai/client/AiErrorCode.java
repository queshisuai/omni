package com.omni.ai.client;

public enum AiErrorCode {
    INVALID_REQUEST("模型请求参数无效"),
    DISABLED("模型调用未启用"),
    TIMEOUT("模型响应超时，请稍后重试"),
    CANCELLED("模型请求已取消"),
    UNAVAILABLE("模型暂时不可用，请稍后重试"),
    HTTP_ERROR("模型服务请求失败，请稍后重试"),
    JSON_ERROR("模型响应格式无效"),
    SSE_ERROR("模型流式响应异常或中断"),
    EMPTY_RESULT("模型未返回可用内容"),
    CALLBACK_ERROR("模型响应处理失败");

    private final String message;
    AiErrorCode(String message) { this.message = message; }
    public String getMessage() { return message; }
}
