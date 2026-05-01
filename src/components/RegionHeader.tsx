import { data, useGame } from '../store'

const REGION_ORDER: string[] = (() => {
  const order: string[] = []
  let cur: string | undefined = 'forest-outskirts'
  while (cur) {
    order.push(cur)
    const r = data.regions.get(cur)
    if (!r?.nextRegion) break
    cur = r.nextRegion
  }
  return order
})()

export function RegionHeader() {
  const currentNodeId = useGame((s) => s.run.currentNodeId)
  const node = data.nodes.get(currentNodeId)
  const region = node ? data.regions.get(node.region) : undefined

  if (!region) return null

  const idx = REGION_ORDER.indexOf(region.id)
  const total = REGION_ORDER.length
  const display = idx >= 0 ? `${idx + 1} / ${total}` : ''

  return (
    <div className="flex items-center justify-between px-5 pt-4 pb-2 select-none">
      <div className="flex items-center gap-2 text-ink-200">
        <span className="text-gold-500 text-base leading-none">◆</span>
        <span
          className="font-medium tracking-wider text-[15px]"
          style={{ letterSpacing: '0.04em' }}
        >
          {region.name}
        </span>
      </div>
      <span
        className="text-[11px] tabular-nums text-ink-400 tracking-widest uppercase"
        aria-label={`지역 진행 ${display}`}
      >
        {display}
      </span>
    </div>
  )
}
