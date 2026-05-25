package com.omni.ticket.dto;

import java.nio.file.Path;

public class PrivateAssetDownload {
    private final Path path;
    private final String originalFilename;
    private final String contentType;
    private final long fileSize;

    public PrivateAssetDownload(Path path, String originalFilename, String contentType, long fileSize) {
        this.path = path;
        this.originalFilename = originalFilename;
        this.contentType = contentType;
        this.fileSize = fileSize;
    }

    public Path getPath() { return path; }
    public String getOriginalFilename() { return originalFilename; }
    public String getContentType() { return contentType; }
    public long getFileSize() { return fileSize; }
}
