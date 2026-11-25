import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlarmClock, Camera, PenLine, Plus, Search, Snowflake } from 'lucide-react'
import { Botao, Chip } from '../../components/ui'
import { Janela } from '../../components/Janela'
import { useSessao } from '../../lib/sessao'
import {
  ETAPAS, enviarFotoEmpresa, TRILHA, corEtapa, criarEmpresa, diasDesde, esfriando, haQuanto, listarEmpresas, prazo,
  type Empresa, type Etapa, type Resumo,
} from '../../lib/parcerias'
import { FotoEmpresa } from '../../components/Empresa'
import { ChipConvenio, SeletorConvenios } from '../../components/Convenio'
import { RegistroRapido } from './RegistroRapido'
import { TrilhaMini } from './TrilhaEtapa'

type Filtro = Etapa | 'paradas' | 'atencao' | ''

/** Empresas parceiras (CRM): quem são, planos de saúde dos funcionários e em que pé está a parceria. */
export function Empresas() {
  const { cliente, acessoLeads } = useSessao()
  const navegar = useNavigate()
  const [empresas, setEmpresas] = useState<Empresa[] | null>(null)
  const [resumos, setResumos] = useState<Map<string, Resumo>>(new Map())
  const [busca, setBusca] = useState('')
  const [convenio, setConvenio] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('')
  const [nova, setNova] = useState(false)
  const [registrar, setRegistrar] = useState<Empresa | null>(null)

  const carregar = useCallback(async () => {
    if (!cliente) return
    const r = await listarEmpresas(cliente.id)
    setEmpresas(r.empresas); setResumos(r.resumos)
  }, [cliente])
  useEffect(() => { void Promise.resolve().then(carregar) }, [carregar])

  const convenios = useMemo(() => [...new Set((empresas ?? []).flatMap((e) => e.convenios))].sort(), [empresas])
  const precisaAtencao = useCallback((e: Empresa) => {
    const atrasado = !!e.proximo_passo_em && diasDesde(e.proximo_passo_em) > 0
    return atrasado || esfriando(e, resumos.get(e.id)?.ultima_interacao)
  }, [resumos])
  const naEtapa = (e: Empresa, f: Filtro) =>
    !f || (f === 'paradas' ? e.etapa === 'pausada' || e.etapa === 'encerrada' : f === 'atencao' ? precisaAtencao(e) : e.etapa === f)
  const filtradas = (empresas ?? []).filter((e) =>
    (!busca || `${e.nome} ${e.segmento ?? ''}`.toLowerCase().includes(busca.toLowerCase())) &&
    (!convenio || e.convenios.includes(convenio)) && naEtapa(e, filtro))
  const conta = (f: Filtro) => (empresas ?? []).filter((e) => naEtapa(e, f)).length
  const alternar = (f: Filtro) => setFiltro(filtro === f ? '' : f)
  const nAtencao = conta('atencao')

  return (
    <>
      <div className="funil" role="group" aria-label="Filtrar por etapa">
        {TRILHA.map((id) => {
          const x = ETAPAS.find((y) => y.id === id)!
          return (
            <button key={id} type="button" className={`funil__etapa${filtro === id ? ' marcada' : ''}`} aria-pressed={filtro === id}
              style={{ '--cor': corEtapa(id) } as React.CSSProperties} onClick={() => alternar(id)}>
              <strong>{conta(id)}</strong><span>{x.nome}</span>
            </button>
          )
        })}
        <button type="button" className={`funil__etapa funil__etapa--parada${filtro === 'paradas' ? ' marcada' : ''}`} aria-pressed={filtro === 'paradas'}
          onClick={() => alternar('paradas')}><strong>{conta('paradas')}</strong><span>Pausadas ou encerradas</span></button>
      </div>

      {nAtencao > 0 && (
        <button type="button" className={`atencao${filtro === 'atencao' ? ' marcada' : ''}`} aria-pressed={filtro === 'atencao'} onClick={() => alternar('atencao')}>
          <AlarmClock size={18} aria-hidden />
          <span><strong>{nAtencao} {nAtencao === 1 ? 'empresa precisa' : 'empresas precisam'} de atenção</strong> · próximo passo atrasado ou mais de 30 dias sem contato</span>
          <span className="atencao__ver">{filtro === 'atencao' ? 'Mostrar todas' : 'Ver quais'}</span>
        </button>
      )}

      <div className="filtros">
        <label className="busca busca-local" style={{ width: 'auto' }}>
          <Search size={16} aria-hidden />
          <input aria-label="Buscar empresa" placeholder="Buscar empresa ou segmento" value={busca} onChange={(e) => setBusca(e.target.value)}
            style={{ border: 0, outline: 0, background: 'none', flex: 1 }} />
        </label>
        <select className="entrada" aria-label="Filtrar por plano de saúde" value={convenio} onChange={(e) => setConvenio(e.target.value)}>
          <option value="">Todos os planos de saúde</option>{convenios.map((c) => <option key={c}>{c}</option>)}
        </select>
        <Botao icone={<Plus size={16} />} onClick={() => setNova(true)}>Nova empresa</Botao>
      </div>

      <div className="tabela-empresas" role="table" aria-label="Empresas parceiras">
        <div className="linha-empresa cabecalho rotulo" role="row">
          <span>Empresa</span><span>Etapa</span><span>Último contato</span><span>Próximo passo</span><span>{acessoLeads ? 'Leads' : ''}</span><span aria-hidden="true" />
        </div>
        {empresas === null && <div className="vazio">Carregando…</div>}
        {empresas !== null && filtradas.length === 0 && (
          <div className="vazio">{empresas.length === 0 ? 'Nenhuma empresa cadastrada ainda. Cadastre a primeira parceira.' : 'Nenhuma empresa com esses filtros.'}</div>
        )}
        {filtradas.map((e) => {
          const r = resumos.get(e.id)
          const frio = esfriando(e, r?.ultima_interacao)
          const p = e.proximo_passo_em ? prazo(e.proximo_passo_em) : null
          return (
            <Link key={e.id} to={`/eventos/empresas/${e.id}`} className="linha-empresa" role="row">
              <span className="linha-empresa__nome">
                <span className="linha-empresa__id">
                  <FotoEmpresa empresa={e} tamanho={42} />
                  <span><strong>{e.nome}</strong>
                    <span className="pequeno" style={{ display: 'block' }}>{[e.segmento, e.funcionarios ? `${e.funcionarios} funcionários` : null].filter(Boolean).join(' · ')}</span></span>
                </span>
                {e.convenios.length > 0 && <span className="chips">{e.convenios.map((c) => <ChipConvenio key={c} nome={c} />)}</span>}
              </span>
              <TrilhaMini etapa={e.etapa} />
              <span>
                {r?.ultima_interacao ? <>
                  <span className={`quando${frio ? ' quando--frio' : ''}`}>{frio && <Snowflake size={13} aria-hidden />}{haQuanto(r.ultima_interacao)}</span>
                  <span className="pequeno corta">{r.ultima_descricao}</span>
                </> : <span className="quando quando--frio"><Snowflake size={13} aria-hidden />Nunca</span>}
              </span>
              <span>
                {e.proximo_passo ? <>
                  <span className="corta" style={{ display: 'block' }}>{e.proximo_passo}</span>
                  {p && <Chip tom={p.tom}>{p.texto}</Chip>}
                </> : <span className="pequeno">Nenhum definido</span>}
              </span>
              <span className="forte">{acessoLeads ? r?.total_leads ?? 0 : ''}</span>
              <button type="button" className="icone-botao linha-empresa__registrar" aria-label={`Registrar algo com ${e.nome}`} title="Registrar contato"
                onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); setRegistrar(e) }}><PenLine size={16} /></button>
            </Link>
          )
        })}
      </div>

      {registrar && (
        <Janela titulo={`Registrar com ${registrar.nome}`} onFechar={() => setRegistrar(null)} largura={620}>
          <div className="janela__corpo">
            <RegistroRapido empresaId={registrar.id} compacto onRegistrado={async () => { setRegistrar(null); await carregar() }} />
          </div>
        </Janela>
      )}

      {nova && cliente && (
        <NovaEmpresa onFechar={() => setNova(false)} onCriar={async ({ foto, ...dados }) => {
          const id = await criarEmpresa(cliente.id, dados)
          if (foto) await enviarFotoEmpresa({ id, cliente_id: cliente.id, foto_url: null }, foto).catch(() => null)
          setNova(false); navegar(`/eventos/empresas/${id}`)
        }} />
      )}
    </>
  )
}

