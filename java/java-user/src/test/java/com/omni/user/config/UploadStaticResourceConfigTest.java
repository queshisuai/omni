package com.omni.user.config;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import static org.junit.jupiter.api.Assertions.assertTrue;

class UploadStaticResourceConfigTest {

    @Test
    void userUploadResourceLocationEndsWithSlash() throws Exception {
        Path uploadRoot = Files.createTempDirectory("omni-user-upload-root");

        String location = UploadStaticResourceConfig.userUploadLocation(uploadRoot.toString());

        assertTrue(location.endsWith("/"));
        assertTrue(location.replace('\\', '/').contains("/user/"));
    }

    @Test
    void defaultUserUploadLocationUsesProjectRuntimeUploadsWhenStartedFromServiceDirectory() {
        String previousUserDir = System.getProperty("user.dir");
        Path projectRoot = findProjectRoot(Paths.get(previousUserDir).toAbsolutePath().normalize());
        try {
            System.setProperty("user.dir", projectRoot.resolve("java/java-user").toString());

            String location = UploadStaticResourceConfig.userUploadLocation("").replace('\\', '/');

            assertTrue(location.contains(projectRoot.resolve("runtime/uploads/user").toUri().toString().replace('\\', '/')));
        } finally {
            System.setProperty("user.dir", previousUserDir);
        }
    }

    private Path findProjectRoot(Path start) {
        Path cursor = start;
        while (cursor != null) {
            if (Files.isDirectory(cursor.resolve("java")) && Files.isDirectory(cursor.resolve("frontend"))) {
                return cursor;
            }
            cursor = cursor.getParent();
        }
        throw new IllegalStateException("Cannot find project root from " + start);
    }
}
