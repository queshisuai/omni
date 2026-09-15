package com.omni.ai.client;

/** 仅携带安全错误信息，不保留上游响应正文、地址或底层异常。 */
public final class AiModelException extends RuntimeException {
    private final AiErrorCode code;
    private final String requestId;
    private final Integer httpStatus;

    public AiModelException(AiErrorCode code, String requestId) { this(code, requestId, null); }

    public AiModelException(AiErrorCode code, String requestId, Integer httpStatus) {
        super(code.getMessage());
        this.code = code;
        this.requestId = requestId;
        this.httpStatus = httpStatus;
    }

    public AiErrorCode getCode() { return code; }
    public String getRequestId() { return requestId; }
    public Integer getHttpStatus() { return httpStatus; }
}
