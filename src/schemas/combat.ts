import { z } from 'zod'
import { StatDelta } from './primitives'

export const EnemyAction = z
  .object({
    id: z.string(),
    name: z.string(),
    predictionText: z.string(),
    executeText: z.string(),
    statDelta: StatDelta.optional(),
  })
  .strict()
export type EnemyAction = z.infer<typeof EnemyAction>

export const EnemyPhaseOverride = z
  .object({
    atTurn: z.number().int().min(1),
    actionsOverride: z.array(EnemyAction),
  })
  .strict()
export type EnemyPhaseOverride = z.infer<typeof EnemyPhaseOverride>

export const EnemyPattern = z
  .object({
    id: z.string(),
    name: z.string(),
    hp: z.number().int().min(1),
    actions: z.array(EnemyAction).min(1),
    phases: z.array(EnemyPhaseOverride).optional(),
  })
  .strict()
export type EnemyPattern = z.infer<typeof EnemyPattern>
