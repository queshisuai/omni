package com.omni.order.config;

import com.alibaba.csp.sentinel.slots.block.RuleConstant;
import com.alibaba.csp.sentinel.slots.block.degrade.DegradeRule;
import com.alibaba.csp.sentinel.slots.block.degrade.DegradeRuleManager;
import com.alibaba.csp.sentinel.slots.block.flow.FlowRule;
import com.alibaba.csp.sentinel.slots.block.flow.FlowRuleManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertTrue;

class OrderSentinelConfigTest {

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

        new OrderSentinelConfig(80, 80, 80).afterPropertiesSet();

        Set<String> resources = FlowRuleManager.getRules().stream()
                .map(FlowRule::getResource)
                .collect(Collectors.toSet());
        assertTrue(resources.contains("unrelated-flow"));
        assertTrue(resources.contains(OrderSentinelConfig.INTERNAL_CREATE_ORDER_RESOURCE));
        assertTrue(resources.contains(OrderSentinelConfig.INTERNAL_CREATE_ORDER_WITH_SEATS_RESOURCE));
        assertTrue(resources.contains(OrderSentinelConfig.INTERNAL_MARK_PAID_RESOURCE));
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

        new OrderSentinelConfig(80, 80, 80).afterPropertiesSet();

        Set<String> resources = DegradeRuleManager.getRules().stream()
                .map(DegradeRule::getResource)
                .collect(Collectors.toSet());
        assertTrue(resources.contains("unrelated-degrade"));
        assertTrue(resources.contains(OrderSentinelConfig.USER_VALIDATE_RESOURCE));
        assertTrue(resources.contains(OrderSentinelConfig.TICKET_SALES_RESOURCE));
    }

    private void clearRules() {
        FlowRuleManager.loadRules(List.of());
        DegradeRuleManager.loadRules(List.of());
    }
}
