import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarDays, Check, EyeOff, Plus, QrCode } from 'lucide-react'
import { Botao, Chip } from '../../components/ui'
import { Janela } from '../../components/Janela'
import { useSessao } from '../../lib/sessao'
import { FotoEmpresa, SeletorEmpresa } from '../../components/Empresa'
import { dataBr, listarEmpresas, listarEventos, type Empresa, type Evento } from '../../lib/parcerias'
import {
  CAMPOS_BASE, CAMPOS_PRONTOS, criarCampanha, listarCampanhas,
  type Campanha, type Campo, type ResumoCampanha, type SituacaoCampanha,
} from '../../lib/campanhas'
import './campanhas.css'

const SITUACAO: Record<SituacaoCampanha, { nome: string; tom: 'sucesso' | 'neutro' | 'alerta' }> = {
  ativa: { nome: 'Ativa', tom: 'sucesso' }, rascunho: { nome: 'Rascunho', tom: 'alerta' }, encerrada: { nome: 'Encerrada', tom: 'neutro' },
}

/** Campanhas QR do cliente: cada uma tem um formulário e uma ou mais peças com QR (cartaz, folder, banner…). */
export function Campanhas() {
  const { cliente } = useSessao()
  const navegar = useNavigate()
  const [campanhas, setCampanhas] = useState<Campanha[] | null>(null)
  const [resumos, setResumos] = useState<Map<string, ResumoCampanha>>(new Map())
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [eventos, setEventos] = useState<Evento[]>([])
  const [filtro, setFiltro] = useState<SituacaoCampanha | ''>('')
  const [nova, setNova] = useState(false)

  const carregar = useCallback(async () => {
    if (!cliente) return
    const [c, e, v] = await Promise.all([listarCampanhas(cliente.id), listarEmpresas(cliente.id), listarEventos(cliente.id)])
    setCampanhas(c.campanhas); setResumos(c.resumos); setEmpresas(e.empresas); setEventos(v)
  }, [cliente])
  useEffect(() => { void Promise.resolve().then(carregar) }, [carregar])

  const visiveis = useMemo(() => (campanhas ?? []).filter((c) => !filtro || c.situacao === filtro), [campanhas, filtro])
  const conta = (s: SituacaoCampanha | '') => (campanhas ?? []).filter((c) => !s || c.situacao === s).length

  return (
    <>
      <div className="filtros">
        <div className="segmentos" role="group" aria-label="Filtrar campanhas">
          {(['', 'ativa', 'rascunho', 'encerrada'] as const).map((s) => (
            <button key={s} type="button" className={filtro === s ? 'marcado' : ''} aria-pressed={filtro === s} onClick={() => setFiltro(s)}>
              {s ? SITUACAO[s].nome + 's' : 'Todas'} <span>{conta(s)}</span>
            </button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        <Botao icone={<Plus size={16} />} onClick={() => setNova(true)}>Nova campanha</Botao>
      </div>

      {campanhas === null && <p className="pequeno">Carregando…</p>}
      {campanhas?.length === 0 && (
        <div className="vazio-grande">
          <QrCode size={40} aria-hidden />
          <h3>Nenhuma campanha ainda</h3>
          <p className="texto-2">Crie uma campanha, monte o formulário e baixe o QR para colocar no cartaz, folder ou banner. Cada leitura vira um lead aqui.</p>
          <Botao icone={<Plus size={16} />} onClick={() => setNova(true)}>Criar a primeira campanha</Botao>
        </div>
      )}

      <div className="grade-campanhas">
        {visiveis.map((c) => {
          const r = resumos.get(c.id)
          const emp = empresas.find((e) => e.id === c.empresa_id)
          const taxa = r && r.leituras > 0 ? Math.round((r.total_leads / r.leituras) * 100) : null
          return (
            <Link key={c.id} to={`/eventos/campanhas/${c.id}`} className="campanha-card">
              <div className="linha" style={{ justifyContent: 'space-between' }}>
                <Chip tom={SITUACAO[c.situacao].tom}>{c.situacao === 'ativa' && <span className="pulso" aria-hidden />}{SITUACAO[c.situacao].nome}</Chip>
                {c.formulario.some((f) => f.modo === 'oculto') && <span className="pequeno linha" title="Tem campos ocultos com valor fixo"><EyeOff size={13} /> campos ocultos</span>}
              </div>
              <div>
                <h3>{c.nome}</h3>
                <p className="pequeno campanha-card__meta">
                  {emp && <span><FotoEmpresa empresa={emp} tamanho={18} /> {emp.nome}</span>}
                  {(c.inicio || c.fim) && <span><CalendarDays size={13} /> {c.inicio ? dataBr(c.inicio) : '…'} até {c.fim ? dataBr(c.fim) : 'sem data'}</span>}
                </p>
              </div>
              <div className="campanha-card__numeros">
                <div><strong>{r?.leituras ?? 0}</strong><span>leituras</span></div>
                <div><strong>{r?.total_leads ?? 0}</strong><span>leads</span></div>
                <div><strong>{taxa === null ? '—' : `${taxa}%`}</strong><span>viraram lead</span></div>
              </div>
              {r && r.leads_7_dias > 0 && <p className="campanha-card__novos">+{r.leads_7_dias} leads nos últimos 7 dias</p>}
            </Link>
          )
        })}
      </div>

      {nova && cliente && (
        <NovaCampanha empresas={empresas} eventos={eventos} onFechar={() => setNova(false)}
          onCriar={async (d) => { const id = await criarCampanha(cliente.id, d); navegar(`/eventos/campanhas/${id}`) }} />
      )}
    </>
  )
}

type Modelo = 'basico' | 'saude'

const pronto = (chave: string): Campo => { const { dica: _dica, ...c } = CAMPOS_PRONTOS.find((x) => x.chave === chave)!; return c }

/** Campos que a campanha já ganha ao ser criada (empresa e plano ocultos quando vem de uma empresa). */
function montarFormulario(modelo: Modelo, emp?: Empresa): Campo[] {
  const campos: Campo[] = [...CAMPOS_BASE]
  if (emp) {
    campos.push({ chave: 'empresa', rotulo: 'Empresa onde trabalha', tipo: 'texto', modo: 'oculto', valor_fixo: emp.nome })
    if (emp.convenios.length) campos.push({ chave: 'convenio', rotulo: 'Plano de saúde', tipo: 'texto', modo: 'oculto', valor_fixo: emp.convenios.join(' / ') })
  } else campos.push(pronto('convenio'))
  if (modelo === 'saude') campos.push(pronto('idade'), pronto('diabetes'), pronto('pressao'))
  return campos
}

function NovaCampanha({ empresas, eventos, onFechar, onCriar }: {
  empresas: Empresa[]; eventos: Evento[]; onFechar: () => void
  onCriar: (d: { nome: string; empresa_id: string | null; evento_id: string | null; inicio: string | null; fim: string | null; formulario: Campo[] }) => Promise<void>
}) {
  const [nome, setNome] = useState('')
  const [empresaId, setEmpresaId] = useState('')
  const [eventoId, setEventoId] = useState('')
  const [modelo, setModelo] = useState<Modelo>('basico')
  const [erro, setErro] = useState<string | null>(null)
  const emp = empresas.find((e) => e.id === empresaId)
  const eventosDaEmpresa = eventos.filter((v) => !empresaId || v.empresa_id === empresaId)
  const formulario = montarFormulario(modelo, emp)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const ev = eventos.find((v) => v.id === eventoId)
    try { await onCriar({ nome: nome.trim(), empresa_id: empresaId || null, evento_id: eventoId || null, inicio: ev?.data ?? null, fim: null, formulario }) }
    catch { setErro('Não foi possível criar a campanha.') }
  }

  return (
    <Janela titulo="Nova campanha QR" onFechar={onFechar} largura={600}>
      <form className="janela__corpo" onSubmit={enviar}>
        <div className="campo"><label htmlFor="cp-nome">Nome da campanha</label>
          <input id="cp-nome" className="entrada" autoFocus required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Dia do Homem na Empresa X" /></div>
        <div className="grade-2">
          <div className="campo"><label htmlFor="cp-emp">É para uma empresa parceira?</label>
            <SeletorEmpresa id="cp-emp" empresas={empresas} valor={empresaId} semEmpresa="Não, é aberta ao público" onMudar={(v) => { setEmpresaId(v); setEventoId('') }} /></div>
          <div className="campo"><label htmlFor="cp-ev">Ligada a um evento?</label>
            <select id="cp-ev" className="entrada" value={eventoId} onChange={(e) => setEventoId(e.target.value)}>
              <option value="">Nenhum</option>{eventosDaEmpresa.map((v) => <option key={v.id} value={v.id}>{v.nome} · {dataBr(v.data)}</option>)}
            </select></div>
        </div>

        <div className="campo"><span className="rotulo-campo">Começar com</span>
          <div className="modelos">
            <button type="button" className={`modelo${modelo === 'basico' ? ' marcado' : ''}`} onClick={() => setModelo('basico')} aria-pressed={modelo === 'basico'}>
              <strong>Básico</strong><span>Nome, WhatsApp e plano de saúde</span></button>
            <button type="button" className={`modelo${modelo === 'saude' ? ' marcado' : ''}`} onClick={() => setModelo('saude')} aria-pressed={modelo === 'saude'}>
              <strong>Triagem de saúde</strong><span>+ idade, diabetes e pressão alta (viram segmentos)</span></button>
          </div>
        </div>

        <div className="previa-campos">
          <span className="rotulo">O formulário já vai com</span>
          {formulario.map((c) => (
            <span key={c.chave} className="linha previa-campos__item">
              {c.modo === 'oculto' ? <EyeOff size={14} /> : <Check size={14} />}
              <span>{c.rotulo}{c.modo === 'oculto' ? <> = <strong>{c.valor_fixo}</strong> <em>(oculto, preenchido sozinho)</em></> : c.modo === 'obrigatorio' ? ' *' : ''}</span>
            </span>
          ))}
          <span className="pequeno">Dá para mudar tudo depois.</span>
        </div>

        {erro && <p className="pequeno" style={{ color: 'var(--perigo)' }}>{erro}</p>}
        <div className="linha" style={{ justifyContent: 'flex-end' }}><Botao type="button" variante="fantasma" onClick={onFechar}>Cancelar</Botao><Botao type="submit">Criar e montar o formulário</Botao></div>
      </form>
    </Janela>
  )
}
