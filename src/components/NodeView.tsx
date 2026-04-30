import { useEffect, useRef } from 'react'
import { data, useGame } from '../store'
import type { Choice } from '../schemas'

function isChoiceVisible(
  choice: Choice,
  ctx: {
    classChosen: string | null
    knowledge: string[]
    inventory: string[]
    stats: { hp: number; mana: number }
  },
): boolean {
  const c = choice.condition
  if (!c) return true
  if (c.class && c.class !== ctx.classChosen) return false
  if (c.knowledge && !ctx.knowledge.includes(c.knowledge)) return false
  if (c.item && !ctx.inventory.includes(c.item)) return false
  if (c.statGte) {
    const v = ctx.stats[c.statGte.name]
    if (v < c.statGte.value) return false
  }
  return true
}

export function NodeView() {
  const run = useGame((s) => s.run)
  const choose = useGame((s) => s.choose)
  const reset = useGame((s) => s.reset)
  const transitionToNextRegion = useGame((s) => s.transitionToNextRegion)

  const node = data.nodes.get(run.currentNodeId)
  const isEnding = run.endingReached || node?.type === 'ending'
  const isDead = run.dead

  const currentRegion = node ? data.regions.get(node.region) : undefined
  const nextRegion =
    isEnding && !isDead && currentRegion?.nextRegion
      ? data.regions.get(currentRegion.nextRegion)
      : undefined

  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [run.history.length])

  const visibleChoices =
    !isDead && !isEnding && node
      ? node.choices.filter((c) =>
          isChoiceVisible(c, {
            classChosen: run.classChosen,
            knowledge: run.knowledge,
            inventory: run.inventory,
            stats: run.stats,
          }),
        )
      : []

  return (
    <div className="flex flex-col h-full">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 py-6 space-y-3"
      >
        {run.history.map((h, i) => {
          if (h.kind === 'node')
            return (
              <p
                key={i}
                className="text-zinc-100 whitespace-pre-line leading-relaxed"
              >
                {h.text}
              </p>
            )
          if (h.kind === 'choice')
            return (
              <p key={i} className="text-purple-300/80 text-sm pl-4">
                → {h.text}
              </p>
            )
          if (h.kind === 'death')
            return (
              <p
                key={i}
                className="text-rose-300/90 text-sm whitespace-pre-line"
              >
                {h.text}
              </p>
            )
          return (
            <p
              key={i}
              className="text-zinc-500 text-sm italic whitespace-pre-line"
            >
              {h.text}
            </p>
          )
        })}
      </div>

      <div className="border-t border-white/10 p-4 space-y-2 bg-zinc-950/30">
        {isDead ? (
          <button
            type="button"
            onClick={reset}
            className="w-full px-4 py-3 rounded-md border border-rose-400/40 bg-rose-400/10 text-rose-100 hover:bg-rose-400/20 active:scale-[0.99] transition"
          >
            다시 출정
          </button>
        ) : isEnding && nextRegion ? (
          <button
            type="button"
            onClick={transitionToNextRegion}
            className="w-full px-4 py-3 rounded-md border border-emerald-400/40 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/20 active:scale-[0.99] transition"
          >
            {nextRegion.name}으로 간다
          </button>
        ) : isEnding ? (
          <button
            type="button"
            onClick={reset}
            className="w-full px-4 py-3 rounded-md border border-zinc-400/40 bg-zinc-400/10 text-zinc-100 hover:bg-zinc-400/20 active:scale-[0.99] transition"
          >
            다시 출정
          </button>
        ) : visibleChoices.length === 0 ? (
          <p className="text-zinc-600 text-center py-4 text-sm">
            가능한 선택지 없음
          </p>
        ) : (
          visibleChoices.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => choose(c.id)}
              className="w-full px-4 py-3 text-left rounded-md border border-purple-400/30 bg-purple-400/5 text-zinc-100 hover:bg-purple-400/15 active:scale-[0.99] transition"
            >
              {c.text}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
