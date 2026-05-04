import { z } from 'zod'

export const ClassType = z.enum(['warrior', 'mage'])
export type ClassType = z.infer<typeof ClassType>

export const StatName = z.enum(['hp', 'mana'])
export type StatName = z.infer<typeof StatName>

export const Stats = z
  .object({
    hp: z.number(),
    mana: z.number(),
  })
  .strict()
export type Stats = z.infer<typeof Stats>

export const StatDelta = z
  .object({
    hp: z.number().optional(),
    mana: z.number().optional(),
  })
  .strict()
export type StatDelta = z.infer<typeof StatDelta>

export const RegionId = z.enum([
  'prologue',
  'forest-outskirts',
  'forgotten-mountains',
  'ash-wastes',
  'dreaming-city',
  'dawn-spire',
])
export type RegionId = z.infer<typeof RegionId>

export const NodeType = z.enum([
  'encounter',
  'event',
  'rest',
  'shop',
  'combat',
  'boss',
  'ending',
])
export type NodeType = z.infer<typeof NodeType>

export const HeroEncounter = z.enum(['neutral', 'companion', 'foe'])
export type HeroEncounter = z.infer<typeof HeroEncounter>

export const EndingId = z.enum([
  'defeat-demon-king',
  'betrayal',
  'self-sacrifice',
])
export type EndingId = z.infer<typeof EndingId>
