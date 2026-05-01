import { useEffect, useRef } from 'react'
import { data, useGame } from '../store'
import type { Choice } from '../schemas'

function isChoiceVisible(
  choice: Choice,
  ctx: {
    classChosen: string | null
    knowledge: string[]
    inventory: string[]
    stats: { hp: number; mana: number }
  },
): boolean {
  const c = choice.condition
  if (!c) return true
  if (c.class && c.class !== ctx.classChosen) return false
  if (c.knowledge && !ctx.knowledge.includes(c.knowledge)) return false
  if (c.item && !ctx.inventory.includes(c.item)) return false
  if (c.statGte) {
    const v = ctx.stats[c.statGte.name]
    if (v < c.statGte.value) return false
  }
  return true
}

interface ParsedParagraph {
  kind: 'narrator' | 'speech'
  speaker?: string
  body: string
}

const SPEAKER_RE = /^([가-힣A-Za-z·]+(?:\s[가-힣A-Za-z·]+)?):\s+([\s\S]+)$/

function splitParagraphs(text: string): ParsedParagraph[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const m = p.match(SPEAKER_RE)
      if (m) return { kind: 'speech', speaker: m[1], body: m[2] }
      return { kind: 'narrator', body: p }
    })
}

function NarratorBlock({ text }: { text: string }) {
  return (
    <div className="space-y-3">
      {splitParagraphs(text).map((p, i) =>
        p.kind === 'speech' ? (
          <SpeechLine key={i} speaker={p.speaker!} body={p.body} />
        ) : (
          <p
            key={i}
            className="prose-ko text-ink-100 whitespace-pre-line"
          >
            {p.body}
          </p>
        ),
      )}
    </div>
  )
}

function SpeechLine({ speaker, body }: { speaker: string; body: string }) {
  return (
    <div className="my-1">
      <div className="flex items-center gap-2 mb-1">
        <span className="h-[1px] w-3 bg-gold-700/60" />
        <span className="text-gold-300 text-[10px] font-semibold tracking-[0.2em] uppercase">
          {speaker}
        </span>
      </div>
      <p className="prose-ko text-ink-50 pl-5 whitespace-pre-line">
        {body}
      </p>
    </div>
  )
}

function OutcomeBlock({ text }: { text: string }) {
  return (
    <div className="space-y-2 pl-3 border-l border-ink-700/50">
      {splitParagraphs(text).map((p, i) =>
        p.kind === 'speech' ? (
          <SpeechLine key={i} speaker={p.speaker!} body={p.body} />
        ) : (
          <p
            key={i}
            className="prose-ko text-ink-200 italic whitespace-pre-line"
          >
            {p.body}
          </p>
        ),
      )}
    </div>
  )
}

export function NodeView() {
  const run = useGame((s) => s.run)
  const choose = useGame((s) => s.choose)
  const reset = useGame((s) => s.reset)
  const transitionToNextRegion = useGame((s) => s.transitionToNextRegion)

  const node = data.nodes.get(run.currentNodeId)
  const isEnding = run.endingReached || node?.type === 'ending'
  const isDead = run.dead

  const currentRegion = node ? data.regions.get(node.region) : undefined
  const nextRegion =
    isEnding && !isDead && currentRegion?.nextRegion
      ? data.regions.get(currentRegion.nextRegion)
      : undefined

  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [run.history.length])

  const visibleChoices =
    !isDead && !isEnding && node
      ? node.choices.filter((c) =>
          isChoiceVisible(c, {
            classChosen: run.classChosen,
            knowledge: run.knowledge,
            inventory: run.inventory,
            stats: run.stats,
          }),
        )
      : []

  return (
    <div className="flex flex-col h-full">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 py-5 space-y-4"
      >
        {run.history.map((h, i) => {
          if (h.kind === 'node') return <NarratorBlock key={i} text={h.text} />

          if (h.kind === 'choice')
            return (
              <p
                key={i}
                className="text-gold-500/90 text-[13px] tracking-wide pl-3 border-l-2 border-gold-700/40 my-1"
              >
                <span className="opacity-70 mr-1">▸</span>
                {h.text}
              </p>
            )

          if (h.kind === 'outcome') return <OutcomeBlock key={i} text={h.text} />

          if (h.kind === 'death')
            return (
              <div
                key={i}
                className="my-3 px-4 py-3 rounded-md border border-blood-700/50 bg-blood-700/15"
              >
                <p className="text-blood-300 text-sm whitespace-pre-line">
                  {h.text}
                </p>
              </div>
            )

          return null
        })}
      </div>

      <div className="border-t border-white/5 px-4 pt-3 pb-4 space-y-2 bg-ink-950/40 backdrop-blur-sm">
        {isDead ? (
          <ChoiceButton variant="death" onClick={reset}>
            다시 출정
          </ChoiceButton>
        ) : isEnding && nextRegion ? (
          <ChoiceButton variant="advance" onClick={transitionToNextRegion}>
            {nextRegion.name}으로 간다
          </ChoiceButton>
        ) : isEnding ? (
          <ChoiceButton variant="neutral" onClick={reset}>
            다시 출정
          </ChoiceButton>
        ) : visibleChoices.length === 0 ? (
          <p className="text-ink-400 text-center py-4 text-sm">
            가능한 선택지 없음
          </p>
        ) : (
          visibleChoices.map((c) => (
            <ChoiceButton key={c.id} variant="default" onClick={() => choose(c.id)}>
              {c.text}
            </ChoiceButton>
          ))
        )}
      </div>
    </div>
  )
}

interface ChoiceButtonProps {
  variant: 'default' | 'advance' | 'death' | 'neutral'
  onClick: () => void
  children: React.ReactNode
}

function ChoiceButton({ variant, onClick, children }: ChoiceButtonProps) {
  const styles: Record<ChoiceButtonProps['variant'], string> = {
    default:
      'border-gold-700/40 hover:border-gold-500/70 bg-gradient-to-b from-gold-700/15 to-gold-700/5 hover:from-gold-700/25 hover:to-gold-700/10 text-ink-100 hover:text-gold-300',
    advance:
      'border-rune-500/40 hover:border-rune-300/70 bg-gradient-to-b from-rune-700/20 to-rune-700/5 hover:from-rune-700/35 text-rune-300',
    death:
      'border-blood-500/40 hover:border-blood-300/70 bg-gradient-to-b from-blood-700/20 to-blood-700/5 hover:from-blood-700/35 text-blood-300',
    neutral:
      'border-ink-400/40 hover:border-ink-200/70 bg-gradient-to-b from-ink-700/30 to-ink-700/10 hover:from-ink-700/40 text-ink-100',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-full px-4 py-3.5 text-left text-[14px]
        rounded-md border transition-all
        active:scale-[0.99]
        group
        ${styles[variant]}
      `}
    >
      <span className="opacity-60 group-hover:opacity-100 mr-2 transition">
        {variant === 'default' ? '▸' : variant === 'advance' ? '✦' : variant === 'death' ? '✕' : '◇'}
      </span>
      {children}
    </button>
  )
}
