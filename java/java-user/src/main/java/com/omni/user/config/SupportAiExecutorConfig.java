package com.omni.user.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

@Configuration
public class SupportAiExecutorConfig {

    @Bean("supportAiExecutor")
    public Executor supportAiExecutor(
            @Value("${omni.support.ai.executor.core-size:${OMNI_SUPPORT_AI_EXECUTOR_CORE_SIZE:2}}") int coreSize,
            @Value("${omni.support.ai.executor.max-size:${OMNI_SUPPORT_AI_EXECUTOR_MAX_SIZE:4}}") int maxSize,
            @Value("${omni.support.ai.executor.queue-capacity:${OMNI_SUPPORT_AI_EXECUTOR_QUEUE_CAPACITY:100}}") int queueCapacity) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(Math.max(1, coreSize));
        executor.setMaxPoolSize(Math.max(Math.max(1, coreSize), maxSize));
        executor.setQueueCapacity(Math.max(1, queueCapacity));
        executor.setThreadNamePrefix("support-ai-");
        executor.initialize();
        return executor;
    }
}
