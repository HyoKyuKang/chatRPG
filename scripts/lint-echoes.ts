import { readdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { Node, Region } from '../src/schemas'

const DATA = 'data'

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

type Edge = { from: string; to: string; gain: string[] }

async function main() {
  const nodes = new Map<string, Node>()
  for (const f of await walkJson(join(DATA, 'nodes'))) {
    const n = Node.parse(await readJson(f))
    nodes.set(n.id, n)
  }

  const regions = new Map<string, Region>()
  for (const f of await walkJson(join(DATA, 'regions'))) {
    const r = Region.parse(await readJson(f))
    regions.set(r.id, r)
  }

  // Start region(s): not referenced as anyone's nextRegion
  const referencedAsNext = new Set<string>()
  for (const r of regions.values())
    if (r.nextRegion) referencedAsNext.add(r.nextRegion)
  const startEntryNodeIds = [...regions.values()]
    .filter((r) => !referencedAsNext.has(r.id))
    .map((r) => r.entryNodeId)
    .filter((id) => nodes.has(id))

  // Edges: choice transitions (M --[knowledgeGain]--> N) + region transitions
  // (ending node in R --[]--> entryNode of nextRegion(R))
  const edges: Edge[] = []
  for (const node of nodes.values()) {
    for (const c of node.choices) {
      const to = c.outcome.nextNodeId
      if (to && nodes.has(to))
        edges.push({
          from: node.id,
          to,
          gain: c.outcome.knowledgeGain ?? [],
        })
    }
  }
  for (const r of regions.values()) {
    if (!r.nextRegion) continue
    const nextR = regions.get(r.nextRegion)
    if (!nextR || !nodes.has(nextR.entryNodeId)) continue
    for (const nid of r.nodeIds) {
      const n = nodes.get(nid)
      if (n && n.type === 'ending')
        edges.push({ from: nid, to: nextR.entryNodeId, gain: [] })
    }
  }

  // Fixed-point: reachableK(N) = union over all paths reaching N of
  // (knowledge granted along the path). This is what's in run.knowledge
  // when renderNodeText(N) is called — store.ts:184-186 + 282 confirm
  // the choice's knowledgeGain is applied to nextRun BEFORE rendering
  // nextNode, so the gain on the edge into N IS visible to N's echoes.
  const reachableK = new Map<string, Set<string>>()
  const visited = new Set<string>()
  for (const id of nodes.keys()) reachableK.set(id, new Set())
  for (const id of startEntryNodeIds) visited.add(id)

  let changed = true
  while (changed) {
    changed = false
    for (const e of edges) {
      if (!visited.has(e.from)) continue
      const target = reachableK.get(e.to)!
      const source = reachableK.get(e.from)!
      const beforeSize = target.size
      const wasUnvisited = !visited.has(e.to)
      for (const k of source) target.add(k)
      for (const k of e.gain) target.add(k)
      visited.add(e.to)
      if (wasUnvisited || target.size !== beforeSize) changed = true
    }
  }

  type Dead = { nodeId: string; echoIndex: number; missing: string }
  const dead: Dead[] = []
  for (const node of nodes.values()) {
    if (!node.echoes || !visited.has(node.id)) continue
    const known = reachableK.get(node.id)!
    for (const [index, echo] of node.echoes.entries()) {
      const reqK = echo.condition?.knowledge
      if (!reqK) continue
      if (!known.has(reqK))
        dead.push({ nodeId: node.id, echoIndex: index, missing: reqK })
    }
  }

  if (dead.length === 0) {
    console.log('0 dead echoes')
    process.exit(0)
  }
  console.log(`${dead.length} dead echo(es):`)
  for (const d of dead)
    console.log(
      `  ⚠ ${d.nodeId}#${d.echoIndex} — knowledge "${d.missing}" never granted on any path to this node`,
    )
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
