package com.omni.user.config;

import com.alibaba.csp.sentinel.slots.block.RuleConstant;
import com.alibaba.csp.sentinel.slots.block.flow.FlowRule;
import com.alibaba.csp.sentinel.slots.block.flow.FlowRuleManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class UserSentinelConfigTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(UserSentinelConfig.class);

    @AfterEach
    void tearDown() {
        FlowRuleManager.loadRules(java.util.Collections.emptyList());
    }

    @Test
    void defaultsLoginPasswordQpsToFiftyAndSendCodeQpsToTwenty() {
        contextRunner.run(context -> {
            var rules = rulesByResource();

            assertEquals(50, rules.get(UserSentinelConfig.LOGIN_PASSWORD).getCount());
            assertEquals(20, rules.get(UserSentinelConfig.SEND_CODE).getCount());
        });
    }

    @Test
    void propertyOverrideChangesLoginPasswordQps() {
        contextRunner
                .withPropertyValues("omni.sentinel.user.login-password.qps=80")
                .run(context -> {
                    var rules = rulesByResource();

                    assertEquals(80, rules.get(UserSentinelConfig.LOGIN_PASSWORD).getCount());
                    assertEquals(20, rules.get(UserSentinelConfig.SEND_CODE).getCount());
                });
    }

    @Test
    void preservesUnrelatedFlowRules() {
        FlowRule unrelatedRule = new FlowRule();
        unrelatedRule.setResource("unrelated-user-resource");
        unrelatedRule.setGrade(RuleConstant.FLOW_GRADE_QPS);
        unrelatedRule.setCount(9);
        FlowRuleManager.loadRules(java.util.List.of(unrelatedRule));

        contextRunner.run(context -> {
            var rules = rulesByResource();

            assertTrue(rules.containsKey("unrelated-user-resource"));
            assertEquals(9, rules.get("unrelated-user-resource").getCount());
            assertTrue(rules.containsKey(UserSentinelConfig.LOGIN_PASSWORD));
            assertTrue(rules.containsKey(UserSentinelConfig.SEND_CODE));
        });
    }

    private java.util.Map<String, FlowRule> rulesByResource() {
        return FlowRuleManager.getRules().stream()
                .collect(Collectors.toMap(FlowRule::getResource, rule -> rule));
    }
}
