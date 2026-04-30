import { z } from 'zod'
import { RegionId } from './primitives'

export const Region = z
  .object({
    id: RegionId,
    name: z.string(),
    description: z.string().optional(),
    entryNodeId: z.string(),
    bossNodeId: z.string(),
    nodeIds: z.array(z.string()),
  })
  .strict()
export type Region = z.infer<typeof Region>
