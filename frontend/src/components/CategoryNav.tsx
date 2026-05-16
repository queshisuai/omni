import { Category } from "@/types/damai";

interface CategoryNavProps {
  categories: Category[];
  activeCategory?: string;
  onCategoryClick?: (id: string) => void;
}

export function CategoryNav({ categories, activeCategory, onCategoryClick }: CategoryNavProps) {
  return (
    <nav className="bg-white border-b border-[#e5e5e5] overflow-x-auto">
      <div className="max-w-[1200px] mx-auto flex items-center gap-0 px-5">
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
            className={`flex-shrink-0 px-5 py-3 text-[14px] whitespace-nowrap transition-colors border-b-2 no-underline ${
              activeCategory === cat.id
                ? "text-[#ff1268] border-[#ff1268]"
                : "text-[#111] border-transparent hover:text-[#ff1268]"
            }`}
          >
            {cat.name}
          </a>
        ))}
      </div>
    </nav>
  );
}
