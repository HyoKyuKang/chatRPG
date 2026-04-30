import { z } from 'zod'
import { ClassType, StatName } from './primitives'

export const Item = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    classRestriction: z.array(ClassType).optional(),
    statBonus: z.record(StatName, z.number()).optional(),
    consumable: z.boolean().optional(),
  })
  .strict()
export type Item = z.infer<typeof Item>
