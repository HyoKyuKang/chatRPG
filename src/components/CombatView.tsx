import { useEffect, useRef, useState } from 'react'
import { data, useGame } from '../store'
import { activeEnemyActions, currentEnemyAction } from '../lib/combat'
import type { Choice, EnemyPattern } from '../schemas'

// Pips above this threshold get cluttered on mobile width — fall back to a
// continuous bar. Bosses (shadow-commander 12, consumed-one 14, mawang 16)
// land in the bar branch; regular enemies (5–10 hp) stay on pips.
const HP_PIP_MAX = 10

function isChoiceVisible(choice: Choice, run: ReturnType<typeof useGame.getState>['run']) {
  const c = choice.condition
  if (!c) return true
  if (c.class && c.class !== run.classChosen) return false
  if (c.knowledge && !run.knowledge.includes(c.knowledge)) return false
  if (c.item && !run.inventory.includes(c.item)) return false
  if (c.statGte && run.stats[c.statGte.name] < c.statGte.value) return false
  return true
}

// Combat panel: occupies the footer slot (where choice buttons usually live)
// while NodeView keeps showing the chat log above. Engagement is gateway-
// driven (NodeView dispatches engageCombatFromChoice); this panel only renders
// when run.combat is set.
export function CombatView() {
  const run = useGame((s) => s.run)
  const combatChoice = useGame((s) => s.combatChoice)

  const node = data.nodes.get(run.currentNodeId)
  if (!node || node.type !== 'combat' || !run.combat) return null

  const pattern = data.enemies.get(run.combat.enemyId)
  if (!pattern) {
    return (
      <div className="border-t border-blood-700/50 px-5 py-4 text-blood-300 text-sm bg-ink-950/40">
        적 데이터 누락: {run.combat.enemyId}
      </div>
    )
  }

  const action = currentEnemyAction(pattern, run.combat.currentTurn)
  const phaseInfo = getPhaseInfo(pattern, run.combat.currentTurn)

  const visibleChoices = node.choices.filter(
    (c) => c.startsCombat === undefined && isChoiceVisible(c, run),
  )

  return (
    <div className="border-t border-blood-700/30 bg-gradient-to-t from-blood-700/10 to-ink-950/50 backdrop-blur-sm">
      <EnemyHeader
        enemy={pattern}
        currentHp={run.combat.enemyHp}
        currentTurn={run.combat.currentTurn}
        phaseInfo={phaseInfo}
      />

      {/* Enemy action prediction — italic, dim, narrator voice */}
      <div className="px-5 pt-2 pb-3 border-t border-blood-700/15">
        <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-blood-300/60 mb-1">
          다음 행동 — {action.name}
        </div>
        <p className="prose-ko text-ink-100/85 italic text-[13px] whitespace-pre-line">
          {action.predictionText}
        </p>
      </div>

      {/* Combat action buttons */}
      <div className="px-4 pt-2 pb-4 space-y-2">
        {visibleChoices.length === 0 ? (
          <p className="text-ink-400 text-center py-4 text-sm">
            가능한 행동 없음
          </p>
        ) : (
          visibleChoices.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                combatChoice(c.id)
              }}
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

// ─── Enemy header ────────────────────────────────────────────────────────

interface PhaseInfo {
  index: number
  total: number
  label: string | null
  changedThisTurn: boolean
}

function getPhaseInfo(pattern: EnemyPattern, turn: number): PhaseInfo {
  const phases = pattern.phases ?? []
  const total = phases.length + 1 // base + each phase override
  let index = 0
  for (const phase of phases) {
    if (turn >= phase.atTurn) index++
  }
  // Detect "phase just changed" — true if the previous turn had a different active set
  const prev = activeEnemyActions(pattern, turn - 1)
  const curr = activeEnemyActions(pattern, turn)
  const changedThisTurn = turn > 1 && prev !== curr
  // Phase label: borrow first action's name as the phase identifier
  const label = phases.length > 0 ? curr[0]?.name ?? null : null
  return { index, total, label, changedThisTurn }
}

interface EnemyHeaderProps {
  enemy: EnemyPattern
  currentHp: number
  currentTurn: number
  phaseInfo: PhaseInfo
}

function EnemyHeader({
  enemy,
  currentHp,
  currentTurn,
  phaseInfo,
}: EnemyHeaderProps) {
  // Shake the HP block on damage taken (current < previous)
  const prevHpRef = useRef(currentHp)
  const [shake, setShake] = useState(false)
  useEffect(() => {
    if (currentHp < prevHpRef.current) {
      setShake(true)
      const t = setTimeout(() => setShake(false), 380)
      prevHpRef.current = currentHp
      return () => clearTimeout(t)
    }
    prevHpRef.current = currentHp
  }, [currentHp])

  return (
    <div className="px-5 pt-3 pb-2">
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <h2 className="text-blood-300 text-base font-semibold tracking-wide truncate">
          {enemy.name}
        </h2>
        <div className="flex items-center gap-3 shrink-0">
          {phaseInfo.total > 1 && (
            <span
              className={`text-[10px] uppercase tracking-[0.25em] tabular-nums ${
                phaseInfo.changedThisTurn
                  ? 'text-blood-300 font-semibold'
                  : 'text-blood-300/60'
              }`}
              aria-label={`페이즈 ${phaseInfo.index + 1} / ${phaseInfo.total}`}
            >
              페이즈 {phaseInfo.index + 1}/{phaseInfo.total}
            </span>
          )}
          <span className="text-[10px] uppercase tracking-[0.25em] text-gold-300/80 tabular-nums">
            턴 {currentTurn}
          </span>
        </div>
      </div>

      <div className={`flex items-center gap-2 ${shake ? 'stat-shake' : ''}`}>
        <EnemyPips current={currentHp} max={enemy.hp} />
        <span className="ml-auto text-[11px] text-blood-300/80 tabular-nums">
          {currentHp} / {enemy.hp}
        </span>
      </div>

      {/* Phase change banner — italic narrator note, fade-in on phase shift */}
      {phaseInfo.changedThisTurn && phaseInfo.label && (
        <p
          key={`phase-${phaseInfo.index}`}
          className="prose-ko text-blood-300/90 italic text-[12px] mt-1.5 fade-in-up"
        >
          — {enemy.name}의 결이 한 칸 어긋난다. 새 자세를 잡는다.
        </p>
      )}
    </div>
  )
}

interface EnemyPipsProps {
  current: number
  max: number
}

function EnemyPips({ current, max }: EnemyPipsProps) {
  // Cap pip count for very high-HP bosses (mawang has 16); use a continuous
  // bar fallback when max > HP_PIP_MAX. Keeps the UI from going pip-crazy.
  if (max > HP_PIP_MAX) {
    const pct = Math.max(0, Math.min(100, (current / max) * 100))
    return (
      <div
        className="h-2 flex-1 rounded-sm bg-blood-700/30 border border-blood-700/40 overflow-hidden"
        aria-label={`적 HP ${current}/${max}`}
      >
        <div
          className="h-full bg-blood-500 shadow-[0_0_4px_rgba(211,71,89,0.5)] transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    )
  }
  const total = Math.max(max, current)
  return (
    <div
      className="flex gap-[3px] flex-1 flex-wrap"
      aria-label={`적 HP ${current}/${max}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-[10px] w-[6px] rounded-[1.5px] transition-colors ${
            i < current
              ? 'bg-blood-500 shadow-[0_0_3px_rgba(211,71,89,0.45)]'
              : 'bg-blood-700/30 border border-blood-700/40'
          }`}
        />
      ))}
    </div>
  )
}
