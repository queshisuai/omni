package com.omni.user.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;
import java.nio.file.Paths;

@Configuration
public class UploadStaticResourceConfig implements WebMvcConfigurer {

    private final String uploadRoot;

    public UploadStaticResourceConfig(@Value("${omni.upload.root:${OMNI_UPLOAD_ROOT:}}") String uploadRoot) {
        this.uploadRoot = uploadRoot;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/uploads/user/**")
                .addResourceLocations(userUploadLocation(uploadRoot));
    }

    static String userUploadLocation(String configuredRoot) {
        return withTrailingSlash(resolveUploadRoot(configuredRoot).resolve("user").normalize().toUri().toString());
    }

    static Path resolveUploadRoot(String configuredRoot) {
        if (StringUtils.hasText(configuredRoot)) {
            return Paths.get(configuredRoot).toAbsolutePath().normalize();
        }
        return Paths.get(System.getProperty("user.dir"), "..", "runtime", "uploads")
                .toAbsolutePath()
                .normalize();
    }

    private static String withTrailingSlash(String location) {
        return location.endsWith("/") ? location : location + "/";
    }
}
