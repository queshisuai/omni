import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Move } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { SeatData, SectionData, SeatStatus } from './types';

interface SeatProps {
  seat: SeatData;
  onClick: (seat: SeatData) => void;
  size?: number;
  color?: string;
  isPrime?: boolean;
}

const Seat: React.FC<SeatProps> = ({ seat, onClick, size = 12, color = '#34d399', isPrime = false }) => {
  const x = seat.x !== undefined ? seat.x : seat.col * (size + 4);
  const y = seat.y !== undefined ? seat.y : seat.row * (size + 4);
  const angle = seat.angle || 0;

  const getSeatColors = () => {
    if (seat.status === 'selected') {
      return { fill: '#ffffff', stroke: '#ffffff', strokeWidth: 1.5 };
    }
    if (seat.status === 'occupied') {
      return { fill: '#27272a', stroke: '#3f3f46', strokeWidth: 1.5 };
    }
    if (seat.status === 'reserved') {
      return { fill: '#f43f5e', stroke: '#e11d48', strokeWidth: 1.5 };
    }
    
    // Available
    const isPrimeSeat = !!isPrime && seat.status === 'available';
    if (isPrimeSeat) {
      return {
        fill: '#fbbf24',
        stroke: color,
        strokeWidth: 2
      };
    }
    
    return {
      fill: color,
      stroke: color,
      strokeWidth: 1
    };
  };

  const colors = getSeatColors();

  return (
    <motion.rect
      x={x - size / 2}
      y={y - size / 2}
      width={size}
      height={size}
      rx={3}
      fill={colors.fill}
      stroke={colors.stroke}
      strokeWidth={colors.strokeWidth}
      transform={`rotate(${angle}, ${x}, ${y})`}
      className={cn(
        "transition-all duration-300 cursor-pointer", 
        seat.status === 'occupied' && "pointer-events-none opacity-40",
        seat.status === 'selected' && "drop-shadow-[0_0_12px_rgba(255,255,255,1)]"
      )}
      onClick={() => onClick(seat)}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      whileHover={{ scale: 1.3, zIndex: 10 }}
      whileTap={{ scale: 0.8 }}
    >
      <title>{`${seat.section} - ${seat.label}`}</title>
    </motion.rect>
  );
};

Seat.displayName = 'Seat';

interface SeatMapProps {
  sections: SectionData[];
  selectedSeats: string[];
  onSeatClick: (seat: SeatData) => void;
  isDesignMode: boolean;
  onPositionUpdate: (id: string, x: number, y: number) => void;
  stagePos: { x: number; y: number };
  onStagePositionUpdate: (x: number, y: number) => void;
  stageTitle?: string;
}

