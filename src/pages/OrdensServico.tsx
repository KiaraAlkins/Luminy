import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertTriangle, Camera, Check, ClipboardList, ExternalLink, ImagePlus, Link2, MapPin, MessageSquare, Package, Phone, Plus, Search, Send, Trash2, X,
} from 'lucide-react'
import { Botao } from '../components/ui'
import { Janela } from '../components/Janela'
import { Selecao, type Opcao } from '../components/Selecao'
import { BotaoPlanilha } from '../components/Planilha'
import { OPCOES_PRIORIDADE } from '../components/opcoes'
import { grupoDe } from '../lib/datas'
import { useFoco } from '../lib/foco'
import { useSessao } from '../lib/sessao'
import { listarPessoas, type Pessoa, type Prioridade } from '../lib/kanban'
import { fmt, listarItens, movimentar, type Item } from '../lib/estoque'
import {
  MOTIVOS_AGUARDANDO, NOME_FOTO, SETORES_OS, SITUACOES_OS, TIPOS_OS, apagarFotoOS, criarOS, enviarFotoOS, eventosOS, excluirOS, linksFotosOS,
  listarOS, nomeSituacaoOS, registrarEventoOS, salvarOS, type EventoOS, type FotoOS, type NovaOS, type OS, type SituacaoOS, type TipoFoto,
} from '../lib/os'
import { FotoPessoa } from './kanban/Pessoas'
import './kanban.css'
import './os.css'

const hojeIso = () => new Date().toISOString().slice(0, 10)
const dataBr = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—')
const prazoDe = (o: OS) => (o.situacao === 'concluida' || o.situacao === 'cancelada' || !o.prazo ? null : grupoDe(`${o.prazo}T23:59:00`))
const quando = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 60) return `há ${Math.max(1, min)} min`; const h = Math.round(min / 60); if (h < 24) return `há ${h} h`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
const opcoesPessoas = (pessoas: Pessoa[], vazio: string): Opcao[] => [{ valor: '', rotulo: vazio }, ...pessoas.map((p) => ({ valor: p.usuario_id, rotulo: p.nome, icone: <FotoPessoa pessoa={p} tamanho={26} /> }))]
type Filtro = SituacaoOS | 'atrasadas' | 'ativas'

