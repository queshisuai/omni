package com.omni.user.config;

import com.alibaba.csp.sentinel.slots.block.RuleConstant;
import com.alibaba.csp.sentinel.slots.block.flow.FlowRule;
import com.alibaba.csp.sentinel.slots.block.flow.FlowRuleManager;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Configuration
public class UserSentinelConfig implements InitializingBean {

    public static final String LOGIN_PASSWORD = "user-login-password";
    public static final String SEND_CODE = "user-send-code";

    private final double loginPasswordQps;
    private final double sendCodeQps;

    public UserSentinelConfig(
            @Value("${omni.sentinel.user.login-password.qps:50}") double loginPasswordQps,
            @Value("${omni.sentinel.user.send-code.qps:20}") double sendCodeQps) {
        this.loginPasswordQps = loginPasswordQps;
        this.sendCodeQps = sendCodeQps;
    }

    @Override
    public void afterPropertiesSet() {
        List<FlowRule> rules = new ArrayList<>();
        rules.add(flowRule(LOGIN_PASSWORD, loginPasswordQps));
        rules.add(flowRule(SEND_CODE, sendCodeQps));
        loadFlowRules(rules);
    }

    private void loadFlowRules(List<FlowRule> ownedRules) {
        Set<String> ownedResources = ownedRules.stream()
                .map(FlowRule::getResource)
                .collect(Collectors.toSet());
        List<FlowRule> mergedRules = FlowRuleManager.getRules().stream()
                .filter(rule -> !ownedResources.contains(rule.getResource()))
                .collect(Collectors.toCollection(ArrayList::new));
        mergedRules.addAll(ownedRules);
        FlowRuleManager.loadRules(mergedRules);
    }

    private FlowRule flowRule(String resource, double qps) {
        FlowRule rule = new FlowRule();
        rule.setResource(resource);
        rule.setGrade(RuleConstant.FLOW_GRADE_QPS);
        rule.setCount(qps);
        return rule;
    }
}
