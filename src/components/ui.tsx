import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variante = 'primario' | 'secundario' | 'fantasma'

export function Botao({ variante = 'primario', icone, children, className = '', ...resto }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; icone?: ReactNode }) {
  return (
    <button className={`botao botao--${variante} ${className}`} {...resto}>
      {icone}
      {children}
    </button>
  )
}

type TomChip = 'marca' | 'neutro' | 'sucesso' | 'alerta' | 'perigo' | 'vidro'

export function Chip({ tom = 'marca', children }: { tom?: TomChip; children: ReactNode }) {
  return <span className={`chip ${tom === 'marca' ? '' : `chip--${tom}`}`}>{children}</span>
}

const CORES = ['var(--marca)', 'var(--info)', 'var(--sucesso)', 'var(--alerta)', 'var(--perigo)', 'var(--marca-forte)']

/** Avatar com iniciais. A cor sai das iniciais, então a mesma pessoa tem sempre a mesma cor. */
export function Avatar({ nome, tamanho = 32, cor }: { nome: string; tamanho?: number; cor?: string }) {
  const iniciais = nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('')
  const indice = [...iniciais].reduce((s, c) => s + c.charCodeAt(0), 0) % CORES.length
  return (
    <span className="avatar" title={nome}
      style={{ width: tamanho, height: tamanho, background: cor ?? CORES[indice], fontSize: tamanho < 28 ? 10 : 12 }}>
      {iniciais}
    </span>
  )
}

export function Cartao({ titulo, acao, children, className = '', style }:
  { titulo?: ReactNode; acao?: ReactNode; children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <section className={`cartao ${className}`} style={style}>
      {(titulo || acao) && (
        <header className="cartao__topo">
          <h4>{titulo}</h4>
          {acao}
        </header>
      )}
      {children}
    </section>
  )
}
