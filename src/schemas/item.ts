import { z } from 'zod'
import { ClassType, StatDelta } from './primitives'

export const Item = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    classRestriction: z.array(ClassType).optional(),
    statBonus: StatDelta.optional(),
    consumable: z.boolean().optional(),
  })
  .strict()
export type Item = z.infer<typeof Item>
