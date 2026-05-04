import { data, useGame } from '../store'
import type { RegionId } from '../schemas'

const REGION_ORDER: string[] = (() => {
  const order: string[] = []
  let cur: RegionId | undefined = 'forest-outskirts'
  while (cur) {
    order.push(cur)
    const r = data.regions.get(cur)
    if (!r?.nextRegion) break
    cur = r.nextRegion as RegionId
  }
  return order
})()

export function RegionHeader() {
  const currentNodeId = useGame((s) => s.run.currentNodeId)
  const resetAll = useGame((s) => s.resetAll)
  const bgmEnabled = useGame((s) => s.meta.bgmEnabled)
  const setBgmEnabled = useGame((s) => s.setBgmEnabled)
  const sfxEnabled = useGame((s) => s.meta.sfxEnabled)
  const setSfxEnabled = useGame((s) => s.setSfxEnabled)
  const node = data.nodes.get(currentNodeId)
  const region = node ? data.regions.get(node.region) : undefined

  if (!region) return null

  const idx = REGION_ORDER.indexOf(region.id)
  const total = REGION_ORDER.length
  const display = idx >= 0 ? `${idx + 1} / ${total}` : ''

  const handleDevReset = () => {
    if (
      confirm('[DEV] 진행 상태와 메타 (기억/출정) 모두 초기화? 되돌릴 수 없음.')
    ) {
      resetAll()
    }
  }

  return (
    <div
      className="relative flex min-h-[76px] items-end justify-between px-5 pt-5 pb-3 select-none overflow-hidden border-b border-white/5 bg-ink-950/50"
      style={
        region.headerImage
          ? {
              backgroundImage: `linear-gradient(180deg, rgba(13,10,19,0.28) 0%, rgba(13,10,19,0.82) 100%), url(${region.headerImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
    >
      <div className="relative z-10 flex items-center gap-2 text-ink-100 drop-shadow">
        <span className="text-gold-500 text-base leading-none">◆</span>
        <span
          className="font-semibold tracking-wider text-[15px]"
          style={{ letterSpacing: '0.04em' }}
        >
          {region.name}
        </span>
      </div>
      <div className="relative z-10 flex items-center gap-2">
        <span
          className="text-[11px] tabular-nums text-ink-400 tracking-widest uppercase"
          aria-label={`지역 진행 ${display}`}
        >
          {display}
        </span>
        <button
          type="button"
          onClick={() => setBgmEnabled(!bgmEnabled)}
          className="text-[12px] text-ink-400 hover:text-gold-300 px-1.5 py-0.5 border border-ink-600/40 hover:border-gold-500/50 rounded-sm transition leading-none"
          title={bgmEnabled ? 'BGM 끄기' : 'BGM 켜기'}
          aria-label={bgmEnabled ? 'BGM 끄기' : 'BGM 켜기'}
          aria-pressed={bgmEnabled}
        >
          {bgmEnabled ? '♪' : '♪̸'}
        </button>
        <button
          type="button"
          onClick={() => setSfxEnabled(!sfxEnabled)}
          className="text-[12px] text-ink-400 hover:text-gold-300 px-1.5 py-0.5 border border-ink-600/40 hover:border-gold-500/50 rounded-sm transition leading-none"
          title={sfxEnabled ? '효과음 끄기' : '효과음 켜기'}
          aria-label={sfxEnabled ? '효과음 끄기' : '효과음 켜기'}
          aria-pressed={sfxEnabled}
        >
          {sfxEnabled ? '✧' : '✧̸'}
        </button>
        {import.meta.env.DEV && (
          <button
            type="button"
            onClick={handleDevReset}
            className="text-[10px] text-ink-500 hover:text-blood-300 px-1.5 py-0.5 border border-ink-600/40 hover:border-blood-500/50 rounded-sm transition leading-none"
            title="진행 상태 초기화 (DEV only)"
            aria-label="진행 상태 초기화"
          >
            ⟲
          </button>
        )}
      </div>
    </div>
  )
}
