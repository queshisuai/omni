import { Activity } from "@/types/omni";
import { MapPin, Calendar } from "lucide-react";
import { SafeImage } from "@/components/SafeImage";

interface TicketCardProps {
  activity: Activity;
}

export function TicketCard({ activity }: TicketCardProps) {
  return (
    <a
      href={activity.itemType === 'tour' ? `/tour/${activity.id}` : `/activity/${activity.id}`}
      className="group block bg-white rounded-2xl overflow-hidden hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 border border-gray-100"
    >
      {/* Poster */}
      <div className="relative aspect-[3/4] overflow-hidden bg-gray-100">
        <SafeImage
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
        {activity.status === "status_syncing" && (
          <div className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[12px] font-medium text-white">
            状态同步中
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="text-[15px] font-bold text-gray-900 leading-snug line-clamp-2 mb-3 group-hover:text-[#ff1268] transition-colors">
          {activity.title}
        </h3>

        <div className="flex items-center gap-1.5 text-[13px] text-gray-500 mb-1.5">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{activity.venue}</span>
        </div>

        <div className="flex items-center gap-1.5 text-[13px] text-gray-500 mb-3">
          <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{activity.showTime}</span>
        </div>

        <div className="flex items-baseline gap-1 text-[#ff1268] font-bold tracking-tight mt-1">
          <span className="text-[18px]">{activity.priceRange}</span>
        </div>
      </div>
    </a>
  );
}
