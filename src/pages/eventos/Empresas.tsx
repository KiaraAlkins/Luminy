import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { Botao, Chip } from '../../components/ui'
import { Janela } from '../../components/Janela'
import { useSessao } from '../../lib/sessao'
import {
  CONVENIOS_SUGERIDOS, ETAPAS, criarEmpresa, dataBr, listarEmpresas, nomeEtapa,
  type Empresa, type Etapa, type Resumo,
} from '../../lib/parcerias'
import { CampoConvenios } from './CampoConvenios'

/** Empresas parceiras (CRM): quem são, planos de saúde dos funcionários e em que pé está a parceria. */
export function Empresas() {
  const { cliente, acessoLeads } = useSessao()
  const navegar = useNavigate()
  const [empresas, setEmpresas] = useState<Empresa[] | null>(null)
  const [resumos, setResumos] = useState<Map<string, Resumo>>(new Map())
  const [busca, setBusca] = useState('')
  const [convenio, setConvenio] = useState('')
  const [etapa, setEtapa] = useState<Etapa | ''>('')
  const [nova, setNova] = useState(false)

  const carregar = useCallback(async () => {
    if (!cliente) return
    const r = await listarEmpresas(cliente.id)
    setEmpresas(r.empresas); setResumos(r.resumos)
  }, [cliente])
  useEffect(() => { void Promise.resolve().then(carregar) }, [carregar])

  const convenios = useMemo(() => [...new Set((empresas ?? []).flatMap((e) => e.convenios))].sort(), [empresas])
  const filtradas = useMemo(() => (empresas ?? []).filter((e) =>
    (!busca || `${e.nome} ${e.segmento ?? ''}`.toLowerCase().includes(busca.toLowerCase())) &&
    (!convenio || e.convenios.includes(convenio)) &&
    (!etapa || e.etapa === etapa)), [empresas, busca, convenio, etapa])

  return (
    <>
      <div className="filtros">
        <label className="busca busca-local" style={{ width: 'auto' }}>
          <Search size={16} aria-hidden />
          <input aria-label="Buscar empresa" placeholder="Buscar empresa ou segmento" value={busca} onChange={(e) => setBusca(e.target.value)}
            style={{ border: 0, outline: 0, background: 'none', flex: 1 }} />
        </label>
        <select className="entrada" aria-label="Filtrar por plano de saúde" value={convenio} onChange={(e) => setConvenio(e.target.value)}>
          <option value="">Todos os planos de saúde</option>{convenios.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className="entrada" aria-label="Filtrar por etapa" value={etapa} onChange={(e) => setEtapa(e.target.value as Etapa | '')}>
          <option value="">Todas as etapas</option>{ETAPAS.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
        </select>
        <Botao icone={<Plus size={16} />} onClick={() => setNova(true)}>Nova empresa</Botao>
      </div>

      <div className="tabela-empresas" role="table" aria-label="Empresas parceiras">
        <div className="linha-empresa cabecalho rotulo" role="row">
          <span>Empresa</span><span>Planos de saúde</span><span>Etapa</span><span>Último registro</span><span>{acessoLeads ? 'Leads' : ''}</span>
        </div>
        {empresas === null && <div className="vazio">Carregando…</div>}
        {empresas !== null && filtradas.length === 0 && (
          <div className="vazio">{empresas.length === 0 ? 'Nenhuma empresa cadastrada ainda. Cadastre a primeira parceira.' : 'Nenhuma empresa com esses filtros.'}</div>
        )}
        {filtradas.map((e) => {
          const r = resumos.get(e.id)
          const cor = ETAPAS.find((x) => x.id === e.etapa)?.cor
          return (
            <Link key={e.id} to={`/eventos/empresas/${e.id}`} className="linha-empresa" role="row">
              <span><strong style={{ display: 'block' }}>{e.nome}</strong><span className="pequeno">{[e.segmento, e.funcionarios ? `${e.funcionarios} funcionários` : null].filter(Boolean).join(' · ')}</span></span>
              <span className="chips">{e.convenios.length ? e.convenios.map((c) => <Chip key={c} tom="neutro">{c}</Chip>) : <span className="pequeno">Não informado</span>}</span>
              <span className="etapa"><i style={{ background: cor }} />{nomeEtapa(e.etapa)}</span>
              <span>{r?.ultima_descricao ? <><span style={{ display: 'block' }}>{r.ultima_descricao}</span><span className="pequeno">{dataBr(r.ultima_interacao)}</span></> : <span className="pequeno">Sem registros</span>}
                {e.proximo_passo && <span className="pequeno" style={{ display: 'block', color: 'var(--marca)' }}>Próximo: {e.proximo_passo}{e.proximo_passo_em ? ` (${dataBr(e.proximo_passo_em)})` : ''}</span>}</span>
              <span className="forte">{acessoLeads ? r?.total_leads ?? 0 : ''}</span>
            </Link>
          )
        })}
      </div>

      {nova && cliente && (
        <NovaEmpresa onFechar={() => setNova(false)} onCriar={async (dados) => {
          const id = await criarEmpresa(cliente.id, dados)
          setNova(false); navegar(`/eventos/empresas/${id}`)
        }} />
      )}
    </>
  )
}

function NovaEmpresa({ onFechar, onCriar }: { onFechar: () => void; onCriar: (d: { nome: string; segmento: string | null; funcionarios: number | null; convenios: string[]; etapa: Etapa }) => Promise<void> }) {
  const [nome, setNome] = useState('')
  const [segmento, setSegmento] = useState('')
  const [funcionarios, setFuncionarios] = useState('')
  const [convenios, setConvenios] = useState<string[]>([])
  const [etapa, setEtapa] = useState<Etapa>('prospeccao')
  const [erro, setErro] = useState<string | null>(null)
  async function enviar(e: FormEvent) {
    e.preventDefault()
    try { await onCriar({ nome: nome.trim(), segmento: segmento.trim() || null, funcionarios: funcionarios ? Number(funcionarios) : null, convenios, etapa }) }
    catch { setErro('Não foi possível cadastrar a empresa.') }
  }
  return (
    <Janela titulo="Nova empresa parceira" onFechar={onFechar} largura={560}>
      <form className="janela__corpo" onSubmit={enviar}>
        <div className="campo"><label htmlFor="emp-nome">Nome da empresa</label><input id="emp-nome" className="entrada" autoFocus required value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <div className="grade-2">
          <div className="campo"><label htmlFor="emp-seg">Segmento</label><input id="emp-seg" className="entrada" value={segmento} onChange={(e) => setSegmento(e.target.value)} placeholder="Ex.: Indústria" /></div>
          <div className="campo"><label htmlFor="emp-func">Funcionários</label><input id="emp-func" className="entrada" type="number" min={0} value={funcionarios} onChange={(e) => setFuncionarios(e.target.value)} /></div>
        </div>
        <CampoConvenios valor={convenios} onMudar={setConvenios} sugestoes={CONVENIOS_SUGERIDOS} />
        <div className="campo"><label htmlFor="emp-etapa">Etapa da parceria</label>
          <select id="emp-etapa" className="entrada" value={etapa} onChange={(e) => setEtapa(e.target.value as Etapa)}>{ETAPAS.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></div>
        {erro && <p className="pequeno" style={{ color: 'var(--perigo)' }}>{erro}</p>}
        <div className="linha" style={{ justifyContent: 'flex-end' }}><Botao type="button" variante="fantasma" onClick={onFechar}>Cancelar</Botao><Botao type="submit">Cadastrar</Botao></div>
      </form>
    </Janela>
  )
}
