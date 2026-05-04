import { readdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { Node } from '../src/schemas'
import type { Choice } from '../src/schemas'

const DATA = 'data'

type WarnKind =
  | 'repeatable-stat-gain'
  | 'repeatable-item-gain'
  | 'repeatable-combat-gateway'

interface BalanceWarn {
  kind: WarnKind
  nodeId: string
  choiceId: string
  message: string
  suggestion: string
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8'))
}

async function walkJson(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...(await walkJson(p)))
    else if (e.isFile() && e.name.endsWith('.json')) out.push(p)
  }
  return out
}

function outgoing(choice: Choice): string | null {
  return choice.outcome.nextNodeId
}

function positiveStats(choice: Choice): string[] {
  const delta = choice.outcome.statDelta
  if (!delta) return []
  const gains: string[] = []
  if ((delta.hp ?? 0) > 0) gains.push(`hp +${delta.hp}`)
  if ((delta.mana ?? 0) > 0) gains.push(`mana +${delta.mana}`)
  return gains
}

function choiceHasCostOrGate(choice: Choice): boolean {
  const delta = choice.outcome.statDelta
  const hasCost = !!delta && ((delta.hp ?? 0) < 0 || (delta.mana ?? 0) < 0)
  const hasCondition = !!choice.condition
  return hasCost || hasCondition
}

function canReach(
  graph: Map<string, string[]>,
  from: string,
  target: string,
): boolean {
  const seen = new Set<string>()
  const stack = [from]
  while (stack.length) {
    const cur = stack.pop()!
    if (cur === target) return true
    if (seen.has(cur)) continue
    seen.add(cur)
    for (const next of graph.get(cur) ?? []) stack.push(next)
  }
  return false
}

async function main() {
  const nodes = new Map<string, Node>()
  for (const f of await walkJson(join(DATA, 'nodes'))) {
    const n = Node.parse(await readJson(f))
    nodes.set(n.id, n)
  }

  const graph = new Map<string, string[]>()
  for (const node of nodes.values()) {
    graph.set(
      node.id,
      node.choices
        .map((choice) => outgoing(choice))
        .filter((id): id is string => !!id && nodes.has(id)),
    )
  }

  const warnings: BalanceWarn[] = []

  for (const node of nodes.values()) {
    for (const choice of node.choices) {
      const next = outgoing(choice)
      if (!next || !nodes.has(next)) continue
      const repeats = canReach(graph, next, node.id)
      if (!repeats) continue

      const statGains = positiveStats(choice)
      if (statGains.length > 0) {
        warnings.push({
          kind: 'repeatable-stat-gain',
          nodeId: node.id,
          choiceId: choice.id,
          message: `${statGains.join(', ')} can repeat because ${next} can reach ${node.id}`,
          suggestion: choiceHasCostOrGate(choice)
            ? 'Review net loop value; add a one-time visited knowledge gate if this reward should not be farmable.'
            : 'Add a one-time visited knowledge gate or route the reward branch forward without returning to this node.',
        })
      }

      for (const itemId of choice.outcome.itemAdd ?? []) {
        warnings.push({
          kind: 'repeatable-item-gain',
          nodeId: node.id,
          choiceId: choice.id,
          message: `item "${itemId}" can repeat because ${next} can reach ${node.id}`,
          suggestion:
            'Add a one-time visited knowledge gate, consume the branch, or make duplicate items harmless in store logic.',
        })
      }

      if (
        node.type === 'combat' &&
        choice.startsCombat === false &&
        choice.outcome.knowledgeGain?.some((k) => k.startsWith('fled-'))
      ) {
        warnings.push({
          kind: 'repeatable-combat-gateway',
          nodeId: node.id,
          choiceId: choice.id,
          message: `flee/evade knowledge can repeat because ${next} can reach ${node.id}`,
          suggestion:
            'Confirm the evade branch cannot farm downstream rewards or add a visited/fled gate before re-entry.',
        })
      }
    }
  }

  if (warnings.length === 0) {
    console.log('0 balance warning(s)')
    return
  }

  console.log(`${warnings.length} balance warning(s):`)
  for (const w of warnings) {
    console.log(`  ⚠ ${w.kind} ${w.nodeId}.${w.choiceId}`)
    console.log(`    ${w.message}`)
    console.log(`    suggestion: ${w.suggestion}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
