import { z } from 'zod'

export const Knowledge = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    region: z.string().optional(),
  })
  .strict()
export type Knowledge = z.infer<typeof Knowledge>
