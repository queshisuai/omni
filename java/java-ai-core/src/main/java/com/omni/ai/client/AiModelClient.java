package com.omni.ai.client;

import com.omni.ai.dto.AiRequest;
import com.omni.ai.dto.AiResponse;
import com.omni.ai.dto.AiStreamChunk;
import java.util.function.Consumer;

/** 同步执行，由调用方选择执行器；取消信号可由其他线程触发。 */
public interface AiModelClient {
    default AiResponse generate(AiRequest request) { return generate(request, new AiCancellationToken()); }
    AiResponse generate(AiRequest request, AiCancellationToken cancellation);

    default AiResponse stream(AiRequest request, Consumer<AiStreamChunk> onChunk) {
        return stream(request, onChunk, new AiCancellationToken());
    }
    /** 最后一个块携带 finishReason/usage，失败抛出统一异常，不自动重试已输出的内容。 */
    AiResponse stream(AiRequest request, Consumer<AiStreamChunk> onChunk, AiCancellationToken cancellation);
}