function NovaEmpresa({ onFechar, onCriar }: { onFechar: () => void; onCriar: (d: { nome: string; segmento: string | null; funcionarios: number | null; convenios: string[]; etapa: Etapa; foto: File | null }) => Promise<void> }) {
  const [nome, setNome] = useState('')
  const [segmento, setSegmento] = useState('')
  const [funcionarios, setFuncionarios] = useState('')
  const [convenios, setConvenios] = useState<string[]>([])
  const [etapa, setEtapa] = useState<Etapa>('prospeccao')
  const [foto, setFoto] = useState<File | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  async function enviar(e: FormEvent) {
    e.preventDefault()
    try { await onCriar({ nome: nome.trim(), segmento: segmento.trim() || null, funcionarios: funcionarios ? Number(funcionarios) : null, convenios, etapa, foto }) }
    catch { setErro('Não foi possível cadastrar a empresa.') }
  }
  return (
    <Janela titulo="Nova empresa parceira" onFechar={onFechar} largura={560}>
      <form className="janela__corpo" onSubmit={enviar}>
        <div className="linha" style={{ alignItems: 'flex-end', flexWrap: 'nowrap' }}>
          <label className="escolher-foto" title="Logo ou foto da fachada">
            {foto ? <img src={URL.createObjectURL(foto)} alt="" /> : <><Camera size={20} /><span>Foto</span></>}
            <input type="file" accept="image/*" hidden onChange={(e) => setFoto(e.target.files?.[0] ?? null)} aria-label="Logo ou foto da fachada" />
          </label>
          <div className="campo" style={{ flex: 1 }}><label htmlFor="emp-nome">Nome da empresa</label><input id="emp-nome" className="entrada" autoFocus required value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        </div>
        <div className="grade-2">
          <div className="campo"><label htmlFor="emp-seg">Segmento</label><input id="emp-seg" className="entrada" value={segmento} onChange={(e) => setSegmento(e.target.value)} placeholder="Ex.: Indústria" /></div>
          <div className="campo"><label htmlFor="emp-func">Funcionários</label><input id="emp-func" className="entrada" type="number" min={0} value={funcionarios} onChange={(e) => setFuncionarios(e.target.value)} /></div>
        </div>
        <SeletorConvenios valor={convenios} onMudar={setConvenios} />
        <div className="campo"><label htmlFor="emp-etapa">Etapa da parceria</label>
          <select id="emp-etapa" className="entrada" value={etapa} onChange={(e) => setEtapa(e.target.value as Etapa)}>{ETAPAS.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></div>
        {erro && <p className="pequeno" style={{ color: 'var(--perigo)' }}>{erro}</p>}
        <div className="linha" style={{ justifyContent: 'flex-end' }}><Botao type="button" variante="fantasma" onClick={onFechar}>Cancelar</Botao><Botao type="submit">Cadastrar</Botao></div>
      </form>
    </Janela>
  )
}
