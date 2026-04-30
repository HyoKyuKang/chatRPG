import { z } from 'zod'
import { ClassType, EndingId, StatName } from './primitives'

export const GameState = z
  .object({
    currentNodeId: z.string(),
    classChosen: ClassType.nullable(),
    stats: z.record(StatName, z.number()),
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
    discoveredKnowledge: z.array(z.string()),
    completedRuns: z.number(),
    endingsReached: z.array(EndingId),
    totalDeaths: z.number(),
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
