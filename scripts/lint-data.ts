import { readdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { Node, Region, Hero, Item, Knowledge } from '../src/schemas'
import type { ChoiceCondition } from '../src/schemas'

const DATA = 'data'

type Issue = { severity: 'error' | 'warn'; file: string; message: string }
const issues: Issue[] = []
const err = (file: string, message: string) =>
  issues.push({ severity: 'error', file, message })
const warn = (file: string, message: string) =>
  issues.push({ severity: 'warn', file, message })

async function readJson(path: string): Promise<unknown> {
  const text = await readFile(path, 'utf8')
  try {
    return JSON.parse(text)
  } catch (e) {
    err(path, `invalid JSON: ${(e as Error).message}`)
    return null
  }
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

function parseWith<T extends z.ZodType>(
  schema: T,
  raw: unknown,
  file: string,
): z.infer<T> | null {
  const result = schema.safeParse(raw)
  if (result.success) return result.data
  for (const issue of result.error.issues) {
    err(file, `${issue.path.join('.') || '(root)'} — ${issue.message}`)
  }
  return null
}

function validateConditionRefs(
  condition: ChoiceCondition | undefined,
  file: string,
  context: string,
  knowledge: Map<string, Knowledge>,
  items: Map<string, Item>,
) {
  if (!condition) return
  if (condition.knowledge && !knowledge.has(condition.knowledge))
    err(file, `${context} → condition.knowledge "${condition.knowledge}" not found`)
  if (condition.item && !items.has(condition.item))
    err(file, `${context} → condition.item "${condition.item}" not found`)
}

async function main() {
  // Phase 1: parse
  const regions = new Map<string, Region>()
  for (const f of await walkJson(join(DATA, 'regions'))) {
    const raw = await readJson(f)
    if (raw === null) continue
    const r = parseWith(Region, raw, f)
    if (!r) continue
    if (regions.has(r.id)) err(f, `duplicate region id: ${r.id}`)
    else regions.set(r.id, r)
  }

  const nodes = new Map<string, Node>()
  const nodeFiles = new Map<string, string>()
  for (const f of await walkJson(join(DATA, 'nodes'))) {
    const raw = await readJson(f)
    if (raw === null) continue
    const n = parseWith(Node, raw, f)
    if (!n) continue
    if (nodes.has(n.id)) err(f, `duplicate node id: ${n.id}`)
    else {
      nodes.set(n.id, n)
      nodeFiles.set(n.id, f)
    }
  }

  const heroes = new Map<string, Hero>()
  const items = new Map<string, Item>()
  const knowledge = new Map<string, Knowledge>()

  await loadShared(z.array(Hero), 'heroes.json', heroes, 'hero')
  await loadShared(z.array(Item), 'items.json', items, 'item')
  await loadShared(z.array(Knowledge), 'knowledge.json', knowledge, 'knowledge')

  // Phase 3: cross-ref
  for (const [id, node] of nodes) {
    const f = nodeFiles.get(id)!
    for (const [index, echo] of (node.echoes ?? []).entries()) {
      validateConditionRefs(
        echo.condition,
        f,
        `echo ${index + 1}`,
        knowledge,
        items,
      )
    }
    for (const c of node.choices) {
      const next = c.outcome.nextNodeId
      if (next !== null && !nodes.has(next))
        err(f, `choice ${c.id} → nextNodeId "${next}" not found`)
      validateConditionRefs(c.condition, f, `choice ${c.id}`, knowledge, items)
      for (const itemId of c.outcome.itemAdd ?? [])
        if (!items.has(itemId))
          err(f, `choice ${c.id} → outcome.itemAdd "${itemId}" not found`)
      for (const itemId of c.outcome.itemRemove ?? [])
        if (!items.has(itemId))
          err(f, `choice ${c.id} → outcome.itemRemove "${itemId}" not found`)
      for (const k of c.outcome.knowledgeGain ?? [])
        if (!knowledge.has(k))
          err(f, `choice ${c.id} → outcome.knowledgeGain "${k}" not found`)
      if (c.outcome.heroEncounter && !heroes.has(c.outcome.heroEncounter))
        err(
          f,
          `choice ${c.id} → outcome.heroEncounter "${c.outcome.heroEncounter}" not found`,
        )
    }
  }

  // Phase 4: region structure
  for (const region of regions.values()) {
    const f = `${DATA}/regions/${region.id}.json`
    if (!nodes.has(region.entryNodeId))
      err(f, `entryNodeId "${region.entryNodeId}" not found`)
    if (!nodes.has(region.bossNodeId))
      err(f, `bossNodeId "${region.bossNodeId}" not found`)
    for (const nid of region.nodeIds)
      if (!nodes.has(nid)) err(f, `nodeIds: "${nid}" not found`)
    for (const nid of region.nodeIds) {
      const n = nodes.get(nid)
      if (n && n.region !== region.id)
        err(
          nodeFiles.get(nid)!,
          `node.region "${n.region}" does not match owning region "${region.id}"`,
        )
    }
    if (region.nextRegion && !regions.has(region.nextRegion))
      err(f, `nextRegion "${region.nextRegion}" not found`)
  }

  // Phase 5: reachability + dead-ends
  if (regions.size > 0) {
    const reachable = new Set<string>()
    for (const region of regions.values()) {
      if (!nodes.has(region.entryNodeId)) continue
      const queue = [region.entryNodeId]
      while (queue.length) {
        const id = queue.shift()!
        if (reachable.has(id)) continue
        reachable.add(id)
        const n = nodes.get(id)
        if (!n) continue
        for (const c of n.choices)
          if (c.outcome.nextNodeId && nodes.has(c.outcome.nextNodeId))
            queue.push(c.outcome.nextNodeId)
      }
    }
    for (const [id] of nodes)
      if (!reachable.has(id))
        warn(
          nodeFiles.get(id)!,
          `orphan node "${id}" not reachable from any region entry`,
        )
  }
  for (const [id, n] of nodes) {
    if (n.type === 'ending') continue
    const hasOutgoing = n.choices.some((c) => c.outcome.nextNodeId !== null)
    if (!hasOutgoing)
      err(
        nodeFiles.get(id)!,
        `dead-end: node "${id}" has no outgoing path and is not type 'ending'`,
      )
  }

  // Report
  const errors = issues.filter((i) => i.severity === 'error')
  const warns = issues.filter((i) => i.severity === 'warn')
  for (const i of issues) {
    const tag = i.severity === 'error' ? '✗ error' : '⚠ warn '
    console.log(`${tag} ${i.file}: ${i.message}`)
  }
  if (issues.length > 0) console.log()
  console.log(
    `Loaded: ${nodes.size} node(s), ${regions.size} region(s), ${heroes.size} hero(es), ${items.size} item(s), ${knowledge.size} knowledge`,
  )
  console.log(`${errors.length} error(s), ${warns.length} warning(s)`)
  if (errors.length > 0) process.exit(1)
}

async function loadShared<T extends { id: string }>(
  schema: z.ZodType<T[]>,
  filename: string,
  out: Map<string, T>,
  label: string,
) {
  const path = join(DATA, 'shared', filename)
  if (!existsSync(path)) return
  const raw = await readJson(path)
  if (raw === null) return
  const arr = parseWith(schema, raw, path)
  if (!arr) return
  for (const e of arr) {
    if (out.has(e.id)) err(path, `duplicate ${label} id: ${e.id}`)
    else out.set(e.id, e)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
