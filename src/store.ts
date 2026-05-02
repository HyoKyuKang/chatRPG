import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { loadGameData } from './lib/loader'
import type { ChoiceCondition, ClassType, MetaState, Node, Stats } from './schemas'

export const data = loadGameData()

const STARTING_REGION = 'forest-outskirts' as const
const STARTING_STATS: Stats = { hp: 5, mana: 3 }
const SHARDS_PER_DEATH = 1
const SHARDS_PER_ENDING = 3
const STORAGE_KEY = 'chat-rpg/save-v1'

export type HistoryEntry =
  | { kind: 'node'; text: string }
  | { kind: 'choice'; text: string }
  | { kind: 'outcome'; text: string }
  | { kind: 'death'; text: string }
  | { kind: 'region-marker'; regionId: string; regionName: string }

export interface RunState {
  currentNodeId: string
  classChosen: ClassType | null
  stats: Stats
  inventory: string[]
  knowledge: string[]
  heroesEncountered: string[]
  history: HistoryEntry[]
  dead: boolean
  endingReached: boolean
}

export interface PersistedState {
  schemaVersion: 1
  meta: MetaState
  run: RunState
}

export type AppView = 'title' | 'game'

interface TransientState {
  appView: AppView
}

interface Actions {
  choose: (choiceId: string) => void
  reset: () => void
  resetAll: () => void
  transitionToNextRegion: () => void
  applyUnlock: (unlockId: string) => void
  setAppView: (view: AppView) => void
}

function applyUnlockEffects(
  baseStats: Stats,
  baseInventory: string[],
  meta: MetaState,
): { stats: Stats; inventory: string[] } {
  let stats: Stats = { ...baseStats }
  let inventory = [...baseInventory]
  for (const id of meta.unlockedBonusIds) {
    const unlock = data.unlocks.get(id)
    if (!unlock) continue
    const eff = unlock.effect
    if (eff.type === 'startStat') {
      stats = { ...stats, [eff.stat]: stats[eff.stat] + eff.delta }
    } else if (eff.type === 'startItem') {
      if (!inventory.includes(eff.itemId)) inventory.push(eff.itemId)
    }
  }
  return { stats, inventory }
}

function freshRun(meta: MetaState): RunState {
  const region = data.regions.get(STARTING_REGION)
  if (!region)
    throw new Error(`Starting region "${STARTING_REGION}" not loaded`)
  const entry = data.nodes.get(region.entryNodeId)
  if (!entry)
    throw new Error(`Entry node "${region.entryNodeId}" not loaded`)

  const { stats, inventory } = applyUnlockEffects(STARTING_STATS, [], meta)

  const run: RunState = {
    currentNodeId: entry.id,
    classChosen: null,
    stats,
    inventory,
    knowledge: [],
    heroesEncountered: [],
    history: [],
    dead: false,
    endingReached: false,
  }
  return {
    ...run,
    history: [
      { kind: 'region-marker', regionId: region.id, regionName: region.name },
      { kind: 'node', text: renderNodeText(entry, run) },
    ],
  }
}

function freshMeta(): MetaState {
  return {
    memoryShards: 0,
    unlockedClasses: [],
    unlockedBonusIds: [],
    discoveredKnowledge: [],
    completedRuns: 0,
    endingsReached: [],
    totalDeaths: 0,
  }
}

function uniq<T>(...arrays: T[][]): T[] {
  return Array.from(new Set(arrays.flat()))
}

function matchesCondition(
  condition: ChoiceCondition | undefined,
  run: Pick<RunState, 'classChosen' | 'knowledge' | 'inventory' | 'stats'>,
): boolean {
  if (!condition) return true
  if (condition.class && condition.class !== run.classChosen) return false
  if (condition.knowledge && !run.knowledge.includes(condition.knowledge))
    return false
  if (condition.item && !run.inventory.includes(condition.item)) return false
  if (condition.statGte) {
    const value = run.stats[condition.statGte.name]
    if (value < condition.statGte.value) return false
  }
  return true
}

function renderNodeText(node: Node, run: RunState): string {
  const echoes =
    node.echoes
      ?.filter((echo) => matchesCondition(echo.condition, run))
      .map((echo) => echo.text) ?? []
  if (echoes.length === 0) return node.description
  return [node.description, ...echoes].join('\n\n')
}

