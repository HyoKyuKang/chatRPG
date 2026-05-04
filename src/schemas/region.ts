import { z } from 'zod'
import { RegionId } from './primitives'

export const Region = z
  .object({
    id: RegionId,
    name: z.string(),
    description: z.string().optional(),
    headerImage: z.string().optional(),
    entryNodeId: z.string(),
    bossNodeId: z.string().optional(),
    nodeIds: z.array(z.string()),
    nextRegion: RegionId.optional(),
  })
  .strict()
export type Region = z.infer<typeof Region>
