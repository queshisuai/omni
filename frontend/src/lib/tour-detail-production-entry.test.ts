import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

function readSource(path: string) {
  return readFileSync(resolve(root, path), 'utf8')
}

test('tour detail page renders compact tour project experience instead of old station detail cards', () => {
  const source = readSource('app/tour/[id]/page.tsx')

  assert.match(source, /巡演项目/)
  assert.match(source, /巡回演唱会/)
  assert.match(source, /想看/)
  assert.match(source, /关注艺人/)
  assert.match(source, /选择巡演城市/)
  assert.match(source, /点击下方各站体验不同发布状态/)
  assert.match(source, /售票中/)
  assert.match(source, /待公布/)
  assert.match(source, /时间待定/)
  assert.match(source, /演出筹备中/)
  assert.match(source, /开启开售提醒/)
  assert.match(source, /已开启开售提醒/)
  assert.match(source, /登记观看意向/)
  assert.match(source, /官方正品保障/)
  assert.match(source, /bg-black\/30/)
  assert.match(source, /bg-black\/80/)
  assert.match(source, /overflow-x-auto/)
  assert.match(source, /scrollbar-hide/)
  assert.match(source, /\+ 求加场/)
  assert.match(source, /showEncoreCityModal/)
  assert.match(source, /我想看的城市/)
  assert.match(source, /当前定位城市/)
  assert.match(source, /热门城市/)
  assert.match(source, /cityGroups/)
  assert.match(source, /submitEncoreCityWish/)
  assert.match(source, /已提交【\$\{city\}】加场心愿，主办方会收到您的期待！/)
  assert.match(source, /router\.push\(`\/activity\/\$\{selectedStation\.activity\.id\}`\)/)
  assert.doesNotMatch(source, /巡演详情/)
  assert.doesNotMatch(source, /grid gap-5 lg:grid-cols-\[260px_1fr\]/)
  assert.doesNotMatch(source, /top-\[-8px\]/)
})

test('tour detail page shares the floating back button and keeps tour city wish modal intact', () => {
  const source = readSource('app/tour/[id]/page.tsx')
  const component = readSource('components/FloatingBackButton.tsx')

  assert.match(source, /FloatingBackButton/)
  assert.match(source, /omni_tour_detail_back_clicked/)
  assert.match(source, /showEncoreCityModal/)
  assert.match(source, /createSubscription/)
  assert.match(source, /TOUR_CITY_REMINDER/)

  assert.match(component, /返回上一页/)
  assert.match(component, /document\.referrer\.includes\(window\.location\.host\)/)
  assert.match(component, /router\.push\(fallbackHref\)/)
})
