import type { ReactNode } from 'react'

/** Peças visuais do arrastar (a lógica fica em lib/arrastar). */
export function VagaCard({ altura }: { altura?: number }) {
  return <div className="card-vaga" style={{ height: altura }} aria-hidden />
}

export function CardVoando({ arraste, voandoRef, children }: {
  arraste: { largura: number; x: number; y: number; dx: number; dy: number }; voandoRef: React.RefObject<HTMLDivElement | null>; children: ReactNode
}) {
  return (
    <div ref={voandoRef} className="card-voando" aria-hidden
      style={{ width: arraste.largura, transform: `translate(${arraste.x - arraste.dx}px, ${arraste.y - arraste.dy}px) rotate(3deg)` }}>
      <div className="card card--no-ar">{children}</div>
    </div>
  )
}

/** Faixa estreita de uma coluna minimizada (nome na vertical + contagem). */
export function FaixaColuna({ id, nome, cor, total, arrastando, onAbrir }: {
  id: string; nome: string; cor: string; total: number; arrastando: boolean; onAbrir: () => void
}) {
  return (
    <section data-coluna={id} className={`coluna coluna--recolhida${arrastando ? ' coluna--receptiva' : ''}`}>
      <button type="button" className="coluna__faixa" onClick={onAbrir} title={`Mostrar ${nome}`} aria-label={`Mostrar coluna ${nome} (${total})`}>
        <span className="coluna__ponto" style={{ background: cor }} />
        <span className="coluna__contagem">{total}</span>
        <span className="coluna__nome-vertical">{nome}</span>
      </button>
    </section>
  )
}
