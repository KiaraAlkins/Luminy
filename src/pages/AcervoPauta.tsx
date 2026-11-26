import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Archive, ArchiveRestore, ArrowRight, CalendarHeart, CalendarPlus, Pencil, ExternalLink, Lightbulb, Link2, Plus, Repeat, ThumbsUp, Trash2, X } from 'lucide-react'
import { Botao } from '../components/ui'
import { Janela } from '../components/Janela'
import { Selecao } from '../components/Selecao'
import { COR_TIPO, iconeTipo, opcoesTipoConteudo } from '../components/opcoes'
import { comemorar } from '../lib/comemorar'
import { useSessao } from '../lib/sessao'
import { supabase } from '../lib/supabase'
import { TIPOS, listarPessoas, type Pessoa } from '../lib/kanban'
import {
  CORES_CAMPANHA, TEMAS, criarPauta, excluirCampanhaPauta, excluirPauta, listarCampanhasPauta, listarPautas, montarCalendario, salvarCampanhaPauta, salvarPauta, virarCard, votar,
  type Calendario, type CampanhaPropria, type EdicaoCampanha, type EdicaoPauta, type Pauta, type Referencia,
} from '../lib/pautas'
import { FotoPessoa } from './kanban/Pessoas'
import './pauta.css'

type Aba = 'ideias' | 'repetir' | 'usadas' | 'arquivadas'
const DIA = 86_400_000
const tempoAtras = (iso: string, agora: number) => {
  const d = Math.floor((agora - new Date(iso).getTime()) / DIA)
  return d < 1 ? 'hoje' : d === 1 ? 'ontem' : d < 30 ? `há ${d} dias` : d < 365 ? `há ${Math.round(d / 30)} ${Math.round(d / 30) === 1 ? 'mês' : 'meses'}` : 'há mais de 1 ano'
}

