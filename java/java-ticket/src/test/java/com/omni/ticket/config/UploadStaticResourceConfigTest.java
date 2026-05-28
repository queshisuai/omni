package com.omni.ticket.config;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import static org.junit.jupiter.api.Assertions.assertTrue;

class UploadStaticResourceConfigTest {

    @Test
    void ticketUploadResourceLocationEndsWithSlash() throws Exception {
        Path uploadRoot = Files.createTempDirectory("omni-ticket-upload-root");

        String location = UploadStaticResourceConfig.ticketUploadLocation(uploadRoot.toString());

        assertTrue(location.endsWith("/"));
        assertTrue(location.replace('\\', '/').contains("/ticket/"));
    }

    @Test
    void defaultTicketUploadLocationUsesProjectRuntimeUploadsWhenStartedFromServiceDirectory() {
        String previousUserDir = System.getProperty("user.dir");
        Path projectRoot = findProjectRoot(Paths.get(previousUserDir).toAbsolutePath().normalize());
        try {
            System.setProperty("user.dir", projectRoot.resolve("java/java-ticket").toString());

            String location = UploadStaticResourceConfig.ticketUploadLocation("").replace('\\', '/');

            assertTrue(location.contains(projectRoot.resolve("runtime/uploads/ticket").toUri().toString().replace('\\', '/')));
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
