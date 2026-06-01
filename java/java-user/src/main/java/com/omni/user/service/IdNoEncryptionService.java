package com.omni.user.service;

import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;

@Service
public class IdNoEncryptionService {
    private static final String VERSION = "v1";
    private static final String ALGORITHM = "AES";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_TAG_BITS = 128;
    private static final int IV_BYTES = 12;

    private final SecretKeySpec secretKey;
    private final SecureRandom secureRandom = new SecureRandom();

    public IdNoEncryptionService(@Value("${omni.privacy.id-no-key:${OMNI_ID_NO_KEY:}}") String keyMaterial) {
        this.secretKey = new SecretKeySpec(deriveKey(keyMaterial), ALGORITHM);
    }

    public String encrypt(String idType, String idNo) {
        if (!StringUtils.hasText(idNo)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "请填写证件号");
        }
        try {
            byte[] iv = new byte[IV_BYTES];
            secureRandom.nextBytes(iv);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_BITS, iv));
            if (StringUtils.hasText(idType)) {
                cipher.updateAAD(idType.getBytes(StandardCharsets.UTF_8));
            }
            byte[] encrypted = cipher.doFinal(idNo.getBytes(StandardCharsets.UTF_8));
            Base64.Encoder encoder = Base64.getUrlEncoder().withoutPadding();
            return VERSION + ":" + encoder.encodeToString(iv) + ":" + encoder.encodeToString(encrypted);
        } catch (GeneralSecurityException e) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "证件信息处理失败");
        }
    }

    private byte[] deriveKey(String keyMaterial) {
        if (!StringUtils.hasText(keyMaterial)) {
            throw new IllegalStateException("证件号加密密钥未配置");
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return digest.digest(keyMaterial.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("证件号加密算法不可用", e);
        }
    }
}
