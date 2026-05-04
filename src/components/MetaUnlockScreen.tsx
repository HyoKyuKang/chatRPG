import { data, useGame } from '../store'
import { audio } from '../lib/audio'

interface Props {
  reason: 'death' | 'ending'
  onContinue: () => void
}

export function MetaUnlockScreen({ reason, onContinue }: Props) {
  const meta = useGame((s) => s.meta)
  const applyUnlock = useGame((s) => s.applyUnlock)
  const allUnlocks = Array.from(data.unlocks.values()).sort(
    (a, b) => a.cost - b.cost,
  )

  const headline = reason === 'death' ? '한 번 더 떨어진다' : '한 번이 끝났다'
  const subline =
    reason === 'death'
      ? '어두운 안개가 너를 감싼다. 기억의 조각 하나가 너의 안쪽에 박힌다.'
      : '세계의 모서리 너머에서 너의 기억이 다시 모인다. 다음 출정을 위해.'

  return (
    <div className="flex flex-col h-full overflow-y-auto fade-in">
      {/* Hero header */}
      <div className="px-5 pt-8 pb-6 text-center border-b border-white/5">
        <div className="text-[10px] uppercase tracking-[0.4em] text-rune-300/60 mb-2">
          공허
        </div>
        <h2 className="text-ink-100 text-xl font-semibold tracking-wide mb-2">
          {headline}
        </h2>
        <p className="prose-ko text-ink-300/80 text-sm mb-5 px-2">{subline}</p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold-500/30 bg-gold-700/15">
          <span className="text-gold-300 text-[10px] uppercase tracking-[0.25em]">
            기억의 조각
          </span>
          <span className="text-gold-200 text-base font-semibold tabular-nums">
            {meta.memoryShards}
          </span>
        </div>
      </div>

      {/* Unlock options */}
      <div className="flex-1 px-5 py-5 space-y-3">
        <div className="text-[11px] uppercase tracking-[0.3em] text-ink-400 mb-3">
          잠금해제
        </div>
        {allUnlocks.map((u) => {
          const owned = meta.unlockedBonusIds.includes(u.id)
          const affordable = meta.memoryShards >= u.cost
          const disabled = owned || !affordable
          return (
            <button
              key={u.id}
              type="button"
              disabled={disabled}
              onClick={() => {
                void audio.playSfx('meta-unlock')
                applyUnlock(u.id)
              }}
              className={`w-full text-left p-3 rounded-md border transition-all duration-150 ${
                owned
                  ? 'border-emerald-500/40 bg-emerald-700/10 text-emerald-300/90 cursor-default'
                  : affordable
                    ? 'border-gold-500/40 hover:border-gold-300/70 bg-gradient-to-b from-gold-700/15 to-gold-700/5 hover:from-gold-700/25 text-gold-200 active:scale-[0.99]'
                    : 'border-ink-600/30 bg-ink-900/30 text-ink-500 cursor-not-allowed'
              }`}
            >
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-sm font-semibold">{u.name}</span>
                <span className="text-[10px] tabular-nums tracking-wider">
                  {owned ? '✓ 보유' : `${u.cost} 조각`}
                </span>
              </div>
              <p className="prose-ko text-[12px] leading-relaxed opacity-80">
                {u.description}
              </p>
            </button>
          )
        })}
      </div>

      {/* Continue */}
      <div className="px-4 pt-2 pb-4 border-t border-white/5 bg-ink-950/40">
        <button
          type="button"
          onClick={() => {
            void audio.playSfx('choice-tap')
            onContinue()
          }}
          className="w-full px-4 py-3.5 text-[14px] rounded-md border border-rune-500/50 bg-gradient-to-b from-rune-700/25 to-rune-700/5 hover:from-rune-700/40 hover:border-rune-300/70 text-rune-300 active:bg-rune-500/30 active:border-rune-300 active:scale-[0.97] transition-all duration-150"
        >
          <span className="opacity-70 mr-2">✦</span>
          다시 출정
        </button>
      </div>
    </div>
  )
}
