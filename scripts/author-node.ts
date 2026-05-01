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

const NodeEchoPlanSchema = z
  .object({
    condition: ConditionSchema.optional(),
    text: z.string(),
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
    echoes: z.array(NodeEchoPlanSchema).optional(),
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

const ReviewOutputSchema = z
  .object({
    voiceMatch: z.number().int().min(0).max(5),
    toneMatch: z.number().int().min(0).max(5),
    structureOk: z.boolean(),
    issues: z.array(z.string()),
  })
  .strict()

type Review = z.infer<typeof ReviewOutputSchema>

const REVIEW_PASS_THRESHOLD = 8 // voice + tone 합산

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
  const nodeJson: Record<string, unknown> = {
    id: node.id,
    region: plan.region,
    type: node.type,
    description: prose.description,
  }
  if (node.echoes && node.echoes.length > 0) {
    nodeJson.echoes = node.echoes
  }
  nodeJson.choices = node.choices.map((planChoice) => {
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
    })

  const outPath = join('data/nodes', plan.region, `${nodeId}.json`)
  await writeFile(outPath, JSON.stringify(nodeJson, null, 2) + '\n', 'utf8')
  return outPath
}

interface ExistingProse {
  description: string
  choices: { id: string; text: string; outcome: { text: string } }[]
}

async function loadExistingProse(
  region: string,
  nodeId: string,
): Promise<ExistingProse> {
  const nodePath = join('data/nodes', region, `${nodeId}.json`)
  const raw = await readFile(nodePath, 'utf8')
  return JSON.parse(raw) as ExistingProse
}

async function buildReviewBrief(
  planPath: string,
  nodeId: string,
): Promise<string> {
  const plan = await loadPlan(planPath)
  const node = findNode(plan, nodeId)

  const personaContents = await Promise.all(
    node.personas.map(async (id) => {
      const text = await loadPersona(id)
      return `# 페르소나: ${id}\n\n${text.trim()}`
    }),
  )

  const prose = await loadExistingProse(plan.region, nodeId)

  const outcomesSection =
    prose.choices.length === 0
      ? '(선택지 없음 — ending 노드)'
      : prose.choices
          .map(
            (c) =>
              `- choice "${c.text}":\n  ${c.outcome.text.replace(/\n/g, '\n  ')}`,
          )
          .join('\n\n')

  return `한국어 텍스트 RPG "이 세계는 끝날 거야" 노드 1개의 prose를 평가. 첨부된 페르소나 voice와 톤 타겟에 얼마나 일치하는지 채점.

${personaContents.join('\n\n')}

# 평가 대상 노드: ${node.id}

## 메타
- region: ${plan.region} (${plan.name})
- type: ${node.type}
- 비트: ${node.beat}
- 톤 타겟: ${node.toneTarget}

## 등장 페르소나
${node.personas.map((p) => `- ${p}`).join('\n')}

## 작성된 prose

### description
${prose.description}

### outcome_text 들
${outcomesSection}

## 평가 기준

1. **voiceMatch (0~5)** — 페르소나 voice와의 일치도
   - narrator: 2인칭 "너", 현재형, 단문, 비유 절제. "당신" / "...였다" / "느꼈다" 금지.
   - 캐릭터: 해당 페르소나 MD의 화법.
   - 5 = 완전 일치, 4 = 작은 흠집, 3 = 명백한 깨짐 1~2 곳, 2↓ = 다른 voice.

2. **toneMatch (0~5)** — 톤 타겟의 정서/긴장과 일치도
   - 5 = 톤 타겟 그대로, 3 = 결은 비슷한데 과/약, 2↓ = 다른 정서.

3. **structureOk (boolean)** — 단락 규칙 + 형식
   - 한 단락 = 한 비트 (단락 사이 빈 줄)
   - 캐릭터 대사는 별도 단락의 \`화자명: "..."\` 형식 (대괄호/꺾쇠 X)
   - description 길이가 type 디폴트 범위 안 (encounter 80~150자, event 100~200자, combat 80~140자, boss 150~250자, ending 180~300자) — 약간 벗어나는 건 OK
   - 위반 1개라도 있으면 false

4. **issues** — 깨진 곳 한 줄씩 (없으면 빈 배열). 보수적으로 채점.

## 출력 (JSON 한 객체만 — 코드펜스 / 설명 / 추가텍스트 금지)

{
  "voiceMatch": 0~5의 정수,
  "toneMatch": 0~5의 정수,
  "structureOk": true | false,
  "issues": ["...", ...]
}`
}

function formatReview(nodeId: string, review: Review): { pass: boolean; output: string } {
  const total = review.voiceMatch + review.toneMatch
  const pass = total >= REVIEW_PASS_THRESHOLD && review.structureOk
  const mark = pass ? '✓' : '⚠'
  const lines = [
    `${mark} ${nodeId}  voice ${review.voiceMatch}/5  tone ${review.toneMatch}/5  structure ${review.structureOk ? 'ok' : 'NG'}`,
  ]
  for (const issue of review.issues) {
    lines.push(`   - ${issue}`)
  }
  return { pass, output: lines.join('\n') }
}

async function reviewIntegrate(
  planPath: string,
  nodeId: string,
  reviewPath: string,
): Promise<{ pass: boolean; output: string }> {
  await loadPlan(planPath) // 검증용
  const reviewRaw = await readFile(reviewPath, 'utf8')
  const reviewJson = JSON.parse(reviewRaw)
  const review = ReviewOutputSchema.parse(reviewJson)
  return formatReview(nodeId, review)
}

async function autoReview(
  planPath: string,
  nodeId: string,
): Promise<{ pass: boolean; output: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY not set. Use review-brief + review-integrate manually.',
    )
  }
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic()
  const brief = await buildReviewBrief(planPath, nodeId)
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: brief }],
  })
  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { text: string }).text)
    .join('\n')
  const json = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim()
  const review = ReviewOutputSchema.parse(JSON.parse(json))
  return formatReview(nodeId, review)
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

