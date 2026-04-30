import { z } from 'zod'
import { ClassType, HeroEncounter } from './primitives'

export const Hero = z
  .object({
    id: z.string(),
    name: z.string(),
    bio: z.string().optional(),
    classAffinity: ClassType.optional(),
    encounter: HeroEncounter,
    knowledgeGives: z.array(z.string()).optional(),
  })
  .strict()
export type Hero = z.infer<typeof Hero>
