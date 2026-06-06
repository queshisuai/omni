package com.omni.order.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.omni.order.entity.CheckInDevice;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface CheckInDeviceMapper extends BaseMapper<CheckInDevice> {

    @Select("SELECT * FROM check_in_device WHERE device_code = #{deviceCode}")
    CheckInDevice selectByDeviceCode(@Param("deviceCode") String deviceCode);
}
