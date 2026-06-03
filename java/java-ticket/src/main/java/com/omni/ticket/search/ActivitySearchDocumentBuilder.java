package com.omni.ticket.search;

import com.omni.ticket.dto.ActivityArtistDto;
import com.omni.ticket.dto.ActivityVO;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

public final class ActivitySearchDocumentBuilder {

    private ActivitySearchDocumentBuilder() {}

    public static ActivitySearchDocument fromActivityVo(ActivityVO vo) {
        ActivitySearchDocument document = new ActivitySearchDocument();
        String itemType = StringUtils.hasText(vo.getItemType()) ? vo.getItemType() : "activity";
        document.setId(vo.getId());
        document.setDocumentId(itemType + ":" + vo.getId());
        document.setItemType(itemType);
        document.setName(vo.getName());
        document.setPoster(vo.getPoster());
        document.setCategoryName(vo.getCategoryName());
        document.setArtistName(vo.getArtistName());
        document.setArtistNames(resolveArtistNames(vo));
        document.setVenueCity(vo.getVenueCity());
        document.setCities(splitCities(vo.getVenueCity()));
        document.setStartTime(vo.getStartTime());
        document.setMinPrice(vo.getMinPrice());
        document.setSeatMapVisibility(vo.getSeatMapVisibility());
        document.setRealNameRequired(Boolean.TRUE.equals(vo.getRealNameRequired()));
        document.setTicketTransferAllowed(!Boolean.FALSE.equals(vo.getTicketTransferAllowed()));
        document.setStatus(vo.getStatus());
        document.setSaleStatus(resolveSaleStatus(vo));
        document.setSearchText(buildSearchText(document));
        return document;
    }

    private static List<String> resolveArtistNames(ActivityVO vo) {
        if (vo.getArtists() != null && !vo.getArtists().isEmpty()) {
            return vo.getArtists().stream()
                    .map(ActivityArtistDto::getName)
                    .filter(StringUtils::hasText)
                    .map(String::trim)
                    .distinct()
                    .collect(Collectors.toList());
        }
        if (StringUtils.hasText(vo.getArtistName())) {
            return List.of(vo.getArtistName().trim());
        }
        return List.of();
    }

    private static List<String> splitCities(String venueCity) {
        if (!StringUtils.hasText(venueCity)) {
            return List.of();
        }
        List<String> cities = new ArrayList<>();
        for (String part : venueCity.split("/")) {
            String city = part.trim();
            if (StringUtils.hasText(city) && !cities.contains(city)) {
                cities.add(city);
            }
        }
        return cities;
    }

    private static String resolveSaleStatus(ActivityVO vo) {
        if (Integer.valueOf(1).equals(vo.getStatus())) {
            return "on_sale";
        }
        if (Integer.valueOf(2).equals(vo.getStatus()) || vo.getMinPrice() == null) {
            return "coming_soon";
        }
        if (Integer.valueOf(0).equals(vo.getStatus()) || Integer.valueOf(3).equals(vo.getStatus())) {
            return "sold_out";
        }
        return "coming_soon";
    }

    private static String buildSearchText(ActivitySearchDocument document) {
        List<String> parts = new ArrayList<>();
        addText(parts, document.getName());
        addText(parts, document.getArtistName());
        for (String artistName : document.getArtistNames()) {
            addText(parts, artistName);
        }
        addText(parts, document.getCategoryName());
        addText(parts, document.getVenueCity());
        return parts.stream().distinct().collect(Collectors.joining(" "));
    }

    private static void addText(List<String> parts, String value) {
        if (StringUtils.hasText(value)) {
            parts.add(value.trim());
        }
    }
}
