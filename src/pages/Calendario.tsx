import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarHeart, Check, CheckSquare, Repeat, ChevronLeft, ChevronRight, ClipboardList, Columns3, Inbox, ListChecks, Plus, Send, Ticket, Trash2,
} from 'lucide-react'
import { Botao } from '../components/ui'
import { Janela } from '../components/Janela'
import { Selecao } from '../components/Selecao'
import { OPCOES_PRIORIDADE } from '../components/opcoes'
import { useSessao } from '../lib/sessao'
import { NavMeuEspaco } from '../components/NavMeuEspaco'
import { supabase } from '../lib/supabase'
import { DIAS_GERADOS, criarTarefa, diasDaRotina, excluirTarefa, listarRotinasPessoais, meusItens, salvarTarefa, type MeuItem } from '../lib/tarefas'
import { carregarQuadro, type Prioridade } from '../lib/kanban'
import { listarEventos } from '../lib/parcerias'
import { listarCampanhasPauta, montarCalendario } from '../lib/pautas'
import './calendario.css'

type Fonte = 'tarefa' | 'rotina' | 'trabalho' | 'entrega' | 'postagem' | 'evento' | 'data'
type ItemCal = {
  id: string; fonte: Fonte; titulo: string; inicio: Date; fim?: Date; temHora: boolean; detalhe?: string; concluida?: boolean
  prioridade?: Prioridade; cor?: string; link?: string; clienteId?: string | null; tarefa?: MeuItem
  /** Veio da Minha rotina (previsto = repetição futura que ainda não virou tarefa) */
  rotina?: boolean; previsto?: boolean
}
const FONTES: { id: Fonte; nome: string; icone: React.ElementType; cor: string }[] = [
  { id: 'tarefa', nome: 'Minhas tarefas', icone: ListChecks, cor: '#3D2EF9' },
  { id: 'rotina', nome: 'Minha rotina', icone: Repeat, cor: '#12A15F' },
  { id: 'trabalho', nome: 'Demandas e OS', icone: ClipboardList, cor: '#7A5AF8' },
  { id: 'entrega', nome: 'Entregas do Kanban', icone: Columns3, cor: '#E8890C' },
  { id: 'postagem', nome: 'Postagens', icone: Send, cor: '#D6297A' },
  { id: 'evento', nome: 'Eventos', icone: Ticket, cor: '#12A15F' },
  { id: 'data', nome: 'Datas e campanhas', icone: CalendarHeart, cor: '#2E90FA' },
]
const fonte = (f: Fonte) => FONTES.find((x) => x.id === f)!
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const chave = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
const inicioDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const hora = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
// Guarda o que a pessoa escondeu (assim, tipos novos aparecem ligados)
const CHAVE_FILTRO = 'luminy.calendario.ocultas'
function lerFiltro(): Fonte[] { try { const v = JSON.parse(localStorage.getItem(CHAVE_FILTRO) ?? '[]') as Fonte[]; return FONTES.map((f) => f.id).filter((f) => !v.includes(f)) } catch { return FONTES.map((f) => f.id) } }
const paraInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