/** Acervo de Pauta: banco de ideias da equipe, com votos, datas da saúde e "virar card" para o Kanban. */
export function AcervoPauta() {
  const { cliente, usuario, ehAdminCliente } = useSessao()
  const eu = supabase ? usuario.id : 'p1'
  const navegar = useNavigate()
  const [pautas, setPautas] = useState<Pauta[] | null>(null)
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [aba, setAba] = useState<Aba>('ideias')
  const [ordem, setOrdem] = useState<'votos' | 'recentes'>('votos')
  const [tema, setTema] = useState<string | null>(null)
  const [dataFiltro, setDataFiltro] = useState<string | null>(null)
  const [rapida, setRapida] = useState('')
  const [abrir, setAbrir] = useState<Pauta | 'nova' | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [agora] = useState(() => Date.now())
  const [proprias, setProprias] = useState<CampanhaPropria[]>([])
  const [editarCampanha, setEditarCampanha] = useState<CampanhaPropria | 'nova' | null>(null)

  const carregar = useCallback(async () => {
    if (!cliente) return
    try {
      const [p, g, c] = await Promise.all([listarPautas(cliente.id), listarPessoas(cliente.id), listarCampanhasPauta(cliente.id)])
      setPautas(p); setPessoas(g); setProprias(c)
    }
    catch (e) { setErro((e as Error).message) }
  }, [cliente])
  useEffect(() => { void Promise.resolve().then(carregar) }, [carregar])

  const calendario: Calendario = useMemo(() => montarCalendario(new Date(agora), proprias), [agora, proprias])
  const datas = calendario.proximas
  const abertas = (pautas ?? []).filter((p) => p.situacao === 'ideia')
  const contagem: Record<Aba, number> = {
    ideias: abertas.length,
    repetir: (pautas ?? []).filter((p) => p.reutilizavel && p.usada_em && p.situacao !== 'arquivada').length,
    usadas: (pautas ?? []).filter((p) => p.situacao === 'usada').length,
    arquivadas: (pautas ?? []).filter((p) => p.situacao === 'arquivada').length,
  }
  const lista = useMemo(() => {
    const base = (pautas ?? []).filter((p) =>
      aba === 'ideias' ? p.situacao === 'ideia' : aba === 'repetir' ? p.reutilizavel && !!p.usada_em && p.situacao !== 'arquivada' : aba === 'usadas' ? p.situacao === 'usada' : p.situacao === 'arquivada')
      .filter((p) => (!tema || p.tema === tema) && (!dataFiltro || p.data_ref === dataFiltro))
    return base.sort((a, b) => (aba === 'usadas' || aba === 'repetir' ? (b.usada_em ?? '').localeCompare(a.usada_em ?? '')
      : ordem === 'votos' ? b.votos.length - a.votos.length || b.criado_em.localeCompare(a.criado_em) : b.criado_em.localeCompare(a.criado_em)))
  }, [pautas, aba, tema, dataFiltro, ordem])
  const temasUsados = TEMAS.filter((t) => (pautas ?? []).some((p) => p.tema === t))

  if (!cliente) return <div className="corpo"><h2>Acervo de Pauta</h2><p className="texto-2">Crie um cliente primeiro.</p></div>

  async function guardarRapida() {
    const t = rapida.trim(); if (!t || !cliente) return
    setRapida('')
    try {
      const nova = await criarPauta(cliente.id, eu, { titulo: t, data_ref: dataFiltro, tema })
      setPautas((ps) => [nova, ...(ps ?? [])]); setAba('ideias')
    } catch (e) { setErro((e as Error).message) }
  }
  async function alternarVoto(p: Pauta) {
    const dar = !p.votos.includes(eu)
    setPautas((ps) => ps?.map((x) => (x.id === p.id ? { ...x, votos: dar ? [...x.votos, eu] : x.votos.filter((v) => v !== eu) } : x)) ?? null)
    try { await votar(p, eu, dar) } catch (e) { setErro((e as Error).message); void carregar() }
  }
  async function levarAoKanban(p: Pauta) {
    if (!cliente) return
    try { const id = await virarCard(p, cliente.id, calendario.porChave(p.data_ref)); comemorar(); navegar(`/kanban?card=${id}`) }
    catch (e) { setErro((e as Error).message) }
  }

  return (
    <div className="corpo">
      <div className="linha" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ maxWidth: 640 }}><h2>Acervo de Pauta</h2><p className="pequeno">Toda ideia de post fica guardada aqui. A equipe vota nas melhores e, na hora de produzir, a ideia vira card no Kanban.</p></div>
        <Botao icone={<Plus size={16} />} onClick={() => setAbrir('nova')}>Nova ideia</Botao>
      </div>

      <form className="pauta-rapida" onSubmit={(e) => { e.preventDefault(); void guardarRapida() }}>
        <Lightbulb size={20} aria-hidden />
        <input value={rapida} onChange={(e) => setRapida(e.target.value)} placeholder="Teve uma ideia? Escreva e aperte Enter para guardar" aria-label="Nova ideia rápida" />
        {rapida.trim() && <button type="submit" className="botao botao--primario botao--mini">Guardar</button>}
      </form>

      <div className="datas-saude__topo">
        <span className="rotulo">Próximas datas e campanhas</span>
        <button type="button" className="contas-redes__info" onClick={() => setEditarCampanha('nova')}><CalendarPlus size={15} /> Criar campanha ou data</button>
      </div>
      <section className="datas-saude" aria-label="Próximas datas e campanhas">
        {datas.map((d) => {
          const n = abertas.filter((p) => p.data_ref === d.chave).length
          const falta = Math.ceil((d.inicio.getTime() - agora) / DIA)
          const agoraMesmo = falta <= 0
          const marcado = dataFiltro === d.chave
          return (
            <div key={d.chave} className="data-saude-caixa">
              <button type="button" className={`data-saude data-saude--${d.origem}${marcado ? ' marcada' : ''}`} style={{ '--cor': d.cor } as React.CSSProperties}
                aria-pressed={marcado} onClick={() => setDataFiltro(marcado ? null : d.chave)}>
                <span className="data-saude__quando">{agoraMesmo ? 'Acontecendo agora' : falta === 1 ? 'Amanhã' : `Em ${falta} dias`}</span>
                <strong>{d.nome}</strong>
                <span className="data-saude__desc">{d.descricao}</span>
                <span className={`data-saude__ideias${n === 0 && falta <= 30 ? ' data-saude__ideias--alerta' : ''}`}>{n ? `${n} ${n === 1 ? 'ideia' : 'ideias'}` : 'Nenhuma ideia ainda'}</span>
              </button>
              {d.origem === 'propria' && (
                <button type="button" className="data-saude__editar" aria-label={`Editar ${d.nome}`} onClick={() => setEditarCampanha(proprias.find((c) => c.id === d.id) ?? null)}><Pencil size={12} /></button>
              )}
            </div>
          )
        })}
        <button type="button" className="data-saude data-saude--nova" onClick={() => setEditarCampanha('nova')}>
          <CalendarPlus size={22} />
          <strong>Nova campanha</strong>
          <span className="data-saude__desc">Faltou alguma data? Crie aqui</span>
        </button>
      </section>

      <div className="linha pauta-filtros">
        <div className="segmentos" role="radiogroup" aria-label="Ver">
          {([['ideias', 'Ideias'], ['repetir', 'Para repetir'], ['usadas', 'Usadas'], ['arquivadas', 'Arquivadas']] as [Aba, string][]).map(([v, r]) => (
            <button key={v} type="button" role="radio" aria-checked={aba === v} className={aba === v ? 'marcado' : ''} onClick={() => setAba(v)}>{r} <span>{contagem[v]}</span></button>
          ))}
        </div>
        {aba === 'ideias' && (
          <div className="segmentos" role="radiogroup" aria-label="Ordenar">
            <button type="button" role="radio" aria-checked={ordem === 'votos'} className={ordem === 'votos' ? 'marcado' : ''} onClick={() => setOrdem('votos')}>Mais votadas</button>
            <button type="button" role="radio" aria-checked={ordem === 'recentes'} className={ordem === 'recentes' ? 'marcado' : ''} onClick={() => setOrdem('recentes')}>Recentes</button>
          </div>
        )}
      </div>
      {(temasUsados.length > 0 || dataFiltro) && (
        <div className="pauta-temas">
          {dataFiltro && <button type="button" className="chip" onClick={() => setDataFiltro(null)}><CalendarHeart size={13} /> {calendario.porChave(dataFiltro)?.nome} <X size={12} /></button>}
          {temasUsados.map((t) => <button key={t} type="button" className={`chip${tema === t ? '' : ' chip--neutro'}`} aria-pressed={tema === t} onClick={() => setTema(tema === t ? null : t)}>{t}</button>)}
        </div>
      )}
      {erro && <p className="importar__erro">{erro}</p>}

      {pautas === null ? <p className="pequeno">Carregando…</p> : lista.length === 0 ? (
        <div className="vazio-grande"><Lightbulb size={34} />
          <h3>{aba === 'ideias' ? (dataFiltro || tema ? 'Nenhuma ideia com esse filtro' : 'Nenhuma ideia guardada ainda') : aba === 'repetir' ? 'Nada para repetir ainda' : aba === 'usadas' ? 'Nenhuma ideia usada ainda' : 'Nada arquivado'}</h3>
          <p className="texto-2">{aba === 'repetir' ? 'Marque "Dá para repetir" nas ideias que funcionam todo ano, como campanhas de datas da saúde.' : 'Escreva a ideia no campo acima e aperte Enter. Detalhes podem vir depois.'}</p>
        </div>
      ) : (
        <ul className="pautas">
          {lista.map((p) => {
            const data = calendario.porChave(p.data_ref)
            const autor = pessoas.find((x) => x.usuario_id === p.criado_por)
            const votei = p.votos.includes(eu)
            return (
              <li key={p.id} className="pauta">
                <button type="button" className="pauta__abrir" onClick={() => setAbrir(p)} aria-label={`Abrir ${p.titulo}`} />
                <div className="pauta__topo">
                  {p.tipo_conteudo && <span className="etiqueta" style={{ '--cor': COR_TIPO[p.tipo_conteudo] ?? '#667085' } as React.CSSProperties}>{iconeTipo(p.tipo_conteudo, 11)} {p.tipo_conteudo}</span>}
                  {data && <span className="pauta__data" style={{ '--cor': data.cor } as React.CSSProperties}><CalendarHeart size={12} /> {data.nome}</span>}
                  {p.reutilizavel && <span className="pauta__repetir" title="Dá para repetir"><Repeat size={12} /></span>}
                </div>
                <strong className="pauta__titulo">{p.titulo}</strong>
                {p.descricao && <p className="pauta__desc">{p.descricao}</p>}
                <div className="pauta__meta">
                  {p.tema && <span>{p.tema}</span>}
                  {p.referencias.length > 0 && <span><Link2 size={12} /> {p.referencias.length}</span>}
                </div>
                <div className="pauta__rodape">
                  {autor ? <FotoPessoa pessoa={autor} tamanho={22} /> : null}
                  <span className="pequeno">{p.situacao === 'usada' || (aba === 'repetir' && p.usada_em) ? `Usada ${tempoAtras(p.usada_em!, agora)}` : tempoAtras(p.criado_em, agora)}</span>
                  <span style={{ flex: 1 }} />
                  <button type="button" className={`pauta__voto${votei ? ' votei' : ''}`} aria-pressed={votei} onClick={() => void alternarVoto(p)} title={votei ? 'Tirar meu voto' : 'Votar nesta ideia'}>
                    <ThumbsUp size={14} /> {p.votos.length}
                  </button>
                  {p.situacao === 'usada' && p.card_id
                    ? <Link className="botao botao--fantasma botao--mini" to={`/kanban?card=${p.card_id}`}>Ver card</Link>
                    : p.situacao !== 'arquivada' && <button type="button" className="botao botao--secundario botao--mini" onClick={() => void levarAoKanban(p)}>{aba === 'repetir' ? 'Repetir' : 'Virar card'} <ArrowRight size={13} /></button>}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {editarCampanha && (
        <CampanhaModal campanha={editarCampanha === 'nova' ? null : editarCampanha} onFechar={() => setEditarCampanha(null)}
          onSalvar={async (c) => { await salvarCampanhaPauta(cliente.id, editarCampanha === 'nova' ? null : editarCampanha.id, c); setEditarCampanha(null); await carregar() }}
          onExcluir={editarCampanha !== 'nova' && (editarCampanha.criado_por === eu || ehAdminCliente)
            ? async () => { await excluirCampanhaPauta(editarCampanha.id); if (dataFiltro === `campanha:${editarCampanha.id}`) setDataFiltro(null); setEditarCampanha(null); await carregar() } : undefined} />
      )}
      {abrir && (
        <FichaPauta datas={calendario.todas} pauta={abrir === 'nova' ? null : abrir} podeExcluir={abrir !== 'nova' && (abrir.criado_por === eu || ehAdminCliente)} padrao={{ data_ref: dataFiltro, tema }}
          onFechar={() => setAbrir(null)}
          onSalvar={async (e) => {
            if (abrir === 'nova') { const nova = await criarPauta(cliente.id, eu, { ...e, titulo: e.titulo ?? '' }); setPautas((ps) => [nova, ...(ps ?? [])]) }
            else { await salvarPauta(abrir.id, e); setPautas((ps) => ps?.map((x) => (x.id === abrir.id ? { ...x, ...e } : x)) ?? null) }
            setAbrir(null)
          }}
          onExcluir={async () => { if (abrir === 'nova') return; await excluirPauta(abrir.id); setPautas((ps) => ps?.filter((x) => x.id !== abrir.id) ?? null); setAbrir(null) }}
          onVirarCard={abrir !== 'nova' && abrir.situacao !== 'arquivada' && !(abrir.situacao === 'usada') ? () => void levarAoKanban(abrir) : undefined} />
      )}
    </div>
  )
}

function FichaPauta({ datas, pauta, padrao, podeExcluir, onFechar, onSalvar, onExcluir, onVirarCard }: {
  datas: Calendario['todas']; pauta: Pauta | null; padrao: { data_ref: string | null; tema: string | null }; podeExcluir: boolean
  onFechar: () => void; onSalvar: (e: EdicaoPauta) => Promise<void>; onExcluir: () => Promise<void>; onVirarCard?: () => void
}) {
  const [titulo, setTitulo] = useState(pauta?.titulo ?? '')
  const [descricao, setDescricao] = useState(pauta?.descricao ?? '')
  const [tipo, setTipo] = useState(pauta?.tipo_conteudo ?? '')
  const [tema, setTema] = useState(pauta?.tema ?? padrao.tema ?? '')
  const [dataRef, setDataRef] = useState(pauta?.data_ref ?? padrao.data_ref ?? '')
  const [refs, setRefs] = useState<Referencia[]>(pauta?.referencias ?? [])
  const [novoLink, setNovoLink] = useState('')
  const [reutilizavel, setReutilizavel] = useState(pauta?.reutilizavel ?? false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)

  function addLink() {
    let url = novoLink.trim(); if (!url) return
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`
    let nome = url
    try { nome = new URL(url).hostname.replace(/^www\./, '') } catch { /* fica a url */ }
    setRefs([...refs, { id: crypto.randomUUID(), nome, url }]); setNovoLink('')
  }
  async function salvar() {
    if (!titulo.trim()) { setErro('Dê um título para a ideia.'); return }
    setSalvando(true); setErro(null)
    try {
      await onSalvar({ titulo: titulo.trim(), descricao: descricao.trim() || null, tipo_conteudo: tipo || null, tema: tema || null, data_ref: dataRef || null, referencias: refs, reutilizavel })
    } catch (e) { setErro((e as Error).message); setSalvando(false) }
  }
  const arquivar = async () => { if (pauta) { setSalvando(true); await onSalvar({ situacao: pauta.situacao === 'arquivada' ? 'ideia' : 'arquivada' }) } }

  return (
    <Janela titulo={pauta ? 'Ideia' : 'Nova ideia'} onFechar={onFechar} largura={600}>
      <form className="janela__corpo" onSubmit={(e) => { e.preventDefault(); void salvar() }}>
        <div className="campo"><label htmlFor="pa-titulo">Ideia</label>
          <input id="pa-titulo" className="entrada" autoFocus={!pauta} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: 5 mitos sobre a vacina da gripe" /></div>
        <div className="campo"><label htmlFor="pa-desc">Como seria (opcional)</label>
          <textarea id="pa-desc" className="entrada" rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Formato, abordagem, quem aparece, o que mostrar…" /></div>
        <div className="grade-2">
          <div className="campo"><label htmlFor="pa-tipo">Formato</label><Selecao id="pa-tipo" valor={tipo} onMudar={setTipo} opcoes={opcoesTipoConteudo(TIPOS)} /></div>
          <div className="campo"><label htmlFor="pa-tema">Tema</label>
            <Selecao id="pa-tema" valor={tema} onMudar={setTema} opcoes={[{ valor: '', rotulo: 'Sem tema' }, ...TEMAS.map((t) => ({ valor: t, rotulo: t }))]} /></div>
        </div>
        <div className="campo"><label htmlFor="pa-data">Campanha ou data (opcional)</label>
          <Selecao id="pa-data" valor={dataRef} onMudar={setDataRef} busca
            opcoes={[{ valor: '', rotulo: 'Nenhuma' }, ...datas.map((d) => ({ valor: d.chave, rotulo: d.nome, descricao: d.descricao, cor: d.cor }))]} /></div>
        <div className="campo">
          <span className="rotulo-campo">Referências</span>
          {refs.length > 0 && (
            <ul className="pauta-refs">{refs.map((r) => (
              <li key={r.id}><a href={r.url} target="_blank" rel="noreferrer"><ExternalLink size={13} /> {r.nome}</a>
                <button type="button" className="icone-botao" style={{ width: 26, height: 26, border: 0 }} aria-label={`Tirar ${r.nome}`} onClick={() => setRefs(refs.filter((x) => x.id !== r.id))}><X size={13} /></button></li>
            ))}</ul>
          )}
          <div className="linha" style={{ gap: 6, flexWrap: 'nowrap' }}>
            <input className="entrada" value={novoLink} onChange={(e) => setNovoLink(e.target.value)} placeholder="Cole um link (post, vídeo, Pinterest, Drive…)" aria-label="Link de referência"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink() } }} />
            <Botao type="button" variante="secundario" onClick={addLink}>Adicionar</Botao>
          </div>
        </div>
        <label className="pauta-repetir-opcao">
          <input type="checkbox" checked={reutilizavel} onChange={(e) => setReutilizavel(e.target.checked)} />
          <span><strong>Dá para repetir</strong><small>Campanhas e datas que voltam todo ano. Depois de usada, a ideia fica em "Para repetir".</small></span>
        </label>
        {erro && <p className="importar__erro">{erro}</p>}
        <div className="linha" style={{ justifyContent: 'space-between' }}>
          <div className="linha" style={{ gap: 4 }}>
            {pauta && <Botao type="button" variante="fantasma" icone={pauta.situacao === 'arquivada' ? <ArchiveRestore size={15} /> : <Archive size={15} />} disabled={salvando} onClick={() => void arquivar()}>{pauta.situacao === 'arquivada' ? 'Restaurar' : 'Arquivar'}</Botao>}
            {pauta && podeExcluir && (confirmar
              ? <Botao type="button" variante="fantasma" className="texto-perigo" onClick={() => void onExcluir()}>Confirmar exclusão</Botao>
              : <Botao type="button" variante="fantasma" icone={<Trash2 size={15} />} onClick={() => setConfirmar(true)}>Excluir</Botao>)}
          </div>
          <div className="linha" style={{ gap: 8 }}>
            {onVirarCard && <Botao type="button" variante="secundario" onClick={onVirarCard}>Virar card <ArrowRight size={14} /></Botao>}
            <Botao type="submit" disabled={salvando}>{salvando ? 'Salvando…' : pauta ? 'Salvar' : 'Guardar ideia'}</Botao>
          </div>
        </div>
      </form>
    </Janela>
  )
}

const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

/** Campanha ou data própria do cliente (ex.: aniversário do hospital, semana da enfermagem do hospital). */
function CampanhaModal({ campanha, onFechar, onSalvar, onExcluir }: { campanha: CampanhaPropria | null; onFechar: () => void; onSalvar: (c: EdicaoCampanha) => Promise<void>; onExcluir?: () => Promise<void> }) {
  const [nome, setNome] = useState(campanha?.nome ?? '')
  const [descricao, setDescricao] = useState(campanha?.descricao ?? '')
  const [inicio, setInicio] = useState(campanha?.inicio ?? hojeIso)
  const [fim, setFim] = useState(campanha?.fim ?? campanha?.inicio ?? hojeIso)
  const [cor, setCor] = useState(campanha?.cor ?? CORES_CAMPANHA[0])
  const [anual, setAnual] = useState(campanha?.anual ?? false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  async function salvar() {
    if (!nome.trim()) { setErro('Dê um nome para a campanha.'); return }
    if (fim < inicio) { setErro('O fim não pode ser antes do começo.'); return }
    setSalvando(true); setErro(null)
    try { await onSalvar({ nome: nome.trim(), descricao: descricao.trim() || null, inicio, fim, cor, anual }) } catch (e) { setErro((e as Error).message); setSalvando(false) }
  }
  return (
    <Janela titulo={campanha ? 'Campanha' : 'Nova campanha'} onFechar={onFechar}>
      <form className="janela__corpo" onSubmit={(e) => { e.preventDefault(); void salvar() }}>
        <div className="campo"><label htmlFor="cp-nome">Nome</label>
          <input id="cp-nome" className="entrada" autoFocus={!campanha} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Semana da Prematuridade, Aniversário do hospital" /></div>
        <div className="campo"><label htmlFor="cp-desc">Sobre (opcional)</label>
          <input id="cp-desc" className="entrada" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Campanha com a maternidade" /></div>
        <div className="grade-2">
          <div className="campo"><label htmlFor="cp-ini">Começa</label><input id="cp-ini" type="date" className="entrada" value={inicio} onChange={(e) => { setInicio(e.target.value); if (fim < e.target.value) setFim(e.target.value) }} /></div>
          <div className="campo"><label htmlFor="cp-fim">Termina</label><input id="cp-fim" type="date" className="entrada" min={inicio} value={fim} onChange={(e) => setFim(e.target.value)} /></div>
        </div>
        <div className="campo"><span className="rotulo-campo">Cor</span>
          <div className="cores-campanha" role="radiogroup" aria-label="Cor">
            {CORES_CAMPANHA.map((c) => <button key={c} type="button" role="radio" aria-checked={cor === c} aria-label={c} className={cor === c ? 'marcada' : ''} style={{ background: c }} onClick={() => setCor(c)} />)}
          </div>
        </div>
        <label className="pauta-repetir-opcao">
          <input type="checkbox" checked={anual} onChange={(e) => setAnual(e.target.checked)} />
          <span><strong>Repete todo ano</strong><small>Depois que passar, volta a aparecer nas próximas datas no ano seguinte.</small></span>
        </label>
        {erro && <p className="importar__erro">{erro}</p>}
        <div className="linha" style={{ justifyContent: 'space-between' }}>
          <div>{onExcluir && (confirmar
            ? <Botao type="button" variante="fantasma" className="texto-perigo" onClick={() => void onExcluir()}>Confirmar exclusão</Botao>
            : <Botao type="button" variante="fantasma" icone={<Trash2 size={15} />} onClick={() => setConfirmar(true)}>Excluir</Botao>)}</div>
          <div className="linha" style={{ gap: 8 }}>
            <Botao type="button" variante="fantasma" onClick={onFechar}>Cancelar</Botao>
            <Botao type="submit" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
          </div>
        </div>
      </form>
    </Janela>
  )
}
