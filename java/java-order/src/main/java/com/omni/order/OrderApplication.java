package com.omni.order;

import com.omni.common.util.LocalProdSplitDefaults;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication(scanBasePackages = "com.omni")
@EnableDiscoveryClient
@EnableScheduling
public class OrderApplication {
    public static void main(String[] args) {
        SpringApplication application = new SpringApplication(OrderApplication.class);
        LocalProdSplitDefaults.apply(application, "java-order", args);
        application.run(args);
    }
}
