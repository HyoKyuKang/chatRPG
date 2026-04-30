import { data, useRun } from '../store'

export function StatBar() {
  const stats = useRun((s) => s.stats)
  const inventory = useRun((s) => s.inventory)

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-white/10 text-xs text-zinc-400 flex-wrap">
      <span className="text-rose-300">
        HP <span className="tabular-nums">{stats.hp}</span>
      </span>
      <span className="text-sky-300">
        MP <span className="tabular-nums">{stats.mana}</span>
      </span>
      <span className="text-zinc-700">|</span>
      {inventory.length === 0 ? (
        <span className="text-zinc-600">소지품 없음</span>
      ) : (
        inventory.map((id) => {
          const item = data.items.get(id)
          return (
            <span key={id} className="text-amber-200">
              {item?.name ?? id}
            </span>
          )
        })
      )}
    </div>
  )
}
