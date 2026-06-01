package com.omni.user.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.user.dto.SupportAccountRequest;
import com.omni.user.dto.SupportAccountResponse;
import com.omni.user.entity.SupportAccount;
import com.omni.user.entity.User;
import com.omni.user.mapper.SupportAccountMapper;
import com.omni.user.mapper.UserMapper;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class SupportAccountService {

    private static final String ROLE_ADMIN = "admin";
    private static final String ROLE_SUPPORT = "support";

    private final UserMapper userMapper;
    private final SupportAccountMapper supportAccountMapper;
    private final PasswordEncoder passwordEncoder;

    public SupportAccountService(UserMapper userMapper,
                                 SupportAccountMapper supportAccountMapper,
                                 PasswordEncoder passwordEncoder) {
        this.userMapper = userMapper;
        this.supportAccountMapper = supportAccountMapper;
        this.passwordEncoder = passwordEncoder;
    }

    public List<SupportAccountResponse> list(Long adminUserId) {
        requireAdmin(adminUserId);
        List<SupportAccount> accounts = supportAccountMapper.selectList(new LambdaQueryWrapper<SupportAccount>()
                .orderByDesc(SupportAccount::getUserId));
        return accounts.stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional
    public SupportAccountResponse create(Long adminUserId, SupportAccountRequest request) {
        requireAdmin(adminUserId);
        if (request == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "客服账号参数不能为空");
        }
        String phone = trimToNull(request.getPhone());
        String nickname = trimToNull(request.getNickname());
        String password = trimToNull(request.getPassword());
        if (phone == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "客服手机号不能为空");
        }
        if (nickname == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "客服昵称不能为空");
        }
        if (password == null || password.length() < 6) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "客服密码长度不能少于6位");
        }
        User exists = userMapper.selectOne(new LambdaQueryWrapper<User>().eq(User::getPhone, phone));
        if (exists != null) {
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
        return toResponse(account);
    }

    @Transactional
    public SupportAccountResponse update(Long adminUserId, Long supportUserId, SupportAccountRequest request) {
        requireAdmin(adminUserId);
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
            throw new BusinessException(ResultCode.BAD_REQUEST, "客服手机号不能为空");
        }
        if (nickname == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "客服昵称不能为空");
        }
        if (!phone.equals(user.getPhone())) {
            User exists = userMapper.selectOne(new LambdaQueryWrapper<User>()
                    .eq(User::getPhone, phone)
                    .ne(User::getId, supportUserId));
            if (exists != null) {
                throw new BusinessException(ResultCode.CONFLICT, "该手机号已存在");
            }
        }
        Integer status = request.getStatus() == null ? account.getStatus() : request.getStatus();
        if (!Integer.valueOf(0).equals(status) && !Integer.valueOf(1).equals(status)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "客服账号状态不正确");
        }
        user.setPhone(phone);
        user.setNickname(nickname);
        user.setStatus(status);
        if (password != null) {
            if (password.length() < 6) {
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
        return toResponse(account);
    }

    @Transactional
    public SupportAccountResponse deactivate(Long adminUserId, Long supportUserId) {
        requireAdmin(adminUserId);
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
        return toResponse(account);
    }

    private void requireAdmin(Long adminUserId) {
        if (adminUserId == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }
        User user = userMapper.selectById(adminUserId);
        if (user == null || !ROLE_ADMIN.equals(user.getRole())) {
            throw new BusinessException(ResultCode.FORBIDDEN, "仅平台管理员可以管理客服账号");
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

    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
