import { z } from 'zod'
import { ClassType, EndingId, Stats } from './primitives'

export const GameState = z
  .object({
    currentNodeId: z.string(),
    classChosen: ClassType.nullable(),
    stats: Stats,
    inventory: z.array(z.string()),
    knowledgeFlags: z.array(z.string()),
    heroesEncountered: z.array(z.string()),
    history: z.array(z.string()),
  })
  .strict()
export type GameState = z.infer<typeof GameState>

export const MetaState = z
  .object({
    memoryShards: z.number(),
    unlockedClasses: z.array(ClassType),
    unlockedBonusIds: z.array(z.string()),
    discoveredKnowledge: z.array(z.string()),
    completedRuns: z.number(),
    endingsReached: z.array(EndingId),
    totalDeaths: z.number(),
    bgmEnabled: z.boolean(),
    bgmVolume: z.number().min(0).max(1),
    sfxEnabled: z.boolean(),
    sfxVolume: z.number().min(0).max(1),
  })
  .strict()
export type MetaState = z.infer<typeof MetaState>

export const SaveData = z
  .object({
    schemaVersion: z.literal(1),
    meta: MetaState,
    currentRun: GameState.nullable(),
  })
  .strict()
export type SaveData = z.infer<typeof SaveData>
