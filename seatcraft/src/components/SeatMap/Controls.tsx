import React from 'react';
import { Settings2, Plus, Minus, Copy, Trash2, Move } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { SectionData, SeatData } from './types';
import { motion, AnimatePresence } from 'motion/react';

interface ControlsProps {
  configs: SectionData[];
  updateConfig: (id: string, updates: Partial<SectionData>) => void;
  addSection: () => void;
  deleteSection: (id: string) => void;
  duplicateSection: (id: string) => void;
  autoAlignAll?: () => void;
  selectedSeats: SeatData[];
  onRemoveSeat?: (seat: SeatData) => void;
  isDesignMode: boolean;
}

const COLORS = [
  { name: 'Emerald', value: '#34d399' },
  { name: 'Blue', value: '#60a5fa' },
  { name: 'Purple', value: '#a78bfa' },
  { name: 'Amber', value: '#fbbf24' },
  { name: 'Rose', value: '#fb7185' },
];

const TYPES = [
  { id: 'core', label: '核心' },
  { id: 'stand', label: '看台' },
  { id: 'zone', label: '普通' },
];

export const Controls = ({ configs, updateConfig, addSection, deleteSection, duplicateSection, autoAlignAll, selectedSeats, onRemoveSeat, isDesignMode }: ControlsProps) => {
  const selectedCount = selectedSeats.length;
  return (
    <div className="w-80 h-full bg-zinc-900 border-l border-zinc-800 p-6 flex flex-col gap-8 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Settings2 className="w-5 h-5 text-emerald-500" />
          </div>
          <h2 className="text-zinc-100 font-semibold text-lg">
            {isDesignMode ? "场地布线" : "座位明细"}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {isDesignMode && (
            <button 
              onClick={addSection}
              className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg border border-zinc-700 transition-colors"
              title="添加分区"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {isDesignMode && autoAlignAll && (
          <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">全局布局工具</span>
              <Settings2 className="w-3 h-3 text-emerald-500/50" />
            </div>
            <button 
              onClick={autoAlignAll}
              className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 text-xs font-bold py-2.5 rounded-lg transition-all shadow-lg shadow-emerald-500/10 active:scale-95"
            >
              <Move className="w-4 h-4" />
              一键快速对齐布局
            </button>
          </div>
        )}

        {isDesignMode ? (
          configs.map((config) => (
            <div key={config.id} className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50 space-y-4">
              <div className="flex items-center justify-between">
                <input 
                  value={config.name}
                  onChange={(e) => updateConfig(config.id, { name: e.target.value })}
                  className="bg-transparent text-zinc-100 text-sm font-bold uppercase tracking-wider outline-none focus:text-emerald-400 w-32"
                />
                  <div className="flex items-center gap-1.5 ">
                    <button 
                      onClick={() => duplicateSection(config.id)}
                      className="p-1.5 text-zinc-500 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-all"
                      title="复制分区"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => deleteSection(config.id)}
                      className="p-1.5 text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                      title="删除分区"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              {/* Type Selection */}
              <div className="grid grid-cols-3 gap-1">
                {TYPES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => updateConfig(config.id, { type: t.id as any })}
                    className={cn(
                      "text-[10px] py-1 rounded font-bold transition-all",
                      config.type === t.id ? "bg-zinc-100 text-zinc-900" : "bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    {t.id === 'core' ? '核心' : t.id === 'stand' ? '看台' : '普通'}
                  </button>
                ))}
              </div>

              {/* Color Select */}
              <div className="flex gap-2">
                {COLORS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => updateConfig(config.id, { color: c.value })}
                    style={{ backgroundColor: c.value }}
                    className={cn(
                      "w-4 h-4 rounded-full ring-offset-2 ring-offset-zinc-900 transition-all",
                      config.color === c.value ? "ring-2 ring-white" : "opacity-50 hover:opacity-100"
                    )}
                  />
                ))}
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => updateConfig(config.id, { layout: 'grid' })}
                  className={cn("flex-1 px-2 py-1 rounded text-[10px] font-bold", config.layout === 'grid' ? "bg-emerald-500 text-zinc-950" : "bg-zinc-700 text-zinc-400")}
                >
                  方阵
                </button>
                <button 
                  onClick={() => updateConfig(config.id, { layout: 'curved' })}
                  className={cn("flex-1 px-2 py-1 rounded text-[10px] font-bold", config.layout === 'curved' ? "bg-emerald-500 text-zinc-950" : "bg-zinc-700 text-zinc-400")}
                >
                  圆弧
                </button>
              </div>

              {/* Rows/Cols */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] text-zinc-500 uppercase">排数 (行)</label>
                  <div className="flex items-center justify-between bg-zinc-900 rounded-lg p-1 px-2 border border-zinc-700">
                    <button onClick={() => updateConfig(config.id, { rows: Math.max(1, config.rows - 1) })} className="p-1 hover:text-zinc-100"><Minus className="w-3 h-3" /></button>
                    <span className="text-zinc-200 font-mono text-xs">{config.rows}</span>
                    <button onClick={() => updateConfig(config.id, { rows: config.rows + 1 })} className="p-1 hover:text-zinc-100"><Plus className="w-3 h-3" /></button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-zinc-500 uppercase">座数 (列)</label>
                  <div className="flex items-center justify-between bg-zinc-900 rounded-lg p-1 px-2 border border-zinc-700">
                    <button onClick={() => updateConfig(config.id, { cols: Math.max(1, config.cols - 1) })} className="p-1 hover:text-zinc-100"><Minus className="w-3 h-3" /></button>
                    <span className="text-zinc-200 font-mono text-xs">{config.cols}</span>
                    <button onClick={() => updateConfig(config.id, { cols: config.cols + 1 })} className="p-1 hover:text-zinc-100"><Plus className="w-3 h-3" /></button>
                  </div>
                </div>
              </div>

              {/* Rotation */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-[9px] text-zinc-500 uppercase">旋转角度</label>
                  <span className="text-zinc-400 text-[10px] font-mono">{config.rotation || 0}°</span>
                </div>
                <input 
                  type="range" min="0" max="360" step="1" 
                  value={config.rotation || 0}
                  onChange={(e) => updateConfig(config.id, { rotation: parseInt(e.target.value) })}
                  className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              {/* Curved Specific */}
              {config.layout === 'curved' && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <label className="text-[9px] text-zinc-500 uppercase">半径</label>
                      <span className="text-zinc-400 text-[10px] font-mono">{config.radius || 200}px</span>
                    </div>
                    <input 
                      type="range" min="50" max="600" step="10" 
                      value={config.radius || 200}
                      onChange={(e) => updateConfig(config.id, { radius: parseInt(e.target.value) })}
                      className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <label className="text-[9px] text-zinc-500 uppercase">弯曲跨度</label>
                      <span className="text-zinc-400 text-[10px] font-mono">{config.arcSpan || 120}°</span>
                    </div>
                    <input 
                      type="range" min="30" max="360" step="5" 
                      value={config.arcSpan || 120}
                      onChange={(e) => updateConfig(config.id, { arcSpan: parseInt(e.target.value) })}
                      className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>
                </div>
              )}
              {/* Prime Range Selection */}
              {config.layout === 'grid' && (
                <div className="space-y-4 pt-4 border-t border-zinc-700/50">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] text-emerald-400 uppercase font-bold tracking-wider">核心优选区</label>
                    <button 
                      onClick={() => updateConfig(config.id, { 
                        primeRange: config.primeRange 
                          ? undefined 
                          : { rowStart: Math.floor(config.rows/4), rowEnd: Math.floor(config.rows*3/4), colStart: Math.floor(config.cols/4), colEnd: Math.floor(config.cols*3/4) } 
                      })}
                      className={cn(
                        "text-[9px] px-2 py-0.5 rounded transition-all font-bold",
                        config.primeRange ? "bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/20" : "bg-zinc-700 text-zinc-400 hover:text-zinc-200"
                      )}
                    >
                      {config.primeRange ? "已开启" : "设置"}
                    </button>
                  </div>
                  
                  {config.primeRange && (
                    <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="space-y-1">
                        <label className="text-[8px] text-zinc-500 uppercase">始/末排</label>
                        <div className="flex items-center gap-1">
                          <input 
                            type="number" 
                            className="w-full bg-zinc-900 border border-zinc-700 rounded p-1 text-[10px] text-zinc-300 outline-none"
                            value={config.primeRange.rowStart}
                            onChange={(e) => updateConfig(config.id, { 
                              primeRange: { ...config.primeRange!, rowStart: parseInt(e.target.value) || 0 } 
                            })}
                          />
                          <input 
                            type="number" 
                            className="w-full bg-zinc-900 border border-zinc-700 rounded p-1 text-[10px] text-zinc-300 outline-none"
                            value={config.primeRange.rowEnd}
                            onChange={(e) => updateConfig(config.id, { 
                              primeRange: { ...config.primeRange!, rowEnd: parseInt(e.target.value) || 0 } 
                            })}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] text-zinc-500 uppercase">始/末座</label>
                        <div className="flex items-center gap-1">
                          <input 
                            type="number" 
                            className="w-full bg-zinc-900 border border-zinc-700 rounded p-1 text-[10px] text-zinc-300 outline-none"
                            value={config.primeRange.colStart}
                            onChange={(e) => updateConfig(config.id, { 
                              primeRange: { ...config.primeRange!, colStart: parseInt(e.target.value) || 0 } 
                            })}
                          />
                          <input 
                            type="number" 
                            className="w-full bg-zinc-900 border border-zinc-700 rounded p-1 text-[10px] text-zinc-300 outline-none"
                            value={config.primeRange.colEnd}
                            onChange={(e) => updateConfig(config.id, { 
                              primeRange: { ...config.primeRange!, colEnd: parseInt(e.target.value) || 0 } 
                            })}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="space-y-6">
            <div className="p-6 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
              <div className="text-zinc-400 text-xs uppercase mb-1">系统状态</div>
              <div className="text-emerald-400 font-bold text-lg">选座系统中...</div>
            </div>

            {selectedSeats.length > 0 && (
              <div className="space-y-3">
                <div className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold px-1">已选座位</div>
                <div className="grid gap-2">
                  <AnimatePresence mode="popLayout">
                    {selectedSeats.map((seat) => (
                      <motion.div 
                        key={seat.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex items-center justify-between p-3 bg-zinc-800/80 rounded-xl border border-zinc-700/50 group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-300">
                            SEAT
                          </div>
                          <div>
                            <div className="text-zinc-100 text-sm font-bold">{seat.label}</div>
                            <div className="text-zinc-500 text-[10px] uppercase font-mono">{seat.section}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-emerald-400 font-mono text-sm leading-none flex items-center gap-1">
                            <span className="text-[10px]">¥</span>100
                          </div>
                          {onRemoveSeat && (
                            <button 
                              onClick={() => onRemoveSeat(seat)}
                              className="p-1.5 text-zinc-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                              title="取消选择"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-auto pt-6 border-t border-zinc-800">
        <div className="bg-emerald-500/10 rounded-2xl p-6 border border-emerald-500/20">
          <div className="flex items-center gap-3 mb-2 text-emerald-400">
            <Settings2 className="w-5 h-5" />
            <span className="font-semibold">结算汇总</span>
          </div>
          <p className="text-emerald-500/70 text-xs mb-4">
            您已选择 {selectedCount} 个座位
          </p>
          <button 
            disabled={selectedCount === 0}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-950 font-bold py-3 rounded-xl transition-all shadow-lg active:scale-95"
          >
            确认选座
          </button>
        </div>
      </div>
    </div>
  );
};
