import { z } from 'zod'
import {
  Node,
  Region,
  Hero,
  Item,
  Knowledge,
  type RegionId,
} from '../schemas'

export interface GameData {
  nodes: Map<string, Node>
  regions: Map<RegionId, Region>
  heroes: Map<string, Hero>
  items: Map<string, Item>
  knowledge: Map<string, Knowledge>
}

type Mod = { default: unknown }

const nodeFiles = import.meta.glob('/data/nodes/**/*.json', {
  eager: true,
}) as Record<string, Mod>
const regionFiles = import.meta.glob('/data/regions/*.json', {
  eager: true,
}) as Record<string, Mod>
const heroFiles = import.meta.glob('/data/shared/heroes.json', {
  eager: true,
}) as Record<string, Mod>
const itemFiles = import.meta.glob('/data/shared/items.json', {
  eager: true,
}) as Record<string, Mod>
const knowledgeFiles = import.meta.glob('/data/shared/knowledge.json', {
  eager: true,
}) as Record<string, Mod>

export function loadGameData(): GameData {
  const nodes = new Map<string, Node>()
  for (const [path, mod] of Object.entries(nodeFiles)) {
    const n = Node.parse(mod.default)
    if (nodes.has(n.id)) throw new Error(`duplicate node id ${n.id} in ${path}`)
    nodes.set(n.id, n)
  }

  const regions = new Map<RegionId, Region>()
  for (const [path, mod] of Object.entries(regionFiles)) {
    const r = Region.parse(mod.default)
    if (regions.has(r.id))
      throw new Error(`duplicate region id ${r.id} in ${path}`)
    regions.set(r.id, r)
  }

  const heroes = new Map<string, Hero>()
  for (const mod of Object.values(heroFiles)) {
    for (const h of z.array(Hero).parse(mod.default)) {
      if (heroes.has(h.id)) throw new Error(`duplicate hero id ${h.id}`)
      heroes.set(h.id, h)
    }
  }

  const items = new Map<string, Item>()
  for (const mod of Object.values(itemFiles)) {
    for (const it of z.array(Item).parse(mod.default)) {
      if (items.has(it.id)) throw new Error(`duplicate item id ${it.id}`)
      items.set(it.id, it)
    }
  }

  const knowledge = new Map<string, Knowledge>()
  for (const mod of Object.values(knowledgeFiles)) {
    for (const k of z.array(Knowledge).parse(mod.default)) {
      if (knowledge.has(k.id))
        throw new Error(`duplicate knowledge id ${k.id}`)
      knowledge.set(k.id, k)
    }
  }

  return { nodes, regions, heroes, items, knowledge }
}
