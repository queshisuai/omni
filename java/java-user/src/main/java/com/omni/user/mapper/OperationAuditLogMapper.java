package com.omni.user.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.omni.user.entity.OperationAuditLog;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface OperationAuditLogMapper extends BaseMapper<OperationAuditLog> {
}
