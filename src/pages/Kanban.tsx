import { useCallback, useEffect, useMemo, useState, type DragEvent, type FormEvent } from 'react'
import { AlertTriangle, Clock, Plus, X } from 'lucide-react'
import { Botao, Chip } from '../components/ui'
import { useSessao } from '../lib/sessao'
import {
  carregarQuadro, criarCard, dataCurta, excluirCard, moverCard, salvarCard, REDES, TIPOS,
  type Card, type Coluna, type EdicaoCard, type Quadro,
} from '../lib/kanban'
import './kanban.css'

const COR_COLUNA: Record<string, string> = {
  'Backlog (ideias)': 'var(--texto-3)', 'Briefing aprovado': 'var(--info)', Fazendo: 'var(--alerta)',
  'Feito e aprovado': 'var(--sucesso)', 'Postado e feito': 'var(--marca)', Impedimento: 'var(--perigo)',
}

type Pendente = { card: Card; coluna: Coluna; posicao: number }

export function Kanban() {
  const { cliente } = useSessao()
  const [quadro, setQuadro] = useState<Quadro | null | undefined>(undefined)
  const [erro, setErro] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [alvo, setAlvo] = useState<string | null>(null)
  const [motivoPara, setMotivoPara] = useState<Pendente | null>(null)
  const [aberto, setAberto] = useState<Card | null>(null)
  const [novoEm, setNovoEm] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    try { setQuadro(await carregarQuadro(cliente.id)) } catch { setErro('Não foi possível carregar o quadro.') }
  }, [cliente.id])

  useEffect(() => { void Promise.resolve().then(recarregar) }, [recarregar])

  const porColuna = useMemo(() => {
    const m = new Map<string, Card[]>()
    quadro?.colunas.forEach((c) => m.set(c.id, []))
    quadro?.cards.forEach((c) => m.get(c.coluna_id)?.push(c))
    m.forEach((lista) => lista.sort((a, b) => a.posicao - b.posicao))
    return m
  }, [quadro])

  async function executarMovimento({ card, coluna, posicao }: Pendente, motivo?: string) {
    if (!quadro) return
    // Atualiza a tela na hora e confirma no banco em seguida.
    setQuadro({ ...quadro, cards: quadro.cards.map((c) => c.id === card.id
      ? { ...c, coluna_id: coluna.id, posicao, motivo_impedimento: motivo ?? null } : c) })
    try { await moverCard(card, coluna.id, posicao, motivo) } catch { setErro('Não foi possível mover o card.') }
    await recarregar()
  }

  function soltar(e: DragEvent, coluna: Coluna, antesDe?: Card) {
    e.preventDefault()
    setAlvo(null)
    const card = quadro?.cards.find((c) => c.id === e.dataTransfer.getData('text/plain'))
    setArrastando(null)
    if (!card) return
    const lista = (porColuna.get(coluna.id) ?? []).filter((c) => c.id !== card.id)
    const posicao = antesDe ? antesDe.posicao - 0.5 : (lista.at(-1)?.posicao ?? 0) + 1
    if (card.coluna_id === coluna.id && !antesDe) return
    const pendente = { card, coluna, posicao }
    // Mover para Impedimento exige motivo (documento, seção 4.3)
    if (coluna.exige_motivo && card.coluna_id !== coluna.id) setMotivoPara(pendente)
    else void executarMovimento(pendente)
  }

  async function adicionar(coluna: Coluna, titulo: string) {
    if (!quadro || !titulo.trim()) return
    const ultimo = porColuna.get(coluna.id)?.at(-1)?.posicao ?? 0
    try { await criarCard(quadro.id, coluna.id, titulo.trim(), ultimo + 1) } catch { setErro('Não foi possível criar o card.') }
    setNovoEm(null)
    await recarregar()
  }

  if (quadro === undefined) return <div className="corpo"><p className="pequeno">Carregando quadro…</p></div>
  if (quadro === null) return <div className="corpo"><h2>Kanban · Redes sociais</h2><p className="texto-2">Este cliente ainda não tem um quadro oficial.</p></div>

  return (
    <div className="corpo kanban-pagina">
      <div className="kanban-topo">
        <div>
          <h2>Kanban · Redes sociais</h2>
          <p className="pequeno">Quadro oficial do {cliente.nome} · {quadro.cards.length} cards</p>
        </div>
        <Botao icone={<Plus size={16} aria-hidden />} onClick={() => setNovoEm(quadro.colunas[0]?.id ?? null)}>Novo card</Botao>
      </div>
      {erro && <p className="aviso" role="alert" style={{ background: 'rgb(229 72 77 / .1)', color: 'var(--perigo)' }}>{erro}</p>}

      <div className="quadro" aria-label="Quadro de redes sociais">
        {quadro.colunas.map((col) => {
          const cards = porColuna.get(col.id) ?? []
          return (
            <section key={col.id} className={`coluna${alvo === col.id ? ' coluna--alvo' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setAlvo(col.id) }}
              onDragLeave={() => setAlvo((a) => (a === col.id ? null : a))}
              onDrop={(e) => soltar(e, col)}>
              <header className="coluna__topo">
                <span className="coluna__ponto" style={{ background: COR_COLUNA[col.nome] ?? 'var(--marca-clara)' }} />
                <strong>{col.nome}</strong>
                <span className="pequeno">{cards.length}</span>
                <button className="coluna__mais" type="button" aria-label={`Novo card em ${col.nome}`} onClick={() => setNovoEm(col.id)}><Plus size={16} /></button>
              </header>

              {cards.map((card) => (
                <article key={card.id} className={`card${arrastando === card.id ? ' card--arrastando' : ''}`}
                  draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', card.id); setArrastando(card.id) }}
                  onDragEnd={() => setArrastando(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.stopPropagation(); soltar(e, col, card) }}
                  onClick={() => setAberto(card)} tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') setAberto(card) }}>
                  <strong className="card__titulo">{card.titulo}</strong>
                  <div className="card__etiquetas">
                    {card.tipo_conteudo && <Chip tom="neutro">{card.tipo_conteudo}</Chip>}
                    {card.redes.map((r) => <Chip key={r}>{r}</Chip>)}
                    {card.prioridade === 'alta' && <Chip tom="perigo">Prioridade alta</Chip>}
                  </div>
                  {card.motivo_impedimento && (
                    <p className="card__impedimento"><AlertTriangle size={14} aria-hidden /> {card.motivo_impedimento}</p>
                  )}
                  {(card.entrega_em || card.postagem_em) && (
                    <p className="card__rodape pequeno"><Clock size={14} aria-hidden />
                      {card.entrega_em ? `Entrega ${dataCurta(card.entrega_em)}` : `Postagem ${dataCurta(card.postagem_em)}`}</p>
                  )}
                </article>
              ))}

              {novoEm === col.id ? (
                <NovoCard onSalvar={(t) => void adicionar(col, t)} onCancelar={() => setNovoEm(null)} />
              ) : (
                <button className="coluna__adicionar" type="button" onClick={() => setNovoEm(col.id)}><Plus size={14} /> Adicionar card</button>
              )}
            </section>
          )
        })}
      </div>

      {motivoPara && (
        <Motivo card={motivoPara.card} onCancelar={() => setMotivoPara(null)}
          onConfirmar={(m) => { void executarMovimento(motivoPara, m); setMotivoPara(null) }} />
      )}
      {aberto && (
        <EditarCard card={aberto} coluna={quadro.colunas.find((c) => c.id === aberto.coluna_id)!}
          onFechar={() => setAberto(null)}
          onSalvar={async (ed) => { await salvarCard(aberto.id, ed); setAberto(null); await recarregar() }}
          onExcluir={async () => { await excluirCard(aberto.id); setAberto(null); await recarregar() }} />
      )}
    </div>
  )
}

function NovoCard({ onSalvar, onCancelar }: { onSalvar: (t: string) => void; onCancelar: () => void }) {
  const [titulo, setTitulo] = useState('')
  return (
    <form className="novo-card" onSubmit={(e) => { e.preventDefault(); onSalvar(titulo) }}>
      <textarea className="entrada" autoFocus rows={2} placeholder="Título do card" value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSalvar(titulo) } if (e.key === 'Escape') onCancelar() }} />
      <div className="linha"><Botao type="submit">Adicionar</Botao><Botao type="button" variante="fantasma" onClick={onCancelar}>Cancelar</Botao></div>
    </form>
  )
}

function Janela({ titulo, onFechar, children, largura = 520 }: { titulo: string; onFechar: () => void; children: React.ReactNode; largura?: number }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onFechar])
  return (
    <div className="janela-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar() }}>
      <div className="janela" role="dialog" aria-modal="true" aria-label={titulo} style={{ maxWidth: largura }}>
        <header className="janela__topo"><h3>{titulo}</h3><button type="button" className="icone-botao" style={{ border: 0 }} aria-label="Fechar" onClick={onFechar}><X size={18} /></button></header>
        {children}
      </div>
    </div>
  )
}

function Motivo({ card, onConfirmar, onCancelar }: { card: Card; onConfirmar: (m: string) => void; onCancelar: () => void }) {
  const [motivo, setMotivo] = useState('')
  return (
    <Janela titulo="Mover para Impedimento" onFechar={onCancelar}>
      <form className="janela__corpo" onSubmit={(e) => { e.preventDefault(); if (motivo.trim()) onConfirmar(motivo.trim()) }}>
        <p className="texto-2">O que está impedindo <strong>{card.titulo}</strong>? O card volta para a coluna de origem quando for liberado.</p>
        <textarea className="entrada" rows={3} autoFocus required value={motivo} onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ex.: aguardando autorização de imagem" />
        <div className="linha" style={{ justifyContent: 'flex-end' }}>
          <Botao type="button" variante="fantasma" onClick={onCancelar}>Cancelar</Botao>
          <Botao type="submit" disabled={!motivo.trim()}>Mover</Botao>
        </div>
      </form>
    </Janela>
  )
}

const paraInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '')
const deInput = (v: string) => (v ? new Date(v).toISOString() : null)

function EditarCard({ card, coluna, onFechar, onSalvar, onExcluir }:
  { card: Card; coluna: Coluna; onFechar: () => void; onSalvar: (e: EdicaoCard) => Promise<void>; onExcluir: () => Promise<void> }) {
  const [ed, setEd] = useState<EdicaoCard>({
    titulo: card.titulo, briefing: card.briefing, tipo_conteudo: card.tipo_conteudo, redes: card.redes,
    entrega_em: card.entrega_em, postagem_em: card.postagem_em, prioridade: card.prioridade,
  })
  const [salvando, setSalvando] = useState(false)
  async function enviar(e: FormEvent) { e.preventDefault(); setSalvando(true); await onSalvar(ed) }
  const alternarRede = (r: string) => setEd({ ...ed, redes: ed.redes.includes(r) ? ed.redes.filter((x) => x !== r) : [...ed.redes, r] })

  return (
    <Janela titulo={coluna.nome} onFechar={onFechar} largura={720}>
      <form className="janela__corpo editar-card" onSubmit={enviar}>
        <input className="editar-card__titulo" value={ed.titulo} onChange={(e) => setEd({ ...ed, titulo: e.target.value })} aria-label="Título" required />
        {card.motivo_impedimento && <p className="card__impedimento"><AlertTriangle size={14} aria-hidden /> {card.motivo_impedimento}</p>}
        <div className="editar-card__grade">
          <div className="campo"><label htmlFor="tipo">Tipo de conteúdo</label>
            <select id="tipo" className="entrada" value={ed.tipo_conteudo ?? ''} onChange={(e) => setEd({ ...ed, tipo_conteudo: e.target.value || null })}>
              <option value="">Sem tipo</option>{TIPOS.map((t) => <option key={t}>{t}</option>)}
            </select></div>
          <div className="campo"><label htmlFor="prioridade">Prioridade</label>
            <select id="prioridade" className="entrada" value={ed.prioridade} onChange={(e) => setEd({ ...ed, prioridade: e.target.value as EdicaoCard['prioridade'] })}>
              <option value="alta">Alta</option><option value="comum">Comum</option><option value="baixa">Baixa</option>
            </select></div>
          <div className="campo"><label htmlFor="entrega">Entrega</label>
            <input id="entrega" type="datetime-local" className="entrada" value={paraInput(ed.entrega_em)} onChange={(e) => setEd({ ...ed, entrega_em: deInput(e.target.value) })} /></div>
          <div className="campo"><label htmlFor="postagem">Postagem</label>
            <input id="postagem" type="datetime-local" className="entrada" value={paraInput(ed.postagem_em)} onChange={(e) => setEd({ ...ed, postagem_em: deInput(e.target.value) })} /></div>
        </div>
        <div className="campo"><span className="pequeno" style={{ color: 'var(--texto-2)' }}>Redes</span>
          <div className="linha">{REDES.map((r) => (
            <button key={r} type="button" className={`opcao${ed.redes.includes(r) ? ' marcada' : ''}`} aria-pressed={ed.redes.includes(r)} onClick={() => alternarRede(r)}>{r}</button>
          ))}</div></div>
        <div className="campo"><label htmlFor="briefing">Briefing</label>
          <textarea id="briefing" className="entrada" rows={5} value={ed.briefing ?? ''} onChange={(e) => setEd({ ...ed, briefing: e.target.value || null })} /></div>
        <div className="linha" style={{ justifyContent: 'space-between' }}>
          <Botao type="button" variante="fantasma" style={{ color: 'var(--perigo)' }} onClick={() => { if (confirm('Excluir este card? Esta ação não pode ser desfeita.')) void onExcluir() }}>Excluir</Botao>
          <div className="linha"><Botao type="button" variante="secundario" onClick={onFechar}>Cancelar</Botao><Botao type="submit" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Botao></div>
        </div>
      </form>
    </Janela>
  )
}
