import { create } from 'zustand'
import { loadGameData } from './lib/loader'
import type { ClassType, Stats } from './schemas'

export const data = loadGameData()

const STARTING_REGION = 'forest-outskirts' as const
const STARTING_STATS: Stats = { hp: 5, mana: 3 }

export type HistoryEntry =
  | { kind: 'node'; text: string }
  | { kind: 'choice'; text: string }
  | { kind: 'outcome'; text: string }

export interface RunState {
  currentNodeId: string
  classChosen: ClassType | null
  stats: Stats
  inventory: string[]
  knowledge: string[]
  history: HistoryEntry[]
}

interface RunActions {
  choose: (choiceId: string) => void
  reset: () => void
}

function initialState(): RunState {
  const region = data.regions.get(STARTING_REGION)
  if (!region)
    throw new Error(`Starting region "${STARTING_REGION}" not loaded`)
  const entry = data.nodes.get(region.entryNodeId)
  if (!entry)
    throw new Error(`Entry node "${region.entryNodeId}" not loaded`)
  return {
    currentNodeId: entry.id,
    classChosen: null,
    stats: { ...STARTING_STATS },
    inventory: [],
    knowledge: [],
    history: [{ kind: 'node', text: entry.description }],
  }
}

export const useRun = create<RunState & RunActions>((set, get) => ({
  ...initialState(),
  choose: (choiceId) => {
    const state = get()
    const node = data.nodes.get(state.currentNodeId)
    if (!node) return
    const choice = node.choices.find((c) => c.id === choiceId)
    if (!choice) return

    const delta = choice.outcome.statDelta
    const stats: Stats = delta
      ? {
          hp: state.stats.hp + (delta.hp ?? 0),
          mana: state.stats.mana + (delta.mana ?? 0),
        }
      : state.stats

    let inventory = state.inventory
    if (choice.outcome.itemAdd?.length)
      inventory = [...inventory, ...choice.outcome.itemAdd]
    if (choice.outcome.itemRemove?.length) {
      const remove = new Set(choice.outcome.itemRemove)
      inventory = inventory.filter((i) => !remove.has(i))
    }

    const knowledge = choice.outcome.knowledgeGain?.length
      ? Array.from(new Set([...state.knowledge, ...choice.outcome.knowledgeGain]))
      : state.knowledge

    const newHistory: HistoryEntry[] = [
      ...state.history,
      { kind: 'choice', text: choice.text },
      { kind: 'outcome', text: choice.outcome.text },
    ]

    const next = choice.outcome.nextNodeId
    if (next === null) {
      set({ stats, inventory, knowledge, history: newHistory })
      return
    }

    const nextNode = data.nodes.get(next)
    if (!nextNode) {
      console.error(`next node "${next}" not loaded`)
      set({ stats, inventory, knowledge, history: newHistory })
      return
    }

    set({
      stats,
      inventory,
      knowledge,
      currentNodeId: next,
      history: [
        ...newHistory,
        { kind: 'node', text: nextNode.description },
      ],
    })
  },
  reset: () => set(initialState()),
}))