export const useGame = create<PersistedState & TransientState & Actions>()(
  persist(
    (set, get) => ({
      schemaVersion: 1,
      meta: freshMeta(),
      run: freshRun(freshMeta()),
      appView: 'title',

      setAppView: (view) => set({ appView: view }),

      choose: (choiceId) => {
        const state = get()
        const run = state.run
        if (run.dead || run.endingReached) return
        const node = data.nodes.get(run.currentNodeId)
        if (!node) return
        const choice = node.choices.find((c) => c.id === choiceId)
        if (!choice) return

        const delta = choice.outcome.statDelta
        const stats: Stats = delta
          ? {
              hp: run.stats.hp + (delta.hp ?? 0),
              mana: run.stats.mana + (delta.mana ?? 0),
            }
          : run.stats

        let inventory = run.inventory
        if (choice.outcome.itemAdd?.length)
          inventory = [...inventory, ...choice.outcome.itemAdd]
        if (choice.outcome.itemRemove?.length) {
          const remove = new Set(choice.outcome.itemRemove)
          inventory = inventory.filter((i) => !remove.has(i))
        }

        const knowledge = choice.outcome.knowledgeGain?.length
          ? uniq(run.knowledge, choice.outcome.knowledgeGain)
          : run.knowledge

        const classChosen = choice.outcome.classSet ?? run.classChosen

        const heroesEncountered = choice.outcome.heroEncounter
          ? uniq(run.heroesEncountered, [choice.outcome.heroEncounter])
          : run.heroesEncountered

        const baseHistory: HistoryEntry[] = [
          ...run.history,
          { kind: 'choice', text: choice.text },
          { kind: 'outcome', text: choice.outcome.text },
        ]

        // Death (priority over node transition)
        if (stats.hp <= 0) {
          set({
            run: {
              ...run,
              stats: { ...stats, hp: 0 },
              inventory,
              knowledge,
              classChosen,
              heroesEncountered,
              history: [
                ...baseHistory,
                {
                  kind: 'death',
                  text: `당신은 여기서 쓰러진다. (기억의 조각 +${SHARDS_PER_DEATH})`,
                },
              ],
              dead: true,
            },
            meta: {
              ...state.meta,
              memoryShards: state.meta.memoryShards + SHARDS_PER_DEATH,
              totalDeaths: state.meta.totalDeaths + 1,
              discoveredKnowledge: uniq(
                state.meta.discoveredKnowledge,
                knowledge,
              ),
            },
          })
          return
        }

        const next = choice.outcome.nextNodeId
        if (next === null) {
          set({
            run: {
              ...run,
              stats,
              inventory,
              knowledge,
              classChosen,
              heroesEncountered,
              history: baseHistory,
            },
          })
          return
        }

        const nextNode = data.nodes.get(next)
        if (!nextNode) {
          console.error(`next node "${next}" not loaded`)
          set({
            run: {
              ...run,
              stats,
              inventory,
              knowledge,
              classChosen,
              heroesEncountered,
              history: baseHistory,
            },
          })
          return
        }

        const reachedEnding = nextNode.type === 'ending'
        const nextRun: RunState = {
          ...run,
          stats,
          inventory,
          knowledge,
          classChosen,
          heroesEncountered,
          currentNodeId: next,
          history: baseHistory,
          endingReached: reachedEnding,
        }
        set({
          run: {
            ...nextRun,
            history: [
              ...baseHistory,
              { kind: 'node', text: renderNodeText(nextNode, nextRun) },
            ],
          },
          meta: reachedEnding
            ? {
                ...state.meta,
                completedRuns: state.meta.completedRuns + 1,
                memoryShards: state.meta.memoryShards + SHARDS_PER_ENDING,
                discoveredKnowledge: uniq(
                  state.meta.discoveredKnowledge,
                  knowledge,
                ),
              }
            : state.meta,
        })
      },

      reset: () => set({ run: freshRun(get().meta) }),

      resetAll: () => set({ run: freshRun(freshMeta()), meta: freshMeta() }),

      applyUnlock: (unlockId) => {
        const state = get()
        const unlock = data.unlocks.get(unlockId)
        if (!unlock) return
        if (state.meta.unlockedBonusIds.includes(unlockId)) return // already owned
        if (state.meta.memoryShards < unlock.cost) return // not enough shards
        set({
          meta: {
            ...state.meta,
            memoryShards: state.meta.memoryShards - unlock.cost,
            unlockedBonusIds: [...state.meta.unlockedBonusIds, unlockId],
          },
        })
      },

      transitionToNextRegion: () => {
        const state = get()
        const run = state.run
        const currentNode = data.nodes.get(run.currentNodeId)
        if (!currentNode) return
        const currentRegion = data.regions.get(currentNode.region)
        if (!currentRegion?.nextRegion) return
        const nextRegion = data.regions.get(currentRegion.nextRegion)
        if (!nextRegion) return
        const entryNode = data.nodes.get(nextRegion.entryNodeId)
        if (!entryNode) return

        const nextRun: RunState = {
          ...run,
          currentNodeId: entryNode.id,
          endingReached: false,
        }
        set({
          run: {
            ...nextRun,
            history: [
              ...run.history,
              {
                kind: 'region-marker',
                regionId: nextRegion.id,
                regionName: nextRegion.name,
              },
              { kind: 'node', text: renderNodeText(entryNode, nextRun) },
            ],
          },
        })
      },
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        schemaVersion: state.schemaVersion,
        meta: state.meta,
        run: state.run,
      }),
      // Deep-merge persisted state with defaults so new fields (e.g.
      // unlockedBonusIds added in V2) get populated for older saves.
      merge: (persistedState, currentState) => {
        const p = (persistedState ?? {}) as Partial<PersistedState>
        return {
          ...currentState,
          ...p,
          meta: { ...currentState.meta, ...(p.meta ?? {}) },
          run: { ...currentState.run, ...(p.run ?? {}) },
        }
      },
    },
  ),
)