/** Ordens de serviço: os pedidos que chegam pelo Tasy, registrados à mão para o marketing acompanhar. */
export function OrdensServico() {
  const { cliente, ehAdminCliente } = useSessao()
  const [params, setParams] = useSearchParams()
  const [lista, setLista] = useState<OS[] | null>(null)
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [filtro, setFiltro] = useState<Filtro>('ativas')
  const [busca, setBusca] = useState('')
  const [setor, setSetor] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [nova, setNova] = useState(false)
  const abertaId = params.get('os')

  const carregar = useCallback(async () => { if (cliente) setLista(await listarOS(cliente.id)) }, [cliente])
  useEffect(() => { void Promise.resolve().then(carregar) }, [carregar])
  useEffect(() => { if (cliente) void listarPessoas(cliente.id).then(setPessoas) }, [cliente])

  const naSituacao = (o: OS, f: Filtro) => f === 'ativas' ? !['concluida', 'cancelada'].includes(o.situacao) : f === 'atrasadas' ? prazoDe(o) === 'atrasadas' : o.situacao === f
  const filtradas = useMemo(() => (lista ?? []).filter((o) => naSituacao(o, filtro) &&
    (!setor || o.setor === setor) && (!responsavel || (responsavel === 'ninguem' ? !o.responsavel_id : o.responsavel_id === responsavel)) &&
    (!busca || `${o.numero} ${o.titulo} ${o.solicitante ?? ''} ${o.setor ?? ''} ${o.local ?? ''}`.toLowerCase().includes(busca.toLowerCase())))
    .sort((a, b) => (prazoDe(a) === 'atrasadas' ? -1 : 0) - (prazoDe(b) === 'atrasadas' ? -1 : 0) || (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999')),
  [lista, filtro, setor, responsavel, busca])
  const conta = (f: Filtro) => (lista ?? []).filter((o) => naSituacao(o, f)).length
  const setores = [...new Set([...(lista ?? []).map((o) => o.setor).filter(Boolean) as string[]])].sort()
  const mudarParam = (v: string | null) => { const p = new URLSearchParams(params); if (v) p.set('os', v); else p.delete('os'); setParams(p, { replace: true }) }
  const pessoa = (id: string | null) => pessoas.find((p) => p.usuario_id === id)

  if (!cliente) return <div className="corpo"><h2>Ordens de serviço</h2><p className="texto-2">Crie um cliente primeiro.</p></div>
  const aberta = lista?.find((o) => o.id === abertaId) ?? null

  return (
    <div className="corpo">
      <div className="linha" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div><h2>Ordens de serviço</h2><p className="pequeno">Pedidos que chegam pelo Tasy, registrados para o marketing acompanhar até a entrega</p></div>
        <div className="linha" style={{ gap: 8 }}>
          <BotaoPlanilha nome="Ordens de serviço" exportar={() => ({
            colunas: ['Nº OS', 'Resumo', 'Situação', 'Solicitante', 'Contato', 'Setor', 'Local', 'Tipo', 'Pedido em', 'Prazo', 'Responsável', 'Fornecedor', 'Custo (R$)', 'Concluída em'],
            linhas: filtradas.map((o) => [o.numero, o.titulo, nomeSituacaoOS(o.situacao), o.solicitante, o.contato, o.setor, o.local, o.tipo, new Date(`${o.pedido_em}T12:00:00`), o.prazo ? new Date(`${o.prazo}T12:00:00`) : null, pessoa(o.responsavel_id)?.nome ?? null, o.fornecedor, o.custo, o.concluida_em ? new Date(o.concluida_em) : null]),
          })} />
          <Botao icone={<Plus size={16} />} onClick={() => setNova(true)}>Registrar OS</Botao>
        </div>
      </div>

      <div className="funil funil--os" role="group" aria-label="Filtrar por situação">
        {([['ativas', 'Em aberto', 'var(--marca)'], ['atrasadas', 'Atrasadas', 'var(--perigo)'], ...SITUACOES_OS.filter((s) => s.id !== 'aberta').map((s) => [s.id, s.nome, s.cor])] as [Filtro, string, string][]).map(([id, nome, cor]) => (
          <button key={id} type="button" className={`funil__etapa${filtro === id ? ' marcada' : ''}`} aria-pressed={filtro === id} style={{ '--cor': cor } as React.CSSProperties} onClick={() => setFiltro(id)}>
            <strong>{conta(id)}</strong><span>{nome}</span>
          </button>
        ))}
      </div>

      <div className="filtros">
        <label className="busca busca-local" style={{ width: 'auto' }}><Search size={16} aria-hidden />
          <input aria-label="Buscar OS" placeholder="Buscar por número, resumo, solicitante, setor ou local" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ border: 0, outline: 0, background: 'none', flex: 1 }} /></label>
        <Selecao rotulo="Setor" valor={setor} onMudar={setSetor} largura={200} opcoes={[{ valor: '', rotulo: 'Todos os setores' }, ...setores.map((s) => ({ valor: s, rotulo: s }))]} />
        <Selecao rotulo="Responsável" valor={responsavel} onMudar={setResponsavel} largura={220} opcoes={[{ valor: '', rotulo: 'Todos os responsáveis' }, { valor: 'ninguem', rotulo: 'Sem responsável' }, ...pessoas.map((p) => ({ valor: p.usuario_id, rotulo: p.nome, icone: <FotoPessoa pessoa={p} tamanho={24} /> }))]} />
      </div>

      <div className="tabela-os">
        <div className="linha-os cabecalho rotulo"><span>Nº OS</span><span>Pedido</span><span>Setor e solicitante</span><span>Responsável</span><span>Prazo</span><span>Situação</span></div>
        {lista === null && <div className="vazio">Carregando…</div>}
        {lista?.length === 0 && <div className="vazio">Nenhuma OS registrada ainda. Clique em "Registrar OS" quando chegar um pedido pelo Tasy.</div>}
        {lista && lista.length > 0 && filtradas.length === 0 && <div className="vazio">Nenhuma OS com esses filtros.</div>}
        {filtradas.map((o) => {
          const p = prazoDe(o); const s = SITUACOES_OS.find((x) => x.id === o.situacao)!; const r = pessoa(o.responsavel_id)
          return (
            <button key={o.id} type="button" className="linha-os" onClick={() => mudarParam(o.id)}>
              <span className="linha-os__numero">{o.numero}</span>
              <span className="linha-os__pedido">
                <strong>{o.prioridade === 'alta' && <AlertTriangle size={13} className="linha-os__alta" />}{o.titulo}</strong>
                <span className="pequeno">{[o.tipo, o.local].filter(Boolean).join(' · ') || '—'}{o.fotos.length > 0 && <> · <Camera size={11} style={{ verticalAlign: -1 }} /> {o.fotos.length}</>}</span>
              </span>
              <span className="linha-os__setor"><strong>{o.setor ?? '—'}</strong><span className="pequeno">{o.solicitante ?? ''}</span></span>
              <span>{r ? <span className="linha" style={{ gap: 6, flexWrap: 'nowrap' }}><FotoPessoa pessoa={r} tamanho={24} /><span className="pequeno">{r.nome.split(' ')[0]}</span></span> : <span className="pequeno sem-resp">Sem responsável</span>}</span>
              <span className={`linha-os__prazo linha-os__prazo--${p ?? 'ok'}`}>{o.prazo ? dataBr(o.prazo) : '—'}{p === 'atrasadas' && <small>atrasada</small>}{p === 'hoje' && <small>hoje</small>}</span>
              <span><span className="situacao-os" style={{ '--cor': s.cor } as React.CSSProperties}>{s.nome}</span>{o.motivo && o.situacao === 'aguardando' && <span className="pequeno" style={{ display: 'block' }}>{o.motivo}</span>}</span>
            </button>
          )
        })}
      </div>

      {nova && <NovaOSJanela pessoas={pessoas} setores={setores} onFechar={() => setNova(false)}
        onCriar={async (d, fotos) => {
          const os = await criarOS(cliente.id, d)
          if (fotos.length) {
            const enviadas: FotoOS[] = []
            for (const [f, tipo] of fotos) enviadas.push(await enviarFotoOS(os, f, tipo))
            await salvarOS(os.id, { fotos: enviadas })
          }
          setNova(false); await carregar(); mudarParam(os.id)
        }} />}
      {aberta && <FichaOS os={aberta} pessoas={pessoas} setores={setores} podeExcluir={ehAdminCliente} clienteId={cliente.id}
        onFechar={() => mudarParam(null)} onRecarregar={carregar}
        onMudar={async (dados) => { setLista((l) => l && l.map((x) => (x.id === aberta.id ? { ...x, ...dados } : x))); await salvarOS(aberta.id, dados) }}
        onExcluir={async () => { await excluirOS(aberta.id); mudarParam(null); await carregar() }} />}
    </div>
  )
}

