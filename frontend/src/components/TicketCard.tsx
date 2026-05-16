import { Activity } from "@/types/damai";
import { MapPin, Calendar } from "lucide-react";

interface TicketCardProps {
  activity: Activity;
}

export function TicketCard({ activity }: TicketCardProps) {
  return (
    <a
      href={`/activity/${activity.id}`}
      className="group block bg-white rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-300"
    >
      {/* Poster */}
      <div className="relative aspect-[3/4] overflow-hidden bg-[#f5f5f5]">
        <img
          src={activity.poster}
          alt={activity.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        {activity.status === "sold_out" && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white text-lg font-medium">售罄</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="text-[14px] text-[#111] leading-[1.4] line-clamp-2 mb-2 group-hover:text-[#ff1268] transition-colors">
          {activity.title}
        </h3>

        <div className="flex items-center gap-1 text-[12px] text-[#999] mb-1">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{activity.venue}</span>
        </div>

        <div className="flex items-center gap-1 text-[12px] text-[#999] mb-2">
          <Calendar className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{activity.showTime}</span>
        </div>

        <div className="text-[16px] text-[#ff1268] font-medium">
          {activity.priceRange}
        </div>
      </div>
    </a>
  );
}
