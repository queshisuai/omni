package com.omni.ticket.config;

import com.omni.common.util.ProjectPathUtil;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class UploadStaticResourceConfig implements WebMvcConfigurer {

    private final String uploadRoot;

    public UploadStaticResourceConfig(@Value("${omni.upload.root:${OMNI_UPLOAD_ROOT:}}") String uploadRoot) {
        this.uploadRoot = uploadRoot;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/uploads/ticket/**")
                .addResourceLocations(ticketUploadLocation(uploadRoot));
    }

    static String ticketUploadLocation(String configuredRoot) {
        return withTrailingSlash(ProjectPathUtil.resolvePublicUploadRoot(configuredRoot).resolve("ticket").normalize().toUri().toString());
    }

    private static String withTrailingSlash(String location) {
        return location.endsWith("/") ? location : location + "/";
    }
}