export const SeatMap = ({ 
  sections, 
  selectedSeats, 
  onSeatClick, 
  isDesignMode,
  onPositionUpdate,
  stagePos,
  onStagePositionUpdate,
  stageTitle = "舞台"
}: SeatMapProps) => {
  const renderSection = (section: SectionData) => {
    const seats: SeatData[] = [];
    const seatSize = 12;
    const seatGap = 4;
    const seatSpacing = seatSize + seatGap;
    
    for (let r = 0; r < section.rows; r++) {
      const innerRadius = section.radius || 200;
      const currentRadius = innerRadius + (r * seatSpacing);
      const baseSpan = section.arcSpan || 120;

      const firstRowArcLength = (innerRadius * baseSpan * Math.PI) / 180;
      const targetSpacing = section.cols > 1 ? firstRowArcLength / (section.cols - 1) : seatSpacing;
      const currentRowArcLength = (currentRadius * baseSpan * Math.PI) / 180;

      let colsInRow = section.cols;
      if (section.layout === 'curved') {
        colsInRow = Math.max(section.cols, Math.round(currentRowArcLength / targetSpacing) + 1);
      }

      for (let c = 0; c < colsInRow; c++) {
        const id = `${section.id}-${r}-${c}`;
        let seatX = (c - (colsInRow - 1) / 2) * seatSpacing;
        let seatY = r * seatSpacing;
        let seatAngle = 0;

        if (section.layout === 'curved') {
          const arcLengthRad = (baseSpan * Math.PI) / 180;
          const angleStep = colsInRow > 1 ? (arcLengthRad / (colsInRow - 1)) : 0;
          const theta = (c - (colsInRow - 1) / 2) * angleStep;
          
          seatX = currentRadius * Math.sin(theta);
          seatY = -currentRadius * Math.cos(theta) + innerRadius;
          seatAngle = (theta * 180) / Math.PI;
        }

        seats.push({
          id,
          row: r,
          col: c,
          x: seatX,
          y: seatY,
          angle: seatAngle,
          status: selectedSeats.includes(id) ? 'selected' : 'available' as SeatStatus,
          price: 100,
          section: section.name,
          label: `${r + 1}排${c + 1}座`
        });
      }
    }

    const width = section.cols * seatSpacing;
    const height = section.rows * seatSpacing;

    // Helper for curved background path
    const getCurvedPath = () => {
      const innerRadius = section.radius || 200;
      const r1 = innerRadius - 20;
      // Calculate max radius used by seats
      const maxRows = section.rows;
      const r2 = r1 + (maxRows * seatSpacing) + 30;
      const span = section.arcSpan || 120;
      const paddingAngle = 2; // small padding in degrees
      const rad = ((span + paddingAngle) / 2) * Math.PI / 180;

      const shiftY = innerRadius;
      
      const x1 = r1 * Math.sin(-rad);
      const y1 = -r1 * Math.cos(-rad) + shiftY;
      const x2 = r1 * Math.sin(rad);
      const y2 = -r1 * Math.cos(rad) + shiftY;
      
      const x3 = r2 * Math.sin(rad);
      const y3 = -r2 * Math.cos(rad) + shiftY;
      const x4 = r2 * Math.sin(-rad);
      const y4 = -r2 * Math.cos(-rad) + shiftY;

      const largeArc = span > 180 ? 1 : 0;

      return `M ${x1} ${y1} A ${r1} ${r1} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${r2} ${r2} 0 ${largeArc} 0 ${x4} ${y4} Z`;
    };

    return (
      <motion.g
        key={section.id}
        drag={isDesignMode}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          onPositionUpdate(section.id, section.x + info.offset.x, section.y + info.offset.y);
        }}
        initial={false}
        animate={{ 
          x: section.x, 
          y: section.y,
          rotate: section.rotation || 0
        }}
        className={cn(
          "group transition-none",
          isDesignMode ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"
        )}
      >
        {/* Section Container Box */}
        {section.layout !== 'curved' ? (
          <rect
            x={-width / 2 - 12}
            y={-35}
            width={width + 24}
            height={height + 45}
            rx={12}
            className={cn(
              "fill-zinc-900/40 stroke-zinc-800/80 transition-all duration-300",
              isDesignMode ? "hover:stroke-emerald-500/50 hover:bg-zinc-800/60" : "group-hover:stroke-zinc-700"
            )}
          />
        ) : (
          <path
            d={getCurvedPath()}
            className={cn(
              "fill-zinc-900/40 stroke-zinc-800/80 transition-all duration-300",
              isDesignMode ? "hover:stroke-emerald-500/50 hover:bg-zinc-800/60" : "group-hover:stroke-zinc-700"
            )}
          />
        )}
        
        {/* Visual Border Accent */}
        <path
          d={section.layout !== 'curved' 
            ? `M ${-width / 2 - 12} -35 L ${width / 2 + 12} -35`
            : "" 
          }
          className={cn(
            "stroke-[2px] opacity-50",
            section.type === 'core' ? "stroke-emerald-500" :
            section.type === 'stand' ? "stroke-blue-500" : "stroke-purple-500"
          )}
        />
        
        {/* Section Header/Label */}
        <text
          x={0}
          y={section.layout === 'curved' ? -35 : -18}
          textAnchor="middle"
          className="text-[10px] font-bold font-mono fill-zinc-400 uppercase tracking-widest pointer-events-none select-none"
        >
          {section.name}
        </text>

        <g className={cn(!isDesignMode && "pointer-events-auto")}>
          {seats.map(seat => {
            const isSelected = selectedSeats.includes(seat.id);
            return (
              <g key={seat.id}>
                <Seat 
                  seat={seat} 
                  onClick={onSeatClick} 
                  color={section.color}
                  isPrime={!!(section.primeRange && 
                    seat.row >= section.primeRange.rowStart && seat.row <= section.primeRange.rowEnd &&
                    seat.col >= section.primeRange.colStart && seat.col <= section.primeRange.colEnd)
                  }
                />
                {!isDesignMode && isSelected && (
                  <motion.g
                    initial={{ opacity: 0, scale: 0.5, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    pointerEvents="none"
                  >
                    <rect 
                      x={seat.x! - 35} 
                      y={seat.y! - 35} 
                      width={70} 
                      height={18} 
                      rx={9} 
                      fill="white" 
                      className="shadow-2xl"
                    />
                    <text
                      x={seat.x}
                      y={seat.y! - 22}
                      textAnchor="middle"
                      className="fill-zinc-950 text-[8px] font-black uppercase tracking-tighter"
                    >
                      {section.name}
                    </text>
                    <path 
                      d={`M ${seat.x} ${seat.y! - 17} L ${seat.x! - 4} ${seat.y! - 23} L ${seat.x! + 4} ${seat.y! - 23} Z`}
                      fill="white"
                      transform={`rotate(180, ${seat.x}, ${seat.y! - 20})`}
                    />
                  </motion.g>
                )}
              </g>
            );
          })}
        </g>
      </motion.g>
    );
  };

  const hasPrimeArea = sections.some(s => !!s.primeRange);
  const uniqueColors = Array.from(new Set(sections.map(s => s.color)));

  return (
    <div className="relative w-full h-full bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl">
      <TransformWrapper
        initialScale={1}
        minScale={0.5}
        maxScale={4}
        centerOnInit
        disabled={isDesignMode} // Disable pan/zoom while editing layout to prevent conflicts
      >
        <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full flex items-center justify-center">
          <svg
            viewBox="0 0 1000 800"
            className="w-full h-full p-12 select-none"
          >
            {/* Background Grid for Design Mode */}
            {isDesignMode && (
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
                </pattern>
              </defs>
            )}
            {isDesignMode && <rect width="100%" height="100%" fill="url(#grid)" />}

            {/* Stage */}
            <motion.g
              drag={isDesignMode}
              dragMomentum={false}
              onDragEnd={(_, info) => {
                onStagePositionUpdate(stagePos.x + info.offset.x, stagePos.y + info.offset.y);
              }}
              initial={false}
              animate={{ x: stagePos.x, y: stagePos.y }}
              className={cn(isDesignMode ? "cursor-grab active:cursor-grabbing" : "pointer-events-none")}
            >
              <defs>
                <linearGradient id="stageGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stageTitle.includes("银幕") || stageTitle.includes("SCREEN") ? "#f8fafc" : "#3f3f46"} />
                  <stop offset="100%" stopColor={stageTitle.includes("银幕") || stageTitle.includes("SCREEN") ? "#cbd5e1" : "#09090b"} />
                </linearGradient>
              </defs>
              <rect
                x={-200}
                y={0}
                width={400}
                height={80}
                rx={8}
                fill="url(#stageGradient)"
                className={cn(
                  "stroke-zinc-700 stroke-[2px]",
                  (stageTitle.includes("银幕") || stageTitle.includes("SCREEN")) && "stroke-zinc-400 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                )}
              />
              
              {!(stageTitle.includes("银幕") || stageTitle.includes("SCREEN")) && (
                <path 
                  d="M -160 80 L 160 80" 
                  fill="none" 
                  className="stroke-emerald-500/50 stroke-[3px]"
                />
              )}
              
              <text
                x={0}
                y={55}
                textAnchor="middle"
                className={cn(
                  "font-mono uppercase tracking-[0.5em]",
                  (stageTitle.includes("银幕") || stageTitle.includes("SCREEN")) ? "fill-zinc-400 text-[8px]" : "fill-zinc-500 text-[10px]"
                )}
              >
                {stageTitle.includes("银幕") || stageTitle.includes("SCREEN") ? "PROJECTION ZONE" : "舞台中心"}
              </text>
              <text
                x={0}
                y={35}
                textAnchor="middle"
                className={cn(
                  "text-xl font-bold tracking-[0.2em]",
                  (stageTitle.includes("银幕") || stageTitle.includes("SCREEN")) ? "fill-zinc-950" : "fill-zinc-100"
                )}
              >
                {stageTitle}
              </text>
            </motion.g>

            {/* Render Sections */}
            <g>
              {sections.map(section => renderSection(section))}
            </g>
          </svg>
        </TransformComponent>
      </TransformWrapper>

      {/* Floating Mode Indicator */}
      {isDesignMode && (
        <div className="absolute top-6 right-6 px-4 py-2 bg-emerald-500 text-zinc-950 text-xs font-bold rounded-full shadow-lg shadow-emerald-500/20 flex items-center gap-2 animate-pulse">
          <Move className="w-3 h-3" /> 设计模式已开启
        </div>
      )}

      {/* Map Legend */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-8 px-8 py-3 bg-zinc-900/90 backdrop-blur-xl rounded-2xl border border-white/5 shadow-2xl z-20 whitespace-nowrap">
        <div className="flex items-center gap-2.5">
          <div className="flex -space-x-1">
            {uniqueColors.map((color, i) => (
              <div 
                key={color} 
                className="w-3.5 h-3.5 rounded-sm ring-2 ring-zinc-950 shadow-sm"
                style={{ backgroundColor: color, zIndex: uniqueColors.length - i }}
              />
            ))}
          </div>
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest pl-1">可选</span>
        </div>
        
        {hasPrimeArea && (
          <div className="flex items-center gap-2.5">
            <div className="w-3.5 h-3.5 bg-[#fbbf24] rounded-sm ring-1 ring-[#f59e0b]/50 shadow-[0_0_10px_rgba(251,191,36,0.3)]" />
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">优选</span>
          </div>
        )}

        <div className="flex items-center gap-2.5">
          <div className="w-3.5 h-3.5 bg-white rounded-sm shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
          <span className="text-[11px] font-bold text-zinc-200 uppercase tracking-widest">已选</span>
        </div>
        
        <div className="flex items-center gap-2.5">
          <div className="w-3.5 h-3.5 bg-zinc-800 rounded-sm border border-zinc-700 opacity-60" />
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">售罄</span>
        </div>
      </div>
    </div>
  );
};