/** Calendário do Meu espaço: tudo o que tem data, de todos os lugares, num lugar só. */
export function Calendario() {
  const { usuario, cliente, clientes, trocarCliente } = useSessao()
  const eu = supabase ? usuario.id : 'p1'
  const navegar = useNavigate()
  const [hoje] = useState(() => new Date())
  const [visao, setVisao] = useState<'mes' | 'semana'>('mes')
  const [base, setBase] = useState(() => new Date())
  const [selecionado, setSelecionado] = useState(() => inicioDia(new Date()))
  const [itens, setItens] = useState<ItemCal[] | null>(null)
  const [fontes, setFontes] = useState<Fonte[]>(lerFiltro)
  const [abrirTarefa, setAbrirTarefa] = useState<ItemCal | null>(null)
  const [nova, setNova] = useState<Date | null>(null)
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [alvo, setAlvo] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const lista: ItemCal[] = []
    const meus = await meusItens(eu).catch(() => [] as MeuItem[])
    meus.filter((m) => m.prazo && m.origem !== 'rotina' && !(m.origem === 'card' && m.cliente_id === cliente?.id)).forEach((m) => {
      const d = new Date(m.prazo!)
      lista.push({
        id: `${m.origem}-${m.id}`, fonte: m.origem === 'tarefa' ? (m.rotinaPessoal ? 'rotina' : 'tarefa') : m.origem === 'card' ? 'entrega' : 'trabalho', titulo: m.titulo, inicio: d,
        temHora: !(d.getHours() === 23 && d.getMinutes() === 59), detalhe: m.detalhe ?? (m.origem === 'tarefa' ? 'Tarefa pessoal' : undefined), concluida: m.concluida,
        prioridade: m.prioridade, clienteId: m.cliente_id, tarefa: m.origem === 'tarefa' ? m : undefined, rotina: m.rotinaPessoal,
        link: m.origem === 'demanda' ? '/demandas' : m.origem === 'os' ? '/ordens' : m.origem === 'card' ? `/kanban?card=${m.id}` : undefined,
      })
    })
    // Repetições da Minha rotina depois dos dias que já viraram tarefa
    const rotinas = await listarRotinasPessoais().catch(() => [])
    const de = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + DIAS_GERADOS)
    const ate = new Date(hoje.getFullYear(), hoje.getMonth() + 4, 0)
    rotinas.forEach((r) => diasDaRotina(r, de, ate).forEach((d) => {
      const [h, mi] = (r.horario ?? '23:59').split(':').map(Number)
      lista.push({ id: `rv-${r.id}-${d.getTime()}`, fonte: 'rotina', titulo: r.titulo, inicio: new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, mi), temHora: !!r.horario,
        detalhe: 'Minha rotina · prevista', prioridade: r.prioridade, rotina: true, previsto: true, link: '/minha-rotina' })
    }))
    if (cliente) {
      const [quadro, eventos, proprias] = await Promise.all([carregarQuadro(cliente.id).catch(() => null), listarEventos(cliente.id).catch(() => []), listarCampanhasPauta(cliente.id).catch(() => [])])
      quadro?.cards.forEach((c) => {
        const coluna = quadro.colunas.find((x) => x.id === c.coluna_id)?.nome ?? ''
        if (c.entrega_em && (c.responsaveis.includes(eu) || !supabase) && !/postado|feito/i.test(coluna))
          lista.push({ id: `entrega-${c.id}`, fonte: 'entrega', titulo: c.titulo, inicio: new Date(c.entrega_em), temHora: true, detalhe: `Entrega · ${coluna}`, prioridade: c.prioridade, link: `/kanban?card=${c.id}`, clienteId: cliente.id })
        if (c.postagem_em)
          lista.push({ id: `post-${c.id}`, fonte: 'postagem', titulo: c.titulo, inicio: new Date(c.postagem_em), temHora: true, detalhe: `${c.tipo_conteudo ?? 'Post'}${c.redes.length ? ` · ${c.redes.join(', ')}` : ''}`, concluida: !!c.postado_em || /^postado/i.test(coluna), link: '/agendamento', clienteId: cliente.id })
      })
      eventos.filter((e) => e.situacao !== 'cancelado').forEach((e) => {
        const d = new Date(`${e.data}T${e.hora ?? '00:00'}`)
        lista.push({ id: `ev-${e.id}`, fonte: 'evento', titulo: e.nome, inicio: d, temHora: !!e.hora, detalhe: e.local ?? 'Evento', concluida: e.situacao === 'realizado', link: '/eventos/agenda', clienteId: cliente.id })
      })
      // Datas da saúde e campanhas de alguns meses antes e depois
      const cal = montarCalendario(new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1), proprias, 400)
      cal.proximas.forEach((d) => lista.push({ id: `data-${d.chave}-${d.inicio.getFullYear()}`, fonte: 'data', titulo: d.nome, inicio: d.inicio, fim: d.fim, temHora: false, detalhe: d.descricao, cor: d.cor, link: '/pauta', clienteId: cliente.id }))
    }
    setItens(lista)
  }, [eu, cliente, hoje])
  useEffect(() => { void Promise.resolve().then(carregar) }, [carregar])

  function alternarFonte(f: Fonte) {
    const n = fontes.includes(f) ? fontes.filter((x) => x !== f) : [...fontes, f]
    setFontes(n); try { localStorage.setItem(CHAVE_FILTRO, JSON.stringify(FONTES.map((x) => x.id).filter((x) => !n.includes(x)))) } catch { /* sem armazenamento */ }
  }

  // Dias visíveis
  const dias = useMemo(() => {
    if (visao === 'semana') { const s = inicioDia(base); s.setDate(s.getDate() - s.getDay()); return Array.from({ length: 7 }, (_, i) => new Date(s.getFullYear(), s.getMonth(), s.getDate() + i)) }
    const primeiro = new Date(base.getFullYear(), base.getMonth(), 1)
    const inicio = new Date(primeiro); inicio.setDate(1 - primeiro.getDay())
    const semanas = Math.ceil((primeiro.getDay() + new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()) / 7)
    return Array.from({ length: semanas * 7 }, (_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i))
  }, [base, visao])

  const visiveis = (itens ?? []).filter((i) => fontes.includes(i.fonte))
  const porDia = useMemo(() => {
    const m = new Map<string, ItemCal[]>()
    const ordem: Fonte[] = ['data', 'evento', 'postagem', 'entrega', 'trabalho', 'tarefa', 'rotina']
    visiveis.forEach((i) => {
      // Campanhas de mês inteiro aparecem só no primeiro dia de cada semana visível e no começo, para não poluir
      if (i.fim && i.fim.getTime() - i.inicio.getTime() > 86_400_000) {
        dias.forEach((d) => { if (d >= inicioDia(i.inicio) && d <= i.fim! && (chave(d) === chave(i.inicio) || d.getDay() === 0)) { const k = chave(d); m.set(k, [...(m.get(k) ?? []), i]) } })
        return
      }
      const k = chave(i.inicio); m.set(k, [...(m.get(k) ?? []), i])
    })
    m.forEach((l) => l.sort((a, b) => ordem.indexOf(a.fonte) - ordem.indexOf(b.fonte) || (a.temHora ? a.inicio.getTime() : 0) - (b.temHora ? b.inicio.getTime() : 0)))
    return m
  }, [visiveis, dias]) // eslint-disable-line react-hooks/exhaustive-deps
  // No painel do dia, campanhas longas aparecem em todos os dias em que estão valendo
  const doDia = useMemo(() => visiveis.filter((i) => chave(i.inicio) === chave(selecionado) || (i.fim && selecionado >= inicioDia(i.inicio) && selecionado <= i.fim))
    .sort((a, b) => (a.temHora ? 1 : 0) - (b.temHora ? 1 : 0) || a.inicio.getTime() - b.inicio.getTime()), [visiveis, selecionado])

  function mover(n: number) {
    setBase(visao === 'mes' ? new Date(base.getFullYear(), base.getMonth() + n, 1) : new Date(base.getFullYear(), base.getMonth(), base.getDate() + 7 * n))
  }
  function abrir(i: ItemCal) {
    if (i.tarefa) { setAbrirTarefa(i); return }
    if (!i.link) return
    if (i.clienteId && i.clienteId !== cliente?.id && clientes.some((c) => c.id === i.clienteId)) trocarCliente(i.clienteId)
    navegar(i.link)
  }
  async function soltar(dia: Date) {
    const item = itens?.find((i) => i.id === arrastando)
    setArrastando(null); setAlvo(null)
    if (!item?.tarefa) return
    const novo = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), item.inicio.getHours(), item.inicio.getMinutes())
    if (chave(novo) === chave(item.inicio)) return
    setItens((l) => l?.map((x) => (x.id === item.id ? { ...x, inicio: novo } : x)) ?? null)
    await salvarTarefa(item.tarefa.id, { prazo: novo.toISOString() }).catch(() => void carregar())
  }

  const titulo = visao === 'mes'
    ? base.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : `${dias[0].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} a ${dias[6].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}`
  const limite = visao === 'mes' ? 3 : 12

  return (
    <div className="corpo calendario">
      <NavMeuEspaco />
      <div className="linha" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div><h2>Calendário</h2><p className="pequeno">Suas tarefas, demandas, OS e entregas, e{cliente ? ` do ${cliente.nome}` : ''} as postagens, eventos e datas, tudo num lugar só.</p></div>
        <Botao icone={<Plus size={16} />} onClick={() => setNova(new Date(selecionado.getFullYear(), selecionado.getMonth(), selecionado.getDate(), 9))}>Nova tarefa</Botao>
      </div>

      <div className="mc-barra">
        <div className="mes-nav">
          <button type="button" className="icone-botao" aria-label="Anterior" onClick={() => mover(-1)}><ChevronLeft size={18} /></button>
          <strong>{titulo.charAt(0).toUpperCase() + titulo.slice(1)}</strong>
          <button type="button" className="icone-botao" aria-label="Próximo" onClick={() => mover(1)}><ChevronRight size={18} /></button>
        </div>
        <Botao variante="secundario" onClick={() => { setBase(new Date()); setSelecionado(inicioDia(new Date())) }}>Hoje</Botao>
        <div className="segmentos" role="radiogroup" aria-label="Visão">
          <button type="button" role="radio" aria-checked={visao === 'mes'} className={visao === 'mes' ? 'marcado' : ''} onClick={() => setVisao('mes')}>Mês</button>
          <button type="button" role="radio" aria-checked={visao === 'semana'} className={visao === 'semana' ? 'marcado' : ''} onClick={() => { setVisao('semana'); setBase(selecionado) }}>Semana</button>
        </div>
      </div>
      <div className="mc-fontes" role="group" aria-label="O que mostrar">
        {FONTES.map((f) => {
          const I = f.icone; const ligado = fontes.includes(f.id)
          return (
            <button key={f.id} type="button" className={`mc-fonte${ligado ? ' ligada' : ''}`} style={{ '--cor': f.cor } as React.CSSProperties} aria-pressed={ligado} onClick={() => alternarFonte(f.id)}>
              <I size={13} /> {f.nome} <span>{(itens ?? []).filter((i) => i.fonte === f.id && dias.some((d) => chave(d) === chave(i.inicio))).length}</span>
            </button>
          )
        })}
      </div>

      <div className="mc-corpo">
        <div className={`mc-grade mc-grade--${visao}`} role="grid" aria-label="Calendário">
          {DIAS.map((d) => <div key={d} className="mc-semana" role="columnheader">{d}</div>)}
          {dias.map((d) => {
            const k = chave(d)
            const lista = porDia.get(k) ?? []
            const fora = visao === 'mes' && d.getMonth() !== base.getMonth()
            return (
              <div key={k} role="gridcell" aria-selected={chave(selecionado) === k}
                className={`mc-dia${fora ? ' fora' : ''}${chave(hoje) === k ? ' hoje' : ''}${chave(selecionado) === k ? ' selecionado' : ''}${alvo === k ? ' alvo' : ''}`}
                onClick={() => setSelecionado(d)} onDoubleClick={() => setNova(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9))}
                onDragOver={(e) => { if (arrastando) { e.preventDefault(); setAlvo(k) } }} onDragLeave={() => setAlvo((a) => (a === k ? null : a))} onDrop={(e) => { e.preventDefault(); void soltar(d) }}>
                <div className="mc-dia__topo">
                  <span className="mc-dia__numero">{d.getDate()}</span>
                  <button type="button" className="mc-dia__mais" aria-label={`Nova tarefa em ${d.toLocaleDateString('pt-BR')}`} onClick={(e) => { e.stopPropagation(); setNova(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9)) }}><Plus size={13} /></button>
                </div>
                <ul className="mc-dia__itens">
                  {lista.slice(0, limite).map((i) => {
                    const f = fonte(i.fonte); const I = i.rotina ? Repeat : f.icone
                    return (
                      <li key={i.id}>
                        <button type="button" draggable={!!i.tarefa} onDragStart={(e) => { setArrastando(i.id); e.dataTransfer.effectAllowed = 'move' }} onDragEnd={() => { setArrastando(null); setAlvo(null) }}
                          className={`mc-item mc-item--${i.fonte}${i.previsto ? ' previsto' : ''}${i.concluida ? ' feito' : ''}${arrastando === i.id ? ' arrastando' : ''}`} style={{ '--cor': i.cor ?? f.cor } as React.CSSProperties}
                          title={`${i.titulo}${i.detalhe ? ` · ${i.detalhe}` : ''}`} onClick={(e) => { e.stopPropagation(); setSelecionado(d); abrir(i) }}>
                          <I size={11} aria-hidden />
                          {i.temHora && <span className="mc-item__hora">{hora(i.inicio)}</span>}
                          <span className="mc-item__titulo">{i.titulo}</span>
                        </button>
                      </li>
                    )
                  })}
                  {lista.length > limite && <li><button type="button" className="mc-item mc-item--mais" onClick={(e) => { e.stopPropagation(); setSelecionado(d) }}>+{lista.length - limite} mais</button></li>}
                </ul>
              </div>
            )
          })}
        </div>

        <aside className="mc-painel" aria-label="Dia selecionado">
          <div className="mc-painel__topo">
            <span className="rotulo">{chave(selecionado) === chave(hoje) ? 'Hoje' : selecionado.toLocaleDateString('pt-BR', { weekday: 'long' })}</span>
            <strong>{selecionado.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}</strong>
          </div>
          {itens === null ? <p className="pequeno">Carregando…</p> : doDia.length === 0 ? (
            <div className="mc-painel__vazio"><Inbox size={26} /><span>Nada neste dia.</span></div>
          ) : (
            <ul className="mc-painel__lista">
              {doDia.map((i) => {
                const f = fonte(i.fonte); const I = i.rotina ? Repeat : f.icone
                return (
                  <li key={i.id}>
                    <button type="button" className={`mc-agenda${i.concluida ? ' feito' : ''}`} style={{ '--cor': i.cor ?? f.cor } as React.CSSProperties} onClick={() => abrir(i)}>
                      <span className="mc-agenda__hora">{i.temHora ? hora(i.inicio) : i.fim && i.fim.getTime() - i.inicio.getTime() > 86_400_000 ? 'Mês' : 'Dia'}</span>
                      <span className="mc-agenda__icone"><I size={14} /></span>
                      <span className="mc-agenda__texto"><strong>{i.concluida && <Check size={13} />} {i.titulo}</strong><small>{f.nome}{i.detalhe && i.detalhe !== f.nome ? ` · ${i.detalhe.replace(/^Minha rotina · /, '')}` : ''}</small></span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <button type="button" className="mc-painel__nova" onClick={() => setNova(new Date(selecionado.getFullYear(), selecionado.getMonth(), selecionado.getDate(), 9))}><Plus size={15} /> Tarefa neste dia</button>
          <p className="pequeno">Dica: arraste suas tarefas para outro dia. Dois cliques num dia criam uma tarefa.</p>
        </aside>
      </div>

      {nova && <NovaTarefa dia={nova} onFechar={() => setNova(null)} onCriar={async (t, quando, p) => { await criarTarefa(t, quando.toISOString(), p); setNova(null); setSelecionado(inicioDia(quando)); await carregar() }} />}
      {abrirTarefa?.tarefa && <TarefaModal item={abrirTarefa} onFechar={() => setAbrirTarefa(null)} onMudou={async () => { setAbrirTarefa(null); await carregar() }} />}
    </div>
  )
}

function NovaTarefa({ dia, onFechar, onCriar }: { dia: Date; onFechar: () => void; onCriar: (titulo: string, quando: Date, p: Prioridade) => Promise<void> }) {
  const [titulo, setTitulo] = useState('')
  const [quando, setQuando] = useState(() => paraInput(dia))
  const [prioridade, setPrioridade] = useState<Prioridade>('comum')
  return (
    <Janela titulo={`Nova tarefa · ${dia.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}`} onFechar={onFechar} largura={480}>
      <form className="janela__corpo" onSubmit={(e) => { e.preventDefault(); if (titulo.trim() && quando) void onCriar(titulo.trim(), new Date(quando), prioridade) }}>
        <div className="campo"><label htmlFor="ct-titulo">O que fazer</label><input id="ct-titulo" className="entrada" autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Reunião com a diretoria" /></div>
        <div className="grade-2">
          <div className="campo"><label htmlFor="ct-quando">Quando</label><input id="ct-quando" type="datetime-local" className="entrada" value={quando} onChange={(e) => setQuando(e.target.value)} /></div>
          <div className="campo"><label htmlFor="ct-prio">Prioridade</label><Selecao id="ct-prio" valor={prioridade} onMudar={(v) => setPrioridade(v as Prioridade)} opcoes={OPCOES_PRIORIDADE} /></div>
        </div>
        <p className="pequeno">Fica só para você, em Minhas tarefas.</p>
        <div className="linha" style={{ justifyContent: 'flex-end' }}><Botao type="button" variante="fantasma" onClick={onFechar}>Cancelar</Botao><Botao type="submit" disabled={!titulo.trim()}>Criar tarefa</Botao></div>
      </form>
    </Janela>
  )
}

function TarefaModal({ item, onFechar, onMudou }: { item: ItemCal; onFechar: () => void; onMudou: () => Promise<void> }) {
  const t = item.tarefa!
  const [titulo, setTitulo] = useState(t.titulo)
  const [quando, setQuando] = useState(() => paraInput(item.inicio))
  const [prioridade, setPrioridade] = useState<Prioridade>(t.prioridade)
  const [salvando, setSalvando] = useState(false)
  async function salvar(extra: Parameters<typeof salvarTarefa>[1] = {}) {
    setSalvando(true)
    await salvarTarefa(t.id, { titulo: titulo.trim() || t.titulo, prazo: quando ? new Date(quando).toISOString() : null, prioridade, ...extra })
    await onMudou()
  }
  return (
    <Janela titulo="Tarefa" onFechar={onFechar} largura={480}>
      <form className="janela__corpo" onSubmit={(e) => { e.preventDefault(); void salvar() }}>
        <div className="campo"><label htmlFor="tm-titulo">Tarefa</label><input id="tm-titulo" className="entrada" value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
        <div className="grade-2">
          <div className="campo"><label htmlFor="tm-quando">Quando</label><input id="tm-quando" type="datetime-local" className="entrada" value={quando} onChange={(e) => setQuando(e.target.value)} /></div>
          <div className="campo"><label htmlFor="tm-prio">Prioridade</label><Selecao id="tm-prio" valor={prioridade} onMudar={(v) => setPrioridade(v as Prioridade)} opcoes={OPCOES_PRIORIDADE} /></div>
        </div>
        <div className="linha" style={{ justifyContent: 'space-between' }}>
          <Botao type="button" variante="fantasma" icone={<Trash2 size={15} />} onClick={() => { if (confirm('Excluir esta tarefa?')) void excluirTarefa(t.id).then(onMudou) }}>Excluir</Botao>
          <div className="linha" style={{ gap: 8 }}>
            <Botao type="button" variante="secundario" icone={<CheckSquare size={15} />} disabled={salvando} onClick={() => void salvar({ status: item.concluida ? 'a_fazer' : 'concluida' })}>{item.concluida ? 'Reabrir' : 'Concluir'}</Botao>
            <Botao type="submit" disabled={salvando}>Salvar</Botao>
          </div>
        </div>
      </form>
    </Janela>
  )
}
