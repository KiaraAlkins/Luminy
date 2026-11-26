import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'

export type Opcao = {
  valor: string
  rotulo: string
  descricao?: string
  /** Ícone, foto ou bolinha de cor à esquerda */
  icone?: ReactNode
  /** Cor da bolinha (quando não há ícone) */
  cor?: string
}

/**
 * Seletor do Luminy: substitui a lista padrão do navegador.
 * Abre por cima de tudo (não é cortado por janelas), tem busca em listas grandes e funciona pelo teclado.
 */
export function Selecao({ valor, onMudar, opcoes, id, rotulo, vazio = 'Escolher', mini = false, busca, largura }: {
  valor: string; onMudar: (v: string) => void; opcoes: Opcao[]; id?: string
  /** Nome para leitores de tela quando não há <label> */
  rotulo?: string
  /** Texto quando nada está escolhido */
  vazio?: string
  mini?: boolean
  /** Mostra a busca (padrão: listas com mais de 8 opções) */
  busca?: boolean
  largura?: number | string
}) {
  const [aberto, setAberto] = useState(false)
  const [termo, setTermo] = useState('')
  const [foco, setFoco] = useState(0)
  const [pos, setPos] = useState<{ top: number; left: number; width: number; acima: boolean } | null>(null)
  const botao = useRef<HTMLButtonElement>(null)
  const painel = useRef<HTMLDivElement>(null)
  const atual = opcoes.find((o) => o.valor === valor)
  const comBusca = busca ?? opcoes.length > 8
  const lista = termo ? opcoes.filter((o) => `${o.rotulo} ${o.descricao ?? ''}`.toLowerCase().includes(termo.toLowerCase())) : opcoes

  // Posiciona o painel colado no botão (abre para cima se faltar espaço embaixo)
  useLayoutEffect(() => {
    if (!aberto || !botao.current) return
    const calcular = () => {
      const r = botao.current!.getBoundingClientRect()
      const altura = Math.min(340, 56 + opcoes.length * 44)
      const acima = window.innerHeight - r.bottom < altura && r.top > window.innerHeight - r.bottom
      setPos({ top: acima ? r.top - 6 : r.bottom + 6, left: r.left, width: Math.max(r.width, 200), acima })
    }
    calcular()
    window.addEventListener('resize', calcular)
    window.addEventListener('scroll', calcular, true)
    return () => { window.removeEventListener('resize', calcular); window.removeEventListener('scroll', calcular, true) }
  }, [aberto, opcoes.length])

  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => {
      if (!painel.current?.contains(e.target as Node) && !botao.current?.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])

  useEffect(() => {
    if (aberto) painel.current?.querySelector<HTMLElement>('.selecao__opcao.focada')?.scrollIntoView({ block: 'nearest' })
  }, [foco, aberto])

  function abrir() {
    setTermo(''); setFoco(Math.max(0, opcoes.findIndex((o) => o.valor === valor))); setAberto(true)
  }
  function escolher(o: Opcao) { onMudar(o.valor); setAberto(false); botao.current?.focus() }
  function tecla(e: React.KeyboardEvent) {
    if (!aberto) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); abrir() }
      return
    }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setAberto(false); botao.current?.focus() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setFoco((f) => Math.min(lista.length - 1, f + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFoco((f) => Math.max(0, f - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (lista[foco]) escolher(lista[foco]) }
    else if (e.key === 'Tab') setAberto(false)
  }

  const marca = (o?: Opcao) => o?.icone ?? (o?.cor ? <span className="selecao__cor" style={{ background: o.cor }} /> : null)

  return (
    <>
      <button ref={botao} id={id} type="button" className={`entrada selecao${mini ? ' selecao--mini' : ''}${aberto ? ' aberta' : ''}`}
        style={largura ? { width: largura } : undefined}
        aria-haspopup="listbox" aria-expanded={aberto} aria-label={rotulo ? `${rotulo}: ${atual?.rotulo ?? vazio}` : undefined}
        onClick={() => (aberto ? setAberto(false) : abrir())} onKeyDown={tecla}>
        {marca(atual)}
        <span className={`selecao__texto${atual ? '' : ' selecao__texto--vazio'}`}>
          <span className="selecao__rotulo">{atual?.rotulo ?? vazio}</span>
          {atual?.descricao && !mini && <span className="selecao__descricao">{atual.descricao}</span>}
        </span>
        <ChevronDown size={mini ? 14 : 16} className="selecao__seta" aria-hidden />
      </button>
      {aberto && pos && createPortal(
        <div ref={painel} className={`selecao__painel${pos.acima ? ' selecao__painel--acima' : ''}`} onKeyDown={tecla}
          style={{ left: pos.left, width: pos.width, ...(pos.acima ? { bottom: window.innerHeight - pos.top } : { top: pos.top }) }}>
          {comBusca && (
            <label className="selecao__busca">
              <Search size={15} aria-hidden />
              <input autoFocus value={termo} onChange={(e) => { setTermo(e.target.value); setFoco(0) }} placeholder="Buscar" aria-label="Buscar opção" />
            </label>
          )}
          <ul role="listbox" aria-label={rotulo}>
            {lista.map((o, i) => (
              <li key={o.valor} role="option" aria-selected={o.valor === valor}
                className={`selecao__opcao${i === foco ? ' focada' : ''}${o.valor === valor ? ' marcada' : ''}`}
                onMouseEnter={() => setFoco(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => escolher(o)}>
                {marca(o)}
                <span className="selecao__texto">
                  <span className="selecao__rotulo">{o.rotulo}</span>
                  {o.descricao && <span className="selecao__descricao">{o.descricao}</span>}
                </span>
                {o.valor === valor && <Check size={16} className="selecao__ok" aria-hidden />}
              </li>
            ))}
            {lista.length === 0 && <li className="selecao__nada">Nada encontrado</li>}
          </ul>
        </div>,
        document.body,
      )}
    </>
  )
}
