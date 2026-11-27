import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CalendarPlus, Check, CheckCircle2, Clock, FileText, Lock, MapPin, Paperclip, Pencil, Plus, Repeat, Search, Trash2, Upload, Users, X, XCircle,
} from 'lucide-react'
import { Botao } from '../components/ui'
import { Janela } from '../components/Janela'
import { Selecao } from '../components/Selecao'
import { comemorar } from '../lib/comemorar'
import { useSessao } from '../lib/sessao'
import { supabase } from '../lib/supabase'
import { listarPessoas, type Pessoa } from '../lib/kanban'
import {
  RECORRENCIAS, abrirAnexo, apagarAnexo, baixarIcs, concluirReuniao, enviarAnexo, excluirReuniao, fimDe, listarReunioes, marcarEncaminhamento, salvarReuniao,
  type Encaminhamento, type EdicaoReuniao, type Recorrencia, type Reuniao,
} from '../lib/reunioes'
import { EscolherResponsaveis, FotoPessoa, Responsaveis } from './kanban/Pessoas'
import './kanban.css'
import './reunioes.css'

const hora = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const diaLongo = (d: Date) => { const t = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }); return t.charAt(0).toUpperCase() + t.slice(1) }
const paraInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
const tamanho = (b: number) => (b > 1_048_576 ? `${(b / 1_048_576).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)
function quando(r: Reuniao, agora: number) {
  const d = new Date(r.inicio); const dias = Math.round((new Date(d.toDateString()).getTime() - new Date(new Date(agora).toDateString()).getTime()) / 86_400_000)
  if (r.situacao === 'agendada' && agora >= d.getTime() && agora <= fimDe(r).getTime()) return 'Acontecendo agora'
  return dias === 0 ? 'Hoje' : dias === 1 ? 'Amanhã' : dias === -1 ? 'Ontem' : dias > 1 && dias < 7 ? d.toLocaleDateString('pt-BR', { weekday: 'long' }) : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
}

/** Reuniões (Organização): agendar, montar a pauta antes, anotar durante, sair com encaminhamentos e anexos. */
export function Reunioes() {
  const { cliente, usuario, ehAdminCliente } = useSessao()
  const eu = supabase ? usuario.id : 'p1'
  const [params, setParams] = useSearchParams()
  const [reunioes, setReunioes] = useState<Reuniao[] | null>(null)
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [aba, setAba] = useState<'proximas' | 'anteriores'>('proximas')
  const [busca, setBusca] = useState('')
  const [editar, setEditar] = useState<Reuniao | 'nova' | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [agora] = useState(() => Date.now())
  const selecionada = params.get('r')

  const carregar = useCallback(async () => {
    if (!cliente) return
    try { const [r, p] = await Promise.all([listarReunioes(cliente.id), listarPessoas(cliente.id).catch(() => [])]); setReunioes(r); setPessoas(p) }
    catch (e) { setErro((e as Error).message) }
  }, [cliente])
  useEffect(() => { void Promise.resolve().then(carregar) }, [carregar])

  const termo = busca.trim().toLowerCase()
  const lista = useMemo(() => (reunioes ?? []).filter((r) => {
    const passada = r.situacao !== 'agendada' || fimDe(r).getTime() < agora - 3 * 3_600_000
    if (termo) return [r.titulo, r.descricao, r.local, r.ata, r.convidados, ...r.pauta.map((p) => p.texto)].some((x) => x?.toLowerCase().includes(termo))
    return aba === 'proximas' ? !passada : passada
  }).sort((a, b) => (aba === 'proximas' && !termo ? a.inicio.localeCompare(b.inicio) : b.inicio.localeCompare(a.inicio))), [reunioes, aba, termo, agora])
  const aberta = (reunioes ?? []).find((r) => r.id === selecionada) ?? (selecionada ? null : lista[0] ?? null)
  const abrir = (id: string) => setParams({ r: id }, { replace: true })

  if (!cliente) return <div className="corpo"><h2>Reuniões</h2><p className="texto-2">Crie um cliente primeiro.</p></div>

  async function atualizar(r: Reuniao, d: EdicaoReuniao) {
    setReunioes((l) => l?.map((x) => (x.id === r.id ? { ...x, ...d } : x)) ?? null)
    try { await salvarReuniao(r.cliente_id, r.id, d) } catch (e) { setErro((e as Error).message); void carregar() }
  }

  return (
    <div className="corpo reunioes">
      <div className="linha" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div><h2>Reuniões</h2><p className="pequeno">Agende, monte a pauta antes, anote durante e saia com cada encaminhamento no nome de alguém.</p></div>
        <Botao icone={<Plus size={16} />} onClick={() => setEditar('nova')}>Nova reunião</Botao>
      </div>
      {erro && <p className="importar__erro">{erro}</p>}
      {aviso && <p className="faixa-dica" role="status"><CheckCircle2 size={15} /> {aviso}</p>}

      <div className="reunioes__corpo">
        <aside className="reunioes__lista">
          <label className="reunioes__busca"><Search size={15} aria-hidden /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar em pautas e anotações" aria-label="Buscar reuniões" /></label>
          {!termo && (
            <div className="segmentos" role="radiogroup" aria-label="Ver">
              <button type="button" role="radio" aria-checked={aba === 'proximas'} className={aba === 'proximas' ? 'marcado' : ''} onClick={() => setAba('proximas')}>Próximas</button>
              <button type="button" role="radio" aria-checked={aba === 'anteriores'} className={aba === 'anteriores' ? 'marcado' : ''} onClick={() => setAba('anteriores')}>Anteriores</button>
            </div>
          )}
          {reunioes === null ? <p className="pequeno">Carregando…</p> : lista.length === 0 ? (
            <div className="reunioes__vazio"><Users size={26} /><span>{termo ? 'Nada encontrado.' : aba === 'proximas' ? 'Nenhuma reunião agendada.' : 'Nenhuma reunião anterior.'}</span></div>
          ) : (
            <ul>
              {lista.map((r) => {
                const d = new Date(r.inicio)
                const q = quando(r, agora)
                return (
                  <li key={r.id}>
                    <button type="button" className={`reuniao-item${aberta?.id === r.id ? ' ativa' : ''}${r.situacao === 'cancelada' ? ' cancelada' : ''}`} onClick={() => abrir(r.id)}>
                      <span className="reuniao-item__data"><b>{d.getDate()}</b><small>{d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</small></span>
                      <span className="reuniao-item__texto">
                        <strong>{r.restrita && <Lock size={12} />} {r.titulo}</strong>
                        <small className={q === 'Acontecendo agora' ? 'agora' : ''}>{q} · {hora(d)}–{hora(fimDe(r))}{r.situacao === 'cancelada' ? ' · cancelada' : r.situacao === 'realizada' ? ' · realizada' : ''}</small>
                        <span className="reuniao-item__meta">
                          <Responsaveis ids={r.participantes} pessoas={pessoas} max={4} tamanho={20} />
                          {r.pauta.length > 0 && <span><FileText size={11} /> {r.pauta.length}</span>}
                          {r.anexos.length > 0 && <span><Paperclip size={11} /> {r.anexos.length}</span>}
                          {r.recorrencia !== 'nenhuma' && <span><Repeat size={11} /></span>}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>

        {aberta ? (
          <DetalheReuniao key={aberta.id} r={aberta} pessoas={pessoas} eu={eu} podeApagar={aberta.criado_por === eu || ehAdminCliente} nomeCliente={cliente.nome} agora={agora}
            onAtualizar={(d) => atualizar(aberta, d)} onEditar={() => setEditar(aberta)}
            onConcluir={async () => {
              const prox = await concluirReuniao(aberta); comemorar(); await carregar()
              setAviso(prox ? `Reunião marcada como realizada. A próxima já ficou agendada para ${diaLongo(new Date(prox.inicio)).toLowerCase()}, com os pontos que não foram discutidos.` : 'Reunião marcada como realizada.')
              if (prox) abrir(prox.id)
            }}
            onExcluir={async () => { await excluirReuniao(aberta); setParams({}, { replace: true }); await carregar() }} />
        ) : (
          <section className="reuniao reuniao--vazia"><CalendarPlus size={34} /><h3>Nenhuma reunião aberta</h3><p className="texto-2">Escolha uma reunião na lista ou agende uma nova.</p></section>
        )}
      </div>

      {editar && <ReuniaoJanela reuniao={editar === 'nova' ? null : editar} pessoas={pessoas} eu={eu} onFechar={() => setEditar(null)}
        onSalvar={async (d) => { const r = await salvarReuniao(cliente.id, editar === 'nova' ? null : editar.id, d); setEditar(null); await carregar(); abrir(r.id); setAba('proximas') }} />}
    </div>
  )
}

function DetalheReuniao({ r, pessoas, eu, podeApagar, nomeCliente, agora, onAtualizar, onEditar, onConcluir, onExcluir }: {
  r: Reuniao; pessoas: Pessoa[]; eu: string; podeApagar: boolean; nomeCliente: string; agora: number
  onAtualizar: (d: EdicaoReuniao) => Promise<void>; onEditar: () => void; onConcluir: () => Promise<void>; onExcluir: () => Promise<void>
}) {
  const d = new Date(r.inicio)
  const [novoPonto, setNovoPonto] = useState('')
  const [ata, setAta] = useState(r.ata ?? '')
  const [salvo, setSalvo] = useState(false)
  const [novoEnc, setNovoEnc] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nome = (id: string | null) => pessoas.find((p) => p.usuario_id === id)?.nome.split(' ')[0] ?? ''
  const agendada = r.situacao === 'agendada'
  const comecou = agora >= d.getTime() - 15 * 60_000

  function mudarAta(v: string) {
    setAta(v); setSalvo(false)
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => { void onAtualizar({ ata: v.trim() ? v : null }).then(() => { setSalvo(true); setTimeout(() => setSalvo(false), 1500) }) }, 800)
  }
  useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current) }, [])
  const addPonto = () => { const t = novoPonto.trim(); if (!t) return; setNovoPonto(''); void onAtualizar({ pauta: [...r.pauta, { id: crypto.randomUUID(), texto: t, autor: eu, discutido: false }] }) }
  const addEnc = () => { const t = novoEnc.trim(); if (!t) return; setNovoEnc(''); void onAtualizar({ encaminhamentos: [...r.encaminhamentos, { id: crypto.randomUUID(), texto: t, responsavel: null, prazo: null, feito: false }] }) }
  const mudarEnc = (e: Encaminhamento, m: Partial<Encaminhamento>) => void onAtualizar({ encaminhamentos: r.encaminhamentos.map((x) => (x.id === e.id ? { ...x, ...m } : x)) })

  async function anexar(arquivos: FileList | null) {
    if (!arquivos?.length) return
    setEnviando(true); setErro(null)
    const novos = []
    for (const f of Array.from(arquivos)) { try { novos.push(await enviarAnexo(r, f)) } catch (e) { setErro((e as Error).message) } }
    if (novos.length) await onAtualizar({ anexos: [...r.anexos, ...novos] })
    setEnviando(false)
  }

  return (
    <section className={`reuniao reuniao--${r.situacao}`}>
      <header className="reuniao__topo">
        <div className="reuniao__titulo">
          <span className="reuniao__quando">{diaLongo(d)} · {hora(d)}–{hora(fimDe(r))}</span>
          <h3>{r.restrita && <Lock size={16} aria-label="Restrita" />} {r.titulo}</h3>
          <div className="reuniao__info">
            {r.local && <span><MapPin size={13} /> {r.local}</span>}
            {r.recorrencia !== 'nenhuma' && <span><Repeat size={13} /> {RECORRENCIAS.find((x) => x.valor === r.recorrencia)?.rotulo}</span>}
            {r.situacao === 'realizada' && <span className="chip chip--sucesso"><Check size={12} /> Realizada</span>}
            {r.situacao === 'cancelada' && <span className="chip chip--perigo">Cancelada</span>}
            {r.restrita && <span className="chip chip--neutro"><Lock size={11} /> Só participantes</span>}
          </div>
        </div>
        <div className="reuniao__acoes">
          {agendada && comecou && <Botao icone={<CheckCircle2 size={15} />} onClick={() => void onConcluir()}>Marcar como realizada</Botao>}
          <Botao variante="secundario" icone={<CalendarPlus size={15} />} onClick={() => baixarIcs(r, nomeCliente)} title="Baixa um arquivo que abre na agenda do celular ou do computador">Pôr na minha agenda</Botao>
          <Botao variante="fantasma" icone={<Pencil size={15} />} onClick={onEditar}>Editar</Botao>
        </div>
      </header>
      {r.descricao && <p className="reuniao__objetivo">{r.descricao}</p>}

      <div className="reuniao__participantes">
        <Users size={15} />
        {r.participantes.map((id) => { const p = pessoas.find((x) => x.usuario_id === id); return p ? <span key={id} className="reuniao__pessoa"><FotoPessoa pessoa={p} tamanho={22} /> {p.nome.split(' ')[0]}</span> : null })}
        {r.convidados && <span className="pequeno">+ {r.convidados}</span>}
        {!r.participantes.length && !r.convidados && <span className="pequeno">Sem participantes definidos</span>}
      </div>

      <div className="reuniao__grade">
        <section className="reuniao__bloco">
          <h4>Pauta <span>{r.pauta.filter((p) => p.discutido).length}/{r.pauta.length}</span></h4>
          {r.pauta.length === 0 && <p className="pequeno">Ninguém colocou nada na pauta ainda.</p>}
          <ul className="pauta-reuniao">
            {r.pauta.map((p, i) => (
              <li key={p.id} className={p.discutido ? 'feito' : ''}>
                <button type="button" className="pauta-reuniao__check" aria-pressed={p.discutido} aria-label={p.discutido ? 'Desmarcar' : 'Marcar como discutido'}
                  onClick={() => void onAtualizar({ pauta: r.pauta.map((x) => (x.id === p.id ? { ...x, discutido: !x.discutido } : x)) })}>{p.discutido ? <Check size={13} /> : i + 1}</button>
                <span className="pauta-reuniao__texto">{p.texto}{p.autor && <small> · {nome(p.autor)}</small>}</span>
                {(p.autor === eu || podeApagar) && <button type="button" className="icone-botao" style={{ width: 26, height: 26, border: 0 }} aria-label="Tirar da pauta" onClick={() => void onAtualizar({ pauta: r.pauta.filter((x) => x.id !== p.id) })}><X size={13} /></button>}
              </li>
            ))}
          </ul>
          <form className="reuniao__adicionar" onSubmit={(e) => { e.preventDefault(); addPonto() }}>
            <Plus size={15} /><input value={novoPonto} onChange={(e) => setNovoPonto(e.target.value)} placeholder="Adicionar um assunto à pauta" aria-label="Novo ponto de pauta" />
          </form>
        </section>

        <section className="reuniao__bloco">
          <h4>Anotações {salvo && <span className="reuniao__salvo"><Check size={12} /> Salvo</span>}</h4>
          <textarea className="entrada reuniao__ata" value={ata} onChange={(e) => mudarAta(e.target.value)} rows={8}
            placeholder={agendada ? 'O que for decidido na reunião, anote aqui. Salva sozinho.' : 'Sem anotações.'} aria-label="Anotações da reunião" />
        </section>

        <section className="reuniao__bloco">
          <h4>Encaminhamentos <span>{r.encaminhamentos.filter((e) => e.feito).length}/{r.encaminhamentos.length}</span></h4>
          <p className="pequeno" style={{ margin: '-4px 0 4px' }}>Quem ficar responsável vê em Minhas tarefas.</p>
          <ul className="encaminhamentos">
            {r.encaminhamentos.map((e) => (
              <li key={e.id} className={e.feito ? 'feito' : ''}>
                <button type="button" className="pauta-reuniao__check" aria-pressed={e.feito} aria-label={e.feito ? 'Desmarcar' : 'Marcar como feito'}
                  onClick={() => void marcarEncaminhamento(r.id, e.id, !e.feito).then(() => mudarEnc(e, { feito: !e.feito }))}>{e.feito && <Check size={13} />}</button>
                <span className="encaminhamentos__texto">{e.texto}</span>
                <span className="encaminhamentos__meta">
                <Selecao mini rotulo="Responsável" valor={e.responsavel ?? ''} onMudar={(v) => mudarEnc(e, { responsavel: v || null })} largura="100%"
                  opcoes={[{ valor: '', rotulo: 'Sem responsável' }, ...pessoas.map((p) => ({ valor: p.usuario_id, rotulo: p.nome.split(' ')[0] }))]} />
                <input type="date" className="entrada entrada--mini" aria-label="Prazo" value={e.prazo ?? ''} onChange={(x) => mudarEnc(e, { prazo: x.target.value || null })} />
                <button type="button" className="icone-botao" style={{ width: 26, height: 26, border: 0 }} aria-label="Tirar encaminhamento" onClick={() => void onAtualizar({ encaminhamentos: r.encaminhamentos.filter((x) => x.id !== e.id) })}><X size={13} /></button>
                </span>
              </li>
            ))}
          </ul>
          <form className="reuniao__adicionar" onSubmit={(e) => { e.preventDefault(); addEnc() }}>
            <Plus size={15} /><input value={novoEnc} onChange={(e) => setNovoEnc(e.target.value)} placeholder="Ex.: Mandar o orçamento para a diretoria" aria-label="Novo encaminhamento" />
          </form>
        </section>

        <section className="reuniao__bloco">
          <h4>Anexos <span>{r.anexos.length}</span></h4>
          <ul className="anexos-reuniao">
            {r.anexos.map((a) => (
              <li key={a.id}>
                <button type="button" className="anexos-reuniao__abrir" onClick={() => void abrirAnexo(a)}><FileText size={16} /><span>{a.nome}<small>{tamanho(a.tamanho)}</small></span></button>
                <button type="button" className="icone-botao" style={{ width: 26, height: 26, border: 0 }} aria-label={`Apagar ${a.nome}`}
                  onClick={() => { if (confirm(`Apagar ${a.nome}?`)) void apagarAnexo(a).then(() => onAtualizar({ anexos: r.anexos.filter((x) => x.id !== a.id) })) }}><Trash2 size={13} /></button>
              </li>
            ))}
          </ul>
          <label className={`reuniao__soltar${enviando ? ' enviando' : ''}`}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void anexar(e.dataTransfer.files) }}>
            <Upload size={18} /> {enviando ? 'Enviando…' : 'Solte arquivos aqui ou clique (apresentação, planilha, PDF, fotos)'}
            <input type="file" multiple hidden onChange={(e) => { void anexar(e.target.files); e.target.value = '' }} />
          </label>
          {erro && <p className="importar__erro">{erro}</p>}
        </section>
      </div>

      <footer className="reuniao__rodape">
        {agendada && <Botao variante="fantasma" icone={<XCircle size={15} />} onClick={() => { if (confirm('Cancelar esta reunião?')) void onAtualizar({ situacao: 'cancelada' }) }}>Cancelar reunião</Botao>}
        {r.situacao === 'cancelada' && <Botao variante="fantasma" onClick={() => void onAtualizar({ situacao: 'agendada' })}>Reabrir</Botao>}
        {podeApagar && (confirmar
          ? <Botao variante="fantasma" className="texto-perigo" onClick={() => void onExcluir()}>Confirmar exclusão</Botao>
          : <Botao variante="fantasma" icone={<Trash2 size={15} />} onClick={() => setConfirmar(true)}>Excluir</Botao>)}
      </footer>
    </section>
  )
}

const DURACOES = [15, 30, 45, 60, 90, 120, 180]
function ReuniaoJanela({ reuniao, pessoas, eu, onFechar, onSalvar }: { reuniao: Reuniao | null; pessoas: Pessoa[]; eu: string; onFechar: () => void; onSalvar: (d: EdicaoReuniao) => Promise<void> }) {
  const [titulo, setTitulo] = useState(reuniao?.titulo ?? '')
  const [descricao, setDescricao] = useState(reuniao?.descricao ?? '')
  const [inicio, setInicio] = useState(() => {
    if (reuniao) return paraInput(new Date(reuniao.inicio))
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0); return paraInput(d)
  })
  const [duracao, setDuracao] = useState(String(reuniao?.duracao_min ?? 60))
  const [local, setLocal] = useState(reuniao?.local ?? '')
  const [participantes, setParticipantes] = useState<string[]>(reuniao?.participantes ?? [eu])
  const [convidados, setConvidados] = useState(reuniao?.convidados ?? '')
  const [restrita, setRestrita] = useState(reuniao?.restrita ?? false)
  const [recorrencia, setRecorrencia] = useState<Recorrencia>(reuniao?.recorrencia ?? 'nenhuma')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    if (!titulo.trim()) { setErro('Dê um nome para a reunião.'); return }
    if (!inicio) { setErro('Escolha o dia e o horário.'); return }
    setSalvando(true); setErro(null)
    try {
      await onSalvar({ titulo: titulo.trim(), descricao: descricao.trim() || null, inicio: new Date(inicio).toISOString(), duracao_min: Number(duracao), local: local.trim() || null,
        participantes, convidados: convidados.trim() || null, restrita, recorrencia })
    } catch (e) { setErro((e as Error).message); setSalvando(false) }
  }
  return (
    <Janela titulo={reuniao ? 'Editar reunião' : 'Nova reunião'} onFechar={onFechar} largura={600}>
      <form className="janela__corpo" onSubmit={(e) => { e.preventDefault(); void salvar() }}>
        <div className="campo"><label htmlFor="ru-titulo">Assunto</label><input id="ru-titulo" className="entrada" autoFocus={!reuniao} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Alinhamento semanal do marketing" /></div>
        <div className="grade-2">
          <div className="campo"><label htmlFor="ru-quando">Dia e horário</label><input id="ru-quando" type="datetime-local" className="entrada" value={inicio} onChange={(e) => setInicio(e.target.value)} /></div>
          <div className="campo"><label htmlFor="ru-dur">Duração</label>
            <Selecao id="ru-dur" valor={duracao} onMudar={setDuracao} opcoes={DURACOES.map((m) => ({ valor: String(m), rotulo: m < 60 ? `${m} min` : `${m / 60}h${m % 60 ? ` ${m % 60}min` : ''}`.replace('.5h', 'h30') }))} /></div>
          <div className="campo"><label htmlFor="ru-local">Onde</label><input id="ru-local" className="entrada" value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Sala, endereço ou link da chamada" /></div>
          <div className="campo"><label htmlFor="ru-rec">Repete</label><Selecao id="ru-rec" valor={recorrencia} onMudar={(v) => setRecorrencia(v as Recorrencia)} opcoes={RECORRENCIAS.map((r) => ({ valor: r.valor, rotulo: r.rotulo }))} /></div>
        </div>
        <div className="campo"><span className="rotulo-campo">Participantes da equipe</span>
          <div className="claro"><EscolherResponsaveis ids={participantes} pessoas={pessoas} onMudar={setParticipantes} /></div></div>
        <div className="campo"><label htmlFor="ru-conv">Pessoas de fora (opcional)</label><input id="ru-conv" className="entrada" value={convidados} onChange={(e) => setConvidados(e.target.value)} placeholder="Ex.: Dra. Paula (diretoria), fornecedor da gráfica" /></div>
        <div className="campo"><label htmlFor="ru-desc">Objetivo (opcional)</label><textarea id="ru-desc" className="entrada" rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="O que precisa sair decidido dessa reunião?" /></div>
        <label className="pauta-repetir-opcao">
          <input type="checkbox" checked={restrita} onChange={(e) => setRestrita(e.target.checked)} />
          <span><strong>Reunião restrita</strong><small>Só os participantes, quem criou e os administradores veem a pauta, as anotações e os anexos.</small></span>
        </label>
        {erro && <p className="importar__erro">{erro}</p>}
        <div className="linha" style={{ justifyContent: 'flex-end' }}><Botao type="button" variante="fantasma" onClick={onFechar}>Cancelar</Botao><Botao type="submit" disabled={salvando} icone={<Clock size={15} />}>{salvando ? 'Salvando…' : reuniao ? 'Salvar' : 'Agendar'}</Botao></div>
      </form>
    </Janela>
  )
}
