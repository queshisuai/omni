package com.omni.payment.config;

import com.alibaba.csp.sentinel.slots.block.RuleConstant;
import com.alibaba.csp.sentinel.slots.block.degrade.DegradeRule;
import com.alibaba.csp.sentinel.slots.block.degrade.DegradeRuleManager;
import com.alibaba.csp.sentinel.slots.block.flow.FlowRule;
import com.alibaba.csp.sentinel.slots.block.flow.FlowRuleManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PaymentSentinelConfigTest {

    @BeforeEach
    void setUp() {
        clearRules();
    }

    @AfterEach
    void tearDown() {
        clearRules();
    }

    @Test
    void afterPropertiesSetMergesFlowRulesWithoutDroppingUnrelatedResources() throws Exception {
        FlowRule unrelatedRule = new FlowRule();
        unrelatedRule.setResource("unrelated-flow");
        unrelatedRule.setGrade(RuleConstant.FLOW_GRADE_QPS);
        unrelatedRule.setCount(10);
        FlowRuleManager.loadRules(List.of(unrelatedRule));

        new PaymentSentinelConfig(60, 100, 30).afterPropertiesSet();

        Map<String, FlowRule> rules = FlowRuleManager.getRules().stream()
                .collect(Collectors.toMap(FlowRule::getResource, Function.identity()));
        assertTrue(rules.containsKey("unrelated-flow"));
        assertEquals(60, rules.get(PaymentSentinelConfig.ALIPAY_SYNC).getCount());
        assertEquals(100, rules.get(PaymentSentinelConfig.ALIPAY_NOTIFY).getCount());
        assertEquals(30, rules.get(PaymentSentinelConfig.REFUND_APPLY).getCount());
    }

    @Test
    void afterPropertiesSetMergesDegradeRulesWithoutDroppingUnrelatedResources() throws Exception {
        DegradeRule unrelatedRule = new DegradeRule();
        unrelatedRule.setResource("unrelated-degrade");
        unrelatedRule.setGrade(RuleConstant.DEGRADE_GRADE_EXCEPTION_RATIO);
        unrelatedRule.setCount(0.5);
        unrelatedRule.setMinRequestAmount(5);
        unrelatedRule.setTimeWindow(10);
        DegradeRuleManager.loadRules(List.of(unrelatedRule));

        new PaymentSentinelConfig(60, 100, 30).afterPropertiesSet();

        Set<String> resources = DegradeRuleManager.getRules().stream()
                .map(DegradeRule::getResource)
                .collect(Collectors.toSet());
        assertTrue(resources.contains("unrelated-degrade"));
        assertTrue(resources.contains(PaymentSentinelConfig.ORDER_CLIENT));
        assertTrue(resources.contains(PaymentSentinelConfig.ALIPAY_CHANNEL));
    }

    private void clearRules() {
        FlowRuleManager.loadRules(List.of());
        DegradeRuleManager.loadRules(List.of());
    }
}
