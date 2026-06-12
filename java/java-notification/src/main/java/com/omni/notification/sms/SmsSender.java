package com.omni.notification.sms;

public interface SmsSender {

    SmsSendResult send(SmsSendRequest request);
}
