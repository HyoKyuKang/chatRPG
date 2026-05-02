import { z } from 'zod'
import { ClassType, StatName, StatDelta, NodeType, RegionId } from './primitives'

export const ChoiceCondition = z
  .object({
    class: ClassType.optional(),
    knowledge: z.string().optional(),
    item: z.string().optional(),
    statGte: z.object({ name: StatName, value: z.number() }).optional(),
  })
  .strict()
export type ChoiceCondition = z.infer<typeof ChoiceCondition>

export const ChoiceOutcome = z
  .object({
    text: z.string(),
    statDelta: StatDelta.optional(),
    itemAdd: z.array(z.string()).optional(),
    itemRemove: z.array(z.string()).optional(),
    knowledgeGain: z.array(z.string()).optional(),
    classSet: ClassType.optional(),
    heroEncounter: z.string().optional(),
    nextNodeId: z.string().nullable(),
    enemyDamage: z.number().int().min(0).optional(),
  })
  .strict()
export type ChoiceOutcome = z.infer<typeof ChoiceOutcome>

export const Choice = z
  .object({
    id: z.string(),
    text: z.string(),
    condition: ChoiceCondition.optional(),
    // Combat gateway: present only on type='combat' nodes.
    //   true  → click engages combat (engageCombat(enemyId)); shown pre-combat.
    //   false → click resolves as evade/diplomacy via outcome.nextNodeId; pre-combat.
    //   undefined → in-combat action (combatChoice); shown only after engagement.
    startsCombat: z.boolean().optional(),
    outcome: ChoiceOutcome,
  })
  .strict()
export type Choice = z.infer<typeof Choice>

export const NodeEcho = z
  .object({
    condition: ChoiceCondition.optional(),
    text: z.string(),
  })
  .strict()
export type NodeEcho = z.infer<typeof NodeEcho>

export const Node = z
  .object({
    id: z.string(),
    region: RegionId,
    type: NodeType,
    description: z.string(),
    echoes: z.array(NodeEcho).optional(),
    choices: z.array(Choice),
    enemyId: z.string().optional(),
  })
  .strict()
export type Node = z.infer<typeof Node>
