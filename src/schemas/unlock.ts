import { z } from 'zod'
import { StatName } from './primitives'

// Effect of buying a unlock — applied at freshRun() time
export const UnlockEffect = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('startStat'),
    stat: StatName,
    delta: z.number(),
  }),
  z.object({
    type: z.literal('startItem'),
    itemId: z.string(),
  }),
])
export type UnlockEffect = z.infer<typeof UnlockEffect>

export const Unlock = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    cost: z.number().int().positive(),
    effect: UnlockEffect,
  })
  .strict()
export type Unlock = z.infer<typeof Unlock>
