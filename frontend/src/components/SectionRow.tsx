import { SectionData } from "@/types/damai";
import { TicketCard } from "./TicketCard";
import { ChevronRight } from "lucide-react";

interface SectionRowProps {
  section: SectionData;
}

export function SectionRow({ section }: SectionRowProps) {
  return (
    <section className="py-10">
      <div className="max-w-[1200px] mx-auto px-5">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[24px] text-[#111] font-normal">
            {section.title}
          </h2>
          <a
            href={section.viewAllUrl}
            className="flex items-center gap-1 text-[14px] text-[#999] hover:text-[#ff1268] transition-colors"
          >
            查看全部
            <ChevronRight className="w-4 h-4" />
          </a>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-5">
          {section.items.slice(0, 7).map((item) => (
            <TicketCard key={item.id} activity={item} />
          ))}
        </div>
      </div>
    </section>
  );
}
