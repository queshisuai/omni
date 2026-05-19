'use client'

import { useEffect, useMemo, useState } from 'react'
import { SeatCanvas } from './SeatCanvas'
import { SeatLayoutControls } from './SeatLayoutControls'
import { cloneSection } from './layout'
import { makeDefaultStage, makeSectionKey, type SeatCraftLayoutDraft, type SeatLayoutDesignerProps } from './types'

function nextSectionId(sections: SeatCraftLayoutDraft['sections']) {
  const max = sections.reduce((acc, section) => {
    const current = Number(section.id)
    return Number.isFinite(current) ? Math.max(acc, current) : acc
  }, 0)
  return String(max + 1)
}

function nextSectionKey(sections: SeatCraftLayoutDraft['sections']) {
  const keys = new Set(sections.map(section => section.sectionKey))
  let index = sections.length
  let key = makeSectionKey(index)
  while (keys.has(key)) {
    index += 1
    key = makeSectionKey(index)
  }
  return key
}

function makeCopySectionKey(sectionKey: string, sections: SeatCraftLayoutDraft['sections']) {
  const keys = new Set(sections.map(section => section.sectionKey))
  let index = 1
  let key = `${sectionKey}-copy`
  while (keys.has(key)) {
    index += 1
    key = `${sectionKey}-copy-${index}`
  }
  return key
}

export function SeatLayoutDesigner({ layout, onChange }: SeatLayoutDesignerProps) {
  const [activeSectionKey, setActiveSectionKey] = useState<string | null>(layout.sections[0]?.sectionKey ?? null)

  useEffect(() => {
    if (activeSectionKey == null) {
      setActiveSectionKey(layout.sections[0]?.sectionKey ?? null)
      return
    }
    const stillExists = layout.sections.some(section => section.sectionKey === activeSectionKey)
    if (!stillExists) {
      setActiveSectionKey(layout.sections[0]?.sectionKey ?? null)
    }
  }, [activeSectionKey, layout.sections])

  const draft = useMemo(() => layout, [layout])

  const commit = (next: SeatCraftLayoutDraft) => onChange(next)

  const updateSection = (sectionKey: string, updates: Partial<SeatCraftLayoutDraft['sections'][number]>) => {
    commit({
      ...draft,
      sections: draft.sections.map(section => section.sectionKey === sectionKey ? { ...section, ...updates } : section),
    })
  }

  const addSection = () => {
    const sectionId = nextSectionId(draft.sections)
    const sectionKey = nextSectionKey(draft.sections)
    commit({
      ...draft,
      sections: [...draft.sections, {
        id: sectionId,
        sectionKey,
        name: `分区 ${draft.sections.length + 1}`,
        rows: 8,
        cols: 16,
        x: 80 + draft.sections.length * 24,
        y: 160 + draft.sections.length * 24,
        color: '#34d399',
        type: 'core',
        layout: 'grid',
      }],
    })
    setActiveSectionKey(sectionKey)
  }

  const duplicateSection = (sectionKey: string) => {
    const section = draft.sections.find(item => item.sectionKey === sectionKey)
    if (!section) return
    const nextId = nextSectionId(draft.sections)
    const nextKey = makeCopySectionKey(section.sectionKey, draft.sections)
    commit({
      ...draft,
      sections: [...draft.sections, cloneSection(section, nextId, nextKey)],
    })
    setActiveSectionKey(nextKey)
  }

  const deleteSection = (sectionKey: string) => {
    const sections = draft.sections.filter(section => section.sectionKey !== sectionKey)
    commit({ ...draft, sections })
    if (activeSectionKey === sectionKey) {
      setActiveSectionKey(sections[0]?.sectionKey ?? null)
    }
  }

  const updateStage = (updates: Partial<SeatCraftLayoutDraft['stage']>) => {
    commit({ ...draft, stage: { ...draft.stage, ...updates } })
  }

  return (
    <div className="flex h-full min-h-[720px] w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
      <div className="min-w-0 flex-1 p-4">
        <SeatCanvas
          sections={draft.sections}
          stage={draft.stage}
          selectedSeatIds={[]}
          isDesignMode
          activeSectionKey={activeSectionKey}
          stageTitle={draft.stage.title}
          onSectionMove={(sectionKey, x, y) => updateSection(sectionKey, { x, y })}
          onStageMove={(x, y) => updateStage({ x, y })}
          onSeatClick={undefined}
        />
      </div>
      <SeatLayoutControls
        layout={draft}
        activeSectionKey={activeSectionKey}
        onSelectSection={setActiveSectionKey}
        onUpdateSection={updateSection}
        onAddSection={addSection}
        onDuplicateSection={duplicateSection}
        onDeleteSection={deleteSection}
        onUpdateStage={updateStage}
      />
    </div>
  )
}

export function createEmptySeatLayoutDraft(): SeatCraftLayoutDraft {
  return {
    id: null,
    venueId: null,
    activityId: null,
    sessionId: null,
    layoutMode: 'unified',
    name: 'SeatCraft 布局',
    templateType: 'concert',
    stage: makeDefaultStage('舞台'),
    canvasWidth: 1000,
    canvasHeight: 800,
    sections: [],
  }
}
