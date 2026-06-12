package com.omni.notification.sms;

public class DisabledSmsSender implements SmsSender {

    @Override
    public SmsSendResult send(SmsSendRequest request) {
        return new SmsSendResult("SKIPPED", null, "短信渠道未配置");
    }
}
