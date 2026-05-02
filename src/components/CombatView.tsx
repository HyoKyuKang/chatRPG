import { useEffect } from 'react'
import { data, useGame } from '../store'
import { currentEnemyAction } from '../lib/combat'

export function CombatView() {
  const run = useGame((s) => s.run)
  const engageCombat = useGame((s) => s.engageCombat)
  const combatChoice = useGame((s) => s.combatChoice)

  const node = data.nodes.get(run.currentNodeId)

  useEffect(() => {
    if (!node || node.type !== 'combat') return
    if (run.combat) return
    if (!node.enemyId) {
      console.error(`combat node "${node.id}" missing enemyId`)
      return
    }
    engageCombat(node.enemyId)
  }, [node, run.combat, engageCombat])

  if (!node || node.type !== 'combat') return null
  if (!run.combat) {
    return (
      <div className="px-5 py-6 text-ink-400 text-sm">전투 준비 중…</div>
    )
  }

  const pattern = data.enemies.get(run.combat.enemyId)
  if (!pattern) {
    return (
      <div className="px-5 py-6 text-blood-300 text-sm">
        적 데이터 누락: {run.combat.enemyId}
      </div>
    )
  }

  const action = currentEnemyAction(pattern, run.combat.currentTurn)
  const hpPct = Math.max(
    0,
    Math.min(100, (run.combat.enemyHp / pattern.hp) * 100),
  )

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {/* Enemy header */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-blood-300 text-base font-semibold tracking-wide">
              {pattern.name}
            </h2>
            <span className="text-[11px] uppercase tracking-[0.25em] text-ink-400">
              턴 {run.combat.currentTurn}
            </span>
          </div>
          <div
            className="h-2 rounded-sm bg-blood-700/30 border border-blood-700/40 overflow-hidden"
            aria-label={`적 HP ${run.combat.enemyHp}/${pattern.hp}`}
          >
            <div
              className="h-full bg-blood-500 transition-all duration-300"
              style={{ width: `${hpPct}%` }}
            />
          </div>
          <div className="text-[11px] text-blood-300/80 tabular-nums">
            HP {run.combat.enemyHp} / {pattern.hp}
          </div>
        </div>

        {/* Prediction */}
        <div className="rounded-md border border-rune-500/30 bg-rune-700/15 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-rune-300/80 mb-1">
            적 행동 예고 — {action.name}
          </div>
          <p className="text-ink-100 text-[13px] whitespace-pre-line">
            {action.predictionText}
          </p>
        </div>

        {/* Node description as flavor text */}
        <p className="text-ink-200/80 text-[13px] whitespace-pre-line">
          {node.description}
        </p>
      </div>

      {/* Player choice buttons */}
      <div className="border-t border-white/5 px-4 pt-3 pb-4 space-y-2 bg-ink-950/40 backdrop-blur-sm">
        {node.choices.length === 0 ? (
          <p className="text-ink-400 text-center py-4 text-sm">
            가능한 행동 없음
          </p>
        ) : (
          node.choices.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => combatChoice(c.id)}
              className="
                relative w-full px-4 py-3.5 text-left text-[14px]
                rounded-md border transition-all duration-150
                active:scale-[0.97] group fade-in
                border-gold-700/40 hover:border-gold-500/70
                bg-gradient-to-b from-gold-700/15 to-gold-700/5
                hover:from-gold-700/30 hover:to-gold-700/10
                text-ink-100 hover:text-gold-300
                active:bg-gold-500/30 active:border-gold-300
              "
            >
              <span className="opacity-60 group-hover:opacity-100 mr-2 transition">
                ▸
              </span>
              {c.text}
              {c.outcome.enemyDamage ? (
                <span className="ml-2 text-[11px] text-blood-300/90 tabular-nums">
                  (적 −{c.outcome.enemyDamage})
                </span>
              ) : null}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
