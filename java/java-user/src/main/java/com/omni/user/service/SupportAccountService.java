package com.omni.user.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.dto.InternalAuthContextResponse;
import com.omni.common.dto.OperationAuditWriteRequest;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.user.dto.SupportAccountRequest;
import com.omni.user.dto.SupportAccountResponse;
import com.omni.user.entity.SupportAccount;
import com.omni.user.entity.User;
import com.omni.user.mapper.SupportAccountMapper;
import com.omni.user.mapper.UserMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class SupportAccountService {

    private static final Logger log = LoggerFactory.getLogger(SupportAccountService.class);
    private static final String ROLE_SUPPORT = "support";

    private final UserMapper userMapper;
    private final SupportAccountMapper supportAccountMapper;
    private final PasswordEncoder passwordEncoder;
    private final RbacService rbacService;
    private final OperationAuditService auditService;

    public SupportAccountService(UserMapper userMapper,
                                 SupportAccountMapper supportAccountMapper,
                                 PasswordEncoder passwordEncoder,
                                 RbacService rbacService,
                                 OperationAuditService auditService) {
        this.userMapper = userMapper;
        this.supportAccountMapper = supportAccountMapper;
        this.passwordEncoder = passwordEncoder;
        this.rbacService = rbacService;
        this.auditService = auditService;
    }

    public List<SupportAccountResponse> list(Long operatorId) {
        requirePermission(operatorId, "support.account.manage");
        List<SupportAccount> accounts = supportAccountMapper.selectList(new LambdaQueryWrapper<SupportAccount>()
                .orderByDesc(SupportAccount::getUserId));
        return accounts.stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional
    public SupportAccountResponse create(Long operatorId, SupportAccountRequest request) {
        requirePermission(operatorId, "support.account.manage");
        if (request == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "客服账号参数不能为空");
        }
        String phone = trimToNull(request.getPhone());
        String nickname = trimToNull(request.getNickname());
        String password = trimToNull(request.getPassword());
        if (phone == null) {
            auditWrite(operatorId, "support.account.create", "phone", null, "客服手机号不能为空", false);
            throw new BusinessException(ResultCode.BAD_REQUEST, "客服手机号不能为空");
        }
        if (nickname == null) {
            auditWrite(operatorId, "support.account.create", "phone", phone, "客服昵称不能为空", false);
            throw new BusinessException(ResultCode.BAD_REQUEST, "客服昵称不能为空");
        }
        if (password == null || password.length() < 6) {
            auditWrite(operatorId, "support.account.create", "phone", phone, "密码长度不足", false);
            throw new BusinessException(ResultCode.BAD_REQUEST, "客服密码长度不能少于6位");
        }
        User exists = userMapper.selectOne(new LambdaQueryWrapper<User>().eq(User::getPhone, phone));
        if (exists != null) {
            auditWrite(operatorId, "support.account.create", "phone", phone, "手机号已存在", false);
            throw new BusinessException(ResultCode.CONFLICT, "该手机号已存在");
        }
        User user = new User();
        user.setPhone(phone);
        user.setNickname(nickname);
        user.setPassword(passwordEncoder.encode(password));
        user.setRole(ROLE_SUPPORT);
        user.setStatus(1);
        userMapper.insert(user);
        SupportAccount account = new SupportAccount();
        account.setUserId(user.getId());
        account.setPhone(phone);
        account.setNickname(nickname);
        account.setStatus(1);
        supportAccountMapper.insert(account);
        auditWrite(operatorId, "support.account.create", Long.toString(user.getId()), phone, "创建成功", true);
        return toResponse(account);
    }

    @Transactional
    public SupportAccountResponse update(Long operatorId, Long supportUserId, SupportAccountRequest request) {
        requirePermission(operatorId, "support.account.manage");
        if (supportUserId == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "客服账号ID不能为空");
        }
        if (request == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "客服账号参数不能为空");
        }
        User user = requireSupportUser(supportUserId);
        SupportAccount account = requireSupportAccount(supportUserId);
        String phone = trimToNull(request.getPhone());
        String nickname = trimToNull(request.getNickname());
        String password = trimToNull(request.getPassword());
        if (phone == null) {
            auditWrite(operatorId, "support.account.update", Long.toString(supportUserId), null, "手机号不能为空", false);
            throw new BusinessException(ResultCode.BAD_REQUEST, "客服手机号不能为空");
        }
        if (nickname == null) {
            auditWrite(operatorId, "support.account.update", Long.toString(supportUserId), phone, "昵称不能为空", false);
            throw new BusinessException(ResultCode.BAD_REQUEST, "客服昵称不能为空");
        }
        if (!phone.equals(user.getPhone())) {
            User exists = userMapper.selectOne(new LambdaQueryWrapper<User>()
                    .eq(User::getPhone, phone)
                    .ne(User::getId, supportUserId));
            if (exists != null) {
                auditWrite(operatorId, "support.account.update", Long.toString(supportUserId), phone, "手机号已被使用", false);
                throw new BusinessException(ResultCode.CONFLICT, "该手机号已存在");
            }
        }
        Integer status = request.getStatus() == null ? account.getStatus() : request.getStatus();
        if (!Integer.valueOf(0).equals(status) && !Integer.valueOf(1).equals(status)) {
            auditWrite(operatorId, "support.account.update", Long.toString(supportUserId), phone, "无效状态值", false);
            throw new BusinessException(ResultCode.BAD_REQUEST, "客服账号状态不正确");
        }
        user.setPhone(phone);
        user.setNickname(nickname);
        user.setStatus(status);
        if (password != null) {
            if (password.length() < 6) {
                auditWrite(operatorId, "support.account.update", Long.toString(supportUserId), phone, "密码长度不足", false);
                throw new BusinessException(ResultCode.BAD_REQUEST, "客服密码长度不能少于6位");
            }
            user.setPassword(passwordEncoder.encode(password));
        }
        account.setPhone(phone);
        account.setNickname(nickname);
        account.setStatus(status);
        account.setUpdateTime(LocalDateTime.now());
        userMapper.updateById(user);
        supportAccountMapper.updateById(account);
        auditWrite(operatorId, "support.account.update", Long.toString(supportUserId), phone, "更新成功", true);
        return toResponse(account);
    }

    @Transactional
    public SupportAccountResponse deactivate(Long operatorId, Long supportUserId) {
        requirePermission(operatorId, "support.account.manage");
        if (supportUserId == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "客服账号ID不能为空");
        }
        User user = requireSupportUser(supportUserId);
        SupportAccount account = requireSupportAccount(supportUserId);
        user.setStatus(0);
        account.setStatus(0);
        account.setUpdateTime(LocalDateTime.now());
        userMapper.updateById(user);
        supportAccountMapper.updateById(account);
        auditWrite(operatorId, "support.account.deactivate", Long.toString(supportUserId),
                account.getPhone(), "停用成功", true);
        return toResponse(account);
    }

    private void requirePermission(Long operatorId, String permissionCode) {
        if (operatorId == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }
        InternalAuthContextResponse auth = rbacService.getInternalAuthContext(operatorId);
        if (!auth.getPermissionCodes().contains(permissionCode)) {
            throw new BusinessException(ResultCode.FORBIDDEN, "无权限");
        }
    }

    private User requireSupportUser(Long supportUserId) {
        User user = userMapper.selectById(supportUserId);
        if (user == null || !ROLE_SUPPORT.equals(user.getRole())) {
            throw new BusinessException(ResultCode.NOT_FOUND, "客服账号不存在");
        }
        return user;
    }

    private SupportAccount requireSupportAccount(Long supportUserId) {
        SupportAccount account = supportAccountMapper.selectById(supportUserId);
        if (account == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "客服账号不存在");
        }
        return account;
    }

    private SupportAccountResponse toResponse(SupportAccount account) {
        SupportAccountResponse response = new SupportAccountResponse();
        response.setId(account.getUserId());
        response.setPhone(account.getPhone());
        response.setNickname(account.getNickname());
        response.setRole(ROLE_SUPPORT);
        response.setStatus(account.getStatus());
        response.setCreateTime(account.getCreateTime());
        response.setUpdateTime(account.getUpdateTime());
        return response;
    }

    private void auditWrite(Long operatorId, String action, String targetRef, String detail, String reason, boolean success) {
        try {
            OperationAuditWriteRequest req = new OperationAuditWriteRequest();
            req.setOperatorId(operatorId);
            req.setAction(action);
            req.setTargetType("support_account");
            req.setTargetRef(targetRef);
            req.setReason(reason);
            req.setSuccess(success);
            if (!success) {
                req.setErrorMessage(detail);
            }
            auditService.write(req);
        } catch (Exception e) {
            log.warn("Failed to write audit log for action={}: {}", action, e.getMessage());
        }
    }

    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
