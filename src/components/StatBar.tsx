import { useEffect, useRef, useState } from 'react'
import { data, useGame } from '../store'
import { audio } from '../lib/audio'

const CLASS_LABEL: Record<'warrior' | 'mage', string> = {
  warrior: '전사',
  mage: '마법사',
}

const MAX_DISPLAY = 5

interface PipsProps {
  value: number
  max?: number
  fillClass: string
  emptyClass: string
  flashClass?: string
}

function Pips({ value, max = MAX_DISPLAY, fillClass, emptyClass, flashClass }: PipsProps) {
  const total = Math.max(max, value)
  return (
    <div className={`flex gap-[3px] ${flashClass ?? ''}`} aria-hidden>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-[10px] w-[6px] rounded-[1.5px] transition-colors ${
            i < value ? fillClass : emptyClass
          }`}
        />
      ))}
    </div>
  )
}

type FlashKind = 'gain' | 'loss' | null

export function StatBar() {
  const stats = useGame((s) => s.run.stats)
  const inventory = useGame((s) => s.run.inventory)
  const classChosen = useGame((s) => s.run.classChosen)
  const memoryShards = useGame((s) => s.meta.memoryShards)
  const completedRuns = useGame((s) => s.meta.completedRuns)
  const historyLen = useGame((s) => s.run.history.length)

  // Flash state per stat
  const prevStatsRef = useRef(stats)
  const prevHistoryLenRef = useRef(historyLen)
  const [hpFlash, setHpFlash] = useState<FlashKind>(null)
  const [mpFlash, setMpFlash] = useState<FlashKind>(null)
  const [hpDelta, setHpDelta] = useState(0)
  const [mpDelta, setMpDelta] = useState(0)
  const flashIdRef = useRef(0)

  useEffect(() => {
    // history shrank or stayed → reset/transition; sync without flash
    if (historyLen <= prevHistoryLenRef.current) {
      prevStatsRef.current = stats
      prevHistoryLenRef.current = historyLen
      return
    }
    // history grew (a choice happened): compare prev → current
    const dHp = stats.hp - prevStatsRef.current.hp
    const dMp = stats.mana - prevStatsRef.current.mana
    if (dHp !== 0) {
      setHpFlash(dHp > 0 ? 'gain' : 'loss')
      setHpDelta(dHp)
      void audio.playSfx(dHp > 0 ? 'stat-gain' : 'stat-loss')
    }
    if (dMp !== 0) {
      setMpFlash(dMp > 0 ? 'gain' : 'loss')
      setMpDelta(dMp)
      void audio.playSfx(dMp > 0 ? 'stat-gain' : 'stat-loss', 0.75)
    }
    prevStatsRef.current = stats
    prevHistoryLenRef.current = historyLen
    flashIdRef.current += 1
  }, [stats, historyLen])

  // Auto-clear flash after animation
  useEffect(() => {
    if (!hpFlash && !mpFlash) return
    const id = flashIdRef.current
    const t = setTimeout(() => {
      // only clear if no newer flash overrode this one
      if (id !== flashIdRef.current) return
      setHpFlash(null)
      setMpFlash(null)
      setHpDelta(0)
      setMpDelta(0)
    }, 1100)
    return () => clearTimeout(t)
  }, [hpFlash, mpFlash])

  return (
    <div className="px-5 pb-3 pt-1 border-b border-white/5 select-none">
      {/* Row 1: HP + MP bars, meta */}
      <div className="flex items-center gap-4 text-[12px]">
        <StatBlock
          label="HP"
          value={stats.hp}
          delta={hpDelta}
          flash={hpFlash}
          labelColorClass="text-blood-300"
          deltaColorClass={hpDelta < 0 ? 'text-blood-200' : 'text-emerald-300'}
          fillClass="bg-blood-500 shadow-[0_0_4px_rgba(211,71,89,0.5)]"
          emptyClass="bg-blood-700/30 border border-blood-700/40"
        />
        <StatBlock
          label="MP"
          value={stats.mana}
          delta={mpDelta}
          flash={mpFlash}
          labelColorClass="text-aether-300"
          deltaColorClass={mpDelta < 0 ? 'text-aether-200' : 'text-emerald-300'}
          fillClass="bg-aether-500 shadow-[0_0_4px_rgba(74,156,200,0.5)]"
          emptyClass="bg-aether-700/30 border border-aether-700/40"
        />
        <div className="ml-auto flex items-center gap-2 text-[10px] text-rune-300/70 tabular-nums">
          {memoryShards > 0 && <span>기억 {memoryShards}</span>}
          {completedRuns > 0 && <span>출정 {completedRuns}</span>}
        </div>
      </div>

      {/* Row 2: class chip + inventory */}
      {(classChosen || inventory.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px]">
          {classChosen && (
            <span className="px-2 py-[2px] rounded-sm border border-gold-500/40 bg-gold-700/20 text-gold-300 font-medium tracking-wider">
              {CLASS_LABEL[classChosen]}
            </span>
          )}
          {inventory.length === 0
            ? null
            : inventory.map((id) => {
                const item = data.items.get(id)
                return (
                  <span
                    key={id}
                    className="px-2 py-[2px] rounded-sm border border-ember-500/30 bg-ember-700/15 text-ember-300"
                  >
                    {item?.name ?? id}
                  </span>
                )
              })}
        </div>
      )}

      {/* Hidden text fallback for QA smoke */}
      {inventory.length === 0 && <span className="sr-only">소지품 없음</span>}
    </div>
  )
}

interface StatBlockProps {
  label: string
  value: number
  delta: number
  flash: FlashKind
  labelColorClass: string
  deltaColorClass: string
  fillClass: string
  emptyClass: string
}

function StatBlock({
  label,
  value,
  delta,
  flash,
  labelColorClass,
  deltaColorClass,
  fillClass,
  emptyClass,
}: StatBlockProps) {
  const containerFlash =
    flash === 'loss' ? 'stat-shake' : flash === 'gain' ? 'stat-pulse' : ''
  const pipsFlash = flash ? 'stat-pulse' : undefined
  return (
    <div
      className={`relative flex items-center gap-2 ${containerFlash}`}
      // re-trigger animation on each new flash
      key={`${label}-${value}-${flash ?? ''}`}
    >
      <span className={`${labelColorClass} font-semibold tracking-wider`}>
        {label}
      </span>
      <Pips
        value={value}
        fillClass={fillClass}
        emptyClass={emptyClass}
        flashClass={pipsFlash}
      />
      <span
        className={`tabular-nums ${labelColorClass} font-semibold w-3 text-right opacity-90`}
      >
        {value}
      </span>
      {delta !== 0 && (
        <span
          className={`absolute -top-1 right-0 text-[10px] tabular-nums font-bold pointer-events-none ${deltaColorClass} ${
            delta < 0 ? 'stat-float-loss' : 'stat-float-gain'
          }`}
          aria-hidden
        >
          {delta > 0 ? `+${delta}` : delta}
        </span>
      )}
    </div>
  )
}
