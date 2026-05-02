import { useEffect, useMemo, useRef, useState } from 'react'
import { data, useGame, type HistoryEntry } from '../store'
import type { Choice, Hero } from '../schemas'
import { MetaUnlockScreen } from './MetaUnlockScreen'

// ─── Choice condition ─────────────────────────────────────────────────────

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

// ─── Paragraph parsing ────────────────────────────────────────────────────

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

// ─── Reveal queue items ───────────────────────────────────────────────────

type HistoryKind = 'node' | 'choice' | 'outcome' | 'death'

type RevealItem =
  | {
      kind: 'paragraph'
      parentKind: HistoryKind
      parentIndex: number
      paragraph: ParsedParagraph
    }
  | {
      kind: 'hero-card'
      parentKind: HistoryKind
      parentIndex: number
      heroId: string
    }
  | { kind: 'simple'; parentKind: HistoryKind; parentIndex: number; body: string }

const heroByName = new Map<string, Hero>()
data.heroes.forEach((h) => heroByName.set(h.name, h))

function entryToReveal(
  entry: HistoryEntry,
  index: number,
  alreadyEncountered: Set<string>,
): RevealItem[] {
  // Region marker is a boundary signal only — never rendered
  if (entry.kind === 'region-marker') return []

  if (entry.kind === 'choice' || entry.kind === 'death') {
    return [
      {
        kind: 'simple',
        parentKind: entry.kind,
        parentIndex: index,
        body: entry.text,
      },
    ]
  }
  // 'node' or 'outcome' — split into paragraphs and inject hero cards
  const paragraphs = splitParagraphs(entry.text)
  const items: RevealItem[] = []
  paragraphs.forEach((p) => {
    if (p.kind === 'speech' && p.speaker) {
      const hero = heroByName.get(p.speaker)
      if (hero && !alreadyEncountered.has(hero.id)) {
        items.push({
          kind: 'hero-card',
          parentKind: entry.kind,
          parentIndex: index,
          heroId: hero.id,
        })
        alreadyEncountered.add(hero.id)
      }
    }
    items.push({
      kind: 'paragraph',
      parentKind: entry.kind,
      parentIndex: index,
      paragraph: p,
    })
  })
  return items
}

// Find the index of the most recent region-marker in history.
// Returns -1 if none (legacy persist data without markers).
function findLastRegionMarker(history: HistoryEntry[]): number {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].kind === 'region-marker') return i
  }
  return -1
}

// ─── Reveal pacing ────────────────────────────────────────────────────────

// Hades-style pacing: narrator instant (batched), only character speech is staged.
// Hero intro card pauses briefly for cinematic effect; death gets emphasis pause.
function pacingFor(item: RevealItem): { delay: number; typing: boolean } {
  if (item.kind === 'simple') {
    if (item.parentKind === 'choice') return { delay: 0, typing: false }
    return { delay: 220, typing: false } // death — slight emphasis
  }
  if (item.kind === 'hero-card') return { delay: 280, typing: false }
  // paragraph
  const isSpeech = item.paragraph.kind === 'speech'
  if (isSpeech) return { delay: 700, typing: true }
  // narrator / outcome-narrator → instant (batched with siblings)
  return { delay: 0, typing: false }
}

