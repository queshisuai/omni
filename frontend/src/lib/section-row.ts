type SectionRowItemKeyInput = {
  id: string | number
  itemType?: string | null
}

export function buildSectionItemKey(sectionId: string | number, item: SectionRowItemKeyInput, index: number) {
  return `${sectionId}-${item.itemType || 'activity'}-${item.id}-${index}`
}
