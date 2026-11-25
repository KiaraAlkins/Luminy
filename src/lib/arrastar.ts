import { useEffect, useRef, useState } from 'react'

/**
 * Arrastar cards entre colunas com o mouse: o card sai com um pulinho, voa inclinado
 * (mais inclinado quanto mais rápido o mouse anda) e quica ao chegar.
 *
 * Como usar: cada coluna tem `data-coluna={id}`, cada card tem `data-card={id}` e
 * `onPointerDown={(e) => iniciar(e, item)}`. Durante o arraste, o card original some
 * e a coluna mostra a <Vaga /> na posição `vaga.indice`.
 */
export type Vaga = { coluna: string; indice: number }
type Arraste<T> = { item: T; id: string; largura: number; altura: number; dx: number; dy: number; x: number; y: number }

export function useArrastar<T>({ idDe, aoSoltar }: { idDe: (item: T) => string; aoSoltar: (item: T, vaga: Vaga) => void }) {
  const [arraste, setArraste] = useState<Arraste<T> | null>(null)
  const [vaga, setVaga] = useState<Vaga | null>(null)
  const [chegou, setChegou] = useState<string | null>(null)
  const quadroRef = useRef<HTMLDivElement>(null)
  const voandoRef = useRef<HTMLDivElement>(null)
  const inicio = useRef<{ item: T; x: number; y: number; el: HTMLElement } | null>(null)
  const atual = useRef<Arraste<T> | null>(null)
  const vagaRef = useRef<Vaga | null>(null)
  const giro = useRef({ ultimoX: 0, angulo: 0 })
  const suprimir = useRef(false)
  const soltarRef = useRef(aoSoltar)
  const idRef = useRef(idDe)
  useEffect(() => { soltarRef.current = aoSoltar; idRef.current = idDe })

  useEffect(() => {
    function mover(e: PointerEvent) {
      const ini = inicio.current
      if (!ini) return
      if (!atual.current) {
        if (Math.hypot(e.clientX - ini.x, e.clientY - ini.y) < 6) return
        const r = ini.el.getBoundingClientRect()
        const a = { item: ini.item, id: idRef.current(ini.item), largura: r.width, altura: r.height, dx: ini.x - r.left, dy: ini.y - r.top, x: e.clientX, y: e.clientY }
        atual.current = a; giro.current = { ultimoX: e.clientX, angulo: 0 }
        setArraste(a); document.body.classList.add('arrastando-card')
      }
      const a = atual.current
      const g = giro.current
      g.angulo = Math.max(-9, Math.min(9, g.angulo * 0.75 + (e.clientX - g.ultimoX) * 0.5)); g.ultimoX = e.clientX
      if (voandoRef.current) voandoRef.current.style.transform = `translate(${e.clientX - a.dx}px, ${e.clientY - a.dy}px) rotate(${3 + g.angulo}deg)`

      // Rola o quadro quando o mouse chega perto das bordas
      const q = quadroRef.current
      const qr = q?.getBoundingClientRect()
      if (q && qr) {
        if (e.clientX > qr.right - 70) q.scrollLeft += 16
        else if (e.clientX < qr.left + 70) q.scrollLeft -= 16
      }

      const col = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-coluna]')
      if (!col) return
      const cards = [...col.querySelectorAll<HTMLElement>('[data-card]')].filter((c) => c.dataset.card !== a.id)
      let indice = cards.findIndex((c) => { const r = c.getBoundingClientRect(); return e.clientY < r.top + r.height / 2 })
      if (indice < 0) indice = cards.length
      const v = { coluna: col.dataset.coluna!, indice }
      if (vagaRef.current?.coluna !== v.coluna || vagaRef.current.indice !== v.indice) { vagaRef.current = v; setVaga(v) }
    }
    function terminar(cancelado: boolean) {
      const a = atual.current; const v = vagaRef.current
      inicio.current = null; atual.current = null; vagaRef.current = null
      if (!a) return
      setArraste(null); setVaga(null); document.body.classList.remove('arrastando-card')
      // O clique que vem logo depois de soltar não deve abrir o card
      suprimir.current = true; setTimeout(() => { suprimir.current = false }, 0)
      if (!cancelado && v) soltarRef.current(a.item, v)
    }
    const soltar = () => terminar(false)
    const cancelar = () => terminar(true)
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') terminar(true) }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
    window.addEventListener('pointercancel', cancelar)
    window.addEventListener('keydown', tecla)
    return () => {
      window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar)
      window.removeEventListener('pointercancel', cancelar); window.removeEventListener('keydown', tecla)
    }
  }, [])

  return {
    arraste, vaga, chegou, quadroRef, voandoRef,
    /** Liga no onPointerDown do card. */
    iniciar: (e: React.PointerEvent<HTMLElement>, item: T) => { if (e.button === 0) inicio.current = { item, x: e.clientX, y: e.clientY, el: e.currentTarget } },
    /** true logo depois de soltar: use para não abrir o card no clique. */
    acabouDeSoltar: () => suprimir.current,
    /** Marca o card que acabou de chegar para quicar. */
    quicar: (id: string) => { setChegou(id); setTimeout(() => setChegou((c) => (c === id ? null : c)), 700) },
  }
}

/** Posição nova entre os vizinhos (posições fracionárias, sem renumerar a coluna). */
export function posicaoEntre(lista: { posicao: number }[], indice: number) {
  const antes = lista[indice - 1]; const depois = lista[indice]
  return antes && depois ? (antes.posicao + depois.posicao) / 2 : depois ? depois.posicao - 1 : antes ? antes.posicao + 1 : 1
}

// ---------------------------------------------------------------- colunas minimizadas
type Preferencias = Record<string, 'r' | 'a'>  // r = minimizada por escolha; a = aberta mesmo vazia

/** Colunas vazias ficam minimizadas na lateral; qualquer coluna pode ser minimizada. Lembra por quadro. */
export function useColunasMinimizadas(chave: string | null, vaga: Vaga | null) {
  const [pref, setPref] = useState<Preferencias>({})
  useEffect(() => {
    if (!chave) return
    let p: Preferencias = {}
    try { p = JSON.parse(localStorage.getItem(chave) ?? '{}') as Preferencias } catch { /* sem armazenamento */ }
    void Promise.resolve().then(() => setPref(p))
  }, [chave])
  const recolhida = (id: string, n: number) => vaga?.coluna !== id && (pref[id] === 'r' || (n === 0 && pref[id] !== 'a'))
  function alternar(id: string, n: number) {
    const p = { ...pref }
    if (recolhida(id, n)) { if (n === 0) p[id] = 'a'; else delete p[id] }
    else { if (n === 0) delete p[id]; else p[id] = 'r' }
    setPref(p)
    try { if (chave) localStorage.setItem(chave, JSON.stringify(p)) } catch { /* sem armazenamento */ }
  }
  return { recolhida, alternar }
}
