import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import { parse as parseYaml } from 'yaml'

const ConditionSchema = z
  .object({
    class: z.enum(['warrior', 'mage']).optional(),
    knowledge: z.string().optional(),
    item: z.string().optional(),
    statGte: z
      .object({
        name: z.enum(['hp', 'mana']),
        value: z.number(),
      })
      .strict()
      .optional(),
  })
  .strict()

const OutcomeEffectSchema = z
  .object({
    statDelta: z
      .object({
        hp: z.number().optional(),
        mana: z.number().optional(),
      })
      .strict()
      .optional(),
    itemAdd: z.array(z.string()).optional(),
    itemRemove: z.array(z.string()).optional(),
    knowledgeGain: z.array(z.string()).optional(),
    classSet: z.enum(['warrior', 'mage']).optional(),
    heroEncounter: z.string().optional(),
    nextNodeId: z.string().nullable(),
  })
  .strict()

const ChoicePlanSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    condition: ConditionSchema.optional(),
    outcome: OutcomeEffectSchema,
  })
  .strict()

const NodeTypeSchema = z.enum([
  'encounter',
  'event',
  'rest',
  'shop',
  'combat',
  'boss',
  'ending',
])

const NodePlanSchema = z
  .object({
    id: z.string(),
    type: NodeTypeSchema,
    beat: z.string(),
    personas: z.array(z.string()),
    toneTarget: z.string(),
    previous: z.array(z.string()).default([]),
    next: z.array(z.string()).default([]),
    choices: z.array(ChoicePlanSchema),
  })
  .strict()

const RegionPlanSchema = z
  .object({
    region: z.string(),
    name: z.string(),
    description: z.string().optional(),
    entry: z.string(),
    boss: z.string(),
    nodes: z.array(NodePlanSchema),
  })
  .strict()

type RegionPlan = z.infer<typeof RegionPlanSchema>
type NodePlan = z.infer<typeof NodePlanSchema>

const ProseOutputSchema = z.object({
  description: z.string().min(1),
  choices: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      outcome_text: z.string().min(1),
    }),
  ),
})

async function loadPlan(planPath: string): Promise<RegionPlan> {
  const text = await readFile(planPath, 'utf8')
  const raw = parseYaml(text)
  return RegionPlanSchema.parse(raw)
}

async function loadPersona(id: string): Promise<string> {
  return readFile(join('personas', `${id}.md`), 'utf8')
}

function findNode(plan: RegionPlan, nodeId: string): NodePlan {
  const node = plan.nodes.find((n) => n.id === nodeId)
  if (!node) throw new Error(`Node "${nodeId}" not found in plan ${plan.region}`)
  return node
}

async function buildBrief(planPath: string, nodeId: string): Promise<string> {
  const plan = await loadPlan(planPath)
  const node = findNode(plan, nodeId)

  const personaContents = await Promise.all(
    node.personas.map(async (id) => {
      const text = await loadPersona(id)
      return `# 페르소나: ${id}\n\n${text.trim()}`
    }),
  )

  const choicesSection =
    node.choices.length === 0
      ? '- 선택지 없음 (ending 노드 — choices: [] 로 출력)'
      : node.choices
          .map((c, i) => {
            const lines = [
              `  ${i + 1}. id "${c.id}", label "${c.label}" (verbatim 반환 필수)`,
            ]
            if (c.condition) {
              lines.push(`     condition: ${JSON.stringify(c.condition)}`)
            }
            const eff: Record<string, unknown> = {}
            for (const key of [
              'statDelta',
              'itemAdd',
              'itemRemove',
              'knowledgeGain',
              'classSet',
              'heroEncounter',
              'nextNodeId',
            ] as const) {
              if (c.outcome[key] !== undefined) eff[key] = c.outcome[key]
            }
            lines.push(`     outcome 효과: ${JSON.stringify(eff)}`)
            return lines.join('\n')
          })
          .join('\n')

  const outputSchema =
    node.choices.length === 0
      ? `{
  "description": "...",
  "choices": []
}`
      : `{
  "description": "...",
  "choices": [
${node.choices
  .map(
    (c) =>
      `    {"id": "${c.id}", "text": "${c.label}", "outcome_text": "..."}`,
  )
  .join(',\n')}
  ]
}`

  return `한국어 텍스트 RPG "이 세계는 끝날 거야" 노드 1개의 prose만 작성. 선택지 라벨은 입력 그대로 verbatim 반환 (변경 금지).

${personaContents.join('\n\n')}

# 노드 brief: ${node.id}

## 메타
- ID: ${node.id}
- region: ${plan.region} (${plan.name})
- type: ${node.type}

## 컨텍스트
- 비트: ${node.beat}
- 직전 노드: ${node.previous.length ? node.previous.join(', ') : '(없음 — region 시작)'}
- 직후 노드: ${node.next.length ? node.next.join(', ') : '(없음 — ending)'}

## 등장 페르소나
${node.personas.map((p) => `- ${p}`).join('\n')}

## 메커닉 (불변, 라벨 verbatim)
${choicesSection}

## 톤 타겟
${node.toneTarget}

## 출력 (JSON 한 객체만 — 코드펜스/설명/추가텍스트 금지)

${outputSchema}

규칙:
- choice text는 입력 라벨 verbatim. 변경 금지.
- description은 narrator voice. 캐릭터 대사는 별도 단락 ("화자명: \\"...\\"" 형식, 대괄호 X).
- outcome_text는 narrator voice. 캐릭터 짧은 반응 인용 가능.
- 출력은 JSON 한 객체만. 코드펜스 금지, 설명 금지.`
}

