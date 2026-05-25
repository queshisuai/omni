import { Category } from "@/types/damai";

interface CategoryNavProps {
  categories: Category[];
  activeCategory?: string;
  onCategoryClick?: (id: string) => void;
}

export function CategoryNav({ categories, activeCategory, onCategoryClick }: CategoryNavProps) {
  return (
    <nav className="w-full flex justify-center py-4 bg-white sticky top-[72px] z-40 border-b border-gray-100/50 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] backdrop-blur-xl bg-white/90">
      <div className="max-w-[1200px] flex items-center gap-2 px-6 overflow-x-auto no-scrollbar">
        {categories.map((cat) => (
          <a
            key={cat.id}
            href={`/search?category=${encodeURIComponent(cat.name)}`}
            onClick={(e) => {
              if (onCategoryClick) {
                e.preventDefault()
                onCategoryClick(cat.id)
              }
            }}
            className={`flex-shrink-0 px-5 py-2 text-[14px] font-medium rounded-full whitespace-nowrap transition-all duration-300 ${
              activeCategory === cat.id
                ? "bg-gradient-to-r from-[#ff1268] to-[#ff4b8b] text-white shadow-md shadow-[#ff1268]/20"
                : "bg-gray-50/80 text-gray-600 hover:bg-[#fff4f8] hover:text-[#ff1268]"
            }`}
          >
            {cat.name}
          </a>
        ))}
      </div>
    </nav>
  )
}
