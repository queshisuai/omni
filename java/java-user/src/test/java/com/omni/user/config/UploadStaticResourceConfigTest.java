package com.omni.user.config;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class UploadStaticResourceConfigTest {

    @Test
    void userUploadResourceLocationEndsWithSlash() throws Exception {
        Path uploadRoot = Files.createTempDirectory("omni-user-upload-root");

        String location = UploadStaticResourceConfig.userUploadLocation(uploadRoot.toString());

        assertTrue(location.endsWith("/"));
        assertTrue(location.replace('\\', '/').contains("/user/"));
    }
}
