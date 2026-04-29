import { useState } from 'react'

function App() {
  const [tapped, setTapped] = useState(0)

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-6 py-12 text-center">
      <p className="text-xs tracking-[0.3em] text-purple-300/70 uppercase mb-4">
        Chapter 0 — Prologue
      </p>
      <h1 className="text-3xl sm:text-4xl font-medium leading-snug mb-3">
        이 세계는 끝날 거야
      </h1>
      <p className="text-sm text-zinc-400 mb-10 max-w-sm">
        마왕의 침식이 시작되었다. 너는 이 세계로 떨어졌다.
      </p>

      <button
        type="button"
        onClick={() => setTapped((n) => n + 1)}
        className="px-6 py-3 rounded-md border border-purple-400/40 bg-purple-400/10 text-purple-100 hover:bg-purple-400/20 active:scale-[0.98] transition"
      >
        앞으로 나아간다 ({tapped})
      </button>

      <p className="mt-12 text-xs text-zinc-600">
        Week 1 · Day 1 — setup OK
      </p>
    </div>
  )
}

export default App
