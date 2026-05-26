package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.SeatCraftBlockDtos;
import com.omni.ticket.entity.SeatBlock;
import com.omni.ticket.entity.SeatLayoutVersion;
import com.omni.ticket.entity.SeatLayoutVersionBlock;
import com.omni.ticket.entity.SeatLayoutVersionGroupBinding;
import com.omni.ticket.entity.SeatLayoutVersionOverride;
import com.omni.ticket.entity.SeatLayoutVersionTicketGroup;
import com.omni.ticket.entity.SeatOverride;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.Station;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.entity.TicketGroup;
import com.omni.ticket.entity.Tour;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.SeatBlockMapper;
import com.omni.ticket.mapper.SeatLayoutVersionBlockMapper;
import com.omni.ticket.mapper.SeatLayoutVersionGroupBindingMapper;
import com.omni.ticket.mapper.SeatLayoutVersionMapper;
import com.omni.ticket.mapper.SeatLayoutVersionOverrideMapper;
import com.omni.ticket.mapper.SeatLayoutVersionTicketGroupMapper;
import com.omni.ticket.mapper.SeatOverrideMapper;
import com.omni.ticket.mapper.StationMapper;
import com.omni.ticket.mapper.TicketGroupMapper;
import com.omni.ticket.mapper.TourMapper;
import com.omni.ticket.dto.InternalUserRefResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class SeatCraftLayoutVersionService {
    private static final String STATUS_DRAFT = "draft";
    private static final String STATUS_PUBLISHED = "published";
    private static final String ROLE_PRIMARY = "primary";

    private final SeatLayoutVersionMapper versionMapper;
    private final SeatLayoutVersionBlockMapper blockMapper;
    private final SeatLayoutVersionOverrideMapper overrideMapper;
    private final SeatLayoutVersionTicketGroupMapper groupMapper;
    private final SeatLayoutVersionGroupBindingMapper bindingMapper;
    @SuppressWarnings("unused")
    private final SeatBlockMapper seatBlockMapper;
    @SuppressWarnings("unused")
    private final SeatOverrideMapper seatOverrideMapper;
    @SuppressWarnings("unused")
    private final TicketGroupMapper ticketGroupMapper;
    private final ActivityMapper activityMapper;
    private final SessionMapper sessionMapper;
    private final StationMapper stationMapper;
    private final TourMapper tourMapper;
    private final UserAccessService userAccessService;

    public SeatCraftLayoutVersionService(SeatLayoutVersionMapper versionMapper,
                                          SeatLayoutVersionBlockMapper blockMapper,
                                          SeatLayoutVersionOverrideMapper overrideMapper,
                                          SeatLayoutVersionTicketGroupMapper groupMapper,
                                          SeatLayoutVersionGroupBindingMapper bindingMapper,
                                          SeatBlockMapper seatBlockMapper,
                                          SeatOverrideMapper seatOverrideMapper,
                                          TicketGroupMapper ticketGroupMapper) {
        this(versionMapper, blockMapper, overrideMapper, groupMapper, bindingMapper, seatBlockMapper, seatOverrideMapper,
                ticketGroupMapper, null, null, null, null, null, null, null);
    }

    @Autowired
    public SeatCraftLayoutVersionService(SeatLayoutVersionMapper versionMapper,
                                          SeatLayoutVersionBlockMapper blockMapper,
                                          SeatLayoutVersionOverrideMapper overrideMapper,
                                          SeatLayoutVersionTicketGroupMapper groupMapper,
                                          SeatLayoutVersionGroupBindingMapper bindingMapper,
                                          SeatBlockMapper seatBlockMapper,
                                          SeatOverrideMapper seatOverrideMapper,
                                           TicketGroupMapper ticketGroupMapper,
                                           ActivityMapper activityMapper,
                                           SessionMapper sessionMapper,
                                           UserAccessService userAccessService,
                                           StationMapper stationMapper,
                                           TourMapper tourMapper,
                                           ActivitySeatLayoutService activitySeatLayoutService,
                                           SessionSeatLayoutService sessionSeatLayoutService) {
        this.versionMapper = versionMapper;
        this.blockMapper = blockMapper;
        this.overrideMapper = overrideMapper;
        this.groupMapper = groupMapper;
        this.bindingMapper = bindingMapper;
        this.seatBlockMapper = seatBlockMapper;
        this.seatOverrideMapper = seatOverrideMapper;
        this.ticketGroupMapper = ticketGroupMapper;
        this.activityMapper = activityMapper;
        this.sessionMapper = sessionMapper;
        this.stationMapper = stationMapper;
        this.tourMapper = tourMapper;
        this.userAccessService = userAccessService;
    }

    @Transactional
    public SeatCraftBlockDtos.LayoutRequest saveDraft(String ownerType, Long ownerId,
                                                       SeatCraftBlockDtos.LayoutRequest layout,
                                                       Long operatorId) {
        validateOwner(ownerType, ownerId);
        requireOwnerAccess(ownerType, ownerId, operatorId);
        validateLayout(layout);
        LocalDateTime now = LocalDateTime.now();
        SeatLayoutVersion draft = findVersion(ownerType, ownerId, STATUS_DRAFT);
        if (draft == null) {
            draft = new SeatLayoutVersion();
            draft.setOwnerType(trim(ownerType));
            draft.setOwnerId(ownerId);
            draft.setVersionNo(nextVersionNo(ownerType, ownerId));
            draft.setVersionStatus(STATUS_DRAFT);
            draft.setCreateTime(now);
            copyVersionMetadata(draft, layout, now);
            versionMapper.insert(draft);
        } else {
            copyVersionMetadata(draft, layout, now);
            versionMapper.updateById(draft);
            deleteVersionDetails(draft.getId());
        }

        Map<String, Long> blockIds = insertBlocks(draft.getId(), layout.getBlocks(), now);
        insertGroups(draft.getId(), layout.getTicketGroups(), now);
        insertBindings(draft.getId(), layout.getBindings(), now);
        insertOverrides(layout.getOverrides(), blockIds, now);
        return getDraft(ownerType, ownerId);
    }

    @Transactional
    public SeatCraftBlockDtos.LayoutRequest getDraft(String ownerType, Long ownerId) {
        validateOwner(ownerType, ownerId);
        SeatLayoutVersion draft = findVersion(ownerType, ownerId, STATUS_DRAFT);
        if (draft != null) {
            return assembleLayout(draft);
        }
        SeatLayoutVersion published = findVersion(ownerType, ownerId, STATUS_PUBLISHED);
        if (published == null) {
            return null;
        }
        return clonePublishedToDraft(ownerType, ownerId, published);
    }

    public List<SeatCraftBlockDtos.VersionSummary> listVersions(String ownerType, Long ownerId) {
        validateOwner(ownerType, ownerId);
        String normalizedOwnerType = trim(ownerType);
        List<SeatLayoutVersion> versions = versionMapper.selectList(new LambdaQueryWrapper<SeatLayoutVersion>()
                .eq(SeatLayoutVersion::getOwnerType, normalizedOwnerType)
                .eq(SeatLayoutVersion::getOwnerId, ownerId)
                .orderByDesc(SeatLayoutVersion::getVersionNo));
        if (versions == null) {
            return Collections.emptyList();
        }
        return versions.stream()
                .filter(Objects::nonNull)
                .filter(version -> Objects.equals(trim(version.getOwnerType()), normalizedOwnerType)
                        && Objects.equals(version.getOwnerId(), ownerId))
                .sorted(Comparator
                        .comparing(SeatLayoutVersion::getVersionNo, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(SeatLayoutVersion::getId, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::toVersionSummary)
                .collect(Collectors.toList());
    }

    @Transactional
    public SeatCraftBlockDtos.LayoutRequest publishDraft(String ownerType, Long ownerId, Long operatorId) {
        validateOwner(ownerType, ownerId);
        requireOwnerAccess(ownerType, ownerId, operatorId);
        SeatLayoutVersion draft = findVersion(ownerType, ownerId, STATUS_DRAFT);
        if (draft == null) {
            throw new BusinessException(404, "草稿版本不存在");
        }
        SeatCraftBlockDtos.LayoutRequest layout = assembleLayout(draft);
        validateLayout(layout);

        LocalDateTime now = LocalDateTime.now();
        SeatLayoutVersion published = findVersion(ownerType, ownerId, STATUS_PUBLISHED);
        if (published != null) {
            published.setVersionStatus("archived");
            published.setUpdateTime(now);
            versionMapper.updateById(published);
        }

        draft.setVersionStatus(STATUS_PUBLISHED);
        draft.setPublishedAt(now);
        draft.setPublishedBy(operatorId);
        draft.setUpdateTime(now);
        versionMapper.updateById(draft);
        materializeLayout(trim(ownerType), ownerId, layout, now);
        return assembleLayout(draft);
    }

    @Transactional
    public SeatCraftBlockDtos.LayoutRequest rollbackToDraft(String ownerType, Long ownerId, Long versionId, Long operatorId) {
        validateOwner(ownerType, ownerId);
        requireOwnerAccess(ownerType, ownerId, operatorId);
        SeatLayoutVersion target = versionMapper.selectOne(new LambdaQueryWrapper<SeatLayoutVersion>()
                .eq(SeatLayoutVersion::getOwnerType, trim(ownerType))
                .eq(SeatLayoutVersion::getOwnerId, ownerId)
                .eq(SeatLayoutVersion::getId, versionId)
                .last("limit 1"));
        if (target == null) {
            throw new BusinessException(404, "目标版本不存在");
        }
        SeatLayoutVersion draft = findVersion(ownerType, ownerId, STATUS_DRAFT);
        if (draft != null) {
            deleteVersionDetails(draft.getId());
            versionMapper.deleteById(draft.getId());
        }
        return cloneVersionToDraft(ownerType, ownerId, target);
    }

    @Transactional
    public void deleteVersion(String ownerType, Long ownerId, Long versionId, Long operatorId) {
        validateOwner(ownerType, ownerId);
        requireOwnerAccess(ownerType, ownerId, operatorId);
        SeatLayoutVersion target = versionMapper.selectOne(new LambdaQueryWrapper<SeatLayoutVersion>()
                .eq(SeatLayoutVersion::getOwnerType, trim(ownerType))
                .eq(SeatLayoutVersion::getOwnerId, ownerId)
                .eq(SeatLayoutVersion::getId, versionId)
                .last("limit 1"));
        if (target == null) {
            throw new BusinessException(404, "目标版本不存在");
        }
        if (STATUS_PUBLISHED.equals(trim(target.getVersionStatus()))) {
            throw new BusinessException(400, "已发布版本不能删除");
        }
        clearBaseVersionReferences(target.getId());
        deleteVersionDetails(target.getId());
        versionMapper.deleteById(target.getId());
    }

    public void deleteVersion(String ownerType, Long ownerId, Long versionId) {
        deleteVersion(ownerType, ownerId, versionId, null);
    }

    private SeatCraftBlockDtos.LayoutRequest clonePublishedToDraft(String ownerType, Long ownerId, SeatLayoutVersion published) {
        return cloneVersionToDraft(ownerType, ownerId, published);
    }

    private SeatCraftBlockDtos.LayoutRequest cloneVersionToDraft(String ownerType, Long ownerId, SeatLayoutVersion published) {
        SeatCraftBlockDtos.LayoutRequest publishedLayout = assembleLayout(published);
        validateLayout(publishedLayout);
        LocalDateTime now = LocalDateTime.now();
        SeatLayoutVersion draft = new SeatLayoutVersion();
        draft.setOwnerType(trim(ownerType));
        draft.setOwnerId(ownerId);
        draft.setVersionNo(nextVersionNo(ownerType, ownerId));
        draft.setVersionStatus(STATUS_DRAFT);
        draft.setBaseVersionId(published.getId());
        draft.setCreateTime(now);
        copyVersionMetadata(draft, publishedLayout, now);
        versionMapper.insert(draft);

        Map<String, Long> blockIds = insertBlocks(draft.getId(), publishedLayout.getBlocks(), now);
        insertGroups(draft.getId(), publishedLayout.getTicketGroups(), now);
        insertBindings(draft.getId(), publishedLayout.getBindings(), now);
        insertOverrides(publishedLayout.getOverrides(), blockIds, now);
        return assembleLayout(draft);
    }

    private void materializeLayout(String ownerType, Long ownerId, SeatCraftBlockDtos.LayoutRequest layout, LocalDateTime now) {
        List<SeatBlock> existingBlocks = ownerBlocks(findMaterializedBlocks(ownerType, ownerId), ownerType, ownerId);
        List<TicketGroup> existingGroups = ownerGroups(findMaterializedGroups(ownerType, ownerId), ownerType, ownerId);
        Set<String> incomingBlockKeys = layout.getBlocks().stream()
                .map(SeatCraftBlockDtos.BlockRequest::getBlockKey)
                .map(this::trim)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Set<String> incomingGroupKeys = layout.getTicketGroups().stream()
                .map(SeatCraftBlockDtos.TicketGroupRequest::getGroupKey)
                .map(this::trim)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        deleteMaterializedOverrides(existingBlocks);
        disableMaterializedBlocks(existingBlocks, incomingBlockKeys, now);
        disableMaterializedGroups(existingGroups, incomingGroupKeys, now);

        Map<String, String> primaryGroups = primaryGroupByBlock(layout.getBindings());
        Map<String, Long> blockIds = upsertMaterializedBlocks(ownerType, ownerId, layout.getBlocks(), existingBlocks, primaryGroups, now);
        upsertMaterializedGroups(ownerType, ownerId, layout.getTicketGroups(), existingGroups, layout.getBlocks(), layout.getBindings(), now);
        insertMaterializedOverrides(layout.getOverrides(), blockIds, now);
    }

    private List<SeatBlock> ownerBlocks(List<SeatBlock> blocks, String ownerType, Long ownerId) {
        if (blocks == null) {
            return Collections.emptyList();
        }
        return blocks.stream()
                .filter(block -> Objects.equals(trim(block.getOwnerType()), ownerType) && Objects.equals(block.getOwnerId(), ownerId))
                .collect(Collectors.toList());
    }

    private List<TicketGroup> ownerGroups(List<TicketGroup> groups, String ownerType, Long ownerId) {
        if (groups == null) {
            return Collections.emptyList();
        }
        return groups.stream()
                .filter(group -> Objects.equals(trim(group.getOwnerType()), ownerType) && Objects.equals(group.getOwnerId(), ownerId))
                .collect(Collectors.toList());
    }

    private List<SeatBlock> findMaterializedBlocks(String ownerType, Long ownerId) {
        return seatBlockMapper.selectList(new LambdaQueryWrapper<SeatBlock>()
                .eq(SeatBlock::getOwnerType, ownerType)
                .eq(SeatBlock::getOwnerId, ownerId)
                .orderByAsc(SeatBlock::getSort));
    }

    private List<TicketGroup> findMaterializedGroups(String ownerType, Long ownerId) {
        return ticketGroupMapper.selectList(new LambdaQueryWrapper<TicketGroup>()
                .eq(TicketGroup::getOwnerType, ownerType)
                .eq(TicketGroup::getOwnerId, ownerId)
                .orderByAsc(TicketGroup::getSort));
    }

    private void deleteMaterializedOverrides(List<SeatBlock> blocks) {
        if (blocks == null || blocks.isEmpty()) {
            return;
        }
        List<Long> blockIds = blocks.stream().map(SeatBlock::getId).filter(Objects::nonNull).collect(Collectors.toList());
        if (!blockIds.isEmpty()) {
            seatOverrideMapper.delete(new LambdaQueryWrapper<SeatOverride>().in(SeatOverride::getBlockId, blockIds));
        }
    }

    private void disableMaterializedBlocks(List<SeatBlock> blocks, Set<String> exceptKeys, LocalDateTime now) {
        if (blocks == null) {
            return;
        }
        for (SeatBlock block : blocks) {
            if (exceptKeys.contains(trim(block.getBlockKey()))) {
                continue;
            }
            block.setStatus(0);
            block.setUpdateTime(now);
            seatBlockMapper.updateById(block);
        }
    }

    private void disableMaterializedGroups(List<TicketGroup> groups, Set<String> exceptKeys, LocalDateTime now) {
        if (groups == null) {
            return;
        }
        for (TicketGroup group : groups) {
            if (exceptKeys.contains(trim(group.getGroupKey()))) {
                continue;
            }
            group.setStatus(0);
            group.setUpdateTime(now);
            ticketGroupMapper.updateById(group);
        }
    }

    private Map<String, String> primaryGroupByBlock(List<SeatCraftBlockDtos.BindingRequest> bindings) {
        Map<String, String> groups = new HashMap<>();
        for (SeatCraftBlockDtos.BindingRequest binding : bindings) {
            if (ROLE_PRIMARY.equals(defaultText(binding.getBindingRole(), ROLE_PRIMARY))) {
                groups.put(trim(binding.getBlockKey()), trim(binding.getGroupKey()));
            }
        }
        return groups;
    }

    private Map<String, Long> upsertMaterializedBlocks(String ownerType, Long ownerId, List<SeatCraftBlockDtos.BlockRequest> blocks,
                                                       List<SeatBlock> existingBlocks, Map<String, String> primaryGroups, LocalDateTime now) {
        Map<String, SeatBlock> existingByKey = existingBlocks == null ? Collections.emptyMap()
                : existingBlocks.stream().filter(block -> trim(block.getBlockKey()) != null)
                .collect(Collectors.toMap(block -> trim(block.getBlockKey()), block -> block, (first, second) -> first));
        Map<String, Long> ids = new HashMap<>();
        for (int i = 0; i < blocks.size(); i++) {
            SeatCraftBlockDtos.BlockRequest request = blocks.get(i);
            String blockKey = trim(request.getBlockKey());
            SeatBlock block = existingByKey.getOrDefault(blockKey, new SeatBlock());
            block.setOwnerType(ownerType);
            block.setOwnerId(ownerId);
            block.setBlockKey(blockKey);
            block.setName(defaultText(request.getName(), blockKey));
            block.setBlockType(trim(request.getBlockType()));
            block.setTicketGroupKey(primaryGroups.get(blockKey));
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
            block.setPolygonPoints(trim(request.getPolygonPoints()));
            block.setColor(defaultText(request.getColor(), "#ff1268"));
            block.setSort(request.getSort() != null ? request.getSort() : i);
            block.setStatus(1);
            block.setUpdateTime(now);
            if (block.getId() == null) {
                block.setCreateTime(now);
                seatBlockMapper.insert(block);
            } else {
                seatBlockMapper.updateById(block);
            }
            ids.put(blockKey, block.getId());
        }
        return ids;
    }

    private void upsertMaterializedGroups(String ownerType, Long ownerId, List<SeatCraftBlockDtos.TicketGroupRequest> groups,
                                          List<TicketGroup> existingGroups, List<SeatCraftBlockDtos.BlockRequest> blocks,
                                          List<SeatCraftBlockDtos.BindingRequest> bindings, LocalDateTime now) {
        Map<String, TicketGroup> existingByKey = existingGroups == null ? Collections.emptyMap()
                : existingGroups.stream().filter(group -> trim(group.getGroupKey()) != null)
                .collect(Collectors.toMap(group -> trim(group.getGroupKey()), group -> group, (first, second) -> first));
        Map<String, Integer> blockSorts = blocks.stream()
                .collect(Collectors.toMap(block -> trim(block.getBlockKey()),
                        block -> block.getSort() == null ? Integer.MAX_VALUE : block.getSort(),
                        Math::min));
        Map<String, List<String>> sourceBlocks = bindings.stream()
                .sorted(Comparator
                        .comparing((SeatCraftBlockDtos.BindingRequest binding) -> blockSorts.getOrDefault(trim(binding.getBlockKey()),
                                binding.getSort() == null ? Integer.MAX_VALUE : binding.getSort()))
                        .thenComparing(binding -> defaultText(binding.getBlockKey(), "")))
                .collect(Collectors.groupingBy(binding -> trim(binding.getGroupKey()),
                        Collectors.mapping(binding -> trim(binding.getBlockKey()), Collectors.toList())));
        for (int i = 0; i < groups.size(); i++) {
            SeatCraftBlockDtos.TicketGroupRequest request = groups.get(i);
            String groupKey = trim(request.getGroupKey());
            TicketGroup group = existingByKey.getOrDefault(groupKey, new TicketGroup());
            group.setOwnerType(ownerType);
            group.setOwnerId(ownerId);
            group.setGroupKey(groupKey);
            group.setName(defaultText(request.getName(), groupKey));
            group.setDefaultPrice(defaultDecimal(request.getDefaultPrice(), BigDecimal.ZERO));
            group.setActivityPrice(defaultDecimal(request.getActivityPrice(), BigDecimal.ZERO));
            group.setSourceBlockIds(String.join(",", sourceBlocks.getOrDefault(groupKey, Collections.emptyList())));
            group.setSort(request.getSort() != null ? request.getSort() : i);
            group.setStatus(1);
            group.setUpdateTime(now);
            if (group.getId() == null) {
                group.setCreateTime(now);
                ticketGroupMapper.insert(group);
            } else {
                ticketGroupMapper.updateById(group);
            }
        }
    }

    private void insertMaterializedOverrides(List<SeatCraftBlockDtos.OverrideRequest> overrides, Map<String, Long> blockIds, LocalDateTime now) {
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

    private SeatLayoutVersion findVersion(String ownerType, Long ownerId, String status) {
        return versionMapper.selectOne(new LambdaQueryWrapper<SeatLayoutVersion>()
                .eq(SeatLayoutVersion::getOwnerType, trim(ownerType))
                .eq(SeatLayoutVersion::getOwnerId, ownerId)
                .eq(SeatLayoutVersion::getVersionStatus, status)
                .orderByDesc(SeatLayoutVersion::getVersionNo)
                .last("limit 1"));
    }

    private Integer nextVersionNo(String ownerType, Long ownerId) {
        List<SeatLayoutVersion> versions = versionMapper.selectList(new LambdaQueryWrapper<SeatLayoutVersion>()
                .eq(SeatLayoutVersion::getOwnerType, trim(ownerType))
                .eq(SeatLayoutVersion::getOwnerId, ownerId));
        if (versions == null || versions.isEmpty()) {
            return 1;
        }
        return versions.stream()
                .map(SeatLayoutVersion::getVersionNo)
                .filter(Objects::nonNull)
                .max(Integer::compareTo)
                .orElse(0) + 1;
    }

    private void copyVersionMetadata(SeatLayoutVersion version, SeatCraftBlockDtos.LayoutRequest layout, LocalDateTime now) {
        version.setName(defaultText(layout.getName(), "座位图草稿"));
        version.setTemplateType(defaultText(layout.getTemplateType(), "concert"));
        version.setStageTitle(defaultText(layout.getStageTitle(), "舞台"));
        version.setStageX(layout.getStageX() == null ? 0 : layout.getStageX());
        version.setStageY(layout.getStageY() == null ? 0 : layout.getStageY());
        version.setCanvasWidth(layout.getCanvasWidth());
        version.setCanvasHeight(layout.getCanvasHeight());
        version.setUpdateTime(now);
    }

    private void deleteVersionDetails(Long versionId) {
        if (versionId == null) {
            return;
        }
        List<SeatLayoutVersionBlock> blocks = blockMapper.selectList(new LambdaQueryWrapper<SeatLayoutVersionBlock>()
                .eq(SeatLayoutVersionBlock::getVersionId, versionId));
        List<Long> blockIds = blocks == null ? Collections.emptyList() : blocks.stream()
                .map(SeatLayoutVersionBlock::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
        if (!blockIds.isEmpty()) {
            overrideMapper.delete(new LambdaQueryWrapper<SeatLayoutVersionOverride>()
                    .in(SeatLayoutVersionOverride::getVersionBlockId, blockIds));
        }
        bindingMapper.delete(new LambdaQueryWrapper<SeatLayoutVersionGroupBinding>()
                .eq(SeatLayoutVersionGroupBinding::getVersionId, versionId));
        groupMapper.delete(new LambdaQueryWrapper<SeatLayoutVersionTicketGroup>()
                .eq(SeatLayoutVersionTicketGroup::getVersionId, versionId));
        blockMapper.delete(new LambdaQueryWrapper<SeatLayoutVersionBlock>()
                .eq(SeatLayoutVersionBlock::getVersionId, versionId));
    }

    private void clearBaseVersionReferences(Long versionId) {
        if (versionId == null) {
            return;
        }
        SeatLayoutVersion update = new SeatLayoutVersion();
        update.setBaseVersionId(null);
        versionMapper.update(update, new UpdateWrapper<SeatLayoutVersion>()
                .eq("base_version_id", versionId)
                .set("base_version_id", null));
    }

    private Map<String, Long> insertBlocks(Long versionId, List<SeatCraftBlockDtos.BlockRequest> blocks, LocalDateTime now) {
        Map<String, Long> blockIds = new HashMap<>();
        for (int i = 0; i < blocks.size(); i++) {
            SeatCraftBlockDtos.BlockRequest request = blocks.get(i);
            SeatLayoutVersionBlock block = new SeatLayoutVersionBlock();
            block.setVersionId(versionId);
            block.setBlockKey(trim(request.getBlockKey()));
            block.setName(defaultText(request.getName(), block.getBlockKey()));
            block.setBlockType(trim(request.getBlockType()));
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
            block.setPolygonPoints(trim(request.getPolygonPoints()));
            block.setColor(defaultText(request.getColor(), "#ff1268"));
            block.setSort(request.getSort() != null ? request.getSort() : i);
            block.setStatus(1);
            block.setCreateTime(now);
            block.setUpdateTime(now);
            blockMapper.insert(block);
            blockIds.put(block.getBlockKey(), block.getId());
        }
        return blockIds;
    }

    private void insertGroups(Long versionId, List<SeatCraftBlockDtos.TicketGroupRequest> groups, LocalDateTime now) {
        for (int i = 0; i < groups.size(); i++) {
            SeatCraftBlockDtos.TicketGroupRequest request = groups.get(i);
            SeatLayoutVersionTicketGroup group = new SeatLayoutVersionTicketGroup();
            group.setVersionId(versionId);
            group.setGroupKey(trim(request.getGroupKey()));
            group.setName(defaultText(request.getName(), group.getGroupKey()));
            group.setDefaultPrice(defaultDecimal(request.getDefaultPrice(), BigDecimal.ZERO));
            group.setActivityPrice(defaultDecimal(request.getActivityPrice(), BigDecimal.ZERO));
            group.setSort(request.getSort() != null ? request.getSort() : i);
            group.setStatus(1);
            group.setCreateTime(now);
            group.setUpdateTime(now);
            groupMapper.insert(group);
        }
    }

    private void insertBindings(Long versionId, List<SeatCraftBlockDtos.BindingRequest> bindings, LocalDateTime now) {
        for (int i = 0; i < bindings.size(); i++) {
            SeatCraftBlockDtos.BindingRequest request = bindings.get(i);
            SeatLayoutVersionGroupBinding binding = new SeatLayoutVersionGroupBinding();
            binding.setVersionId(versionId);
            binding.setBlockKey(trim(request.getBlockKey()));
            binding.setGroupKey(trim(request.getGroupKey()));
            binding.setBindingRole(defaultText(request.getBindingRole(), ROLE_PRIMARY));
            binding.setSort(request.getSort() != null ? request.getSort() : i);
            binding.setCreateTime(now);
            binding.setUpdateTime(now);
            bindingMapper.insert(binding);
        }
    }

    private void insertOverrides(List<SeatCraftBlockDtos.OverrideRequest> overrides, Map<String, Long> blockIds, LocalDateTime now) {
        if (overrides == null) {
            return;
        }
        for (SeatCraftBlockDtos.OverrideRequest request : overrides) {
            Long versionBlockId = blockIds.get(trim(request.getBlockKey()));
            if (versionBlockId == null) {
                throw new BusinessException(400, "座位微调必须绑定有效座位块");
            }
            SeatLayoutVersionOverride override = new SeatLayoutVersionOverride();
            override.setVersionBlockId(versionBlockId);
            override.setRowNo(request.getRowNo());
            override.setSeatNo(request.getSeatNo());
            override.setStatus(defaultText(request.getStatus(), "visible"));
            override.setDx(defaultDecimal(request.getDx(), BigDecimal.ZERO));
            override.setDy(defaultDecimal(request.getDy(), BigDecimal.ZERO));
            override.setCustomLabel(trim(request.getCustomLabel()));
            override.setCreateTime(now);
            override.setUpdateTime(now);
            overrideMapper.insert(override);
        }
    }

    private SeatCraftBlockDtos.LayoutRequest assembleLayout(SeatLayoutVersion version) {
        List<SeatLayoutVersionBlock> blocks = blockMapper.selectList(new LambdaQueryWrapper<SeatLayoutVersionBlock>()
                .eq(SeatLayoutVersionBlock::getVersionId, version.getId())
                .orderByAsc(SeatLayoutVersionBlock::getSort));
        List<SeatLayoutVersionTicketGroup> groups = groupMapper.selectList(new LambdaQueryWrapper<SeatLayoutVersionTicketGroup>()
                .eq(SeatLayoutVersionTicketGroup::getVersionId, version.getId())
                .orderByAsc(SeatLayoutVersionTicketGroup::getSort));
        List<SeatLayoutVersionGroupBinding> bindings = bindingMapper.selectList(new LambdaQueryWrapper<SeatLayoutVersionGroupBinding>()
                .eq(SeatLayoutVersionGroupBinding::getVersionId, version.getId())
                .orderByAsc(SeatLayoutVersionGroupBinding::getSort));
        Map<Long, String> blockKeys = blocks == null ? Collections.emptyMap() : blocks.stream()
                .filter(block -> block.getId() != null)
                .collect(Collectors.toMap(SeatLayoutVersionBlock::getId, SeatLayoutVersionBlock::getBlockKey, (first, second) -> first));
        List<Long> blockIds = blocks == null ? Collections.emptyList() : blocks.stream()
                .map(SeatLayoutVersionBlock::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
        List<SeatLayoutVersionOverride> overrides = blockIds.isEmpty() ? Collections.emptyList()
                : overrideMapper.selectList(new LambdaQueryWrapper<SeatLayoutVersionOverride>()
                .in(SeatLayoutVersionOverride::getVersionBlockId, blockIds));

        SeatCraftBlockDtos.LayoutRequest layout = new SeatCraftBlockDtos.LayoutRequest();
        layout.setVersionId(version.getId());
        layout.setVersionNo(version.getVersionNo());
        layout.setVersionStatus(version.getVersionStatus());
        layout.setName(version.getName());
        layout.setTemplateType(defaultText(version.getTemplateType(), "concert"));
        layout.setStageTitle(defaultText(version.getStageTitle(), "舞台"));
        layout.setStageX(version.getStageX() == null ? 0 : version.getStageX());
        layout.setStageY(version.getStageY() == null ? 0 : version.getStageY());
        layout.setCanvasWidth(version.getCanvasWidth());
        layout.setCanvasHeight(version.getCanvasHeight());
        layout.setBlocks(blocks == null ? Collections.emptyList() : blocks.stream().map(this::toBlockRequest).collect(Collectors.toList()));
        layout.setTicketGroups(groups == null ? Collections.emptyList() : groups.stream().map(this::toGroupRequest).collect(Collectors.toList()));
        layout.setBindings(bindings == null ? Collections.emptyList() : bindings.stream().map(this::toBindingRequest).collect(Collectors.toList()));
        layout.setOverrides(overrides == null ? Collections.emptyList() : overrides.stream()
                .map(override -> toOverrideRequest(override, blockKeys.get(override.getVersionBlockId())))
                .filter(override -> override.getBlockKey() != null)
                .collect(Collectors.toList()));
        return layout;
    }

    private SeatCraftBlockDtos.VersionSummary toVersionSummary(SeatLayoutVersion version) {
        SeatCraftBlockDtos.VersionSummary summary = new SeatCraftBlockDtos.VersionSummary();
        summary.setId(version.getId());
        summary.setVersionNo(version.getVersionNo());
        summary.setVersionStatus(version.getVersionStatus());
        summary.setName(version.getName());
        summary.setBaseVersionId(version.getBaseVersionId());
        summary.setPublishedAt(version.getPublishedAt());
        summary.setPublishedBy(version.getPublishedBy());
        summary.setCreateTime(version.getCreateTime());
        summary.setUpdateTime(version.getUpdateTime());
        return summary;
    }

    private SeatCraftBlockDtos.BlockRequest toBlockRequest(SeatLayoutVersionBlock block) {
        SeatCraftBlockDtos.BlockRequest request = new SeatCraftBlockDtos.BlockRequest();
        request.setBlockKey(block.getBlockKey());
        request.setName(block.getName());
        request.setBlockType(block.getBlockType());
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
        request.setPolygonPoints(block.getPolygonPoints());
        request.setColor(block.getColor());
        request.setSort(block.getSort());
        return request;
    }

    private SeatCraftBlockDtos.TicketGroupRequest toGroupRequest(SeatLayoutVersionTicketGroup group) {
        SeatCraftBlockDtos.TicketGroupRequest request = new SeatCraftBlockDtos.TicketGroupRequest();
        request.setGroupKey(group.getGroupKey());
        request.setName(group.getName());
        request.setDefaultPrice(group.getDefaultPrice());
        request.setActivityPrice(group.getActivityPrice());
        request.setSort(group.getSort());
        return request;
    }

    private SeatCraftBlockDtos.BindingRequest toBindingRequest(SeatLayoutVersionGroupBinding binding) {
        SeatCraftBlockDtos.BindingRequest request = new SeatCraftBlockDtos.BindingRequest();
        request.setBlockKey(binding.getBlockKey());
        request.setGroupKey(binding.getGroupKey());
        request.setBindingRole(binding.getBindingRole());
        request.setSort(binding.getSort());
        return request;
    }

    private SeatCraftBlockDtos.OverrideRequest toOverrideRequest(SeatLayoutVersionOverride override, String blockKey) {
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

    private void validateOwner(String ownerType, Long ownerId) {
        if (trim(ownerType) == null || ownerId == null || ownerId <= 0) {
            throw new BusinessException(400, "布局归属无效");
        }
    }

    private void requireOwnerAccess(String ownerType, Long ownerId, Long operatorId) {
        if (operatorId == null) {
            throw new BusinessException(401, "未登录");
        }
        String normalizedOwnerType = trim(ownerType);
        if ("activity".equals(normalizedOwnerType)) {
            if (activityMapper == null || userAccessService == null) {
                throw new BusinessException(500, "活动权限服务未初始化");
            }
            InternalUserRefResponse user = userAccessService.requireAdminOrOrganizer(operatorId);
            Activity activity = activityMapper.selectById(ownerId);
            if (activity == null || !Integer.valueOf(1).equals(activity.getStatus())) {
                throw new BusinessException(404, "活动不存在");
            }
            if ("organizer".equals(user.getRole()) && !operatorId.equals(activity.getOrganizerId())) {
                throw new BusinessException(403, "只能管理自己的活动");
            }
            return;
        }
        if ("session".equals(normalizedOwnerType)) {
            if (sessionMapper == null || activityMapper == null || userAccessService == null) {
                throw new BusinessException(500, "场次权限服务未初始化");
            }
            InternalUserRefResponse user = userAccessService.requireAdminOrOrganizer(operatorId);
            Session session = sessionMapper.selectById(ownerId);
            if (session == null || !Integer.valueOf(1).equals(session.getStatus())) {
                throw new BusinessException(404, "场次不存在");
            }
            Activity activity = activityMapper.selectById(session.getActivityId());
            if (activity == null || !Integer.valueOf(1).equals(activity.getStatus())) {
                throw new BusinessException(404, "活动不存在");
            }
            if ("organizer".equals(user.getRole()) && !operatorId.equals(activity.getOrganizerId())) {
                throw new BusinessException(403, "只能管理自己的场次");
            }
            return;
        }
        if ("station".equals(normalizedOwnerType)) {
            if (stationMapper == null || tourMapper == null || activityMapper == null || userAccessService == null) {
                throw new BusinessException(500, "站点权限服务未初始化");
            }
            InternalUserRefResponse user = userAccessService.requireAdminOrOrganizer(operatorId);
            Station station = stationMapper.selectById(ownerId);
            if (station == null || !Integer.valueOf(1).equals(station.getStatus())) {
                throw new BusinessException(404, "站点不存在");
            }
            if ("admin".equals(user.getRole())) {
                return;
            }
            if (station.getTourId() != null) {
                Tour tour = tourMapper.selectById(station.getTourId());
                if (tour == null || !operatorId.equals(tour.getOrganizerId())) {
                    throw new BusinessException(403, "只能管理自己的巡演站点");
                }
                return;
            }
            if (station.getActivityId() != null) {
                Activity activity = activityMapper.selectById(station.getActivityId());
                if (activity == null || !operatorId.equals(activity.getOrganizerId())) {
                    throw new BusinessException(403, "只能管理自己的活动站点");
                }
                return;
            }
            throw new BusinessException(400, "站点缺少归属信息");
        }
        throw new BusinessException(400, "布局归属无效");
    }

    private void validateLayout(SeatCraftBlockDtos.LayoutRequest layout) {
        if (layout == null || layout.getBlocks() == null || layout.getBlocks().isEmpty()) {
            throw new BusinessException(400, "请至少添加一个座位块");
        }
        if (layout.getTicketGroups() == null || layout.getTicketGroups().isEmpty()) {
            throw new BusinessException(400, "请至少配置一个票档组");
        }
        if (layout.getBindings() == null || layout.getBindings().isEmpty()) {
            throw new BusinessException(400, "请至少配置一个票档绑定");
        }
        Set<String> blockKeys = new HashSet<>();
        for (SeatCraftBlockDtos.BlockRequest block : layout.getBlocks()) {
            if (block == null) {
                throw new BusinessException(400, "座位块不能为空");
            }
            String blockKey = trim(block.getBlockKey());
            if (blockKey == null) {
                throw new BusinessException(400, "座位块标识不能为空");
            }
            if (!blockKeys.add(blockKey)) {
                throw new BusinessException(400, "座位块标识不能重复");
            }
        }
        Set<String> groupKeys = new HashSet<>();
        for (SeatCraftBlockDtos.TicketGroupRequest group : layout.getTicketGroups()) {
            if (group == null) {
                throw new BusinessException(400, "票档组不能为空");
            }
            String groupKey = trim(group.getGroupKey());
            if (groupKey == null) {
                throw new BusinessException(400, "票档组标识不能为空");
            }
            if (!groupKeys.add(groupKey)) {
                throw new BusinessException(400, "票档组标识不能重复");
            }
            if (group.getSourceBlockKeys() != null) {
                for (String sourceBlockKey : group.getSourceBlockKeys()) {
                    if (!blockKeys.contains(trim(sourceBlockKey))) {
                        throw new BusinessException(400, "票档组来源座位块无效");
                    }
                }
            }
        }
        Set<String> primaryBoundBlocks = new HashSet<>();
        Set<String> bindingKeys = new HashSet<>();
        for (SeatCraftBlockDtos.BindingRequest binding : layout.getBindings()) {
            if (binding == null) {
                throw new BusinessException(400, "票档绑定不能为空");
            }
            String blockKey = trim(binding.getBlockKey());
            String groupKey = trim(binding.getGroupKey());
            String bindingRole = defaultText(binding.getBindingRole(), ROLE_PRIMARY);
            if (!blockKeys.contains(blockKey)) {
                throw new BusinessException(400, "票档绑定座位块无效");
            }
            if (!groupKeys.contains(groupKey)) {
                throw new BusinessException(400, "票档绑定票档组无效");
            }
            if (!bindingKeys.add(blockKey + ":" + bindingRole)) {
                throw new BusinessException(400, "票档绑定不能重复");
            }
            if (ROLE_PRIMARY.equals(bindingRole)) {
                primaryBoundBlocks.add(blockKey);
            }
        }
        for (SeatCraftBlockDtos.BlockRequest block : layout.getBlocks()) {
            String blockKey = trim(block.getBlockKey());
            if (!primaryBoundBlocks.contains(blockKey)) {
                throw new BusinessException(400, "座位块必须配置主票档绑定");
            }
            if (trim(block.getTicketGroupKey()) != null && !groupKeys.contains(trim(block.getTicketGroupKey()))) {
                throw new BusinessException(400, "座位块必须绑定有效票档组");
            }
            if ("polygonBlock".equals(trim(block.getBlockType())) && trim(block.getPolygonPoints()) == null) {
                throw new BusinessException(400, "多边形座位块必须包含顶点数据");
            }
        }
        Set<String> overrideKeys = new HashSet<>();
        if (layout.getOverrides() != null) {
            for (SeatCraftBlockDtos.OverrideRequest override : layout.getOverrides()) {
                if (override == null) {
                    throw new BusinessException(400, "座位微调不能为空");
                }
                String blockKey = trim(override.getBlockKey());
                if (!blockKeys.contains(blockKey)) {
                    throw new BusinessException(400, "座位微调座位块无效");
                }
                if (override.getRowNo() == null || override.getSeatNo() == null) {
                    throw new BusinessException(400, "座位微调行列不能为空");
                }
                String overrideKey = blockKey + ":" + override.getRowNo() + ":" + override.getSeatNo();
                if (!overrideKeys.add(overrideKey)) {
                    throw new BusinessException(400, "座位微调不能重复");
                }
            }
        }
    }

    private String trim(String value) {
        if (value == null) {
            return null;
        }
        String text = value.trim();
        return text.isEmpty() ? null : text;
    }

    private String defaultText(String value, String defaultValue) {
        String text = trim(value);
        return text == null ? defaultValue : text;
    }

    private BigDecimal defaultDecimal(BigDecimal value, BigDecimal defaultValue) {
        return value == null ? defaultValue : value;
    }
}
