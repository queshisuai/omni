export type SeatStatus = 'available' | 'reserved' | 'selected' | 'occupied';

export interface SeatData {
  id: string;
  row: number;
  col: number;
  x?: number;
  y?: number;
  angle?: number;
  status: SeatStatus;
  price: number;
  section: string;
  label?: string;
}

export interface SectionData {
  id: string;
  name: string;
  rows: number;
  cols: number;
  x: number;
  y: number;
  color: string;
  type: 'core' | 'stand' | 'zone';
  layout?: 'grid' | 'curved';
  radius?: number;
  arcSpan?: number; 
  rotation?: number; 
  primeRange?: {
    rowStart: number;
    rowEnd: number;
    colStart: number;
    colEnd: number;
  };
}

export interface MapConfig {
  stageWidth: number;
  stageHeight: number;
  sections: SectionData[];
}
