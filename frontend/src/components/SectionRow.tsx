import { SectionData } from "@/types/omni";
import { TicketCard } from "./TicketCard";
import { ChevronRight } from "lucide-react";
import { buildSectionItemKey } from "@/lib/section-row";

interface SectionRowProps {
  section: SectionData;
}

export function SectionRow({ section }: SectionRowProps) {
  return (
    <section className="py-10">
      <div className="max-w-[1200px] mx-auto px-5">
        {/* Section Header */}
        <div className="flex items-end justify-between mb-8">
          <h2 className="text-[28px] font-extrabold text-gray-900 tracking-tight">
            {section.title}
          </h2>
          <a
            href={section.viewAllUrl}
            className="flex items-center gap-1 text-[14px] font-medium text-gray-500 hover:text-[#ff1268] transition-colors pb-1"
          >
            查看全部
            <ChevronRight className="w-4 h-4" />
          </a>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
          {section.items.slice(0, 6).map((item, index) => (
            <TicketCard key={buildSectionItemKey(section.id, item, index)} activity={item} />
          ))}
        </div>
      </div>
    </section>
  );
}
