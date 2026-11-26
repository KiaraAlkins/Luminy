import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle, ArrowRight, CalendarDays, Check, ClipboardList, Columns3, Hand, Inbox, ListChecks, Package, Play, Send, Sparkles, User,
} from 'lucide-react'
import { Cartao, Chip } from '../components/ui'
import { COR_TIPO, iconeTipo } from '../components/opcoes'
import { useSessao } from '../lib/sessao'
import { supabase } from '../lib/supabase'
import { tempoDesde, useFoco } from '../lib/foco'
import { grupoDe, rotuloPrazo } from '../lib/datas'
import { meusItens, type MeuItem } from '../lib/tarefas'
import { aceitarDemanda, listarDemandas, type Demanda } from '../lib/demandas'
import { listarCampanhas, listarLeads, type Campanha, type Lead } from '../lib/campanhas'
import { carregarQuadro, type Card } from '../lib/kanban'
import { listarOS, type OS } from '../lib/os'
import { fmt, listarItens, situacao, type Item } from '../lib/estoque'
import { listarEventos, type Evento } from '../lib/parcerias'
import './inicio.css'

function saudacao(d: Date) {
  const h = d.getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}
const ICONE_ORIGEM: Record<MeuItem['origem'], React.ElementType> = { tarefa: User, demanda: Inbox, card: Columns3, os: ClipboardList }
const chaveDia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

type Dados = { itens: MeuItem[]; demandas: Demanda[]; leads: Lead[]; campanhas: Campanha[]; cards: Card[]; os: OS[]; estoque: Item[]; eventos: Evento[] }
const VAZIO: Dados = { itens: [], demandas: [], leads: [], campanhas: [], cards: [], os: [], estoque: [], eventos: [] }

