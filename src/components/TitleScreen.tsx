import { useEffect, useMemo } from 'react'
import { useGame } from '../store'

export function TitleScreen() {
  const setAppView = useGame((s) => s.setAppView)
  const resetAll = useGame((s) => s.resetAll)
  const historyLen = useGame((s) => s.run.history.length)
  const completedRuns = useGame((s) => s.meta.completedRuns)

  // freshRun() seeds history with [region-marker, first node] = length 2;
  // any choice grows it past that.
  const isFreshPlayer = historyLen <= 2 && completedRuns === 0

  // QA smoke (and users with prefers-reduced-motion) skip the title pause
  // and drop straight into the game — same convention NodeView uses
  // to bypass Phase B staged reveal.
  const reducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  useEffect(() => {
    if (reducedMotion) setAppView('game')
  }, [reducedMotion, setAppView])

  if (reducedMotion) return null

  const enterGame = () => setAppView('game')

  const startOver = () => {
    resetAll()
    setAppView('game')
  }

  return (
    <div className="flex flex-col h-full max-w-md mx-auto bg-ink-900/40 shadow-card">
      <div className="flex-1 flex flex-col justify-center px-6 fade-in">
        <div className="text-center space-y-4 mb-12">
          <div className="text-[10px] uppercase tracking-[0.4em] text-rune-300/60">
            텍스트 RPG
          </div>
          <h1
            className="text-gold-300 text-4xl font-semibold leading-tight"
            style={{ letterSpacing: '0.12em' }}
          >
            아스트렌
          </h1>
          <p className="prose-ko text-ink-300 text-sm px-4">
            이 세계는 끝날 거야 — 텍스트 RPG
          </p>
        </div>

        <div className="space-y-3 px-2">
          {isFreshPlayer ? (
            <TitleButton variant="rune" onClick={enterGame}>
              <span className="opacity-70 mr-2">▸</span>
              출정 시작
            </TitleButton>
          ) : (
            <>
              <TitleButton variant="gold" onClick={enterGame}>
                <span className="opacity-70 mr-2">▸</span>
                이어하기
              </TitleButton>
              <TitleButton variant="neutral" onClick={startOver}>
                <span className="opacity-70 mr-2">✕</span>
                처음부터 다시
              </TitleButton>
            </>
          )}
        </div>
      </div>

      <div className="px-5 pb-6 pt-2 text-center select-none">
        <p className="text-[10px] tracking-[0.25em] uppercase text-ink-500">
          메이드: HyoKyuKang · V1.0
        </p>
      </div>
    </div>
  )
}

interface TitleButtonProps {
  variant: 'gold' | 'rune' | 'neutral'
  onClick: () => void
  children: React.ReactNode
}

function TitleButton({ variant, onClick, children }: TitleButtonProps) {
  const styles: Record<TitleButtonProps['variant'], string> = {
    gold: 'border-gold-700/40 hover:border-gold-500/70 bg-gradient-to-b from-gold-700/15 to-gold-700/5 hover:from-gold-700/30 hover:to-gold-700/10 text-ink-100 hover:text-gold-300 active:bg-gold-500/30 active:border-gold-300 active:text-gold-200',
    rune: 'border-rune-500/40 hover:border-rune-300/70 bg-gradient-to-b from-rune-700/20 to-rune-700/5 hover:from-rune-700/40 text-rune-300 active:bg-rune-500/30 active:border-rune-300',
    neutral:
      'border-ink-400/40 hover:border-ink-200/70 bg-gradient-to-b from-ink-700/30 to-ink-700/10 hover:from-ink-700/45 text-ink-100 active:bg-ink-500/30 active:border-ink-200',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-full px-4 py-3.5 text-left text-[14px] rounded-md border transition-all duration-150 active:scale-[0.97] fade-in overflow-hidden ${styles[variant]}`}
    >
      {children}
    </button>
  )
}
