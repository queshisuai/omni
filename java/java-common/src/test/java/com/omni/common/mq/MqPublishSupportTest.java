package com.omni.common.mq;

import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;

class MqPublishSupportTest {

    @Test
    void runsImmediatelyWhenNoTransactionIsActive() {
        AtomicInteger calls = new AtomicInteger();

        MqPublishSupport.afterCommitOrNow(calls::incrementAndGet);

        assertEquals(1, calls.get());
    }

    @Test
    void defersUntilCommitWhenTransactionIsActive() {
        AtomicInteger calls = new AtomicInteger();
        TransactionSynchronizationManager.initSynchronization();
        TransactionSynchronizationManager.setActualTransactionActive(true);
        try {
            MqPublishSupport.afterCommitOrNow(calls::incrementAndGet);

            assertEquals(0, calls.get());
            TransactionSynchronizationManager.getSynchronizations().forEach(synchronization -> synchronization.afterCommit());
            assertEquals(1, calls.get());
        } finally {
            TransactionSynchronizationManager.setActualTransactionActive(false);
            TransactionSynchronizationManager.clearSynchronization();
        }
    }
}
