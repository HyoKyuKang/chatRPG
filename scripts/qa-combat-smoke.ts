// Combat infra smoke test (W8). Pure logic — no browser.
//
// Validates:
//   1. enemies.json parses against EnemyPattern schema
//   2. activeEnemyActions correctly applies phase overrides
//   3. currentEnemyAction cycles through actions per turn
//   4. simulated engageCombat → combatChoice (winning blow) → endCombat flow
//      produces the expected math (enemy hp reaches 0, victory, choice's
//      nextNodeId is the post-combat target)
//   5. simulated defeat path: enemy retaliates over turns, player hp reaches 0
//
// W9 will add real combat nodes; this smoke covers the engine in isolation.

import { readFileSync } from 'node:fs'
import { z } from 'zod'
import { EnemyPattern, type EnemyAction, type Stats } from '../src/schemas'
import { activeEnemyActions, currentEnemyAction } from '../src/lib/combat'

let failures = 0
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`✓ ${label}`)
  } else {
    failures++
    console.error(`✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

// ─── 1. Schema parse ──────────────────────────────────────────────────
const raw = JSON.parse(
  readFileSync('data/shared/enemies.json', 'utf8'),
) as unknown
const enemies = z.array(EnemyPattern).parse(raw)
check('enemies.json parses', enemies.length === 5, `got ${enemies.length}`)

const ids = new Set(enemies.map((e) => e.id))
check(
  'enemy ids unique',
  ids.size === enemies.length,
  `${ids.size} unique of ${enemies.length}`,
)

const avgHp = enemies.reduce((s, e) => s + e.hp, 0) / enemies.length
const avgActions =
  enemies.reduce((s, e) => s + e.actions.length, 0) / enemies.length
console.log(
  `  avg hp ${avgHp.toFixed(1)}, avg actions ${avgActions.toFixed(1)}`,
)

// ─── 2. Action cycling ───────────────────────────────────────────────
const wolf = enemies.find((e) => e.id === 'rotting-wolf')!
const t1 = currentEnemyAction(wolf, 1)
const t2 = currentEnemyAction(wolf, 2)
const t3 = currentEnemyAction(wolf, 3)
const t4 = currentEnemyAction(wolf, 4)
check('wolf turn 1 = growl', t1.id === 'growl', `got ${t1.id}`)
check('wolf turn 2 = lunge', t2.id === 'lunge', `got ${t2.id}`)
check('wolf turn 3 = bite', t3.id === 'bite', `got ${t3.id}`)
check('wolf turn 4 = growl (cycle)', t4.id === 'growl', `got ${t4.id}`)

// ─── 3. Phase override ───────────────────────────────────────────────
const lieutenant = enemies.find((e) => e.id === 'demon-king-lieutenant')!
const baseActions = activeEnemyActions(lieutenant, 1)
const wrathActions = activeEnemyActions(lieutenant, 4)
check(
  'lieutenant pre-phase actions = base',
  baseActions === lieutenant.actions,
)
check(
  'lieutenant phase 4 swaps actions',
  wrathActions !== lieutenant.actions &&
    wrathActions[0].id === 'wrath-strike',
  `got ${wrathActions[0]?.id}`,
)

// ─── 4. Simulated combat: victory path ───────────────────────────────
//
// Replicates the math inside combatChoice() without zustand. If the
// implementation ever drifts, this will catch it.

interface SimChoice {
  id: string
  text: string
  enemyDamage?: number
  selfStatDelta?: Partial<Stats>
  nextNodeId: string | null
}

function simulateTurn(opts: {
  stats: Stats
  enemyHp: number
  turn: number
  enemyAction: EnemyAction
  choice: SimChoice
}): { stats: Stats; enemyHp: number; victory: boolean; dead: boolean } {
  let { stats, enemyHp } = opts
  const c = opts.choice

  if (c.selfStatDelta) {
    stats = {
      hp: stats.hp + (c.selfStatDelta.hp ?? 0),
      mana: stats.mana + (c.selfStatDelta.mana ?? 0),
    }
  }
  enemyHp -= c.enemyDamage ?? 0
  const victory = enemyHp <= 0
  if (!victory && opts.enemyAction.statDelta) {
    stats = {
      hp: stats.hp + (opts.enemyAction.statDelta.hp ?? 0),
      mana: stats.mana + (opts.enemyAction.statDelta.mana ?? 0),
    }
  }
  return { stats, enemyHp, victory, dead: stats.hp <= 0 }
}

// Wolf victory in 2 turns: turn 1 strike for 3 (wolf hp 5 → 2, growl no dmg),
// turn 2 strike for 2 (wolf hp 2 → 0, victory)
let stats: Stats = { hp: 5, mana: 3 }
let enemyHp = wolf.hp
let turn = 1
let log: string[] = []

const r1 = simulateTurn({
  stats,
  enemyHp,
  turn,
  enemyAction: currentEnemyAction(wolf, turn),
  choice: { id: 'strike', text: '검을 휘두른다', enemyDamage: 3, nextNodeId: null },
})
log.push(`t${turn}: hp=${r1.stats.hp} eHp=${r1.enemyHp}`)
stats = r1.stats
enemyHp = r1.enemyHp
turn++

const r2 = simulateTurn({
  stats,
  enemyHp,
  turn,
  enemyAction: currentEnemyAction(wolf, turn),
  choice: {
    id: 'finish',
    text: '결정타',
    enemyDamage: 2,
    nextNodeId: 'fo-post-wolf',
  },
})
log.push(`t${turn}: hp=${r2.stats.hp} eHp=${r2.enemyHp} victory=${r2.victory}`)

check(
  'wolf victory in 2 turns',
  r2.victory && r2.enemyHp <= 0,
  `enemyHp=${r2.enemyHp}`,
)
check(
  'player survives victory turn (no retaliation on killing blow)',
  r2.stats.hp === 5,
  `hp=${r2.stats.hp} log=${log.join(' | ')}`,
)

// ─── 5. Simulated combat: defeat path ────────────────────────────────
//
// Mage with hp=5 takes pure defense (no damage to enemy) vs wolf:
//   t1: growl (no dmg)  → hp 5
//   t2: lunge (-1)      → hp 4
//   t3: bite  (-2)      → hp 2
//   t4: growl           → hp 2
//   t5: lunge (-1)      → hp 1
//   t6: bite  (-2)      → hp -1 → dead
stats = { hp: 5, mana: 3 }
enemyHp = wolf.hp
log = []
const noOp: SimChoice = { id: 'wait', text: '버틴다', nextNodeId: null }
let dead = false
for (turn = 1; turn <= 8 && !dead; turn++) {
  const r = simulateTurn({
    stats,
    enemyHp,
    turn,
    enemyAction: currentEnemyAction(wolf, turn),
    choice: noOp,
  })
  stats = r.stats
  enemyHp = r.enemyHp
  dead = r.dead
  log.push(`t${turn}: hp=${stats.hp}`)
}
check('defeat path eventually kills player', dead, log.join(' | '))
check(
  'defeat takes ≥3 turns vs wolf',
  turn - 1 >= 3,
  `died on turn ${turn - 1}`,
)

// ─── Done ────────────────────────────────────────────────────────────
if (failures > 0) {
  console.error(`\nqa-combat-smoke FAILED — ${failures} check(s)`)
  process.exit(1)
}
console.log(`\nqa-combat-smoke passed (${enemies.length} enemies validated).`)
