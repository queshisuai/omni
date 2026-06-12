package com.omni.notification.sms;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SmsSenderConfig {

    @Bean
    @ConditionalOnMissingBean(SmsSender.class)
    @ConditionalOnProperty(name = "omni.notification.sms.enabled", havingValue = "false", matchIfMissing = true)
    public SmsSender disabledSmsSender() {
        return new DisabledSmsSender();
    }
}
