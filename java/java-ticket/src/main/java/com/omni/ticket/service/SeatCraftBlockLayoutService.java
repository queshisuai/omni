package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.SeatCraftBlockDtos;
import com.omni.ticket.entity.SeatBlock;
import com.omni.ticket.entity.SeatOverride;
import com.omni.ticket.entity.TicketGroup;
import com.omni.ticket.mapper.SeatBlockMapper;
import com.omni.ticket.mapper.SeatOverrideMapper;
import com.omni.ticket.mapper.TicketGroupMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class SeatCraftBlockLayoutService {
    private final SeatBlockMapper seatBlockMapper;
    private final SeatOverrideMapper seatOverrideMapper;
    private final TicketGroupMapper ticketGroupMapper;

    public SeatCraftBlockLayoutService(SeatBlockMapper seatBlockMapper,
                                       SeatOverrideMapper seatOverrideMapper,
                                       TicketGroupMapper ticketGroupMapper) {
        this.seatBlockMapper = seatBlockMapper;
        this.seatOverrideMapper = seatOverrideMapper;
        this.ticketGroupMapper = ticketGroupMapper;
    }

    @Transactional
    public void replaceLayout(String ownerType, Long ownerId, SeatCraftBlockDtos.LayoutRequest layout) {
        validateOwner(ownerType, ownerId);
        validateLayout(layout);
        LocalDateTime now = LocalDateTime.now();
        disableExisting(ownerType, ownerId, now);
        Map<String, Long> blockIds = insertBlocks(ownerType, ownerId, layout.getBlocks(), now);
        insertOverrides(layout.getOverrides(), blockIds, now);
        insertTicketGroups(ownerType, ownerId, layout.getTicketGroups(), now);
    }

    public SeatCraftBlockDtos.LayoutRequest getLayout(String ownerType, Long ownerId) {
        validateOwner(ownerType, ownerId);
        List<SeatBlock> blocks = seatBlockMapper.selectList(new LambdaQueryWrapper<SeatBlock>()
                .eq(SeatBlock::getOwnerType, ownerType)
                .eq(SeatBlock::getOwnerId, ownerId)
                .eq(SeatBlock::getStatus, 1)
                .orderByAsc(SeatBlock::getSort));
        if (blocks == null || blocks.isEmpty()) {
            return null;
        }
        List<Long> blockIds = blocks.stream().map(SeatBlock::getId).collect(Collectors.toList());
        List<SeatOverride> overrides = seatOverrideMapper.selectList(new LambdaQueryWrapper<SeatOverride>()
                .in(SeatOverride::getBlockId, blockIds));
        List<TicketGroup> groups = ticketGroupMapper.selectList(new LambdaQueryWrapper<TicketGroup>()
                .eq(TicketGroup::getOwnerType, ownerType)
                .eq(TicketGroup::getOwnerId, ownerId)
                .eq(TicketGroup::getStatus, 1)
                .orderByAsc(TicketGroup::getSort));

        Map<Long, String> blockKeys = blocks.stream().collect(Collectors.toMap(SeatBlock::getId, SeatBlock::getBlockKey));
        SeatCraftBlockDtos.LayoutRequest layout = new SeatCraftBlockDtos.LayoutRequest();
        layout.setBlocks(blocks.stream().map(this::toBlockRequest).collect(Collectors.toList()));
        layout.setOverrides(overrides == null ? Collections.emptyList() : overrides.stream()
                .map(override -> toOverrideRequest(override, blockKeys.get(override.getBlockId())))
                .filter(override -> override.getBlockKey() != null)
                .collect(Collectors.toList()));
        layout.setTicketGroups(groups == null ? Collections.emptyList() : groups.stream().map(this::toTicketGroupRequest).collect(Collectors.toList()));
        return layout;
    }

    private void disableExisting(String ownerType, Long ownerId, LocalDateTime now) {
        List<SeatBlock> blocks = seatBlockMapper.selectList(new LambdaQueryWrapper<SeatBlock>()
                .eq(SeatBlock::getOwnerType, ownerType)
                .eq(SeatBlock::getOwnerId, ownerId)
                .eq(SeatBlock::getStatus, 1));
        for (SeatBlock block : blocks) {
            block.setStatus(0);
            block.setUpdateTime(now);
            seatBlockMapper.updateById(block);
        }

        List<TicketGroup> groups = ticketGroupMapper.selectList(new LambdaQueryWrapper<TicketGroup>()
                .eq(TicketGroup::getOwnerType, ownerType)
                .eq(TicketGroup::getOwnerId, ownerId)
                .eq(TicketGroup::getStatus, 1));
        for (TicketGroup group : groups) {
            group.setStatus(0);
            group.setUpdateTime(now);
            ticketGroupMapper.updateById(group);
        }
    }

    private Map<String, Long> insertBlocks(String ownerType, Long ownerId, List<SeatCraftBlockDtos.BlockRequest> blocks, LocalDateTime now) {
        Map<String, Long> ids = new HashMap<>();
        for (int i = 0; i < blocks.size(); i++) {
            SeatCraftBlockDtos.BlockRequest request = blocks.get(i);
            SeatBlock block = new SeatBlock();
            block.setOwnerType(ownerType);
            block.setOwnerId(ownerId);
            block.setBlockKey(trim(request.getBlockKey()));
            block.setName(defaultText(request.getName(), block.getBlockKey()));
            block.setBlockType(trim(request.getBlockType()));
            block.setTicketGroupKey(trim(request.getTicketGroupKey()));
            block.setX(defaultDecimal(request.getX(), BigDecimal.ZERO));
            block.setY(defaultDecimal(request.getY(), BigDecimal.ZERO));
            block.setRotation(defaultDecimal(request.getRotation(), BigDecimal.ZERO));
            block.setScale(defaultDecimal(request.getScale(), BigDecimal.ONE));
            block.setRows(request.getRows());
            block.setCols(request.getCols());
            block.setSeatsPerRow(request.getSeatsPerRow());
            block.setRowSpacing(request.getRowSpacing());
            block.setSeatSpacing(request.getSeatSpacing());
            block.setInnerRadius(request.getInnerRadius());
            block.setArcStartAngle(request.getArcStartAngle());
            block.setArcEndAngle(request.getArcEndAngle());
            block.setWidth(request.getWidth());
            block.setHeight(request.getHeight());
            block.setCapacity(request.getCapacity());
            block.setColor(defaultText(request.getColor(), "#ff1268"));
            block.setSort(request.getSort() != null ? request.getSort() : i);
            block.setStatus(1);
            block.setCreateTime(now);
            block.setUpdateTime(now);
            seatBlockMapper.insert(block);
            ids.put(block.getBlockKey(), block.getId());
        }
        return ids;
    }

    private void insertOverrides(List<SeatCraftBlockDtos.OverrideRequest> overrides, Map<String, Long> blockIds, LocalDateTime now) {
        if (overrides == null) {
            return;
        }
        for (SeatCraftBlockDtos.OverrideRequest request : overrides) {
            Long blockId = blockIds.get(trim(request.getBlockKey()));
            if (blockId == null) {
                throw new BusinessException(400, "座位微调必须绑定有效座位块");
            }
            SeatOverride override = new SeatOverride();
            override.setBlockId(blockId);
            override.setRowNo(request.getRowNo());
            override.setSeatNo(request.getSeatNo());
            override.setStatus(defaultText(request.getStatus(), "visible"));
            override.setDx(defaultDecimal(request.getDx(), BigDecimal.ZERO));
            override.setDy(defaultDecimal(request.getDy(), BigDecimal.ZERO));
            override.setCustomLabel(trim(request.getCustomLabel()));
            override.setCreateTime(now);
            override.setUpdateTime(now);
            seatOverrideMapper.insert(override);
        }
    }

    private void insertTicketGroups(String ownerType, Long ownerId, List<SeatCraftBlockDtos.TicketGroupRequest> groups, LocalDateTime now) {
        for (int i = 0; i < groups.size(); i++) {
            SeatCraftBlockDtos.TicketGroupRequest request = groups.get(i);
            TicketGroup group = new TicketGroup();
            group.setOwnerType(ownerType);
            group.setOwnerId(ownerId);
            group.setGroupKey(trim(request.getGroupKey()));
            group.setName(defaultText(request.getName(), group.getGroupKey()));
            group.setDefaultPrice(request.getDefaultPrice());
            group.setActivityPrice(request.getActivityPrice());
            group.setSourceBlockIds(String.join(",", request.getSourceBlockKeys()));
            group.setSort(request.getSort() != null ? request.getSort() : i);
            group.setStatus(1);
            group.setCreateTime(now);
            group.setUpdateTime(now);
            ticketGroupMapper.insert(group);
        }
    }

    private void validateLayout(SeatCraftBlockDtos.LayoutRequest layout) {
        if (layout == null || layout.getBlocks() == null || layout.getBlocks().isEmpty()) {
            throw new BusinessException(400, "请至少添加一个座位块");
        }
        if (layout.getTicketGroups() == null || layout.getTicketGroups().isEmpty()) {
            throw new BusinessException(400, "请至少配置一个票档组");
        }
        Set<String> groupKeys = layout.getTicketGroups().stream()
                .map(SeatCraftBlockDtos.TicketGroupRequest::getGroupKey)
                .map(this::trim)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        for (SeatCraftBlockDtos.BlockRequest block : layout.getBlocks()) {
            if (trim(block.getBlockKey()) == null) {
                throw new BusinessException(400, "座位块标识不能为空");
            }
            if (!groupKeys.contains(trim(block.getTicketGroupKey()))) {
                throw new BusinessException(400, "座位块必须绑定有效票档组");
            }
        }
    }

    private SeatCraftBlockDtos.BlockRequest toBlockRequest(SeatBlock block) {
        SeatCraftBlockDtos.BlockRequest request = new SeatCraftBlockDtos.BlockRequest();
        request.setBlockKey(block.getBlockKey());
        request.setName(block.getName());
        request.setBlockType(block.getBlockType());
        request.setTicketGroupKey(block.getTicketGroupKey());
        request.setX(block.getX());
        request.setY(block.getY());
        request.setRotation(block.getRotation());
        request.setScale(block.getScale());
        request.setRows(block.getRows());
        request.setCols(block.getCols());
        request.setSeatsPerRow(block.getSeatsPerRow());
        request.setRowSpacing(block.getRowSpacing());
        request.setSeatSpacing(block.getSeatSpacing());
        request.setInnerRadius(block.getInnerRadius());
        request.setArcStartAngle(block.getArcStartAngle());
        request.setArcEndAngle(block.getArcEndAngle());
        request.setWidth(block.getWidth());
        request.setHeight(block.getHeight());
        request.setCapacity(block.getCapacity());
        request.setColor(block.getColor());
        request.setSort(block.getSort());
        return request;
    }

    private SeatCraftBlockDtos.OverrideRequest toOverrideRequest(SeatOverride override, String blockKey) {
        SeatCraftBlockDtos.OverrideRequest request = new SeatCraftBlockDtos.OverrideRequest();
        request.setBlockKey(blockKey);
        request.setRowNo(override.getRowNo());
        request.setSeatNo(override.getSeatNo());
        request.setStatus(override.getStatus());
        request.setDx(override.getDx());
        request.setDy(override.getDy());
        request.setCustomLabel(override.getCustomLabel());
        return request;
    }

    private SeatCraftBlockDtos.TicketGroupRequest toTicketGroupRequest(TicketGroup group) {
        SeatCraftBlockDtos.TicketGroupRequest request = new SeatCraftBlockDtos.TicketGroupRequest();
        request.setGroupKey(group.getGroupKey());
        request.setName(group.getName());
        request.setDefaultPrice(group.getDefaultPrice());
        request.setActivityPrice(group.getActivityPrice());
        request.setSourceBlockKeys(split(group.getSourceBlockIds()));
        request.setSort(group.getSort());
        return request;
    }

    private List<String> split(String value) {
        String text = trim(value);
        if (text == null) {
            return Collections.emptyList();
        }
        return Arrays.stream(text.split(","))
                .map(String::trim)
                .filter(item -> !item.isEmpty())
                .collect(Collectors.toList());
    }

    private void validateOwner(String ownerType, Long ownerId) {
        if (trim(ownerType) == null || ownerId == null || ownerId <= 0) {
            throw new BusinessException(400, "座位图归属不正确");
        }
    }

    private BigDecimal defaultDecimal(BigDecimal value, BigDecimal fallback) {
        return value == null ? fallback : value;
    }

    private String defaultText(String value, String fallback) {
        String text = trim(value);
        return text == null ? fallback : text;
    }

    private String trim(String value) {
        if (value == null) {
            return null;
        }
        String text = value.trim();
        return text.isEmpty() ? null : text;
    }
}
