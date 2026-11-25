import confetti from 'canvas-confetti'

const CORES = ['#3D2EF9', '#A69CFF', '#F3EDFF', '#12A15F', '#E8890C', '#E5484D', '#2E90FA']

/** Festa de confete. Respeita quem pediu menos movimento no sistema. */
export function comemorar(intensidade: 'normal' | 'grande' = 'normal') {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const base = { colors: CORES, zIndex: 100, disableForReducedMotion: true }
  if (intensidade === 'normal') {
    void confetti({ ...base, particleCount: 120, spread: 80, origin: { x: 0.85, y: 0.9 } })
    return
  }
  const fim = Date.now() + 2500
  const rodada = () => {
    void confetti({ ...base, particleCount: 6, angle: 60, spread: 70, origin: { x: 0, y: 0.75 } })
    void confetti({ ...base, particleCount: 6, angle: 120, spread: 70, origin: { x: 1, y: 0.75 } })
    if (Date.now() < fim) requestAnimationFrame(rodada)
  }
  void confetti({ ...base, particleCount: 200, spread: 120, startVelocity: 45, origin: { y: 0.6 } })
  rodada()
}
