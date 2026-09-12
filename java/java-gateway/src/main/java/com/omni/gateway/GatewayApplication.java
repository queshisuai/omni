package com.omni.gateway;

import com.omni.common.util.LocalProdSplitDefaults;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

@SpringBootApplication(scanBasePackages = "com.omni.gateway")
@EnableDiscoveryClient
public class GatewayApplication {
    public static void main(String[] args) {
        SpringApplication application = new SpringApplication(GatewayApplication.class);
        LocalProdSplitDefaults.apply(application, "java-gateway", args);
        application.run(args);
    }
}