// ─── Main component ───────────────────────────────────────────────────────

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

  // Reveal state — scoped to "active region" (entries after last region-marker)
  const [revealed, setRevealed] = useState<RevealItem[]>([])
  const [pending, setPending] = useState<RevealItem[]>([])
  const [typing, setTyping] = useState(false)
  const lastSnapshotRef = useRef<{ historyLen: number; activeStart: number }>({
    historyLen: 0,
    activeStart: 0,
  })
  const hydratedRef = useRef(false)

  // Skip staging when user prefers reduced motion (also used by QA smoke)
  const reducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  const scrollRef = useRef<HTMLDivElement>(null)

  // Sync history → reveal queue (region-scoped: only render entries after the
  // last region-marker; new region-marker wipes the chat log)
  useEffect(() => {
    const history = run.history
    const lastMarker = findLastRegionMarker(history)
    const activeStart = lastMarker + 1
    const last = lastSnapshotRef.current

    // ─── First mount / hydrate from persist ────────────────────
    if (!hydratedRef.current) {
      if (history.length === 0) return
      const activeEntries = history.slice(activeStart)
      const encountered = new Set(run.heroesEncountered)
      const items = activeEntries.flatMap((h, di) =>
        entryToReveal(h, activeStart + di, encountered),
      )
      setRevealed(items)
      setPending([])
      setTyping(false)
      lastSnapshotRef.current = { historyLen: history.length, activeStart }
      hydratedRef.current = true
      return
    }

    // ─── Reset (history shrank) ────────────────────────────────
    if (history.length < last.historyLen) {
      const fresh = new Set<string>()
      const activeEntries = history.slice(activeStart)
      const items = activeEntries.flatMap((h, di) =>
        entryToReveal(h, activeStart + di, fresh),
      )
      if (reducedMotion) {
        setRevealed(items)
        setPending([])
      } else {
        setRevealed([])
        setPending(items)
      }
      setTyping(false)
      lastSnapshotRef.current = { historyLen: history.length, activeStart }
      return
    }

    // ─── Region transition (new region-marker) — wipe + restage ─
    if (activeStart !== last.activeStart) {
      const newEntries = history.slice(activeStart)
      const fresh = new Set<string>()
      const items = newEntries.flatMap((h, di) =>
        entryToReveal(h, activeStart + di, fresh),
      )
      if (reducedMotion) {
        setRevealed(items)
        setPending([])
      } else {
        setRevealed([])
        setPending(items)
      }
      setTyping(false)
      lastSnapshotRef.current = { historyLen: history.length, activeStart }
      return
    }

    // ─── Normal grow within same region ────────────────────────
    if (history.length > last.historyLen) {
      const startIdx = last.historyLen
      const newEntries = history.slice(startIdx)
      const encountered = new Set(run.heroesEncountered)
      revealed.forEach((it) => {
        if (it.kind === 'hero-card') encountered.add(it.heroId)
      })
      const newItems = newEntries.flatMap((h, di) =>
        entryToReveal(h, startIdx + di, encountered),
      )
      if (reducedMotion) {
        setRevealed((prev) => [...prev, ...newItems])
      } else {
        setPending((prev) => [...prev, ...newItems])
      }
      lastSnapshotRef.current = { historyLen: history.length, activeStart }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.history.length])

  // Process pending queue:
  // 1. Drain leading instant items in one batch (narrator/choice → flushed together)
  // 2. Then schedule the next paced item via setTimeout
  useEffect(() => {
    if (pending.length === 0) {
      if (typing) setTyping(false)
      return
    }

    // Batch-flush leading instant items (delay === 0, no typing)
    let batchEnd = 0
    while (batchEnd < pending.length) {
      const { delay, typing: shouldType } = pacingFor(pending[batchEnd])
      if (delay > 0 || shouldType) break
      batchEnd++
    }
    if (batchEnd > 0) {
      const batch = pending.slice(0, batchEnd)
      setRevealed((prev) => [...prev, ...batch])
      setPending((prev) => prev.slice(batchEnd))
      return
    }

    // pending[0] is a paced item
    const next = pending[0]
    const { delay, typing: shouldType } = pacingFor(next)
    if (shouldType) setTyping(true)
    else if (typing) setTyping(false)

    const timer = setTimeout(() => {
      setRevealed((prev) => [...prev, next])
      setPending((prev) => prev.slice(1))
      setTyping(false)
    }, delay)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending])

  // Auto-scroll to bottom on new content
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [revealed.length, typing])

  // Tap-to-skip
  const skipAll = () => {
    if (pending.length === 0 && !typing) return
    setRevealed((prev) => [...prev, ...pending])
    setPending([])
    setTyping(false)
  }

  const revealComplete = pending.length === 0 && !typing

  const visibleChoices =
    !isDead && !isEnding && node && revealComplete
      ? node.choices.filter((c) =>
          isChoiceVisible(c, {
            classChosen: run.classChosen,
            knowledge: run.knowledge,
            inventory: run.inventory,
            stats: run.stats,
          }),
        )
      : []

  // Group revealed items by parentIndex for entry-level styling
  const groups = useMemo(() => {
    const map = new Map<number, RevealItem[]>()
    revealed.forEach((it) => {
      if (!map.has(it.parentIndex)) map.set(it.parentIndex, [])
      map.get(it.parentIndex)!.push(it)
    })
    return Array.from(map.entries()).sort(([a], [b]) => a - b)
  }, [revealed])

  // After the chat log finishes revealing a death or final ending, swap the
  // entire view to MetaUnlockScreen (공허). Region transitions stay in chat log.
  const isFinalEnding = isEnding && !nextRegion
  const showMetaScreen = revealComplete && (isDead || isFinalEnding)
  if (showMetaScreen) {
    return (
      <MetaUnlockScreen
        reason={isDead ? 'death' : 'ending'}
        onContinue={reset}
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div
        ref={scrollRef}
        onClick={skipAll}
        className="flex-1 overflow-y-auto px-5 py-5 space-y-4 cursor-default"
      >
        {groups.map(([parentIndex, items]) => (
          <RevealedGroup key={parentIndex} items={items} />
        ))}

        {typing && <TypingIndicator />}
      </div>

      <div className="border-t border-white/5 px-4 pt-3 pb-4 space-y-2 bg-ink-950/40 backdrop-blur-sm">
        {!revealComplete ? (
          <p className="text-ink-500 text-center py-4 text-[12px] tracking-widest uppercase select-none">
            화면을 누르면 빨리감기
          </p>
        ) : isEnding && nextRegion ? (
          <ChoiceButton variant="advance" onClick={transitionToNextRegion}>
            {nextRegion.name}으로 간다
          </ChoiceButton>
        ) : visibleChoices.length === 0 ? (
          <p className="text-ink-400 text-center py-4 text-sm">
            가능한 선택지 없음
          </p>
        ) : (
          visibleChoices.map((c) => (
            <ChoiceButton
              key={c.id}
              variant="default"
              onClick={() => choose(c.id)}
            >
              {c.text}
            </ChoiceButton>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Group renderer (one history entry's worth of items) ──────────────────

function RevealedGroup({ items }: { items: RevealItem[] }) {
  if (items.length === 0) return null
  const head = items[0]

  if (head.kind === 'simple' && head.parentKind === 'choice') {
    return (
      <p className="text-gold-500/90 text-[13px] tracking-wide pl-3 border-l-2 border-gold-700/40 my-1 fade-in-up">
        <span className="opacity-70 mr-1">▸</span>
        {head.body}
      </p>
    )
  }

  if (head.kind === 'simple' && head.parentKind === 'death') {
    return (
      <div className="my-3 px-4 py-3 rounded-md border border-blood-700/50 bg-blood-700/15 fade-in-up">
        <p className="text-blood-300 text-sm whitespace-pre-line">
          {head.body}
        </p>
      </div>
    )
  }

  // 'node' or 'outcome' — paragraphs + hero cards
  const isOutcome = head.parentKind === 'outcome'
  const wrapperClass = isOutcome
    ? 'space-y-2 pl-3 border-l border-ink-700/50'
    : 'space-y-3'

  return (
    <div className={wrapperClass}>
      {items.map((it, i) => {
        if (it.kind === 'hero-card') {
          const hero = data.heroes.get(it.heroId)
          if (!hero) return null
          return <HeroIntroCard key={i} hero={hero} />
        }
        if (it.kind === 'paragraph') {
          const p = it.paragraph
          if (p.kind === 'speech' && p.speaker) {
            return (
              <SpeechLine
                key={i}
                speaker={p.speaker}
                body={p.body}
                muted={isOutcome}
              />
            )
          }
          return (
            <p
              key={i}
              className={`prose-ko whitespace-pre-line fade-in-up ${
                isOutcome ? 'text-ink-200 italic' : 'text-ink-100'
              }`}
            >
              {p.body}
            </p>
          )
        }
        return null
      })}
    </div>
  )
}

function SpeechLine({
  speaker,
  body,
  muted,
}: {
  speaker: string
  body: string
  muted?: boolean
}) {
  const hero = heroByName.get(speaker)
  const [avatarError, setAvatarError] = useState(false)
  const showAvatar = hero && !avatarError
  return (
    <div className="my-1 fade-in-up">
      <div className="flex items-center gap-2 mb-1">
        {showAvatar ? (
          <img
            src={`/portraits/${hero.id}.webp`}
            alt={speaker}
            onError={() => setAvatarError(true)}
            className="w-6 h-6 rounded-full object-cover border border-gold-700/40 -ml-0.5"
          />
        ) : (
          <span className="h-[1px] w-3 bg-gold-700/60" />
        )}
        <span className="text-gold-300 text-[10px] font-semibold tracking-[0.2em] uppercase">
          {speaker}
        </span>
      </div>
      <p
        className={`prose-ko pl-5 whitespace-pre-line ${
          muted ? 'text-ink-100/85' : 'text-ink-50'
        }`}
      >
        {body}
      </p>
    </div>
  )
}

// ─── Hero intro placeholder card ──────────────────────────────────────────

const ENCOUNTER_LABEL: Record<Hero['encounter'], string> = {
  companion: '동행',
  neutral: '조우',
  foe: '적',
}

const ENCOUNTER_TONE: Record<Hero['encounter'], string> = {
  companion:
    'border-gold-500/40 from-gold-700/25 to-ink-800/60 text-gold-300',
  neutral:
    'border-rune-500/40 from-rune-700/25 to-ink-800/60 text-rune-300',
  foe:
    'border-blood-500/40 from-blood-700/30 to-ink-800/60 text-blood-300',
}

function HeroIntroCard({ hero }: { hero: Hero }) {
  const enc = hero.encounter
  const tone = ENCOUNTER_TONE[enc]
  const initial = hero.name[0]
  const [imageError, setImageError] = useState(false)
  const portraitUrl = `/portraits/${hero.id}.webp`
  return (
    <div
      className={`my-4 rounded-lg border bg-gradient-to-br overflow-hidden shadow-card fade-in-up ${tone}`}
    >
      <div className="aspect-[5/3] flex items-center justify-center bg-gradient-to-br from-black/40 via-transparent to-black/30 border-b border-white/5 relative overflow-hidden">
        {!imageError ? (
          <img
            src={portraitUrl}
            alt={hero.name}
            onError={() => setImageError(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <>
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.15),transparent_70%)]" />
            <div className="text-[88px] font-bold text-white/20 tracking-tight select-none drop-shadow-lg">
              {initial}
            </div>
            <div className="absolute bottom-2 right-3 text-[9px] uppercase tracking-[0.3em] text-white/30">
              일러스트 곧 추가
            </div>
          </>
        )}
      </div>
      <div className="px-4 py-3 bg-ink-900/40">
        <div className="text-[10px] font-semibold uppercase tracking-[0.3em] mb-1 opacity-90">
          {ENCOUNTER_LABEL[enc]}
        </div>
        <div className="text-lg font-semibold text-ink-50 mb-1.5">
          {hero.name}
        </div>
        <div className="text-[13px] text-ink-200/75 leading-relaxed">
          {hero.bio}
        </div>
      </div>
    </div>
  )
}

// ─── Typing indicator ─────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="pl-5 py-1 flex gap-1.5 items-center fade-in" aria-hidden>
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-gold-300/80" />
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-gold-300/80" />
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-gold-300/80" />
    </div>
  )
}

// ─── Choice button ────────────────────────────────────────────────────────

interface ChoiceButtonProps {
  variant: 'default' | 'advance' | 'death' | 'neutral'
  onClick: () => void
  children: React.ReactNode
}

function ChoiceButton({ variant, onClick, children }: ChoiceButtonProps) {
  const styles: Record<ChoiceButtonProps['variant'], string> = {
    default:
      'border-gold-700/40 hover:border-gold-500/70 bg-gradient-to-b from-gold-700/15 to-gold-700/5 hover:from-gold-700/30 hover:to-gold-700/10 text-ink-100 hover:text-gold-300 active:bg-gold-500/30 active:border-gold-300 active:text-gold-200',
    advance:
      'border-rune-500/40 hover:border-rune-300/70 bg-gradient-to-b from-rune-700/20 to-rune-700/5 hover:from-rune-700/40 text-rune-300 active:bg-rune-500/30 active:border-rune-300',
    death:
      'border-blood-500/40 hover:border-blood-300/70 bg-gradient-to-b from-blood-700/20 to-blood-700/5 hover:from-blood-700/40 text-blood-300 active:bg-blood-500/30 active:border-blood-300',
    neutral:
      'border-ink-400/40 hover:border-ink-200/70 bg-gradient-to-b from-ink-700/30 to-ink-700/10 hover:from-ink-700/45 text-ink-100 active:bg-ink-500/30 active:border-ink-200',
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`
        relative w-full px-4 py-3.5 text-left text-[14px]
        rounded-md border transition-all duration-150
        active:scale-[0.97]
        group fade-in overflow-hidden
        ${styles[variant]}
      `}
    >
      <span className="opacity-60 group-hover:opacity-100 group-active:opacity-100 mr-2 transition">
        {variant === 'default'
          ? '▸'
          : variant === 'advance'
            ? '✦'
            : variant === 'death'
              ? '✕'
              : '◇'}
      </span>
      {children}
    </button>
  )
}
