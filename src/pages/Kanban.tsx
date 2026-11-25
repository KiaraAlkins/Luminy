import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { AlertTriangle, ChevronsLeft, Clock, Play, Plus } from 'lucide-react'
import { Botao, Chip } from '../components/ui'
import { Janela } from '../components/Janela'
import { useFoco } from '../lib/foco'
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
type Arraste = { card: Card; largura: number; altura: number; dx: number; dy: number; x: number; y: number }
type Vaga = { coluna: string; indice: number }
type Preferencias = Record<string, 'r' | 'a'>  // r = minimizada por escolha; a = aberta mesmo vazia

const lerPreferencias = (chave: string): Preferencias => { try { return JSON.parse(localStorage.getItem(chave) ?? '{}') as Preferencias } catch { return {} } }

/** Conteúdo do card, usado na coluna e no card "voando" durante o arraste. */
function CardConteudo({ card }: { card: Card }) {
  return (
    <>
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
    </>
  )
}

export function Kanban() {
  const { cliente } = useSessao()
  const clienteId = cliente?.id
  const [quadro, setQuadro] = useState<Quadro | null | undefined>(undefined)
  const [erro, setErro] = useState<string | null>(null)
  const [arraste, setArraste] = useState<Arraste | null>(null)
  const [vaga, setVaga] = useState<Vaga | null>(null)
  const [chegou, setChegou] = useState<string | null>(null)
  const [preferencias, setPreferencias] = useState<Preferencias>({})
  const [motivoPara, setMotivoPara] = useState<Pendente | null>(null)
  const [aberto, setAberto] = useState<Card | null>(null)
  const [novoEm, setNovoEm] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    if (!clienteId) { setQuadro(null); return }
    try { setQuadro(await carregarQuadro(clienteId)) } catch { setErro('Não foi possível carregar o quadro.') }
  }, [clienteId])

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
    setChegou(card.id); setTimeout(() => setChegou((c) => (c === card.id ? null : c)), 700)
    try { await moverCard(card, coluna.id, posicao, motivo) } catch { setErro('Não foi possível mover o card.') }
    await recarregar()
  }

  /** Solta o card na vaga escolhida: calcula a posição entre os vizinhos. */
  function soltarEm(card: Card, { coluna: colunaId, indice }: Vaga) {
    const coluna = quadro?.colunas.find((c) => c.id === colunaId)
    if (!coluna) return
    const todos = porColuna.get(coluna.id) ?? []
    if (card.coluna_id === coluna.id && todos.findIndex((c) => c.id === card.id) === indice) return
    const lista = todos.filter((c) => c.id !== card.id)
    const antes = lista[indice - 1]; const depois = lista[indice]
    const posicao = antes && depois ? (antes.posicao + depois.posicao) / 2 : depois ? depois.posicao - 1 : antes ? antes.posicao + 1 : 1
    const pendente = { card, coluna, posicao }
    // Mover para Impedimento exige motivo (documento, seção 4.3)
    if (coluna.exige_motivo && card.coluna_id !== coluna.id) setMotivoPara(pendente)
    else void executarMovimento(pendente)
  }

  // ---------------------------------------------------------------- arrastar com o mouse (inclina e quica)
  const quadroRef = useRef<HTMLDivElement>(null)
  const voando = useRef<HTMLDivElement>(null)
  const inicio = useRef<{ card: Card; x: number; y: number; el: HTMLElement } | null>(null)
  const arrasteRef = useRef<Arraste | null>(null)
  const vagaRef = useRef<Vaga | null>(null)
  const giro = useRef({ ultimoX: 0, angulo: 0 })
  const suprimirClique = useRef(false)
  const soltarRef = useRef(soltarEm)
  useEffect(() => { soltarRef.current = soltarEm })

  useEffect(() => {
    function mover(e: PointerEvent) {
      const ini = inicio.current
      if (!ini) return
      if (!arrasteRef.current) {
        if (Math.hypot(e.clientX - ini.x, e.clientY - ini.y) < 6) return
        const r = ini.el.getBoundingClientRect()
        const a = { card: ini.card, largura: r.width, altura: r.height, dx: ini.x - r.left, dy: ini.y - r.top, x: e.clientX, y: e.clientY }
        arrasteRef.current = a; giro.current = { ultimoX: e.clientX, angulo: 0 }
        setArraste(a); document.body.classList.add('arrastando-card')
      }
      const a = arrasteRef.current
      // Inclina mais quanto mais rápido o mouse anda para o lado
      const g = giro.current
      g.angulo = Math.max(-9, Math.min(9, g.angulo * 0.75 + (e.clientX - g.ultimoX) * 0.5)); g.ultimoX = e.clientX
      if (voando.current) voando.current.style.transform = `translate(${e.clientX - a.dx}px, ${e.clientY - a.dy}px) rotate(${3 + g.angulo}deg)`

      // Rola o quadro quando chega perto das bordas
      const q = quadroRef.current?.getBoundingClientRect()
      if (q && quadroRef.current) {
        if (e.clientX > q.right - 70) quadroRef.current.scrollLeft += 16
        else if (e.clientX < q.left + 70) quadroRef.current.scrollLeft -= 16
      }

      const col = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-coluna]')
      if (!col) return
      const cards = [...col.querySelectorAll<HTMLElement>('[data-card]')].filter((c) => c.dataset.card !== a.card.id)
      let indice = cards.findIndex((c) => { const r = c.getBoundingClientRect(); return e.clientY < r.top + r.height / 2 })
      if (indice < 0) indice = cards.length
      const v = { coluna: col.dataset.coluna!, indice }
      if (vagaRef.current?.coluna !== v.coluna || vagaRef.current.indice !== v.indice) { vagaRef.current = v; setVaga(v) }
    }
    function terminar(cancelado: boolean) {
      const a = arrasteRef.current; const v = vagaRef.current
      inicio.current = null; arrasteRef.current = null; vagaRef.current = null
      if (!a) return
      setArraste(null); setVaga(null); document.body.classList.remove('arrastando-card')
      suprimirClique.current = true; setTimeout(() => { suprimirClique.current = false }, 0)
      if (!cancelado && v) soltarRef.current(a.card, v)
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

  // ---------------------------------------------------------------- colunas minimizadas
  const chavePref = quadro ? `luminy.kanban.colunas.${quadro.id}` : null
  useEffect(() => { if (chavePref) void Promise.resolve().then(() => setPreferencias(lerPreferencias(chavePref))) }, [chavePref])
  const estaRecolhida = (col: Coluna, n: number) => vaga?.coluna !== col.id && (preferencias[col.id] === 'r' || (n === 0 && preferencias[col.id] !== 'a'))
  function alternarColuna(col: Coluna, n: number) {
    const p = { ...preferencias }
    if (estaRecolhida(col, n)) { if (n === 0) p[col.id] = 'a'; else delete p[col.id] }
    else { if (n === 0) delete p[col.id]; else p[col.id] = 'r' }
    setPreferencias(p)
    try { if (chavePref) localStorage.setItem(chavePref, JSON.stringify(p)) } catch { /* sem armazenamento */ }
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
          <p className="pequeno">Quadro oficial do {cliente?.nome} · {quadro.cards.length} cards</p>
        </div>
        <Botao icone={<Plus size={16} aria-hidden />} onClick={() => setNovoEm(quadro.colunas[0]?.id ?? null)}>Novo card</Botao>
      </div>
      {erro && <p className="aviso" role="alert" style={{ background: 'rgb(229 72 77 / .1)', color: 'var(--perigo)' }}>{erro}</p>}

      <div className="quadro" aria-label="Quadro de redes sociais" ref={quadroRef}>
        {quadro.colunas.map((col) => {
          const cards = porColuna.get(col.id) ?? []
          const visiveis = cards.filter((c) => c.id !== arraste?.card.id)
          const recolhida = estaRecolhida(col, cards.length)
          const cor = COR_COLUNA[col.nome] ?? 'var(--marca-clara)'
          const vagaAqui = arraste && vaga?.coluna === col.id ? vaga.indice : -1
          const slot = <div key="vaga" className="card-vaga" style={{ height: arraste?.altura }} aria-hidden />

          if (recolhida) return (
            <section key={col.id} data-coluna={col.id} className={`coluna coluna--recolhida${arraste ? ' coluna--receptiva' : ''}`}>
              <button type="button" className="coluna__faixa" onClick={() => alternarColuna(col, cards.length)}
                title={`Mostrar ${col.nome}`} aria-label={`Mostrar coluna ${col.nome} (${cards.length} cards)`}>
                <span className="coluna__ponto" style={{ background: cor }} />
                <span className="coluna__contagem">{cards.length}</span>
                <span className="coluna__nome-vertical">{col.nome}</span>
              </button>
            </section>
          )

          return (
            <section key={col.id} data-coluna={col.id} className={`coluna${vagaAqui >= 0 ? ' coluna--alvo' : ''}`}>
              <header className="coluna__topo">
                <span className="coluna__ponto" style={{ background: cor }} />
                <strong>{col.nome}</strong>
                <span className="pequeno">{cards.length}</span>
                <button className="coluna__mais" type="button" aria-label={`Novo card em ${col.nome}`} title="Novo card" onClick={() => setNovoEm(col.id)}><Plus size={16} /></button>
                <button className="coluna__mais" type="button" aria-label={`Minimizar coluna ${col.nome}`} title="Minimizar coluna" onClick={() => alternarColuna(col, cards.length)}><ChevronsLeft size={16} /></button>
              </header>

              {visiveis.map((card, i) => [
                i === vagaAqui && slot,
                <article key={card.id} data-card={card.id} className={`card${chegou === card.id ? ' card--chegou' : ''}`}
                  onPointerDown={(e) => { if (e.button === 0) inicio.current = { card, x: e.clientX, y: e.clientY, el: e.currentTarget } }}
                  onClick={() => { if (!suprimirClique.current) setAberto(card) }} tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') setAberto(card) }}>
                  <CardConteudo card={card} />
                </article>,
              ])}
              {vagaAqui >= visiveis.length && slot}

              {novoEm === col.id ? (
                <NovoCard onSalvar={(t) => void adicionar(col, t)} onCancelar={() => setNovoEm(null)} />
              ) : (
                <button className="coluna__adicionar" type="button" onClick={() => setNovoEm(col.id)}><Plus size={14} /> Adicionar card</button>
              )}
            </section>
          )
        })}
      </div>

      {arraste && (
        <div ref={voando} className="card-voando" aria-hidden
          style={{ width: arraste.largura, transform: `translate(${arraste.x - arraste.dx}px, ${arraste.y - arraste.dy}px) rotate(3deg)` }}>
          <div className="card card--no-ar"><CardConteudo card={arraste.card} /></div>
        </div>
      )}

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
  const { foco, definir } = useFoco()
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
          <Botao type="button" variante="secundario" icone={<Play size={14} />}
            onClick={() => { void definir(card.titulo, card.id); onFechar() }}>{foco?.card_id === card.id ? 'Você está fazendo agora' : 'Fazer agora'}</Botao>
          <Botao type="button" variante="fantasma" style={{ color: 'var(--perigo)' }} onClick={() => { if (confirm('Excluir este card? Esta ação não pode ser desfeita.')) void onExcluir() }}>Excluir</Botao>
          <div className="linha"><Botao type="button" variante="secundario" onClick={onFechar}>Cancelar</Botao><Botao type="submit" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Botao></div>
        </div>
      </form>
    </Janela>
  )
}
