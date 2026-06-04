package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.ticket.dto.SeatCraftBlockDtos;
import com.omni.ticket.dto.SeatCraftLayoutDtos;
import com.omni.ticket.dto.InternalUserRefResponse;
import com.omni.ticket.entity.Venue;
import com.omni.ticket.entity.VenueArea;
import com.omni.ticket.entity.VenueDefaultLayout;
import com.omni.ticket.service.UserAccessService;
import com.omni.ticket.mapper.VenueAreaMapper;
import com.omni.ticket.mapper.VenueDefaultLayoutMapper;
import com.omni.ticket.mapper.VenueDefaultLayoutSectionMapper;
import com.omni.ticket.mapper.VenueMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.same;
import static org.mockito.ArgumentMatchers.eq;

@ExtendWith(MockitoExtension.class)
class VenueDefaultLayoutServiceTest {
    @Mock
    private VenueDefaultLayoutMapper layoutMapper;
    @Mock
    private VenueDefaultLayoutSectionMapper sectionMapper;
    @Mock
    private VenueMapper venueMapper;
    @Mock
    private VenueAreaMapper venueAreaMapper;
    @Mock
    private UserAccessService userAccessService;
    @Mock
    private SeatCraftBlockLayoutService blockLayoutService;

    private VenueDefaultLayoutService service;

    @BeforeEach
    void setUp() {
        service = new VenueDefaultLayoutService(layoutMapper, sectionMapper, venueMapper, venueAreaMapper, userAccessService, blockLayoutService);
    }

    @Test
    void saveLayoutAcceptsBlockOnlyLayoutAndPersistsBlocks() {
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2002L, "venue.manage")).thenReturn(user("admin"));
        when(venueMapper.selectById(9L)).thenReturn(venue());
        when(layoutMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);
        doAnswer(invocation -> {
            VenueDefaultLayout layout = invocation.getArgument(0);
            layout.setId(88L);
            return 1;
        }).when(layoutMapper).insert(any(VenueDefaultLayout.class));
        SeatCraftLayoutDtos.LayoutResponse request = blockOnlyLayout();

        service.saveLayout(2002L, 9L, request);

        ArgumentCaptor<VenueDefaultLayout> captor = ArgumentCaptor.forClass(VenueDefaultLayout.class);
        verify(layoutMapper).insert(captor.capture());
        assertEquals(9L, captor.getValue().getVenueId());
        verify(blockLayoutService).replaceLayout(eq("venue"), eq(9L), same(request.getBlockLayout()));
    }

    @Test
    void getLayoutIncludesBlockLayout() {
        VenueDefaultLayout layout = new VenueDefaultLayout();
        layout.setId(88L);
        layout.setVenueId(9L);
        layout.setName("默认座位图");
        layout.setTemplateType("concert");
        layout.setStageTitle("舞台");
        layout.setStageX(0);
        layout.setStageY(0);
        layout.setCanvasWidth(1000);
        layout.setCanvasHeight(800);
        when(layoutMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(layout);
        when(sectionMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());
        SeatCraftBlockDtos.LayoutRequest blockLayout = new SeatCraftBlockDtos.LayoutRequest();
        when(blockLayoutService.getLayout("venue", 9L)).thenReturn(blockLayout);

        SeatCraftLayoutDtos.LayoutResponse response = service.getLayout(9L);

        assertSame(blockLayout, response.getBlockLayout());
    }

    @Test
    void getLayoutBackfillsFromLegacyVenueAreasWhenDefaultLayoutIsMissing() {
        when(layoutMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);
        when(venueMapper.selectById(9L)).thenReturn(venue());
        when(venueAreaMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(area(1L, "VIP区", 5, 12, 1), area(2L, "A区", 8, 16, 2)));
        doAnswer(invocation -> {
            VenueDefaultLayout layout = invocation.getArgument(0);
            layout.setId(88L);
            return 1;
        }).when(layoutMapper).insert(any(VenueDefaultLayout.class));

        SeatCraftLayoutDtos.LayoutResponse response = service.getLayout(9L);

        assertEquals("北京星河体育馆 SeatCraft 座位图", response.getName());
        assertEquals(2, response.getBlockLayout().getBlocks().size());
        assertEquals("VIP区", response.getBlockLayout().getBlocks().get(0).getName());
        assertEquals(5, response.getBlockLayout().getBlocks().get(0).getRows());
        assertEquals(12, response.getBlockLayout().getBlocks().get(0).getCols());
        assertEquals(2, response.getBlockLayout().getTicketGroups().size());
        verify(blockLayoutService).replaceLayout(eq("venue"), eq(9L), any(SeatCraftBlockDtos.LayoutRequest.class));
    }

    private SeatCraftLayoutDtos.LayoutResponse blockOnlyLayout() {
        SeatCraftLayoutDtos.LayoutResponse layout = new SeatCraftLayoutDtos.LayoutResponse();
        layout.setName("默认座位图");
        layout.setTemplateType("concert");
        layout.setStageTitle("舞台");
        layout.setStageX(0);
        layout.setStageY(0);
        layout.setCanvasWidth(1000);
        layout.setCanvasHeight(800);
        layout.setSections(List.of());

        SeatCraftBlockDtos.LayoutRequest blockLayout = new SeatCraftBlockDtos.LayoutRequest();
        SeatCraftBlockDtos.BlockRequest block = new SeatCraftBlockDtos.BlockRequest();
        block.setBlockKey("block-a");
        block.setName("A 区");
        block.setBlockType("gridBlock");
        block.setTicketGroupKey("vip");
        block.setX(new BigDecimal("100"));
        block.setY(new BigDecimal("200"));
        block.setRows(2);
        block.setCols(3);
        blockLayout.setBlocks(List.of(block));

        SeatCraftBlockDtos.TicketGroupRequest group = new SeatCraftBlockDtos.TicketGroupRequest();
        group.setGroupKey("vip");
        group.setName("VIP");
        group.setSourceBlockKeys(List.of("block-a"));
        blockLayout.setTicketGroups(List.of(group));
        layout.setBlockLayout(blockLayout);
        return layout;
    }

    private InternalUserRefResponse user(String role) {
        InternalUserRefResponse user = new InternalUserRefResponse();
        user.setRole(role);
        return user;
    }

    private Venue venue() {
        Venue venue = new Venue();
        venue.setId(9L);
        venue.setName("北京星河体育馆");
        venue.setStatus(1);
        return venue;
    }

    private VenueArea area(Long id, String name, Integer rows, Integer cols, Integer sort) {
        VenueArea area = new VenueArea();
        area.setId(id);
        area.setVenueId(9L);
        area.setName(name);
        area.setRowCount(rows);
        area.setSeatsPerRow(cols);
        area.setColor("#ff1268");
        area.setSort(sort);
        area.setStatus(1);
        return area;
    }
}
