/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import { SeatMap } from './components/SeatMap/SeatMap';
import { Controls } from './components/SeatMap/Controls';
import { SeatData, SectionData } from './components/SeatMap/types';
import { Layout, Palette, Users, Ticket, MousePointer2, Move, Plus } from 'lucide-react';
import { cn } from './lib/utils';

export default function App() {
  const [isDesignMode, setIsDesignMode] = useState(true);
  const [selectedSeats, setSelectedSeats] = useState<SeatData[]>([]);
  const [stagePos, setStagePos] = useState({ x: 500, y: 50 });
  const [stageTitle, setStageTitle] = useState("演出舞台 / STAGE");
  
  const [sectionConfigs, setSectionConfigs] = useState<SectionData[]>([
    { id: 'core', name: '核心区 (Core)', rows: 8, cols: 20, type: 'core', x: 500, y: 180, color: '#34d399', layout: 'grid' },
    { id: 'stand-l', name: '看台 L', rows: 12, cols: 8, type: 'stand', x: 260, y: 180, color: '#60a5fa', layout: 'grid' },
    { id: 'stand-r', name: '看台 R', rows: 12, cols: 8, type: 'stand', x: 740, y: 180, color: '#60a5fa', layout: 'grid' },
  ]);

  const applyTemplate = (type: 'concert' | 'cinema' | 'custom') => {
    switch (type) {
      case 'concert':
        setStagePos({ x: 500, y: 50 });
        setStageTitle("演出舞台 / STAGE");
        setSectionConfigs([
          { id: 'floor', name: '池座内场', rows: 12, cols: 24, type: 'core', x: 500, y: 180, color: '#34d399', layout: 'grid' },
          { id: 'stands', name: '环绕看台', rows: 8, cols: 48, type: 'stand', x: 500, y: 80, color: '#60a5fa', layout: 'curved', radius: 300, arcSpan: 180, rotation: 180 },
        ]);
        break;
      case 'cinema':
        setStagePos({ x: 500, y: 50 });
        setStageTitle("电影银幕 / SCREEN");
        setSectionConfigs([
          { 
            id: 'cinema-main', 
            name: '观影大厅', 
            rows: 15, 
            cols: 30, 
            type: 'zone', 
            x: 500, 
            y: 200, 
            color: '#34d399', 
            layout: 'grid',
            primeRange: {
              rowStart: 5,
              rowEnd: 10,
              colStart: 10,
              colEnd: 20
            }
          },
        ]);
        break;
      case 'custom':
        setStagePos({ x: 500, y: 100 });
        setStageTitle("自定义舞台 / VENUE");
        setSectionConfigs([]);
        break;
    }
    setSelectedSeats([]);
  };

  const updateConfig = useCallback((id: string, updates: Partial<SectionData>) => {
    setSectionConfigs(prev => prev.map(conf => 
      conf.id === id ? { ...conf, ...updates } : conf
    ));
  }, []);

  const deleteSection = useCallback((id: string) => {
    setSectionConfigs(prev => prev.filter(c => c.id !== id));
  }, []);

  const duplicateSection = useCallback((id: string) => {
    const original = sectionConfigs.find(c => c.id === id);
    if (!original) return;

    const newId = `dup-${Date.now()}`;
    setSectionConfigs(prev => [
      ...prev,
      { 
        ...original, 
        id: newId, 
        name: `${original.name} (副本)`,
        x: original.x + 30,
        y: original.y + 30
      }
    ]);
  }, [sectionConfigs]);

  const addSection = useCallback(() => {
    const id = `new-${Date.now()}`;
    setSectionConfigs(prev => [
      ...prev,
      { 
        id, 
        name: '新分区', 
        rows: 8, 
        cols: 16, 
        type: 'zone', 
        x: 500, 
        y: 400, 
        color: '#a78bfa',
        layout: 'grid',
        rotation: 0
      }
    ]);
  }, []);

  const updatePosition = useCallback((id: string, x: number, y: number) => {
    setSectionConfigs(prev => prev.map(conf => 
      conf.id === id ? { ...conf, x, y } : conf
    ));
  }, []);

  const handleSeatClick = useCallback((seat: SeatData) => {
    if (isDesignMode) return;
    setSelectedSeats(prev => 
      prev.find(s => s.id === seat.id) 
        ? prev.filter(s => s.id !== seat.id) 
        : [...prev, seat]
    );
  }, [isDesignMode]);

  const addNewSection = useCallback(() => {
    const id = `zone-${Date.now()}`;
    const newSection: SectionData = {
      id,
      name: `New Area ${sectionConfigs.length + 1}`,
      rows: 5,
      cols: 10,
      type: 'zone',
      x: 450,
      y: 500,
      color: '#f472b6',
      layout: 'grid'
    };
    setSectionConfigs(prev => [...prev, newSection]);
  }, [sectionConfigs.length]);

  const autoAlignAll = useCallback(() => {
    // 1. Target stage position
    const targetStageY = 50;
    setStagePos({ x: 500, y: targetStageY });

    setSectionConfigs(prev => {
      if (prev.length === 0) return prev;
      
      // Heuristic: Group sections that are at a similar Y level
      const sortedByY = [...prev].sort((a, b) => a.y - b.y);
      const rows: SectionData[][] = [];
      let currentRow: SectionData[] = [];
      
      sortedByY.forEach(conf => {
        if (currentRow.length === 0) {
          currentRow.push(conf);
        } else {
          const last = currentRow[currentRow.length - 1];
          // If Y difference is small, treat as same row
          if (Math.abs(conf.y - last.y) < 150) {
            currentRow.push(conf);
          } else {
            rows.push(currentRow);
            currentRow = [conf];
          }
        }
      });
      if (currentRow.length > 0) rows.push(currentRow);

      const STAGE_Y_OFFSET = targetStageY + 120;
      const ROW_GAP = 80;
      const COLUMN_GAP = 60;
      const SEAT_SPACING = 16;
      const MAP_CENTER_X = 500;

      let currentY = STAGE_Y_OFFSET;

      return rows.map(row => {
        // Sort each row by original X to maintain relative order
        const sortedRow = row.sort((a, b) => a.x - b.x);
        
        // Calculate widths for horizontal centering
        const widths = sortedRow.map(c => {
          if (c.layout === 'curved') {
            const radius = c.radius || 200;
            const span = c.arcSpan || 120;
            return 2 * radius * Math.sin((span / 2) * Math.PI / 180);
          }
          return c.cols * SEAT_SPACING;
        });

        const totalRowWidth = widths.reduce((a, b) => a + b, 0) + (sortedRow.length - 1) * COLUMN_GAP;
        let runningX = MAP_CENTER_X - totalRowWidth / 2;
        let maxRowHeight = 0;

        const alignedRow = sortedRow.map((conf, i) => {
          const w = widths[i];
          const h = conf.rows * SEAT_SPACING;
          maxRowHeight = Math.max(maxRowHeight, h);
          
          const updated = {
            ...conf,
            x: runningX + w / 2,
            y: currentY + 40,
            rotation: 0
          };

          // Special case for curved stands in concert template
          if (conf.layout === 'curved' && conf.id === 'stands') {
            updated.rotation = 180;
            updated.y = targetStageY + 30; // Position behind/above stage
            updated.x = 500; 
          }

          runningX += w + COLUMN_GAP;
          return updated;
        });

        currentY += maxRowHeight + ROW_GAP;
        return alignedRow;
      }).flat();
    });
  }, []);

  return (
    <div className="flex h-screen bg-black text-zinc-100 font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <div className="w-20 border-r border-zinc-800 flex flex-col items-center py-8 gap-8 bg-zinc-950">
        <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <Ticket className="w-6 h-6 text-zinc-950" />
        </div>
        <div className="flex flex-col gap-6">
          <button 
            onClick={() => setIsDesignMode(false)}
            className={cn("p-3 rounded-xl transition-all", !isDesignMode ? "bg-zinc-800 text-emerald-400" : "text-zinc-500 hover:text-zinc-300")}
            title="Ticket Selection"
          >
            <MousePointer2 className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setIsDesignMode(true)}
            className={cn("p-3 rounded-xl transition-all", isDesignMode ? "bg-zinc-800 text-emerald-400" : "text-zinc-500 hover:text-zinc-300")}
            title="Design Layout"
          >
            <Move className="w-5 h-5" />
          </button>
          <div className="h-px w-8 bg-zinc-800 my-2" />
          <NavItem icon={<Palette className="w-5 h-5 text-zinc-500" />} />
          <NavItem icon={<Users className="w-5 h-5 text-zinc-500" />} />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-20 border-b border-zinc-800 flex items-center justify-between px-10 bg-zinc-950/50 backdrop-blur-sm">
          <div className="flex items-center gap-12">
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                {isDesignMode ? "场地布线工具" : "选座购票"}
              </h1>
              <p className="text-xs text-zinc-500 uppercase tracking-widest mt-1">
                模式: {isDesignMode ? "设计器" : "用户视图"}
              </p>
            </div>

            {isDesignMode && (
              <div className="flex items-center gap-2 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                <TemplateButton 
                  label="演出场地" 
                  onClick={() => applyTemplate('concert')} 
                />
                <TemplateButton 
                  label="影院模式" 
                  onClick={() => applyTemplate('cinema')} 
                />
                <TemplateButton 
                  label="清空画布" 
                  onClick={() => applyTemplate('custom')} 
                />
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {isDesignMode && (
              <button 
                onClick={addNewSection}
                className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-500/20 transition-all font-mono"
              >
                <Plus className="w-4 h-4" /> ADD_SECTION
              </button>
            )}
            <div className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-400">
              {isDesignMode ? "DRAG_TO_MOVE" : "CLICK_TO_PICK"}
            </div>
          </div>
        </header>

        {/* Workspace */}
        <div className="flex-1 p-8 overflow-hidden bg-[radial-gradient(circle_at_50%_50%,#111_0%,#000_100%)]">
          <div className="max-w-6xl mx-auto flex flex-col gap-8 h-full">
            <div className="flex-1 min-h-0">
              <SeatMap 
                sections={sectionConfigs} 
                selectedSeats={selectedSeats.map(s => s.id)}
                onSeatClick={handleSeatClick}
                isDesignMode={isDesignMode}
                onPositionUpdate={updatePosition}
                stagePos={stagePos}
                onStagePositionUpdate={(x, y) => setStagePos({ x, y })}
                stageTitle={stageTitle}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Right Sidebar Controls */}
      <Controls 
        configs={sectionConfigs}
        updateConfig={updateConfig}
        addSection={addSection}
        deleteSection={deleteSection}
        duplicateSection={duplicateSection}
        autoAlignAll={autoAlignAll}
        selectedSeats={selectedSeats}
        onRemoveSeat={handleSeatClick}
        isDesignMode={isDesignMode}
      />
    </div>
  );
}

function TemplateButton({ label, onClick }: { label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-all"
    >
      {label}
    </button>
  );
}

function NavItem({ icon }: { icon: React.ReactNode }) {
  return (
    <button className="p-3 rounded-xl hover:bg-zinc-800 transition-colors">
      {icon}
    </button>
  );
}
