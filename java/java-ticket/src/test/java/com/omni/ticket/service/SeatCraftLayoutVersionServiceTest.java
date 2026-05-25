package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.SeatCraftBlockDtos;
import com.omni.ticket.entity.SeatBlock;
import com.omni.ticket.entity.SeatLayoutVersion;
import com.omni.ticket.entity.SeatLayoutVersionBlock;
import com.omni.ticket.entity.SeatLayoutVersionGroupBinding;
import com.omni.ticket.entity.SeatLayoutVersionOverride;
import com.omni.ticket.entity.SeatLayoutVersionTicketGroup;
import com.omni.ticket.entity.SeatOverride;
import com.omni.ticket.entity.TicketGroup;
import com.omni.ticket.mapper.SeatBlockMapper;
import com.omni.ticket.mapper.SeatLayoutVersionBlockMapper;
import com.omni.ticket.mapper.SeatLayoutVersionGroupBindingMapper;
import com.omni.ticket.mapper.SeatLayoutVersionMapper;
import com.omni.ticket.mapper.SeatLayoutVersionOverrideMapper;
import com.omni.ticket.mapper.SeatLayoutVersionTicketGroupMapper;
import com.omni.ticket.mapper.SeatOverrideMapper;
import com.omni.ticket.mapper.TicketGroupMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SeatCraftLayoutVersionServiceTest {

    @Mock
    private SeatLayoutVersionMapper versionMapper;
    @Mock
    private SeatLayoutVersionBlockMapper blockMapper;
    @Mock
    private SeatLayoutVersionOverrideMapper overrideMapper;
    @Mock
    private SeatLayoutVersionTicketGroupMapper groupMapper;
    @Mock
    private SeatLayoutVersionGroupBindingMapper bindingMapper;
    @Mock
    private SeatBlockMapper seatBlockMapper;
    @Mock
    private SeatOverrideMapper seatOverrideMapper;
    @Mock
    private TicketGroupMapper ticketGroupMapper;

    private SeatCraftLayoutVersionService service;

    @BeforeEach
    void setUp() {
        service = new SeatCraftLayoutVersionService(
                versionMapper,
                blockMapper,
                overrideMapper,
                groupMapper,
                bindingMapper,
                seatBlockMapper,
                seatOverrideMapper,
                ticketGroupMapper);
    }

    @Test
    void saveDraftPersistsVersionBlocksGroupsOverridesAndBindingsWithoutMaterializedTables() {
        SeatCraftBlockDtos.LayoutRequest layout = sampleLayout();
        List<SeatLayoutVersionBlock> insertedBlocks = new ArrayList<>();
        List<SeatLayoutVersionTicketGroup> insertedGroups = new ArrayList<>();
        List<SeatLayoutVersionGroupBinding> insertedBindings = new ArrayList<>();
        List<SeatLayoutVersionOverride> insertedOverrides = new ArrayList<>();
        SeatLayoutVersion persistedVersion = new SeatLayoutVersion();
        persistedVersion.setId(100L);
        persistedVersion.setOwnerType("session");
        persistedVersion.setOwnerId(3001L);
        persistedVersion.setVersionNo(1);
        persistedVersion.setVersionStatus("draft");
        persistedVersion.setName(layout.getName());
        persistedVersion.setCanvasWidth(layout.getCanvasWidth());
        persistedVersion.setCanvasHeight(layout.getCanvasHeight());

        when(versionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null, persistedVersion);
        when(versionMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());
        doAnswer(invocation -> {
            SeatLayoutVersion version = invocation.getArgument(0);
            version.setId(100L);
            persistedVersion.setCreateTime(version.getCreateTime());
            persistedVersion.setUpdateTime(version.getUpdateTime());
            return 1;
        }).when(versionMapper).insert(any(SeatLayoutVersion.class));
        doAnswer(invocation -> {
            SeatLayoutVersionBlock block = invocation.getArgument(0);
            block.setId(200L);
            insertedBlocks.add(block);
            return 1;
        }).when(blockMapper).insert(any(SeatLayoutVersionBlock.class));
        doAnswer(invocation -> {
            insertedGroups.add(invocation.getArgument(0));
            return 1;
        }).when(groupMapper).insert(any(SeatLayoutVersionTicketGroup.class));
        doAnswer(invocation -> {
            insertedBindings.add(invocation.getArgument(0));
            return 1;
        }).when(bindingMapper).insert(any(SeatLayoutVersionGroupBinding.class));
        doAnswer(invocation -> {
            insertedOverrides.add(invocation.getArgument(0));
            return 1;
        }).when(overrideMapper).insert(any(SeatLayoutVersionOverride.class));
        when(blockMapper.selectList(any(LambdaQueryWrapper.class))).thenAnswer(invocation -> insertedBlocks);
        when(groupMapper.selectList(any(LambdaQueryWrapper.class))).thenAnswer(invocation -> insertedGroups);
        when(bindingMapper.selectList(any(LambdaQueryWrapper.class))).thenAnswer(invocation -> insertedBindings);
        when(overrideMapper.selectList(any(LambdaQueryWrapper.class))).thenAnswer(invocation -> insertedOverrides);

        SeatCraftBlockDtos.LayoutRequest result = service.saveDraft("session", 3001L, layout, 2003L);

        assertEquals(100L, result.getVersionId());
        assertEquals("draft", result.getVersionStatus());
        verify(versionMapper).insert(any(SeatLayoutVersion.class));
        verify(blockMapper).insert(any(SeatLayoutVersionBlock.class));
        verify(groupMapper).insert(any(SeatLayoutVersionTicketGroup.class));
        verify(bindingMapper).insert(any(SeatLayoutVersionGroupBinding.class));
        verify(overrideMapper).insert(any(SeatLayoutVersionOverride.class));
        assertEquals(200L, insertedOverrides.get(0).getVersionBlockId());
        assertEquals("primary", insertedBindings.get(0).getBindingRole());
        verifyNoInteractions(seatBlockMapper, seatOverrideMapper, ticketGroupMapper);
    }

    @Test
    void saveDraftRejectsDuplicateBlockKey() {
        SeatCraftBlockDtos.LayoutRequest layout = sampleLayout();
        SeatCraftBlockDtos.BlockRequest duplicated = new SeatCraftBlockDtos.BlockRequest();
        duplicated.setBlockKey("block-a");
        duplicated.setBlockType("gridBlock");
        layout.setBlocks(List.of(layout.getBlocks().get(0), duplicated));

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.saveDraft("session", 3001L, layout, 2003L));

        assertEquals(400, error.getCode());
    }

    @Test
    void saveDraftRejectsBindingWithMissingGroup() {
        SeatCraftBlockDtos.LayoutRequest layout = sampleLayout();
        layout.getBindings().get(0).setGroupKey("missing");

        assertRejected(layout);
    }

    @Test
    void saveDraftRejectsDuplicateGroupKey() {
        SeatCraftBlockDtos.LayoutRequest layout = sampleLayout();
        SeatCraftBlockDtos.TicketGroupRequest duplicated = new SeatCraftBlockDtos.TicketGroupRequest();
        duplicated.setGroupKey("vip");
        duplicated.setName("VIP 2");
        layout.setTicketGroups(List.of(layout.getTicketGroups().get(0), duplicated));

        assertRejected(layout);
    }

    @Test
    void saveDraftRejectsBindingWithMissingBlock() {
        SeatCraftBlockDtos.LayoutRequest layout = sampleLayout();
        layout.getBindings().get(0).setBlockKey("missing");

        assertRejected(layout);
    }

    @Test
    void saveDraftRejectsDuplicateBindingBlockAndRole() {
        SeatCraftBlockDtos.LayoutRequest layout = sampleLayout();
        SeatCraftBlockDtos.BindingRequest duplicated = new SeatCraftBlockDtos.BindingRequest();
        duplicated.setBlockKey("block-a");
        duplicated.setGroupKey("vip");
        duplicated.setBindingRole(null);
        layout.setBindings(List.of(layout.getBindings().get(0), duplicated));

        assertRejected(layout);
    }

    @Test
    void saveDraftRejectsNullBlockElementWithBusinessException() {
        SeatCraftBlockDtos.LayoutRequest layout = sampleLayout();
        List<SeatCraftBlockDtos.BlockRequest> blocks = new ArrayList<>(layout.getBlocks());
        blocks.add(null);
        layout.setBlocks(blocks);

        assertRejected(layout);
    }

    @Test
    void saveDraftRejectsNullTicketGroupElementWithBusinessException() {
        SeatCraftBlockDtos.LayoutRequest layout = sampleLayout();
        List<SeatCraftBlockDtos.TicketGroupRequest> groups = new ArrayList<>(layout.getTicketGroups());
        groups.add(null);
        layout.setTicketGroups(groups);

        assertRejected(layout);
    }

    @Test
    void saveDraftRejectsNullOverrideElementWithBusinessException() {
        SeatCraftBlockDtos.LayoutRequest layout = sampleLayout();
        List<SeatCraftBlockDtos.OverrideRequest> overrides = new ArrayList<>(layout.getOverrides());
        overrides.add(null);
        layout.setOverrides(overrides);

        assertRejected(layout);
    }

    @Test
    void saveDraftRejectsOverrideWithMissingBlock() {
        SeatCraftBlockDtos.LayoutRequest layout = sampleLayout();
        layout.getOverrides().get(0).setBlockKey("missing");

        assertRejected(layout);
    }

    @Test
    void saveDraftRejectsDuplicateOverrideBlockRowAndSeat() {
        SeatCraftBlockDtos.LayoutRequest layout = sampleLayout();
        SeatCraftBlockDtos.OverrideRequest duplicated = new SeatCraftBlockDtos.OverrideRequest();
        duplicated.setBlockKey("block-a");
        duplicated.setRowNo(1);
        duplicated.setSeatNo(2);
        duplicated.setStatus("hidden");
        layout.setOverrides(List.of(layout.getOverrides().get(0), duplicated));

        assertRejected(layout);
    }

    @Test
    void saveDraftRejectsOverrideWithMissingRowNoOrSeatNo() {
        SeatCraftBlockDtos.LayoutRequest missingRow = sampleLayout();
        missingRow.getOverrides().get(0).setRowNo(null);
        assertRejected(missingRow);

        SeatCraftBlockDtos.LayoutRequest missingSeat = sampleLayout();
        missingSeat.getOverrides().get(0).setSeatNo(null);
        assertRejected(missingSeat);
    }

    @Test
    void getDraftClonesPublishedWithBaseVersionId() {
        SeatLayoutVersion published = new SeatLayoutVersion();
        published.setId(90L);
        published.setOwnerType("session");
        published.setOwnerId(3001L);
        published.setVersionNo(3);
        published.setVersionStatus("published");
        published.setName("已发布布局");
        published.setCanvasWidth(1200);
        published.setCanvasHeight(800);
        List<SeatLayoutVersionBlock> blocks = new ArrayList<>();
        List<SeatLayoutVersionTicketGroup> groups = new ArrayList<>();
        List<SeatLayoutVersionGroupBinding> bindings = new ArrayList<>();
        List<SeatLayoutVersionOverride> overrides = new ArrayList<>();

        when(versionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null, published, null, published);
        when(versionMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(published));
        doAnswer(invocation -> {
            SeatLayoutVersion version = invocation.getArgument(0);
            version.setId(100L);
            return 1;
        }).when(versionMapper).insert(any(SeatLayoutVersion.class));
        doAnswer(invocation -> {
            SeatLayoutVersionBlock block = invocation.getArgument(0);
            block.setId(200L);
            blocks.add(block);
            return 1;
        }).when(blockMapper).insert(any(SeatLayoutVersionBlock.class));
        doAnswer(invocation -> {
            groups.add(invocation.getArgument(0));
            return 1;
        }).when(groupMapper).insert(any(SeatLayoutVersionTicketGroup.class));
        doAnswer(invocation -> {
            bindings.add(invocation.getArgument(0));
            return 1;
        }).when(bindingMapper).insert(any(SeatLayoutVersionGroupBinding.class));
        doAnswer(invocation -> {
            overrides.add(invocation.getArgument(0));
            return 1;
        }).when(overrideMapper).insert(any(SeatLayoutVersionOverride.class));
        when(blockMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(publishedBlocks(), blocks);
        when(groupMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(publishedGroups(), groups);
        when(bindingMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(publishedBindings(), bindings);
        when(overrideMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(publishedOverrides(), overrides);

        service.getDraft("session", 3001L);

        verify(versionMapper).insert(org.mockito.ArgumentMatchers.argThat(version -> Long.valueOf(90L).equals(version.getBaseVersionId())
                && "draft".equals(version.getVersionStatus())));
    }

    @Test
    void saveDraftRejectsNullListElementWithBusinessException() {
        SeatCraftBlockDtos.LayoutRequest layout = sampleLayout();
        layout.setBindings(new ArrayList<>(layout.getBindings()));
        layout.getBindings().add(null);

        assertRejected(layout);
    }

    @Test
    void publishDraftArchivesCurrentPublishedAndMaterializesCompatibilityFields() {
        SeatLayoutVersion draft = version(100L, 4, "draft");
        SeatLayoutVersion published = version(90L, 3, "published");
        List<SeatBlock> insertedBlocks = new ArrayList<>();
        List<TicketGroup> insertedGroups = new ArrayList<>();
        List<SeatOverride> insertedOverrides = new ArrayList<>();

        when(versionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(draft, published);
        when(blockMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(publishedBlocks(), publishedBlocks());
        when(groupMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(publishedGroups(), publishedGroups());
        when(bindingMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(publishedBindings(), publishedBindings());
        when(overrideMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(publishedOverrides(), publishedOverrides());
        when(seatBlockMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());
        when(ticketGroupMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());
        doAnswer(invocation -> {
            SeatBlock block = invocation.getArgument(0);
            block.setId(300L);
            insertedBlocks.add(block);
            return 1;
        }).when(seatBlockMapper).insert(any(SeatBlock.class));
        doAnswer(invocation -> {
            insertedGroups.add(invocation.getArgument(0));
            return 1;
        }).when(ticketGroupMapper).insert(any(TicketGroup.class));
        doAnswer(invocation -> {
            insertedOverrides.add(invocation.getArgument(0));
            return 1;
        }).when(seatOverrideMapper).insert(any(SeatOverride.class));

        service.publishDraft("session", 3001L, 2003L);

        assertEquals("archived", published.getVersionStatus());
        assertNotNull(published.getUpdateTime());
        assertEquals("published", draft.getVersionStatus());
        assertEquals(2003L, draft.getPublishedBy());
        assertNotNull(draft.getPublishedAt());
        verify(versionMapper).updateById(published);
        verify(versionMapper).updateById(draft);
        InOrder order = inOrder(versionMapper);
        order.verify(versionMapper).updateById(published);
        order.verify(versionMapper).updateById(draft);
        assertEquals("vip", insertedBlocks.get(0).getTicketGroupKey());
        assertEquals("block-a", insertedGroups.get(0).getSourceBlockIds());
        assertEquals(300L, insertedOverrides.get(0).getBlockId());
    }

    @Test
    void rollbackClonesHistoricalVersionAsDraft() {
        SeatLayoutVersion historical = version(80L, 2, "archived");
        List<SeatLayoutVersionBlock> insertedBlocks = new ArrayList<>();
        List<SeatLayoutVersionTicketGroup> insertedGroups = new ArrayList<>();
        List<SeatLayoutVersionGroupBinding> insertedBindings = new ArrayList<>();
        List<SeatLayoutVersionOverride> insertedOverrides = new ArrayList<>();

        when(versionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(historical, null, null, historical);
        when(versionMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(historical));
        doAnswer(invocation -> {
            SeatLayoutVersion version = invocation.getArgument(0);
            version.setId(100L);
            return 1;
        }).when(versionMapper).insert(any(SeatLayoutVersion.class));
        doAnswer(invocation -> {
            SeatLayoutVersionBlock block = invocation.getArgument(0);
            block.setId(200L);
            insertedBlocks.add(block);
            return 1;
        }).when(blockMapper).insert(any(SeatLayoutVersionBlock.class));
        doAnswer(invocation -> {
            insertedGroups.add(invocation.getArgument(0));
            return 1;
        }).when(groupMapper).insert(any(SeatLayoutVersionTicketGroup.class));
        doAnswer(invocation -> {
            insertedBindings.add(invocation.getArgument(0));
            return 1;
        }).when(bindingMapper).insert(any(SeatLayoutVersionGroupBinding.class));
        doAnswer(invocation -> {
            insertedOverrides.add(invocation.getArgument(0));
            return 1;
        }).when(overrideMapper).insert(any(SeatLayoutVersionOverride.class));
        when(blockMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(publishedBlocks(), insertedBlocks);
        when(groupMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(publishedGroups(), insertedGroups);
        when(bindingMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(publishedBindings(), insertedBindings);
        when(overrideMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(publishedOverrides(), insertedOverrides);

        SeatCraftBlockDtos.LayoutRequest result = service.rollbackToDraft("session", 3001L, 80L, 2003L);

        assertEquals(100L, result.getVersionId());
        assertEquals("draft", result.getVersionStatus());
        verify(versionMapper).insert(org.mockito.ArgumentMatchers.argThat(version -> Long.valueOf(80L).equals(version.getBaseVersionId())
                && "draft".equals(version.getVersionStatus())));
    }

    @Test
    void rollbackDeletesOnlyExistingDraftDetails() {
        SeatLayoutVersion target = version(80L, 2, "archived");
        SeatLayoutVersion draft = version(100L, 4, "draft");
        List<SeatLayoutVersionBlock> draftBlocks = List.of(versionBlock(101L, 100L, "draft-block", 1, "gridBlock"));
        List<SeatLayoutVersionBlock> insertedBlocks = new ArrayList<>();
        List<SeatLayoutVersionTicketGroup> insertedGroups = new ArrayList<>();
        List<SeatLayoutVersionGroupBinding> insertedBindings = new ArrayList<>();
        List<SeatLayoutVersionOverride> insertedOverrides = new ArrayList<>();

        when(versionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(target, draft, null, target);
        when(versionMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(target, draft));
        doAnswer(invocation -> {
            SeatLayoutVersion version = invocation.getArgument(0);
            version.setId(110L);
            return 1;
        }).when(versionMapper).insert(any(SeatLayoutVersion.class));
        doAnswer(invocation -> {
            SeatLayoutVersionBlock block = invocation.getArgument(0);
            block.setId(210L);
            insertedBlocks.add(block);
            return 1;
        }).when(blockMapper).insert(any(SeatLayoutVersionBlock.class));
        doAnswer(invocation -> {
            insertedGroups.add(invocation.getArgument(0));
            return 1;
        }).when(groupMapper).insert(any(SeatLayoutVersionTicketGroup.class));
        doAnswer(invocation -> {
            insertedBindings.add(invocation.getArgument(0));
            return 1;
        }).when(bindingMapper).insert(any(SeatLayoutVersionGroupBinding.class));
        doAnswer(invocation -> {
            insertedOverrides.add(invocation.getArgument(0));
            return 1;
        }).when(overrideMapper).insert(any(SeatLayoutVersionOverride.class));
        when(blockMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(draftBlocks, publishedBlocks(), insertedBlocks);
        when(groupMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(publishedGroups(), insertedGroups);
        when(bindingMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(publishedBindings(), insertedBindings);
        when(overrideMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(publishedOverrides(), insertedOverrides);

        service.rollbackToDraft("session", 3001L, 80L, 2003L);

        verify(versionMapper).deleteById(100L);
        verify(versionMapper, never()).deleteById(80L);
        verify(overrideMapper).delete(any(LambdaQueryWrapper.class));
    }

    @Test
    void publishRejectsBlockWithoutPrimaryBinding() {
        SeatLayoutVersion draft = version(100L, 4, "draft");
        List<SeatLayoutVersionGroupBinding> noBindings = List.of();

        when(versionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(draft);
        when(blockMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(publishedBlocks());
        when(groupMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(publishedGroups());
        when(bindingMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(noBindings);

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.publishDraft("session", 3001L, 2003L));

        assertEquals(400, error.getCode());
    }

    @Test
    void publishRejectsStandingBlockWithoutPrimaryBinding() {
        SeatLayoutVersion draft = version(100L, 4, "draft");
        SeatLayoutVersionBlock standing = versionBlock(91L, 100L, "standing-a", 1, "standingBlock");

        when(versionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(draft);
        when(blockMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(standing));
        when(groupMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(publishedGroups());
        when(bindingMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.publishDraft("session", 3001L, 2003L));

        assertEquals(400, error.getCode());
    }

    @Test
    void publishMaterializesSourceBlockIdsInStableBlockOrder() {
        SeatLayoutVersion draft = version(100L, 4, "draft");
        List<TicketGroup> insertedGroups = new ArrayList<>();

        when(versionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(draft, null);
        when(blockMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(
                versionBlock(92L, 100L, "block-b", 2, "gridBlock"),
                versionBlock(91L, 100L, "block-a", 1, "gridBlock")));
        when(groupMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(publishedGroups(), publishedGroups());
        when(bindingMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(
                binding("block-b", "vip", 2),
                binding("block-a", "vip", 1)), List.of(
                binding("block-b", "vip", 2),
                binding("block-a", "vip", 1)));
        when(overrideMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(), List.of());
        when(seatBlockMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());
        when(ticketGroupMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());
        doAnswer(invocation -> {
            SeatBlock block = invocation.getArgument(0);
            block.setId("block-a".equals(block.getBlockKey()) ? 301L : 302L);
            return 1;
        }).when(seatBlockMapper).insert(any(SeatBlock.class));
        doAnswer(invocation -> {
            insertedGroups.add(invocation.getArgument(0));
            return 1;
        }).when(ticketGroupMapper).insert(any(TicketGroup.class));

        service.publishDraft("session", 3001L, 2003L);

        assertEquals("block-a,block-b", insertedGroups.get(0).getSourceBlockIds());
    }

    @Test
    void publishDoesNotUpdateMaterializedBlocksFromOtherOwner() {
        SeatLayoutVersion draft = version(100L, 4, "draft");
        SeatBlock currentOwnerBlock = materializedBlock(301L, "session", 3001L, "stale-current");
        SeatBlock otherOwnerBlock = materializedBlock(302L, "session", 9999L, "stale-other");

        when(versionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(draft, null);
        when(blockMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(publishedBlocks(), publishedBlocks());
        when(groupMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(publishedGroups(), publishedGroups());
        when(bindingMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(publishedBindings(), publishedBindings());
        when(overrideMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(publishedOverrides(), publishedOverrides());
        when(seatBlockMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(currentOwnerBlock, otherOwnerBlock));
        when(ticketGroupMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());
        doAnswer(invocation -> {
            SeatBlock block = invocation.getArgument(0);
            block.setId(303L);
            return 1;
        }).when(seatBlockMapper).insert(any(SeatBlock.class));

        service.publishDraft("session", 3001L, 2003L);

        verify(seatBlockMapper).updateById(currentOwnerBlock);
        verify(seatBlockMapper, never()).updateById(otherOwnerBlock);
    }

    @Test
    void listVersionsReturnsOnlyOwnerVersionsInStableServiceOrder() {
        SeatLayoutVersion newest = version(101L, 5, "draft");
        newest.setName("最新草稿");
        newest.setBaseVersionId(90L);
        newest.setPublishedBy(2003L);
        newest.setPublishedAt(LocalDateTime.of(2026, 5, 25, 10, 0));
        newest.setCreateTime(LocalDateTime.of(2026, 5, 25, 9, 0));
        newest.setUpdateTime(LocalDateTime.of(2026, 5, 25, 11, 0));
        SeatLayoutVersion sameVersionHigherId = version(102L, 5, "archived");
        SeatLayoutVersion sameVersionNullId = version(null, 5, "archived");
        SeatLayoutVersion older = version(90L, 4, "published");
        older.setName("当前发布");
        SeatLayoutVersion nullVersionNo = version(500L, null, "archived");
        SeatLayoutVersion otherOwner = version(999L, 99, "published");
        otherOwner.setOwnerId(9999L);
        when(versionMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(
                nullVersionNo,
                otherOwner,
                newest,
                older,
                sameVersionNullId,
                sameVersionHigherId));

        List<SeatCraftBlockDtos.VersionSummary> result = service.listVersions(" session ", 3001L);

        assertEquals(5, result.size());
        assertEquals(102L, result.get(0).getId());
        assertEquals(5, result.get(0).getVersionNo());
        assertEquals(101L, result.get(1).getId());
        assertEquals(5, result.get(1).getVersionNo());
        assertEquals("draft", result.get(1).getVersionStatus());
        assertEquals("最新草稿", result.get(1).getName());
        assertEquals(90L, result.get(1).getBaseVersionId());
        assertEquals(2003L, result.get(1).getPublishedBy());
        assertEquals(LocalDateTime.of(2026, 5, 25, 10, 0), result.get(1).getPublishedAt());
        assertEquals(LocalDateTime.of(2026, 5, 25, 9, 0), result.get(1).getCreateTime());
        assertEquals(LocalDateTime.of(2026, 5, 25, 11, 0), result.get(1).getUpdateTime());
        assertNull(result.get(2).getId());
        assertEquals(5, result.get(2).getVersionNo());
        assertEquals(90L, result.get(3).getId());
        assertEquals(4, result.get(3).getVersionNo());
        assertEquals(500L, result.get(4).getId());
        assertNull(result.get(4).getVersionNo());
        verify(versionMapper).selectList(any(LambdaQueryWrapper.class));
    }

    @Test
    void listVersionsReturnsEmptyListWhenMapperReturnsNull() {
        when(versionMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(null);

        List<SeatCraftBlockDtos.VersionSummary> result = service.listVersions("session", 3001L);

        assertEquals(0, result.size());
    }

    @Test
    void listVersionsRejectsInvalidOwner() {
        BusinessException error = assertThrows(BusinessException.class,
                () -> service.listVersions(" ", 3001L));

        assertEquals(400, error.getCode());
        verify(versionMapper, never()).selectList(any(LambdaQueryWrapper.class));
    }

    private void assertRejected(SeatCraftBlockDtos.LayoutRequest layout) {
        BusinessException error = assertThrows(BusinessException.class,
                () -> service.saveDraft("session", 3001L, layout, 2003L));

        assertEquals(400, error.getCode());
    }

    private SeatCraftBlockDtos.LayoutRequest sampleLayout() {
        SeatCraftBlockDtos.LayoutRequest layout = new SeatCraftBlockDtos.LayoutRequest();
        layout.setName("测试布局");
        layout.setCanvasWidth(1200);
        layout.setCanvasHeight(800);

        SeatCraftBlockDtos.BlockRequest block = new SeatCraftBlockDtos.BlockRequest();
        block.setBlockKey("block-a");
        block.setName("A 区");
        block.setBlockType("gridBlock");
        block.setTicketGroupKey("vip");
        block.setX(new BigDecimal("100"));
        block.setY(new BigDecimal("200"));
        block.setRows(2);
        block.setCols(3);
        block.setSort(1);
        layout.setBlocks(List.of(block));

        SeatCraftBlockDtos.TicketGroupRequest group = new SeatCraftBlockDtos.TicketGroupRequest();
        group.setGroupKey("vip");
        group.setName("VIP");
        group.setDefaultPrice(new BigDecimal("680"));
        group.setActivityPrice(new BigDecimal("580"));
        group.setSourceBlockKeys(List.of("block-a"));
        group.setSort(1);
        layout.setTicketGroups(List.of(group));

        SeatCraftBlockDtos.BindingRequest binding = new SeatCraftBlockDtos.BindingRequest();
        binding.setBlockKey("block-a");
        binding.setGroupKey("vip");
        binding.setBindingRole("primary");
        binding.setSort(1);
        layout.setBindings(List.of(binding));

        SeatCraftBlockDtos.OverrideRequest override = new SeatCraftBlockDtos.OverrideRequest();
        override.setBlockKey("block-a");
        override.setRowNo(1);
        override.setSeatNo(2);
        override.setStatus("visible");
        override.setDx(new BigDecimal("3.5"));
        override.setDy(new BigDecimal("-2.5"));
        override.setCustomLabel("A02");
        layout.setOverrides(List.of(override));
        return layout;
    }

    private SeatLayoutVersion version(Long id, Integer versionNo, String status) {
        SeatLayoutVersion version = new SeatLayoutVersion();
        version.setId(id);
        version.setOwnerType("session");
        version.setOwnerId(3001L);
        version.setVersionNo(versionNo);
        version.setVersionStatus(status);
        version.setName("测试布局");
        version.setCanvasWidth(1200);
        version.setCanvasHeight(800);
        return version;
    }

    private List<SeatLayoutVersionBlock> publishedBlocks() {
        return List.of(versionBlock(91L, 90L, "block-a", 1, "gridBlock"));
    }

    private SeatLayoutVersionBlock versionBlock(Long id, Long versionId, String blockKey, Integer sort, String blockType) {
        SeatLayoutVersionBlock block = new SeatLayoutVersionBlock();
        block.setId(id);
        block.setVersionId(versionId);
        block.setBlockKey(blockKey);
        block.setName(blockKey);
        block.setBlockType(blockType);
        block.setX(new BigDecimal("100"));
        block.setY(new BigDecimal("200"));
        block.setSort(sort);
        return block;
    }

    private List<SeatLayoutVersionTicketGroup> publishedGroups() {
        SeatLayoutVersionTicketGroup group = new SeatLayoutVersionTicketGroup();
        group.setVersionId(90L);
        group.setGroupKey("vip");
        group.setName("VIP");
        group.setDefaultPrice(new BigDecimal("680"));
        group.setActivityPrice(new BigDecimal("580"));
        group.setSort(1);
        return List.of(group);
    }

    private List<SeatLayoutVersionGroupBinding> publishedBindings() {
        return List.of(binding("block-a", "vip", 1));
    }

    private SeatLayoutVersionGroupBinding binding(String blockKey, String groupKey, Integer sort) {
        SeatLayoutVersionGroupBinding binding = new SeatLayoutVersionGroupBinding();
        binding.setVersionId(90L);
        binding.setBlockKey(blockKey);
        binding.setGroupKey(groupKey);
        binding.setBindingRole("primary");
        binding.setSort(sort);
        return binding;
    }

    private SeatBlock materializedBlock(Long id, String ownerType, Long ownerId, String blockKey) {
        SeatBlock block = new SeatBlock();
        block.setId(id);
        block.setOwnerType(ownerType);
        block.setOwnerId(ownerId);
        block.setBlockKey(blockKey);
        block.setStatus(1);
        return block;
    }

    private List<SeatLayoutVersionOverride> publishedOverrides() {
        SeatLayoutVersionOverride override = new SeatLayoutVersionOverride();
        override.setVersionBlockId(91L);
        override.setRowNo(1);
        override.setSeatNo(2);
        override.setStatus("visible");
        override.setDx(new BigDecimal("3.5"));
        override.setDy(new BigDecimal("-2.5"));
        override.setCustomLabel("A02");
        return List.of(override);
    }
}