async function reviewAll(planPath: string): Promise<void> {
  const plan = await loadPlan(planPath)
  if (!process.env.ANTHROPIC_API_KEY) {
    // Manual mode — emit all briefs separated by markers, expect caller
    // (main Claude Code session via Agent tool, or human) to produce a single
    // JSON object keyed by node id and run review-integrate-batch.
    const out: string[] = []
    out.push(`# review-all (manual mode — ANTHROPIC_API_KEY not set)`)
    out.push(`# region: ${plan.region}, ${plan.nodes.length} node(s)`)
    out.push(``)
    out.push(`# Review each node below. Produce ONE JSON object keyed by node id:`)
    out.push(`#   { "fo-arrive": { "voiceMatch": 5, "toneMatch": 4, "structureOk": true, "issues": [] }, ... }`)
    out.push(`# Save to /tmp/reviews-${plan.region}.json then run:`)
    out.push(`#   npm run author -- review-integrate-batch <plan-path> /tmp/reviews-${plan.region}.json`)
    out.push(``)
    for (const node of plan.nodes) {
      out.push(`\n=========================================================`)
      out.push(`=== NODE: ${node.id}`)
      out.push(`=========================================================\n`)
      const brief = await buildReviewBrief(planPath, node.id)
      out.push(brief)
    }
    console.log(out.join('\n'))
    return
  }
  // Auto mode — call API for each node sequentially
  process.stderr.write(`Reviewing ${plan.nodes.length} nodes in ${plan.region}...\n`)
  const results: { id: string; pass: boolean; output: string }[] = []
  for (const node of plan.nodes) {
    process.stderr.write(`  ${node.id}...`)
    const r = await autoReview(planPath, node.id)
    process.stderr.write(` ${r.pass ? '✓' : '⚠'}\n`)
    results.push({ id: node.id, ...r })
  }
  console.log(`\n# review-all summary: ${plan.region}\n`)
  for (const r of results) console.log(r.output)
  const passed = results.filter((r) => r.pass).length
  const failed = results.filter((r) => !r.pass).length
  console.log(`\nPassed: ${passed} / ${results.length}, Failed: ${failed}`)
  if (failed > 0) process.exitCode = 2
}

async function reviewIntegrateBatch(
  planPath: string,
  reviewsPath: string,
): Promise<void> {
  const plan = await loadPlan(planPath)
  const raw = await readFile(reviewsPath, 'utf8')
  const reviewsRaw = JSON.parse(raw) as Record<string, unknown>
  const results: { id: string; pass: boolean; output: string }[] = []
  let missing = 0
  for (const node of plan.nodes) {
    const data = reviewsRaw[node.id]
    if (data === undefined) {
      console.log(`? ${node.id}  (no review data)`)
      missing += 1
      continue
    }
    const review = ReviewOutputSchema.parse(data)
    const r = formatReview(node.id, review)
    results.push({ id: node.id, ...r })
    console.log(r.output)
  }
  const passed = results.filter((r) => r.pass).length
  const failed = results.filter((r) => !r.pass).length
  console.log(
    `\nPassed: ${passed} / ${results.length}, Failed: ${failed}, Missing: ${missing}`,
  )
  if (failed > 0 || missing > 0) process.exitCode = 2
}

const HELP = `Usage:
  tsx scripts/author-node.ts validate-plan <plan-path>
  tsx scripts/author-node.ts build-brief <plan-path> <node-id>
  tsx scripts/author-node.ts integrate <plan-path> <node-id> <prose-json-path>
  tsx scripts/author-node.ts auto <plan-path> <node-id>                       (requires ANTHROPIC_API_KEY)
  tsx scripts/author-node.ts review-brief <plan-path> <node-id>
  tsx scripts/author-node.ts review-integrate <plan-path> <node-id> <review-json-path>
  tsx scripts/author-node.ts review <plan-path> <node-id>                     (requires ANTHROPIC_API_KEY)
  tsx scripts/author-node.ts review-all <plan-path>                           (auto if ANTHROPIC_API_KEY, else emits briefs)
  tsx scripts/author-node.ts review-integrate-batch <plan-path> <reviews-json-path>
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
    case 'review-brief': {
      const [planPath, nodeId] = args
      if (!planPath || !nodeId) throw new Error(HELP)
      const brief = await buildReviewBrief(planPath, nodeId)
      console.log(brief)
      break
    }
    case 'review-integrate': {
      const [planPath, nodeId, reviewPath] = args
      if (!planPath || !nodeId || !reviewPath) throw new Error(HELP)
      const result = await reviewIntegrate(planPath, nodeId, reviewPath)
      console.log(result.output)
      if (!result.pass) process.exitCode = 2
      break
    }
    case 'review': {
      const [planPath, nodeId] = args
      if (!planPath || !nodeId) throw new Error(HELP)
      const result = await autoReview(planPath, nodeId)
      console.log(result.output)
      if (!result.pass) process.exitCode = 2
      break
    }
    case 'review-all': {
      const [planPath] = args
      if (!planPath) throw new Error(HELP)
      await reviewAll(planPath)
      break
    }
    case 'review-integrate-batch': {
      const [planPath, reviewsPath] = args
      if (!planPath || !reviewsPath) throw new Error(HELP)
      await reviewIntegrateBatch(planPath, reviewsPath)
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
