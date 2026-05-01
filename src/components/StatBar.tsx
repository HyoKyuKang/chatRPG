import { data, useGame } from '../store'

const CLASS_LABEL: Record<'warrior' | 'mage', string> = {
  warrior: '전사',
  mage: '마법사',
}

const MAX_DISPLAY = 5

interface PipsProps {
  value: number
  max?: number
  fillClass: string
  emptyClass: string
}

function Pips({ value, max = MAX_DISPLAY, fillClass, emptyClass }: PipsProps) {
  const total = Math.max(max, value)
  return (
    <div className="flex gap-[3px]" aria-hidden>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-[10px] w-[6px] rounded-[1.5px] transition-colors ${
            i < value ? fillClass : emptyClass
          }`}
        />
      ))}
    </div>
  )
}

export function StatBar() {
  const stats = useGame((s) => s.run.stats)
  const inventory = useGame((s) => s.run.inventory)
  const classChosen = useGame((s) => s.run.classChosen)
  const memoryShards = useGame((s) => s.meta.memoryShards)
  const completedRuns = useGame((s) => s.meta.completedRuns)

  return (
    <div className="px-5 pb-3 pt-1 border-b border-white/5 select-none">
      {/* Row 1: HP + MP bars, class, meta */}
      <div className="flex items-center gap-4 text-[12px]">
        <div className="flex items-center gap-2">
          <span className="text-blood-300 font-semibold tracking-wider">HP</span>
          <Pips
            value={stats.hp}
            fillClass="bg-blood-500 shadow-[0_0_4px_rgba(211,71,89,0.5)]"
            emptyClass="bg-blood-700/30 border border-blood-700/40"
          />
          <span className="tabular-nums text-blood-300/90 font-semibold w-3 text-right">
            {stats.hp}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-aether-300 font-semibold tracking-wider">MP</span>
          <Pips
            value={stats.mana}
            fillClass="bg-aether-500 shadow-[0_0_4px_rgba(74,156,200,0.5)]"
            emptyClass="bg-aether-700/30 border border-aether-700/40"
          />
          <span className="tabular-nums text-aether-300/90 font-semibold w-3 text-right">
            {stats.mana}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2 text-[10px] text-rune-300/70 tabular-nums">
          {memoryShards > 0 && <span>기억 {memoryShards}</span>}
          {completedRuns > 0 && <span>출정 {completedRuns}</span>}
        </div>
      </div>

      {/* Row 2: class chip + inventory */}
      {(classChosen || inventory.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px]">
          {classChosen && (
            <span className="px-2 py-[2px] rounded-sm border border-gold-500/40 bg-gold-700/20 text-gold-300 font-medium tracking-wider">
              {CLASS_LABEL[classChosen]}
            </span>
          )}
          {inventory.length === 0 ? null : (
            inventory.map((id) => {
              const item = data.items.get(id)
              return (
                <span
                  key={id}
                  className="px-2 py-[2px] rounded-sm border border-ember-500/30 bg-ember-700/15 text-ember-300"
                >
                  {item?.name ?? id}
                </span>
              )
            })
          )}
        </div>
      )}

      {/* Hidden text fallback for QA smoke (소지품 없음) */}
      {inventory.length === 0 && (
        <span className="sr-only">소지품 없음</span>
      )}
    </div>
  )
}
