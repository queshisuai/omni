package com.omni.ticket.service;

import com.omni.common.dto.InternalAuthContextResponse;
import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.ticket.client.UserInternalClient;
import com.omni.ticket.dto.InternalUserRefResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class UserAccessService {
    private static final String ROLE_ADMIN = "admin";
    private static final String ROLE_PLATFORM_SUPER_ADMIN = "platform_super_admin";
    private static final String ROLE_ORGANIZER = "organizer";

    private final UserInternalClient userInternalClient;
    private final String internalApiToken;

    public UserAccessService(UserInternalClient userInternalClient,
                             @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
        this.userInternalClient = userInternalClient;
        this.internalApiToken = internalApiToken;
    }

    public InternalUserRefResponse requireUser(Long userId) {
        if (userId == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "用户ID不能为空");
        }
        if (!StringUtils.hasText(internalApiToken)) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "内部接口令牌未配置");
        }
        Result<InternalUserRefResponse> result;
        try {
            result = userInternalClient.getUserRef(userId, internalApiToken);
        } catch (RuntimeException e) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "用户服务无响应");
        }
        if (result == null || result.getCode() != ResultCode.SUCCESS.getCode()) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "用户服务无响应");
        }
        InternalUserRefResponse user = result.getData();
        if (user == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "用户不存在");
        }
        return user;
    }

    public InternalUserRefResponse requireAdmin(Long userId) {
        InternalUserRefResponse user = requireUser(userId);
        if (!isAdmin(user)) {
            throw new BusinessException(ResultCode.FORBIDDEN, "仅平台管理员可操作");
        }
        return user;
    }

    public InternalUserRefResponse requireAdminOrOrganizer(Long userId) {
        InternalUserRefResponse user = requireUser(userId);
        if (!isAdmin(user) && !isOrganizer(user)) {
            throw new BusinessException(ResultCode.FORBIDDEN, "无权限");
        }
        return user;
    }

    public InternalAuthContextResponse requirePermission(Long userId, String permissionCode) {
        InternalAuthContextResponse auth = getAuthContext(userId);
        if (!hasAnyPermission(auth, permissionCode)) {
            throw new BusinessException(ResultCode.FORBIDDEN, "无权限");
        }
        return auth;
    }

    public InternalAuthContextResponse requirePlatformPermission(Long userId, String permissionCode) {
        InternalAuthContextResponse auth = getAuthContext(userId);
        if (!"platform".equals(auth.getScopeType()) || !hasAnyPermission(auth, permissionCode)) {
            throw new BusinessException(ResultCode.FORBIDDEN, "无权限");
        }
        return auth;
    }

    public InternalUserRefResponse requireAdminOrAnyPermission(Long userId, String... permissionCodes) {
        InternalUserRefResponse user = requireUser(userId);
        if (hasAnyPermission(getAuthContext(userId), permissionCodes)) {
            return user;
        }
        throw new BusinessException(ResultCode.FORBIDDEN, "无权限");
    }

    public InternalUserRefResponse requireAdminOrOrganizerOrAnyPermission(Long userId, String... permissionCodes) {
        InternalUserRefResponse user = requireUser(userId);
        if (isOrganizer(user)) {
            return user;
        }
        InternalAuthContextResponse auth = getAuthContext(userId);
        if (permissionCodes != null) {
            for (String permissionCode : permissionCodes) {
                if (hasAnyPermission(auth, permissionCode)) {
                    return user;
                }
            }
        }
        throw new BusinessException(ResultCode.FORBIDDEN, "无权限");
    }

    public InternalAuthContextResponse getAuthContext(Long userId) {
        if (userId == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "用户ID不能为空");
        }
        if (!StringUtils.hasText(internalApiToken)) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "内部接口令牌未配置");
        }
        try {
            Result<InternalAuthContextResponse> result = userInternalClient.getAuthContext(userId, internalApiToken);
            if (result == null || result.getCode() != ResultCode.SUCCESS.getCode() || result.getData() == null) {
                throw new BusinessException(ResultCode.INTERNAL_ERROR, "用户服务无响应");
            }
            return result.getData();
        } catch (BusinessException e) {
            throw e;
        } catch (RuntimeException e) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "用户服务无响应");
        }
    }

    public String requireAdminOrOrganizerRole(Long userId) {
        return requireAdminOrOrganizer(userId).getRole();
    }

    public String requireAdminOrAnyPermissionRole(Long userId, String... permissionCodes) {
        return requireAdminOrAnyPermission(userId, permissionCodes).getRole();
    }

    public String requireAdminOrOrganizerOrAnyPermissionRole(Long userId, String... permissionCodes) {
        return requireAdminOrOrganizerOrAnyPermission(userId, permissionCodes).getRole();
    }

    public boolean isAdmin(InternalUserRefResponse user) {
        return user != null && isAdminRole(user.getRole());
    }

    public boolean isOrganizer(InternalUserRefResponse user) {
        return user != null && isOrganizerRole(user.getRole());
    }

    public boolean isAdminRole(String role) {
        return ROLE_ADMIN.equals(role) || ROLE_PLATFORM_SUPER_ADMIN.equals(role);
    }

    public boolean isOrganizerRole(String role) {
        return ROLE_ORGANIZER.equals(role);
    }

    private boolean hasAnyPermission(InternalAuthContextResponse auth, String... permissionCodes) {
        if (auth == null || auth.getPermissionCodes() == null || permissionCodes == null) {
            return false;
        }
        for (String permissionCode : permissionCodes) {
            if (StringUtils.hasText(permissionCode) && auth.getPermissionCodes().contains(permissionCode)) {
                return true;
            }
        }
        return false;
    }

    public boolean hasAnyPermission(Long userId, String... permissionCodes) {
        return hasAnyPermission(getAuthContext(userId), permissionCodes);
    }

    public boolean hasPlatformPermission(Long userId, String... permissionCodes) {
        InternalAuthContextResponse auth = getAuthContext(userId);
        return "platform".equals(auth.getScopeType()) && hasAnyPermission(auth, permissionCodes);
    }

    private boolean hasPermission(InternalAuthContextResponse auth, String permissionCode) {
        return auth != null
                && auth.getPermissionCodes() != null
                && auth.getPermissionCodes().contains(permissionCode);
    }
}