async function integrate(
  planPath: string,
  nodeId: string,
  prosePath: string,
): Promise<string> {
  const plan = await loadPlan(planPath)
  const node = findNode(plan, nodeId)

  const proseRaw = await readFile(prosePath, 'utf8')
  const proseJson = JSON.parse(proseRaw)
  const prose = ProseOutputSchema.parse(proseJson)

  // Validate choice count + label verbatim
  if (prose.choices.length !== node.choices.length) {
    throw new Error(
      `Choice count mismatch for ${nodeId}: prose has ${prose.choices.length}, plan has ${node.choices.length}`,
    )
  }
  for (const planChoice of node.choices) {
    const proseChoice = prose.choices.find((c) => c.id === planChoice.id)
    if (!proseChoice) {
      throw new Error(`Plan choice "${planChoice.id}" missing in prose`)
    }
    if (proseChoice.text !== planChoice.label) {
      throw new Error(
        `Choice "${planChoice.id}" label mismatch — plan: "${planChoice.label}", prose: "${proseChoice.text}"`,
      )
    }
  }

  // Build node JSON matching src/schemas/node.ts shape
  const nodeJson = {
    id: node.id,
    region: plan.region,
    type: node.type,
    description: prose.description,
    choices: node.choices.map((planChoice) => {
      const proseChoice = prose.choices.find((c) => c.id === planChoice.id)!
      const outcomeOut: Record<string, unknown> = {
        text: proseChoice.outcome_text,
      }
      for (const key of [
        'statDelta',
        'itemAdd',
        'itemRemove',
        'knowledgeGain',
        'classSet',
        'heroEncounter',
      ] as const) {
        if (planChoice.outcome[key] !== undefined) {
          outcomeOut[key] = planChoice.outcome[key]
        }
      }
      outcomeOut.nextNodeId = planChoice.outcome.nextNodeId

      const choiceOut: Record<string, unknown> = {
        id: planChoice.id,
        text: planChoice.label,
      }
      if (planChoice.condition) choiceOut.condition = planChoice.condition
      choiceOut.outcome = outcomeOut
      return choiceOut
    }),
  }

  const outPath = join('data/nodes', plan.region, `${nodeId}.json`)
  await writeFile(outPath, JSON.stringify(nodeJson, null, 2) + '\n', 'utf8')
  return outPath
}

async function autoNode(planPath: string, nodeId: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY not set. Use build-brief + integrate manually, or set the key for full automation.',
    )
  }
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic()
  const brief = await buildBrief(planPath, nodeId)
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: brief }],
  })
  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { text: string }).text)
    .join('\n')
  const json = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim()
  const tmpPath = `/tmp/prose-${nodeId}.json`
  await writeFile(tmpPath, json, 'utf8')
  return integrate(planPath, nodeId, tmpPath)
}

const HELP = `Usage:
  tsx scripts/author-node.ts validate-plan <plan-path>
  tsx scripts/author-node.ts build-brief <plan-path> <node-id>
  tsx scripts/author-node.ts integrate <plan-path> <node-id> <prose-json-path>
  tsx scripts/author-node.ts auto <plan-path> <node-id>   (requires ANTHROPIC_API_KEY)
`

async function main() {
  const [, , subcommand, ...args] = process.argv
  switch (subcommand) {
    case 'validate-plan': {
      const [planPath] = args
      if (!planPath) throw new Error(HELP)
      const plan = await loadPlan(planPath)
      console.log(
        `✓ ${planPath} valid: region "${plan.region}" with ${plan.nodes.length} node(s)`,
      )
      break
    }
    case 'build-brief': {
      const [planPath, nodeId] = args
      if (!planPath || !nodeId) throw new Error(HELP)
      const brief = await buildBrief(planPath, nodeId)
      console.log(brief)
      break
    }
    case 'integrate': {
      const [planPath, nodeId, prosePath] = args
      if (!planPath || !nodeId || !prosePath) throw new Error(HELP)
      const out = await integrate(planPath, nodeId, prosePath)
      console.log(`✓ wrote ${out}`)
      break
    }
    case 'auto': {
      const [planPath, nodeId] = args
      if (!planPath || !nodeId) throw new Error(HELP)
      const out = await autoNode(planPath, nodeId)
      console.log(`✓ wrote ${out} (auto)`)
      break
    }
    default:
      console.error(HELP)
      process.exit(1)
  }
}

main().catch((e: Error) => {
  console.error(`ERROR: ${e.message}`)
  process.exit(1)
})