/** Início do cliente: o resumo do dia com dados reais (tarefas, demandas, leads, publicações, OS, estoque e eventos). */
export function Inicio() {
  const { usuario, acessoLeads, cliente, ehProprietario, agencia } = useSessao()
  const navegar = useNavigate()
  const { foco, definir, concluir } = useFoco()
  const [agora] = useState(() => new Date())
  const [dados, setDados] = useState<Dados | null>(null)
  const eu = supabase ? usuario.id : 'p1'

  const carregar = useCallback(async () => {
    if (!cliente) return
    const seguro = <T,>(p: Promise<T>, padrao: T) => p.catch(() => padrao)
    const [itens, demandas, leads, campanhas, quadro, os, estoque, eventos] = await Promise.all([
      seguro(meusItens(eu), []), seguro(listarDemandas(cliente.id), []),
      acessoLeads ? seguro(listarLeads(cliente.id), []) : Promise.resolve([]),
      acessoLeads ? seguro(listarCampanhas(cliente.id).then((r) => r.campanhas), []) : Promise.resolve([]),
      seguro(carregarQuadro(cliente.id), null), seguro(listarOS(cliente.id), []),
      seguro(listarItens(cliente.id).then((r) => r.ativos), []), seguro(listarEventos(cliente.id), []),
    ])
    setDados({ itens: itens.filter((i) => !i.cliente_id || i.cliente_id === cliente.id), demandas, leads, campanhas, cards: quadro?.cards ?? [], os, estoque, eventos })
  }, [cliente, acessoLeads, eu])
  useEffect(() => { void Promise.resolve().then(carregar) }, [carregar])

  const d = dados ?? VAZIO
  const pendentes = useMemo(() => d.itens.filter((i) => !i.concluida), [d.itens])
  const doDia = pendentes.filter((i) => ['atrasadas', 'hoje'].includes(grupoDe(i.prazo, agora)))
    .sort((a, b) => (a.prazo ?? '').localeCompare(b.prazo ?? '') || (a.prioridade === 'alta' ? -1 : 1))
  const proxima = doDia[0] ?? pendentes.filter((i) => i.prazo).sort((a, b) => a.prazo!.localeCompare(b.prazo!))[0]
  const aguardando = d.demandas.filter((x) => x.status === 'aguardando_aceite' && (!x.responsavel_id || x.responsavel_id === eu))
  const leadsNovos = d.leads.filter((l) => l.etapa === 'novo')
  const porCampanha = [...leadsNovos.reduce((m, l) => m.set(l.campanha_id ?? '', (m.get(l.campanha_id ?? '') ?? 0) + 1), new Map<string, number>())]
    .map(([id, n]) => ({ nome: d.campanhas.find((c) => c.id === id)?.nome ?? 'Importados / sem campanha', n })).sort((a, b) => b.n - a.n).slice(0, 3)
  const publicacoes = d.cards.filter((c) => c.postagem_em && new Date(c.postagem_em) >= new Date(agora.getTime() - 3_600_000)).sort((a, b) => a.postagem_em!.localeCompare(b.postagem_em!)).slice(0, 4)
  const osAbertas = d.os.filter((o) => !['concluida', 'cancelada'].includes(o.situacao))
  const osAtrasadas = osAbertas.filter((o) => o.prazo && `${o.prazo}T23:59` < agora.toISOString().slice(0, 16))
  const repor = d.estoque.filter((i) => situacao(i) !== 'ok')
  const hojeIso = agora.toISOString().slice(0, 10)
  const proxEventos = d.eventos.filter((v) => v.data >= hojeIso && v.situacao !== 'cancelado').slice(0, 3)

  // Semana: quantas entregas (minhas) e publicações por dia
  const semana = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const dia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + i)
    const k = chaveDia(dia)
    const entregas = pendentes.filter((x) => x.prazo && chaveDia(new Date(x.prazo)) === k).length
    const posts = d.cards.filter((c) => c.postagem_em && chaveDia(new Date(c.postagem_em)) === k).length
    return { dia, entregas, posts }
  }), [agora, pendentes, d.cards])
  const livre = semana.slice(1).find((s) => s.dia.getDay() !== 0 && s.dia.getDay() !== 6 && s.entregas + s.posts === 0)

  async function aceitar(x: Demanda) { await aceitarDemanda(x.id, eu).catch(() => null); await carregar() }
  function abrirItem(i: MeuItem) {
    navegar(i.origem === 'card' ? `/kanban?card=${i.id}` : i.origem === 'demanda' ? `/demandas?d=${i.id}` : i.origem === 'os' ? `/ordens?os=${i.id}` : '/tarefas')
  }

  const dataLonga = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const primeiroNome = usuario.nome.split(' ')[0]

  if (!cliente) {
    return (
      <div className="corpo">
        <div className="saudacao"><div>
          <div className="rotulo">{dataLonga}</div>
          <h1>{saudacao(agora)}, {primeiroNome}</h1>
          <p className="texto-2">{agencia ? `Sua agência ${agencia.nome} está pronta.` : 'Sua conta está pronta.'}</p>
        </div></div>
        <Cartao titulo="Primeiros passos">
          <ol className="passos">
            <li className="feito"><strong>Criar a conta</strong><span className="pequeno">Feito</span></li>
            {ehProprietario ? (
              <>
                <li><strong>Cadastrar o primeiro cliente</strong><span className="pequeno">Cada cliente tem Kanban, demandas, campanhas e equipe próprios.</span>
                  <Link className="botao botao--primario" to="/principal">Cadastrar cliente</Link></li>
                <li><strong>Convidar a equipe</strong><span className="pequeno">Por link no WhatsApp ou por e-mail, em Configurações.</span></li>
                <li><strong>Criar a primeira campanha com QR Code</strong><span className="pequeno">Para captar leads em eventos.</span></li>
              </>
            ) : (
              <li><strong>Entrar numa equipe</strong><span className="pequeno">Peça o link do convite ao administrador da equipe.</span></li>
            )}
          </ol>
        </Cartao>
      </div>
    )
  }

  const resumo = [
    doDia.length ? plural(doDia.length, 'entrega para hoje', 'entregas para hoje') : 'nada vencendo hoje',
    aguardando.length ? plural(aguardando.length, 'demanda esperando aceite', 'demandas esperando aceite') : null,
    acessoLeads && leadsNovos.length ? plural(leadsNovos.length, 'lead novo para atender', 'leads novos para atender') : null,
  ].filter(Boolean)

  return (
    <div className="corpo">
      <div className="saudacao">
        <div>
          <div className="rotulo">{dataLonga}</div>
          <h1>{saudacao(agora)}, {primeiroNome}</h1>
          <p className="texto-2">{dados === null ? 'Carregando o seu dia…' : `Você tem ${resumo.length > 1 ? `${resumo.slice(0, -1).join(', ')} e ${resumo.at(-1)}` : resumo[0]}.`}</p>
        </div>
      </div>

      <div className="bento">
        {/* Fazendo agora / o que fazer agora */}
        <section className="cartao bento--2 tarefa-atual">
          {foco ? (
            <>
              <header className="cartao__topo"><h4 className="rotulo" style={{ color: '#fff' }}>Fazendo agora</h4><span className="pequeno" style={{ color: '#fff' }}>há {tempoDesde(foco.iniciado_em)} · aparece na TV</span></header>
              <h2>{foco.titulo}</h2>
              <div className="linha">
                <button className="botao botao-claro" type="button" onClick={() => void concluir().then(carregar)}><Check size={16} aria-hidden /> Concluir</button>
                {foco.card_id && <Link className="botao botao-contorno" to={`/kanban?card=${foco.card_id}`}>Abrir card</Link>}
              </div>
              {doDia.filter((i) => i.titulo !== foco.titulo && i.id !== foco.card_id).length > 0 && (
                <div className="depois">
                  <span className="rotulo" style={{ color: 'var(--marca-clara)' }}>Depois disso</span>
                  {doDia.filter((i) => i.titulo !== foco.titulo && i.id !== foco.card_id).slice(0, 3).map((i) => (
                    <button key={`${i.origem}-${i.id}`} type="button" className="depois__item" onClick={() => void definir(i.titulo, i.origem === 'card' ? i.id : null)} title="Fazer agora">
                      <Play size={13} /> <span>{i.titulo}</span> <small>{i.prazo ? rotuloPrazo(i.prazo) : ''}</small>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : proxima ? (
            <>
              <header className="cartao__topo"><h4 className="rotulo" style={{ color: '#fff' }}>Sugestão para começar</h4><span className="pequeno" style={{ color: '#fff' }}>{grupoDe(proxima.prazo, agora) === 'atrasadas' ? 'está atrasada' : 'a mais urgente'}</span></header>
              <h2>{proxima.titulo}</h2>
              <div className="linha" style={{ color: '#fff' }}>
                {proxima.prazo && <Chip tom="vidro">{rotuloPrazo(proxima.prazo)}</Chip>}
                {proxima.detalhe && <Chip tom="vidro">{proxima.detalhe}</Chip>}
              </div>
              <div className="linha">
                <button className="botao botao-claro" type="button" onClick={() => void definir(proxima.titulo, proxima.origem === 'card' ? proxima.id : null)}><Play size={16} aria-hidden /> Fazer agora</button>
                <button className="botao botao-contorno" type="button" onClick={() => abrirItem(proxima)}>Abrir</button>
              </div>
            </>
          ) : (
            <>
              <header className="cartao__topo"><h4 className="rotulo" style={{ color: '#fff' }}>Tudo em dia</h4></header>
              <h2>Nada urgente por aqui 🎉</h2>
              <div className="linha"><Link className="botao botao-claro" to="/tarefas"><ListChecks size={16} /> Ver minhas tarefas</Link></div>
            </>
          )}
        </section>

        <Cartao titulo="Seu dia" acao={<Link className="pequeno" to="/tarefas">Minhas tarefas</Link>}>
          {doDia.slice(0, 6).map((i) => {
            const I = ICONE_ORIGEM[i.origem]
            const atrasada = grupoDe(i.prazo, agora) === 'atrasadas'
            return (
              <button key={`${i.origem}-${i.id}`} type="button" className="item-dia" onClick={() => abrirItem(i)}>
                <span className={`item-dia__icone item-dia__icone--${i.origem}`}><I size={14} /></span>
                <span className="item-dia__texto"><strong>{i.titulo}</strong><span className={`pequeno${atrasada ? ' atrasado' : ''}`}>{atrasada ? 'Atrasada · ' : ''}{i.prazo ? rotuloPrazo(i.prazo) : ''}</span></span>
              </button>
            )
          })}
          {dados && doDia.length === 0 && <p className="texto-2">Nada vencendo hoje. {pendentes.length ? `Você tem ${plural(pendentes.length, 'item', 'itens')} nos próximos dias.` : ''}</p>}
          {doDia.length > 6 && <Link className="pequeno" to="/tarefas">e mais {doDia.length - 6}…</Link>}
        </Cartao>

        <Cartao titulo="Demandas esperando aceite" acao={<Link className="pequeno" to="/demandas">Demandas</Link>}>
          {aguardando.slice(0, 3).map((x) => (
            <div key={x.id} className="demanda">
              <div><div className="forte">{x.titulo}</div><div className="pequeno">{[x.setor_solicitante, x.prazo ? `prazo ${rotuloPrazo(x.prazo)}` : null].filter(Boolean).join(' · ')}</div></div>
              <div className="linha"><button type="button" className="botao botao--primario botao--mini" onClick={() => void aceitar(x)}><Hand size={14} /> Aceitar</button>
                <Link className="botao botao--fantasma botao--mini" to={`/demandas?d=${x.id}`}>Ver</Link></div>
            </div>
          ))}
          {dados && aguardando.length === 0 && <p className="texto-2">Nenhuma demanda esperando resposta.</p>}
        </Cartao>

        {acessoLeads && (
          <section className="cartao leads-novos">
            <header className="cartao__topo"><h4 className="rotulo" style={{ color: '#fff' }}>Leads novos</h4><span className="pequeno" style={{ color: 'var(--texto-sobre-escuro)' }}>Sigiloso</span></header>
            <div className="linha" style={{ alignItems: 'baseline' }}><span className="numero">{leadsNovos.length}</span><span className="pequeno" style={{ color: 'var(--texto-sobre-escuro)' }}>esperando o primeiro contato</span></div>
            {porCampanha.map((o) => (
              <div key={o.nome} className="origem">
                <div className="linha"><span className="pequeno" style={{ color: '#fff', flex: 1 }}>{o.nome}</span><span className="forte">{o.n}</span></div>
                <div className="barra-escura"><span style={{ width: `${(o.n / Math.max(1, leadsNovos.length)) * 100}%` }} /></div>
              </div>
            ))}
            <Link className="linha forte" style={{ color: '#fff' }} to="/eventos/leads">Abrir os leads <ArrowRight size={16} aria-hidden /></Link>
          </section>
        )}

        <Cartao titulo="Próximas publicações" acao={<Link className="pequeno" to="/kanban">Kanban</Link>}>
          {publicacoes.map((p) => {
            const dt = new Date(p.postagem_em!)
            const ehHoje = dt.toDateString() === agora.toDateString()
            return (
              <Link key={p.id} to={`/kanban?card=${p.id}`} className="publicacao">
                <div className={`dia${ehHoje ? ' dia--hoje' : ''}`}><span>{ehHoje ? 'Hoje' : dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</span><strong>{dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong></div>
                <div style={{ minWidth: 0 }}>
                  <div className="forte">{p.titulo}</div>
                  <div className="linha" style={{ marginTop: 4, gap: 4 }}>
                    {p.tipo_conteudo && <span className="etiqueta" style={{ '--cor': COR_TIPO[p.tipo_conteudo] ?? '#667085' } as React.CSSProperties}>{iconeTipo(p.tipo_conteudo, 11)} {p.tipo_conteudo}</span>}
                    {p.redes.slice(0, 2).map((r) => <span key={r} className="pequeno">{r}</span>)}
                  </div>
                </div>
              </Link>
            )
          })}
          {dados && publicacoes.length === 0 && <p className="texto-2">Nenhuma publicação com data. Coloque a data de postagem nos cards do Kanban.</p>}
        </Cartao>

        <Cartao titulo="Ordens de serviço" acao={<Link className="pequeno" to="/ordens">Ver todas</Link>}>
          <div className="numeros-mini">
            <div><strong>{osAbertas.length}</strong><span>em aberto</span></div>
            <div className={osAtrasadas.length ? 'perigo' : ''}><strong>{osAtrasadas.length}</strong><span>atrasadas</span></div>
            <div><strong>{osAbertas.filter((o) => !o.responsavel_id).length}</strong><span>sem responsável</span></div>
          </div>
          {[...osAbertas].sort((a, b) => (a.prazo ?? '9').localeCompare(b.prazo ?? '9')).slice(0, 3).map((o) => (
            <Link key={o.id} to={`/ordens?os=${o.id}`} className="item-dia">
              <span className="item-dia__icone item-dia__icone--os"><ClipboardList size={14} /></span>
              <span className="item-dia__texto"><strong>OS {o.numero} · {o.titulo}</strong><span className={`pequeno${osAtrasadas.includes(o) ? ' atrasado' : ''}`}>{o.setor ?? ''}{o.prazo ? ` · até ${new Date(`${o.prazo}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}` : ''}</span></span>
            </Link>
          ))}
        </Cartao>

        <Cartao titulo="Estoque" acao={<Link className="pequeno" to="/estoque">Abrir estoque</Link>}>
          {repor.length ? (
            <>
              <p className="aviso-estoque"><AlertTriangle size={15} /> {plural(repor.length, 'item precisa', 'itens precisam')} de reposição</p>
              {repor.slice(0, 4).map((i) => (
                <div key={i.id} className="linha" style={{ justifyContent: 'space-between' }}>
                  <span><Package size={13} style={{ verticalAlign: -2, color: 'var(--texto-3)' }} /> {i.nome}</span>
                  <span className={`forte ${situacao(i) === 'zerado' ? 'zerado' : 'baixo'}`}>{fmt(i.quantidade)} {i.unidade}</span>
                </div>
              ))}
            </>
          ) : <p className="texto-2">{dados ? 'Tudo acima do mínimo.' : 'Carregando…'}</p>}
        </Cartao>

        <Cartao titulo="Próximos eventos" acao={<Link className="pequeno" to="/eventos/agenda">Agenda</Link>}>
          {proxEventos.map((v) => {
            const dt = new Date(`${v.data}T12:00:00`)
            return (
              <div key={v.id} className="publicacao">
                <div className={`dia${v.data === hojeIso ? ' dia--hoje' : ''}`}><span>{dt.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span><strong>{dt.getDate()}</strong></div>
                <div><div className="forte">{v.nome}</div><div className="pequeno">{[v.hora?.slice(0, 5), v.local].filter(Boolean).join(' · ')}</div></div>
              </div>
            )
          })}
          {dados && proxEventos.length === 0 && <p className="texto-2">Nenhum evento marcado.</p>}
        </Cartao>

        <Cartao titulo="Sua semana" className="bento--3" acao={<span className="pequeno">entregas e publicações dos próximos 7 dias</span>}>
          <div className="semana">
            {semana.map((s, i) => (
              <div key={i} className={`semana__dia${i === 0 ? ' hoje' : ''}`}>
                <span className="pequeno">{i === 0 ? 'Hoje' : s.dia.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</span>
                <strong className="semana__numero">{s.dia.getDate()}</strong>
                <span className="semana__contas">
                  {s.entregas > 0 && <span title="Suas entregas"><ListChecks size={12} /> {s.entregas}</span>}
                  {s.posts > 0 && <span title="Publicações" className="posts"><Send size={11} /> {s.posts}</span>}
                  {s.entregas + s.posts === 0 && <span className="livre">livre</span>}
                </span>
              </div>
            ))}
          </div>
          {livre && <div className="sugestao"><Sparkles size={18} aria-hidden /> {livre.dia.toLocaleDateString('pt-BR', { weekday: 'long' })} está livre de entregas e publicações. Bom dia para adiantar pautas ou gravar conteúdo.</div>}
          {!livre && <div className="sugestao"><CalendarDays size={18} aria-hidden /> Semana cheia: confira o Kanban por data para distribuir as publicações.</div>}
        </Cartao>
      </div>
    </div>
  )
}