/** Campo de texto com atalhos de um toque (ex.: setores mais comuns). */
function TextoComAtalhos({ id, valor, onMudar, atalhos, placeholder }: { id?: string; valor: string; onMudar: (v: string) => void; atalhos: string[]; placeholder?: string }) {
  return (
    <>
      <input id={id} className="entrada" value={valor} onChange={(e) => onMudar(e.target.value)} placeholder={placeholder} />
      <div className="atalhos">{atalhos.map((a) => <button key={a} type="button" className={`opcao opcao--mini${valor === a ? ' marcada' : ''}`} onClick={() => onMudar(valor === a ? '' : a)}>{a}</button>)}</div>
    </>
  )
}

function NovaOSJanela({ pessoas, setores, onFechar, onCriar }: { pessoas: Pessoa[]; setores: string[]; onFechar: () => void; onCriar: (d: NovaOS, fotos: [File, TipoFoto][]) => Promise<void> }) {
  const [d, setD] = useState<NovaOS>({ numero: '', titulo: '', descricao: null, solicitante: null, contato: null, setor: null, local: null, tipo: null, pedido_em: hojeIso(), prazo: null, prioridade: 'comum', responsavel_id: null, links: [] })
  const [fotos, setFotos] = useState<[File, TipoFoto][]>([])
  const [link, setLink] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const campo = (k: keyof NovaOS) => ({ value: (d[k] as string | null) ?? '', onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD({ ...d, [k]: e.target.value || null }) })
  const todosSetores = [...new Set([...SETORES_OS, ...setores])]

  async function enviar(e: FormEvent) {
    e.preventDefault(); setErro(null); setSalvando(true)
    const links = link.trim() ? [...d.links, { id: crypto.randomUUID(), url: /^https?:\/\//.test(link.trim()) ? link.trim() : `https://${link.trim()}`, nome: 'Link do pedido' }] : d.links
    try { await onCriar({ ...d, numero: d.numero.trim(), titulo: d.titulo.trim(), links }, fotos) } catch (err) { setErro((err as Error).message); setSalvando(false) }
  }
  const escolherFotos = (lista: FileList | null, tipo: TipoFoto) => lista && setFotos([...fotos, ...Array.from(lista).map((f) => [f, tipo] as [File, TipoFoto])])

  return (
    <Janela titulo="Registrar ordem de serviço" onFechar={onFechar} largura={820}>
      <form className="janela__corpo nova-os" onSubmit={enviar}>
        <div className="nova-os__topo">
          <div className="campo nova-os__numero"><label htmlFor="os-num">Nº da OS (Tasy)</label><input id="os-num" className="entrada" required autoFocus inputMode="numeric" placeholder="48213" {...campo('numero')} value={d.numero} /></div>
          <div className="campo" style={{ flex: 1 }}><label htmlFor="os-tit">Resumo do pedido</label><input id="os-tit" className="entrada" required placeholder="Ex.: Placa de identificação da nova UTI" {...campo('titulo')} value={d.titulo} /></div>
        </div>
        <div className="campo"><label htmlFor="os-desc">Descrição</label><textarea id="os-desc" className="entrada" rows={3} placeholder="O que foi pedido, medidas, textos, cores…" {...campo('descricao')} /></div>

        <div className="grade-2">
          <div className="campo"><label htmlFor="os-sol">Solicitante</label><input id="os-sol" className="entrada" placeholder="Nome de quem pediu" {...campo('solicitante')} /></div>
          <div className="campo"><label htmlFor="os-cont">Contato</label><input id="os-cont" className="entrada" placeholder="Ramal, WhatsApp ou e-mail" {...campo('contato')} /></div>
        </div>
        <div className="campo"><label htmlFor="os-setor">Setor</label><TextoComAtalhos id="os-setor" valor={d.setor ?? ''} onMudar={(v) => setD({ ...d, setor: v || null })} atalhos={todosSetores} placeholder="Ex.: UTI" /></div>
        <div className="grade-2">
          <div className="campo"><label htmlFor="os-local">Local</label><input id="os-local" className="entrada" placeholder="Ex.: Bloco B, 3º andar" {...campo('local')} /></div>
          <div className="campo"><label htmlFor="os-tipo">Tipo de serviço</label><Selecao id="os-tipo" valor={d.tipo ?? ''} onMudar={(v) => setD({ ...d, tipo: v || null })} opcoes={[{ valor: '', rotulo: 'Escolher' }, ...TIPOS_OS.map((t) => ({ valor: t, rotulo: t }))]} /></div>
          <div className="campo"><label htmlFor="os-ped">Data do pedido</label><input id="os-ped" type="date" className="entrada" value={d.pedido_em} onChange={(e) => setD({ ...d, pedido_em: e.target.value || hojeIso() })} /></div>
          <div className="campo"><label htmlFor="os-prazo">Data de entrega limite</label><input id="os-prazo" type="date" className="entrada" {...campo('prazo')} /></div>
          <div className="campo"><label htmlFor="os-pri">Prioridade</label><Selecao id="os-pri" valor={d.prioridade} onMudar={(v) => setD({ ...d, prioridade: v as Prioridade })} opcoes={OPCOES_PRIORIDADE} /></div>
          <div className="campo"><label htmlFor="os-resp">Responsável do marketing</label><Selecao id="os-resp" valor={d.responsavel_id ?? ''} onMudar={(v) => setD({ ...d, responsavel_id: v || null })} opcoes={opcoesPessoas(pessoas, 'Definir depois')} /></div>
        </div>

        <div className="nova-os__fotos">
          {(['local', 'referencia'] as TipoFoto[]).map((tipo) => (
            <label key={tipo} className="soltar-foto">
              <ImagePlus size={20} /><span><strong>{NOME_FOTO[tipo]}</strong><small>{fotos.filter((f) => f[1] === tipo).length ? `${fotos.filter((f) => f[1] === tipo).length} foto(s)` : 'Escolher fotos'}</small></span>
              <input type="file" accept="image/*" multiple hidden onChange={(e) => escolherFotos(e.target.files, tipo)} />
            </label>
          ))}
        </div>
        {fotos.length > 0 && <div className="previas">{fotos.map(([f, tipo], i) => (
          <span key={i} className="previa"><img src={URL.createObjectURL(f)} alt="" /><small>{tipo === 'local' ? 'Local' : 'Referência'}</small>
            <button type="button" aria-label="Tirar foto" onClick={() => setFotos(fotos.filter((_, j) => j !== i))}><X size={12} /></button></span>
        ))}</div>}
        <div className="campo"><label htmlFor="os-link">Link (se precisar)</label><input id="os-link" className="entrada" placeholder="Drive, Canva, e-mail do pedido…" value={link} onChange={(e) => setLink(e.target.value)} /></div>

        {erro && <p className="importar__erro">{erro}</p>}
        <div className="linha" style={{ justifyContent: 'flex-end' }}><Botao type="button" variante="fantasma" onClick={onFechar}>Cancelar</Botao><Botao type="submit" disabled={salvando || !d.numero.trim() || !d.titulo.trim()}>{salvando ? 'Registrando…' : 'Registrar OS'}</Botao></div>
      </form>
    </Janela>
  )
}

function FichaOS({ os, pessoas, setores, podeExcluir, clienteId, onFechar, onMudar, onExcluir, onRecarregar }: {
  os: OS; pessoas: Pessoa[]; setores: string[]; podeExcluir: boolean; clienteId: string
  onFechar: () => void; onMudar: (d: Partial<OS>) => Promise<void>; onExcluir: () => Promise<void>; onRecarregar: () => Promise<void>
}) {
  const { definir } = useFoco()
  const [eventos, setEventos] = useState<EventoOS[]>([])
  const [links, setLinks] = useState<Map<string, string>>(new Map())
  const [comentario, setComentario] = useState('')
  const [motivoPara, setMotivoPara] = useState<SituacaoOS | null>(null)
  const [motivo, setMotivo] = useState('')
  const [material, setMaterial] = useState(false)
  const [novoLink, setNovoLink] = useState<{ url: string; nome: string } | null>(null)
  const [enviando, setEnviando] = useState<TipoFoto | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [d, setD] = useState({ titulo: os.titulo, descricao: os.descricao ?? '', numero: os.numero, solicitante: os.solicitante ?? '', contato: os.contato ?? '', setor: os.setor ?? '', local: os.local ?? '', fornecedor: os.fornecedor ?? '', custo: os.custo?.toString() ?? '' })
  const carregarEventos = useCallback(async () => setEventos(await eventosOS(os.id)), [os.id])
  useEffect(() => { void Promise.resolve().then(carregarEventos) }, [carregarEventos, os.situacao])
  const caminhos = os.fotos.map((f) => f.caminho).join('|')
  useEffect(() => { void linksFotosOS(caminhos ? caminhos.split('|') : []).then(setLinks) }, [caminhos])

  async function mudar(dados: Partial<OS>) { setErro(null); try { await onMudar(dados) } catch (e) { setErro((e as Error).message); await onRecarregar() } }
  const salvarTexto = (k: keyof typeof d, campoOS: keyof OS, transformar: (v: string) => unknown = (v) => v.trim() || null) => () => {
    const novo = transformar(d[k]); const atual = os[campoOS] ?? null
    if (String(novo ?? '') !== String(atual ?? '')) void mudar({ [campoOS]: novo } as Partial<OS>)
  }
  const campo = (k: keyof typeof d, campoOS: keyof OS, transformar?: (v: string) => unknown) => ({ value: d[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD({ ...d, [k]: e.target.value }), onBlur: salvarTexto(k, campoOS, transformar) })

  function mudarSituacao(s: SituacaoOS) {
    if (s === os.situacao) return
    if (SITUACOES_OS.find((x) => x.id === s)?.motivo) { setMotivo(''); setMotivoPara(s); return }
    void mudar({ situacao: s, motivo: null })
  }
  async function enviarFotos(lista: FileList | null, tipo: TipoFoto) {
    if (!lista?.length) return
    setEnviando(tipo); setErro(null)
    try {
      const novas: FotoOS[] = []
      for (const f of Array.from(lista)) novas.push(await enviarFotoOS(os, f, tipo))
      await mudar({ fotos: [...os.fotos, ...novas] })
    } catch (e) { setErro((e as Error).message) }
    setEnviando(null)
  }
  async function tirarFoto(f: FotoOS) {
    if (!confirm('Remover esta foto?')) return
    await mudar({ fotos: os.fotos.filter((x) => x.id !== f.id) }); await apagarFotoOS(f.caminho)
  }

  return (
    <Janela titulo={`OS ${os.numero}`} onFechar={onFechar} largura={1040} classe="ficha-card">
      <div className="ficha-card__corpo">
        <div className="ficha-card__principal">
          <div>
            <span className="numero-os"><ClipboardList size={14} /> OS {os.numero}</span>
            <input className="editar-card__titulo" aria-label="Resumo" {...campo('titulo', 'titulo', (v) => v.trim() || os.titulo)} />
            <p className="pequeno">Pedida em {dataBr(os.pedido_em)}{os.solicitante ? ` por ${os.solicitante}` : ''}{os.setor ? ` · ${os.setor}` : ''}</p>
          </div>

          <div className="trilha-demanda" role="radiogroup" aria-label="Situação">
            {SITUACOES_OS.map((s) => (
              <button key={s.id} type="button" role="radio" aria-checked={os.situacao === s.id} style={{ '--cor': s.cor } as React.CSSProperties}
                className={`etapas-lead__item${os.situacao === s.id ? ' marcado' : ''}`} onClick={() => mudarSituacao(s.id)}>{s.nome}</button>
            ))}
          </div>
          {motivoPara && (
            <div className="sugestao motivo-os">
              <strong>{motivoPara === 'aguardando' ? 'Aguardando o quê?' : 'Por que foi cancelada?'}</strong>
              {motivoPara === 'aguardando' && <div className="linha" style={{ gap: 6 }}>{MOTIVOS_AGUARDANDO.map((m) => <button key={m} type="button" className={`opcao opcao--mini${motivo === m ? ' marcada' : ''}`} onClick={() => setMotivo(m)}>{m}</button>)}</div>}
              <div className="linha" style={{ gap: 6, flexWrap: 'nowrap' }}>
                <input className="entrada entrada--mini" style={{ flex: 1 }} autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Escreva o motivo" aria-label="Motivo" />
                <button type="button" className="botao botao--primario botao--mini" disabled={!motivo.trim()} onClick={() => { void mudar({ situacao: motivoPara, motivo: motivo.trim() }); setMotivoPara(null) }}>Confirmar</button>
                <button type="button" className="botao botao--fantasma botao--mini" onClick={() => setMotivoPara(null)}>Voltar</button>
              </div>
            </div>
          )}
          {os.motivo && (os.situacao === 'aguardando' || os.situacao === 'cancelada') && !motivoPara && <p className="card__impedimento"><AlertTriangle size={14} /> {os.situacao === 'aguardando' ? 'Aguardando: ' : 'Cancelada: '}{os.motivo}</p>}

          <section className="ficha-secao">
            <h4>Descrição</h4>
            <textarea className="entrada ficha-texto" rows={3} placeholder="O que foi pedido, medidas, textos, cores…" {...campo('descricao', 'descricao')} />
          </section>

          <section className="ficha-secao">
            <h4><Camera size={16} /> Fotos</h4>
            <div className="fotos-os">
              {(['local', 'referencia', 'resultado'] as TipoFoto[]).map((tipo) => {
                const doTipo = os.fotos.filter((f) => f.tipo === tipo)
                return (
                  <div key={tipo} className={`fotos-os__grupo fotos-os__grupo--${tipo}`}>
                    <span className="rotulo">{NOME_FOTO[tipo]}</span>
                    <div className="fotos-os__lista">
                      {doTipo.map((f) => (
                        <span key={f.id} className="foto-os">
                          <a href={links.get(f.caminho)} target="_blank" rel="noreferrer">{links.get(f.caminho) ? <img src={links.get(f.caminho)} alt={NOME_FOTO[tipo]} /> : null}</a>
                          <button type="button" aria-label="Remover foto" onClick={() => void tirarFoto(f)}><X size={12} /></button>
                        </span>
                      ))}
                      <label className={`foto-os foto-os--nova${enviando === tipo ? ' enviando' : ''}`} title={`Adicionar: ${NOME_FOTO[tipo]}`}>
                        <Plus size={18} /><input type="file" accept="image/*" multiple hidden onChange={(e) => { void enviarFotos(e.target.files, tipo); e.target.value = '' }} />
                      </label>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="ficha-secao">
            <h4><Link2 size={16} /> Links</h4>
            {os.links.map((l) => (
              <span key={l.id} className="link-os"><a href={l.url} target="_blank" rel="noreferrer">{l.nome} <ExternalLink size={12} /></a>
                <button type="button" aria-label={`Remover ${l.nome}`} onClick={() => void mudar({ links: os.links.filter((x) => x.id !== l.id) })}><X size={13} /></button></span>
            ))}
            {novoLink ? (
              <form className="anexo-link" onSubmit={(e) => { e.preventDefault(); if (!novoLink.url.trim()) return; const url = /^https?:\/\//.test(novoLink.url.trim()) ? novoLink.url.trim() : `https://${novoLink.url.trim()}`
                void mudar({ links: [...os.links, { id: crypto.randomUUID(), url, nome: novoLink.nome.trim() || url.replace(/^https?:\/\//, '').slice(0, 50) }] }); setNovoLink(null) }}>
                <input className="entrada entrada--mini" autoFocus placeholder="Cole o link" value={novoLink.url} onChange={(e) => setNovoLink({ ...novoLink, url: e.target.value })} aria-label="Link" />
                <input className="entrada entrada--mini" placeholder="Nome (opcional)" value={novoLink.nome} onChange={(e) => setNovoLink({ ...novoLink, nome: e.target.value })} aria-label="Nome do link" />
                <button type="submit" className="botao botao--primario botao--mini">Adicionar</button>
                <button type="button" className="botao botao--fantasma botao--mini" onClick={() => setNovoLink(null)}>Cancelar</button>
              </form>
            ) : <button type="button" className="botao botao--secundario botao--mini" style={{ alignSelf: 'flex-start' }} onClick={() => setNovoLink({ url: '', nome: '' })}><Plus size={14} /> Adicionar link</button>}
          </section>

          <section className="ficha-secao">
            <h4><Package size={16} /> Material do estoque</h4>
            {eventos.filter((e) => e.tipo === 'material').map((e) => <span key={e.id} className="pequeno">• {e.texto} <span style={{ color: 'var(--texto-3)' }}>({e.autor ?? 'alguém'}, {quando(e.criado_em)})</span></span>)}
            {material ? <UsarMaterial clienteId={clienteId} numero={os.numero} onFeito={async (texto, detalhe) => { await registrarEventoOS(os.id, 'material', texto, detalhe); setMaterial(false); await carregarEventos() }} onCancelar={() => setMaterial(false)} />
              : <button type="button" className="botao botao--secundario botao--mini" style={{ alignSelf: 'flex-start' }} onClick={() => setMaterial(true)}><Package size={14} /> Registrar material usado</button>}
          </section>

          <section className="ficha-secao">
            <h4><MessageSquare size={16} /> Conversa e histórico</h4>
            <form className="comentar" onSubmit={(e) => { e.preventDefault(); const t = comentario.trim(); if (t) void registrarEventoOS(os.id, 'comentario', t).then(() => { setComentario(''); return carregarEventos() }) }}>
              <input className="entrada" value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Escreva para a equipe… (Enter envia)" aria-label="Comentário" />
              {comentario && <button type="submit" className="icone-botao" aria-label="Enviar"><Send size={15} /></button>}
            </form>
            <ul className="comentarios">
              {eventos.filter((e) => e.tipo !== 'material').map((e) => (
                <li key={e.id} className={e.tipo !== 'comentario' ? 'comentarios__sistema' : ''}>
                  <span className="comentarios__avatar">{(e.autor ?? '•').slice(0, 1).toUpperCase()}</span>
                  <div><span className="linha" style={{ gap: 8 }}><strong>{e.autor ?? 'Luminy'}</strong><span className="pequeno">{quando(e.criado_em)}</span></span>
                    {e.tipo === 'comentario' ? <p>{e.texto}</p> : <span className="pequeno">{e.tipo === 'criada' ? 'registrou a OS' : `mudou de ${nomeSituacaoOS(e.detalhe.de as SituacaoOS)} para ${nomeSituacaoOS(e.detalhe.para as SituacaoOS)}${e.detalhe.motivo ? `: "${e.detalhe.motivo}"` : ''}`}</span>}</div>
                </li>
              ))}
            </ul>
          </section>
          {erro && <p className="importar__erro">{erro}</p>}
        </div>

        <aside className="painel-propriedades">
          <span className="rotulo">Dados da OS</span>
          <div className="propriedade"><span>Nº da OS (Tasy)</span><input className="entrada entrada--mini" aria-label="Número da OS" {...campo('numero', 'numero', (v) => v.trim() || os.numero)} /></div>
          <div className="propriedade"><span>Responsável do marketing</span><Selecao mini valor={os.responsavel_id ?? ''} onMudar={(v) => void mudar({ responsavel_id: v || null })} opcoes={opcoesPessoas(pessoas, 'Ninguém ainda')} /></div>
          <div className="propriedade"><span>Entrega limite</span><input type="date" className="entrada entrada--mini" value={os.prazo ?? ''} onChange={(e) => void mudar({ prazo: e.target.value || null })} aria-label="Entrega limite" /></div>
          <div className="propriedade"><span>Prioridade</span><Selecao mini valor={os.prioridade} onMudar={(v) => void mudar({ prioridade: v as Prioridade })} opcoes={OPCOES_PRIORIDADE} /></div>
          <div className="propriedade"><span>Tipo de serviço</span><Selecao mini valor={os.tipo ?? ''} onMudar={(v) => void mudar({ tipo: v || null })} opcoes={[{ valor: '', rotulo: 'Não informado' }, ...TIPOS_OS.map((t) => ({ valor: t, rotulo: t }))]} /></div>
          <div className="propriedade"><span>Solicitante</span><input className="entrada entrada--mini" aria-label="Solicitante" {...campo('solicitante', 'solicitante')} /></div>
          <div className="propriedade"><span><Phone size={12} /> Contato</span><input className="entrada entrada--mini" aria-label="Contato" placeholder="Ramal, WhatsApp…" {...campo('contato', 'contato')} /></div>
          <div className="propriedade"><span>Setor</span><input className="entrada entrada--mini" aria-label="Setor" {...campo('setor', 'setor')} placeholder={setores[0] ?? 'Ex.: UTI'} /></div>
          <div className="propriedade"><span><MapPin size={12} /> Local</span><input className="entrada entrada--mini" aria-label="Local" {...campo('local', 'local')} /></div>
          <div className="propriedade"><span>Pedido em</span><input type="date" className="entrada entrada--mini" value={os.pedido_em} onChange={(e) => e.target.value && void mudar({ pedido_em: e.target.value })} aria-label="Pedido em" /></div>
          <div className="propriedade"><span>Fornecedor</span><input className="entrada entrada--mini" aria-label="Fornecedor" placeholder="Gráfica, serralheria…" {...campo('fornecedor', 'fornecedor')} /></div>
          <div className="propriedade"><span>Custo (R$)</span><input className="entrada entrada--mini" aria-label="Custo" inputMode="decimal" placeholder="0,00" {...campo('custo', 'custo', (v) => { const n = Number(v.replace(/\./g, '').replace(',', '.')); return v.trim() && Number.isFinite(n) ? n : null })} /></div>

          <span className="rotulo" style={{ marginTop: 8 }}>Ações</span>
          {os.situacao !== 'concluida' && os.situacao !== 'cancelada' && (
            <button type="button" className="painel-propriedades__acao painel-propriedades__acao--destaque" onClick={() => void mudar({ situacao: 'concluida', motivo: null })}><Check size={15} /> Concluir OS</button>
          )}
          <button type="button" className="painel-propriedades__acao" onClick={() => { void definir(`OS ${os.numero}: ${os.titulo}`); onFechar() }}>▶ Fazer agora</button>
          {podeExcluir && <button type="button" className="painel-propriedades__acao painel-propriedades__acao--perigo" onClick={() => { if (confirm(`Excluir a OS ${os.numero}?`)) void onExcluir() }}><Trash2 size={15} /> Excluir OS</button>}
        </aside>
      </div>
    </Janela>
  )
}

/** Dá baixa no estoque (saída) com o número da OS no motivo, e registra na OS. */
function UsarMaterial({ clienteId, numero, onFeito, onCancelar }: { clienteId: string; numero: string; onFeito: (texto: string, detalhe: Record<string, string | number>) => Promise<void>; onCancelar: () => void }) {
  const [itens, setItens] = useState<Item[]>([])
  const [itemId, setItemId] = useState('')
  const [qtd, setQtd] = useState('1')
  const [erro, setErro] = useState<string | null>(null)
  const carregado = useRef(false)
  useEffect(() => { if (!carregado.current) { carregado.current = true; void listarItens(clienteId).then((r) => setItens(r.ativos)) } }, [clienteId])
  const item = itens.find((i) => i.id === itemId)
  async function registrar() {
    const n = Number(qtd.replace(',', '.'))
    if (!item || !(n > 0)) return
    setErro(null)
    try { await movimentar(item.id, 'saida', n, `OS ${numero}`); await onFeito(`${fmt(n)} ${item.unidade} de ${item.nome}`, { item_id: item.id, quantidade: n }) }
    catch (e) { setErro((e as Error).message) }
  }
  return (
    <div className="usar-material">
      <Selecao mini valor={itemId} onMudar={setItemId} vazio="Escolher item do estoque" largura={280}
        opcoes={itens.map((i) => ({ valor: i.id, rotulo: i.nome, descricao: `${fmt(i.quantidade)} ${i.unidade} em estoque` }))} />
      <input className="entrada entrada--mini" style={{ width: 80 }} inputMode="decimal" value={qtd} onChange={(e) => setQtd(e.target.value)} aria-label="Quantidade" />
      {item && <span className="pequeno">{item.unidade}</span>}
      <button type="button" className="botao botao--primario botao--mini" disabled={!item} onClick={() => void registrar()}>Dar baixa</button>
      <button type="button" className="botao botao--fantasma botao--mini" onClick={onCancelar}>Cancelar</button>
      {erro && <span className="pequeno" style={{ color: 'var(--perigo)', flexBasis: '100%' }}>{erro}</span>}
    </div>
  )
}
