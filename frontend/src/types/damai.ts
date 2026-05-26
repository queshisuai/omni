export interface Category {
  id: string;
  name: string;
  icon?: string;
}

export interface Activity {
  id: string;
  itemType?: 'activity' | 'tour';
  title: string;
  categoryId: string;
  poster: string;
  venue: string;
  showTime: string;
  priceRange: string;
  price: number;
  status: 'on_sale' | 'coming_soon' | 'sold_out';
}

export interface SectionData {
  id: string;
  title: string;
  category: string;
  viewAllUrl: string;
  items: Activity[];
}
