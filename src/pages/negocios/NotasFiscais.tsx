import { useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, FileText, Inbox, PenLine, ScanLine, Search, Trash2, Truck } from 'lucide-react'
import { Botao } from '../../components/ui'
import { Janela } from '../../components/Janela'
import { Selecao } from '../../components/Selecao'
import { BotaoPlanilha } from '../../components/Planilha'
import type { Evento } from '../../lib/parcerias'
import type { Pessoa } from '../../lib/kanban'
import {
  REFERENTES, abrirArquivo, dataBr, enviarArquivo, etapaNota, excluir, hojeIso, lerValor, mesIso, reais, salvar, situacaoContrato,
  type Contrato, type DadosNegocios, type EtapaNota, type NotaFiscal, type ReferenteTipo,
} from '../../lib/negocios'
import { CampoArquivo, CampoValor, ICONE_REFERENTE, SeletorFornecedor, valorParaCampo } from './comum'

const ROTULO_ETAPA: Record<EtapaNota, string> = { assinar: 'Falta assinar', digitalizar: 'Falta digitalizar', entregar: 'Falta entregar', concluida: 'Concluídas' }
const nomeMes = (d: Date) => { const t = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); return t.charAt(0).toUpperCase() + t.slice(1) }
const primeiroNome = (pessoas: Pessoa[], id: string | null) => (id ? pessoas.find((p) => p.usuario_id === id)?.nome.split(' ')[0] ?? null : null)
const dataCurta = (iso: string | null) => (iso ? dataBr(iso).slice(0, 5) : '')

type Props = { clienteId: string; eu: string; dados: DadosNegocios; eventos: Evento[]; pessoas: Pessoa[]; recarregar: () => Promise<void>; agora: number; novaPara: Partial<NotaFiscal> | null; setNovaPara: (n: Partial<NotaFiscal> | null) => void }

/** Notas fiscais do mês: de onde é cada uma e em que pé está (assinada, digitalizada, entregue ao almoxarifado). */
export function NotasFiscais({ clienteId, eu, dados, eventos, pessoas, recarregar, agora, novaPara, setNovaPara }: Props) {
  const [mes, setMes] = useState(() => { const d = new Date(agora); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [filtro, setFiltro] = useState<EtapaNota | 'todas'>('todas')
  const [busca, setBusca] = useState('')
  const [abrir, setAbrir] = useState<NotaFiscal | null>(null)
  const [entregar, setEntregar] = useState<NotaFiscal | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [digitalizar, setDigitalizar] = useState<NotaFiscal | null>(null)

  const chave = mesIso(mes)
  const fornecedor = (n: { fornecedor_id: string | null; fornecedor_nome?: string | null }) => dados.fornecedores.find((f) => f.id === n.fornecedor_id)?.nome ?? n.fornecedor_nome ?? 'Fornecedor não informado'
  const contrato = (id: string | null) => dados.contratos.find((c) => c.id === id) ?? null
  const evento = (id: string | null) => eventos.find((e) => e.id === id) ?? null
  const termo = busca.trim().toLowerCase()
  // Com busca, procura em todos os meses ("que outdoor é essa?"); sem busca, mostra o mês escolhido
  const base = useMemo(() => dados.notas.filter((n) => termo
    ? [n.numero, fornecedor(n), n.referente, contrato(n.contrato_id)?.titulo, evento(n.evento_id)?.nome, n.entregue_para, n.protocolo].some((x) => x?.toLowerCase().includes(termo))
    : n.competencia === chave), [dados, chave, termo, eventos]) // eslint-disable-line react-hooks/exhaustive-deps
  const contagem = (e: EtapaNota) => base.filter((n) => etapaNota(n) === e).length
  const lista = base.filter((n) => filtro === 'todas' || etapaNota(n) === filtro)
    .sort((a, b) => ['assinar', 'digitalizar', 'entregar', 'concluida'].indexOf(etapaNota(a)) - ['assinar', 'digitalizar', 'entregar', 'concluida'].indexOf(etapaNota(b)) || b.recebida_em.localeCompare(a.recebida_em))
  // Contratos que mandam nota todo mês e ainda não mandaram neste mês
  const faltando = termo ? [] : dados.contratos.filter((c) => c.nota_mensal && ['ativo', 'renovar'].includes(situacaoContrato(c, agora))
    && c.inicio.slice(0, 7) <= chave.slice(0, 7) && !dados.notas.some((n) => n.contrato_id === c.id && n.competencia === chave))

  async function marcar(n: NotaFiscal, mudanca: Partial<NotaFiscal>) {
    setErro(null)
    try { await salvar('notas_fiscais', clienteId, n.id, mudanca); await recarregar() } catch (e) { setErro((e as Error).message) }
  }
  const agoraIso = () => new Date().toISOString()
  function pedirArquivo(n: NotaFiscal) { setDigitalizar(n); (document.getElementById('nf-digitalizar') as HTMLInputElement | null)?.click() }

  return (
    <>
      <div className="notas-barra">
        <div className="mes-nav">
          <button type="button" className="icone-botao" aria-label="Mês anterior" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))}><ChevronLeft size={18} /></button>
          <strong>{nomeMes(mes)}</strong>
          <button type="button" className="icone-botao" aria-label="Próximo mês" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))}><ChevronRight size={18} /></button>
        </div>
        <label className="busca-notas"><Search size={16} aria-hidden /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar: nº da nota, fornecedor, outdoor, evento, protocolo…" aria-label="Buscar notas" /></label>
        <BotaoPlanilha nome={`notas-fiscais-${chave.slice(0, 7)}`} exportar={() => ({
          colunas: ['Nº', 'Fornecedor', 'Referente a', 'Do quê', 'Evento', 'Valor', 'Recebida', 'Assinada', 'Digitalizada', 'Entregue', 'Para quem', 'Protocolo'],
          linhas: lista.map((n) => [n.numero, fornecedor(n), REFERENTES.find((r) => r.valor === n.referente_tipo)?.rotulo, n.referente, evento(n.evento_id)?.nome, n.valor,
            dataBr(n.recebida_em), dataBr(n.assinada_em), dataBr(n.digitalizada_em), dataBr(n.entregue_em), n.entregue_para, n.protocolo]),
        })} />
      </div>

      <div className="notas-total">
        <span><small>{termo ? 'Total encontrado' : `Total das notas de ${mes.toLocaleDateString('pt-BR', { month: 'long' })}`}</small><strong>{reais(base.reduce((t, n) => t + (n.valor ?? 0), 0))}</strong></span>
        <span className="pequeno">Só para controle: o valor das notas não mexe na verba do mês.</span>
      </div>
      <div className="pauta-temas">
        <button type="button" className={`chip${filtro === 'todas' ? '' : ' chip--neutro'}`} aria-pressed={filtro === 'todas'} onClick={() => setFiltro('todas')}>{termo ? 'Resultados' : 'Todas do mês'} · {base.length}</button>
        {(['assinar', 'digitalizar', 'entregar', 'concluida'] as EtapaNota[]).map((e) => (
          <button key={e} type="button" className={`chip ${filtro === e ? '' : e === 'concluida' ? 'chip--neutro' : contagem(e) ? 'chip--alerta' : 'chip--neutro'}`} aria-pressed={filtro === e} onClick={() => setFiltro(filtro === e ? 'todas' : e)}>{ROTULO_ETAPA[e]} · {contagem(e)}</button>
        ))}
      </div>
      {erro && <p className="importar__erro">{erro}</p>}

      {faltando.length > 0 && (
        <section className="notas-faltando">
          <strong><Inbox size={16} /> Ainda não chegou a nota de {mes.toLocaleDateString('pt-BR', { month: 'long' })}</strong>
          <ul>{faltando.map((c) => (
            <li key={c.id}>
              <span><b>{fornecedor(c)}</b> · {c.titulo}{c.referente ? <small>{c.referente}</small> : null}</span>
              <button type="button" className="botao botao--secundario botao--mini" onClick={() => setNovaPara({ fornecedor_id: c.fornecedor_id, contrato_id: c.id, valor: c.valor, referente_tipo: c.referente_tipo ?? 'servico', referente: c.referente, competencia: chave })}>Chegou</button>
            </li>
          ))}</ul>
        </section>
      )}

      {lista.length === 0 ? (
        <div className="vazio-grande"><FileText size={34} /><h3>{termo ? 'Nada encontrado' : `Nenhuma nota em ${nomeMes(mes)}`}</h3><p className="texto-2">Registre cada nota quando ela chegar, dizendo de onde ela é. Depois é só ir marcando: assinada, digitalizada e entregue.</p></div>
      ) : (
        <ul className="notas">
          {lista.map((n) => {
            const Icone = ICONE_REFERENTE[n.referente_tipo]
            const ev = evento(n.evento_id)
            const ct = contrato(n.contrato_id)
            const etapa = etapaNota(n)
            const passos: { chave: string; rotulo: string; icone: React.ElementType; feito: boolean; quando: string | null; quem: string | null; agir: () => void }[] = [
              { chave: 'recebida', rotulo: 'Recebida', icone: Inbox, feito: true, quando: n.recebida_em, quem: primeiroNome(pessoas, n.recebida_por), agir: () => setAbrir(n) },
              { chave: 'assinada', rotulo: 'Assinada', icone: PenLine, feito: !!n.assinada_em, quando: n.assinada_em, quem: primeiroNome(pessoas, n.assinada_por),
                agir: () => void marcar(n, n.assinada_em ? { assinada_em: null, assinada_por: null } : { assinada_em: agoraIso(), assinada_por: eu }) },
              { chave: 'digitalizada', rotulo: 'Digitalizada', icone: ScanLine, feito: !!n.arquivo_path, quando: n.digitalizada_em, quem: null,
                agir: () => (n.arquivo_path ? void abrirArquivo(n.arquivo_path) : pedirArquivo(n)) },
              { chave: 'entregue', rotulo: 'Entregue', icone: Truck, feito: !!n.entregue_em, quando: n.entregue_em, quem: n.entregue_para,
                agir: () => (n.entregue_em ? setAbrir(n) : setEntregar(n)) },
            ]
            const proximo = passos.find((p) => !p.feito)?.chave
            return (
              <li key={n.id} className={`nota nota--${etapa}`}>
                <button type="button" className="nota__abrir" onClick={() => setAbrir(n)}>
                  <span className={`nota__icone nota__icone--${n.referente_tipo}`}><Icone size={20} /></span>
                  <span className="nota__texto">
                    <span className="nota__referente">{REFERENTES.find((r) => r.valor === n.referente_tipo)?.rotulo}{ev ? ` · ${ev.nome}` : ''}{n.referente ? ` · ${n.referente}` : ''}</span>
                    <strong>{fornecedor(n)}{n.numero ? <small> · NF {n.numero}</small> : null}</strong>
                    <small>{[n.valor != null && reais(n.valor), ct && `Contrato: ${ct.titulo}`, ev && `Evento em ${dataBr(ev.data)}`, termo && `Mês: ${nomeMes(new Date(`${n.competencia}T12:00:00`))}`].filter(Boolean).join(' · ')}</small>
                  </span>
                </button>
                <ol className="nota__passos" aria-label="Andamento da nota">
                  {passos.map((p) => {
                    const PI = p.icone
                    return (
                      <li key={p.chave}>
                        <button type="button" className={`passo${p.feito ? ' feito' : ''}${proximo === p.chave ? ' proximo' : ''}`} onClick={p.agir}
                          title={p.feito ? `${p.rotulo}${p.quando ? ` em ${dataBr(p.quando)}` : ''}${p.quem ? ` · ${p.quem}` : ''}${p.chave === 'assinada' ? ' (clique para desfazer)' : ''}` : `Marcar como ${p.rotulo.toLowerCase()}`}>
                          <span className="passo__bola">{p.feito ? <Check size={13} /> : <PI size={13} />}</span>
                          <span className="passo__texto">{p.feito ? p.rotulo : proximo === p.chave ? (p.chave === 'assinada' ? 'Assinar' : p.chave === 'digitalizada' ? 'Digitalizar' : 'Entregar') : p.rotulo}
                            <small>{p.feito ? [dataCurta(p.quando), p.quem].filter(Boolean).join(' · ') : ' '}</small></span>
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </li>
            )
          })}
        </ul>
      )}

      <input id="nf-digitalizar" type="file" hidden accept=".pdf,image/*"
        onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = ''
          if (!f || !digitalizar) return
          try { const caminho = await enviarArquivo(clienteId, 'notas', f); await marcar(digitalizar, { arquivo_path: caminho, digitalizada_em: agoraIso() }) }
          catch (x) { setErro((x as Error).message) }
          setDigitalizar(null)
        }} />

      {entregar && <EntregaModal nota={entregar} fornecedor={fornecedor(entregar)} onFechar={() => setEntregar(null)}
        onSalvar={async (para, protocolo) => { await marcar(entregar, { entregue_em: agoraIso(), entregue_por: eu, entregue_para: para, protocolo }); setEntregar(null) }} />}
      {(abrir || novaPara) && <FichaNota clienteId={clienteId} nota={abrir} inicial={novaPara ?? { competencia: chave }} dados={dados} eventos={eventos} pessoas={pessoas}
        onFechar={() => { setAbrir(null); setNovaPara(null) }}
        onSalvar={async (n) => {
          // O valor fica só na nota: não entra na verba do mês do Financeiro
          const id = await salvar('notas_fiscais', clienteId, abrir?.id ?? null, n)
          setAbrir(null); setNovaPara(null); await recarregar()
          return id
        }}
        onExcluir={abrir ? async () => { await excluir('notas_fiscais', abrir.id); setAbrir(null); await recarregar() } : undefined} />}
    </>
  )
}

function EntregaModal({ nota, fornecedor, onFechar, onSalvar }: { nota: NotaFiscal; fornecedor: string; onFechar: () => void; onSalvar: (para: string | null, protocolo: string | null) => Promise<void> }) {
  const [para, setPara] = useState(() => { try { return localStorage.getItem('luminy.almoxarifado') ?? '' } catch { return '' } })
  const [protocolo, setProtocolo] = useState('')
  return (
    <Janela titulo="Entregar ao almoxarifado" onFechar={onFechar} largura={460}>
      <form className="janela__corpo" onSubmit={(e) => {
        e.preventDefault()
        try { if (para.trim()) localStorage.setItem('luminy.almoxarifado', para.trim()) } catch { /* sem armazenamento */ }
        void onSalvar(para.trim() || null, protocolo.trim() || null)
      }}>
        <p className="texto-2" style={{ margin: 0 }}>{fornecedor}{nota.numero ? ` · NF ${nota.numero}` : ''}</p>
        <div className="campo"><label htmlFor="en-para">Entregue para (opcional)</label><input id="en-para" className="entrada" autoFocus value={para} onChange={(e) => setPara(e.target.value)} placeholder="Ex.: Sandra (almoxarifado)" /></div>
        <div className="campo"><label htmlFor="en-prot">Protocolo (opcional)</label><input id="en-prot" className="entrada" value={protocolo} onChange={(e) => setProtocolo(e.target.value)} placeholder="Nº do protocolo ou do recibo" /></div>
        <div className="linha" style={{ justifyContent: 'flex-end' }}><Botao type="button" variante="fantasma" onClick={onFechar}>Cancelar</Botao><Botao type="submit" icone={<Truck size={15} />}>Marcar como entregue</Botao></div>
      </form>
    </Janela>
  )
}

function FichaNota({ clienteId, nota, inicial, dados, eventos, pessoas, onFechar, onSalvar, onExcluir }: {
  clienteId: string; nota: NotaFiscal | null; inicial: Partial<NotaFiscal>; dados: DadosNegocios; eventos: Evento[]; pessoas: Pessoa[]
  onFechar: () => void; onSalvar: (n: Partial<NotaFiscal>) => Promise<string>; onExcluir?: () => Promise<void>
}) {
  const v = { ...inicial, ...(nota ?? {}) }
  const [fornecedorId, setFornecedorId] = useState(v.fornecedor_id ?? '')
  const [fornecedorNome, setFornecedorNome] = useState(v.fornecedor_nome ?? '')
  const [numero, setNumero] = useState(v.numero ?? '')
  const [valor, setValor] = useState(valorParaCampo(v.valor))
  const [emissao, setEmissao] = useState(v.emissao ?? '')
  const [competencia, setCompetencia] = useState(() => (v.competencia ?? mesIso(new Date())).slice(0, 7))
  const [contratoId, setContratoId] = useState(v.contrato_id ?? '')
  const [tipo, setTipo] = useState<ReferenteTipo>(v.referente_tipo ?? 'servico')
  const [referente, setReferente] = useState(v.referente ?? '')
  const [eventoId, setEventoId] = useState(v.evento_id ?? '')
  const [recebida, setRecebida] = useState(() => v.recebida_em ?? hojeIso())
  const [arquivo, setArquivo] = useState<string | null>(v.arquivo_path ?? null)
  const [entreguePara, setEntreguePara] = useState(v.entregue_para ?? '')
  const [protocolo, setProtocolo] = useState(v.protocolo ?? '')
  const [observacao, setObservacao] = useState(v.observacao ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const contratosDoFornecedor = dados.contratos.filter((c) => c.situacao !== 'encerrado' && (!fornecedorId || c.fornecedor_id === fornecedorId))
  const lancado = nota?.lancamento_id ? dados.lancamentos.find((l) => l.id === nota.lancamento_id) : null

  function escolherContrato(id: string) {
    setContratoId(id)
    const c: Contrato | undefined = dados.contratos.find((x) => x.id === id)
    if (!c) return
    if (!fornecedorId && c.fornecedor_id) setFornecedorId(c.fornecedor_id)
    if (c.referente_tipo) setTipo(c.referente_tipo)
    if (!valor && c.periodicidade === 'mensal') setValor(valorParaCampo(c.valor))
  }
  async function salvarTudo() {
    if (!fornecedorId && !fornecedorNome.trim()) { setErro('Diga de qual fornecedor é a nota.'); return }
    if (!referente.trim() && !eventoId) { setErro('Diga do que é a nota (qual outdoor, lona, evento…). É isso que ajuda a achar depois.'); return }
    setSalvando(true); setErro(null)
    try {
      await onSalvar({
        fornecedor_id: fornecedorId || null, fornecedor_nome: fornecedorId ? null : fornecedorNome.trim(), numero: numero.trim() || null, valor: lerValor(valor), emissao: emissao || null,
        competencia: `${competencia}-01`, contrato_id: contratoId || null, referente_tipo: tipo, referente: referente.trim() || null, evento_id: tipo === 'evento' ? eventoId || null : null,
        recebida_em: recebida, arquivo_path: arquivo, digitalizada_em: arquivo ? nota?.digitalizada_em ?? new Date().toISOString() : null,
        entregue_para: nota?.entregue_em ? entreguePara.trim() || null : nota?.entregue_para ?? null, protocolo: nota?.entregue_em ? protocolo.trim() || null : nota?.protocolo ?? null,
        observacao: observacao.trim() || null,
      })
    } catch (e) { setErro((e as Error).message); setSalvando(false) }
  }
  const dica = REFERENTES.find((r) => r.valor === tipo)?.dica

  return (
    <Janela titulo={nota ? 'Nota fiscal' : 'Registrar nota fiscal'} onFechar={onFechar} largura={640}>
      <form className="janela__corpo" onSubmit={(e) => { e.preventDefault(); void salvarTudo() }}>
        <div className="campo"><span className="rotulo-campo">De onde é esta nota</span>
          <div className="referentes" role="radiogroup" aria-label="Referente a">
            {REFERENTES.map((r) => { const I = ICONE_REFERENTE[r.valor]; return (
              <button key={r.valor} type="button" role="radio" aria-checked={tipo === r.valor} className={`referente referente--${r.valor}${tipo === r.valor ? ' marcado' : ''}`} onClick={() => setTipo(r.valor)}><I size={16} /> {r.rotulo}</button>
            ) })}
          </div>
        </div>
        {tipo === 'evento' && (
          <div className="campo"><label htmlFor="nf-ev">Qual evento</label>
            <Selecao id="nf-ev" valor={eventoId} onMudar={setEventoId} busca={eventos.length > 6} vazio="Escolher evento da agenda"
              opcoes={[{ valor: '', rotulo: 'Nenhum (escrever abaixo)' }, ...[...eventos].sort((a, b) => b.data.localeCompare(a.data)).map((e) => ({ valor: e.id, rotulo: e.nome, descricao: `${dataBr(e.data)}${e.local ? ` · ${e.local}` : ''}` }))]} /></div>
        )}
        <div className="campo"><label htmlFor="nf-ref">{tipo === 'outdoor' ? 'Qual outdoor' : tipo === 'material' ? 'Qual material' : tipo === 'evento' ? 'O que foi pago no evento' : 'Do que é'}</label>
          <input id="nf-ref" className="entrada" autoFocus={!nota} value={referente} onChange={(e) => setReferente(e.target.value)} placeholder={dica} /></div>
        <div className="grade-2">
          <div className="campo"><label htmlFor="nf-forn">Fornecedor</label><SeletorFornecedor id="nf-forn" valor={fornecedorId} onMudar={(x) => { setFornecedorId(x); if (contratoId && dados.contratos.find((c) => c.id === contratoId)?.fornecedor_id !== x) setContratoId('') }} fornecedores={dados.fornecedores} vazio="Outro (escrever o nome)" /></div>
          {!fornecedorId ? <div className="campo"><label htmlFor="nf-fnome">Nome do fornecedor</label><input id="nf-fnome" className="entrada" value={fornecedorNome} onChange={(e) => setFornecedorNome(e.target.value)} /></div>
            : <div className="campo"><label htmlFor="nf-ct">Contrato (opcional)</label>
              <Selecao id="nf-ct" valor={contratoId} onMudar={escolherContrato} opcoes={[{ valor: '', rotulo: 'Sem contrato' }, ...contratosDoFornecedor.map((c) => ({ valor: c.id, rotulo: c.titulo, descricao: c.referente ?? undefined }))]} /></div>}
          <div className="campo"><label htmlFor="nf-num">Nº da nota</label><input id="nf-num" className="entrada" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ex.: 4521" /></div>
          <div className="campo"><label htmlFor="nf-valor">Valor</label><CampoValor id="nf-valor" valor={valor} onMudar={setValor} /></div>
          <div className="campo"><label htmlFor="nf-comp">Mês de referência</label><input id="nf-comp" type="month" className="entrada" value={competencia} onChange={(e) => e.target.value && setCompetencia(e.target.value)} /></div>
          <div className="campo"><label htmlFor="nf-rec">Chegou em</label><input id="nf-rec" type="date" className="entrada" value={recebida} onChange={(e) => setRecebida(e.target.value)} /></div>
          <div className="campo"><label htmlFor="nf-em">Emissão (opcional)</label><input id="nf-em" type="date" className="entrada" value={emissao} onChange={(e) => setEmissao(e.target.value)} /></div>
        </div>
        <div className="campo"><span className="rotulo-campo">Nota digitalizada</span><CampoArquivo clienteId={clienteId} pasta="notas" caminho={arquivo} onMudar={setArquivo} rotulo="Anexar nota assinada (PDF ou foto)" /></div>

        {nota && (
          <section className="nota-historico">
            <span className="rotulo-campo">Andamento</span>
            <ul>
              <li className="feito"><Inbox size={14} /> Recebida em {dataBr(nota.recebida_em)}{primeiroNome(pessoas, nota.recebida_por) ? ` · registrada por ${primeiroNome(pessoas, nota.recebida_por)}` : ''}</li>
              <li className={nota.assinada_em ? 'feito' : ''}><PenLine size={14} /> {nota.assinada_em ? `Assinada em ${dataBr(nota.assinada_em)}${primeiroNome(pessoas, nota.assinada_por) ? ` por ${primeiroNome(pessoas, nota.assinada_por)}` : ''}` : 'Ainda não assinada'}</li>
              <li className={nota.arquivo_path ? 'feito' : ''}><ScanLine size={14} /> {nota.arquivo_path ? `Digitalizada${nota.digitalizada_em ? ` em ${dataBr(nota.digitalizada_em)}` : ''}` : 'Ainda não digitalizada'}</li>
              <li className={nota.entregue_em ? 'feito' : ''}><Truck size={14} /> {nota.entregue_em ? `Entregue em ${dataBr(nota.entregue_em)}` : 'Ainda não entregue ao almoxarifado'}</li>
            </ul>
            {nota.entregue_em && (
              <div className="grade-2">
                <div className="campo"><label htmlFor="nf-para">Entregue para</label><input id="nf-para" className="entrada" value={entreguePara} onChange={(e) => setEntreguePara(e.target.value)} /></div>
                <div className="campo"><label htmlFor="nf-prot">Protocolo</label><input id="nf-prot" className="entrada" value={protocolo} onChange={(e) => setProtocolo(e.target.value)} /></div>
              </div>
            )}
            {lancado && <span className="pequeno">No Financeiro: {reais(lancado.valor)} · {lancado.situacao === 'pago' ? 'pago' : 'previsto'} em {dataBr(lancado.data)}</span>}
          </section>
        )}
        <div className="campo"><label htmlFor="nf-obs">Observação (opcional)</label><input id="nf-obs" className="entrada" value={observacao} onChange={(e) => setObservacao(e.target.value)} /></div>
        {erro && <p className="importar__erro">{erro}</p>}
        <div className="linha" style={{ justifyContent: 'space-between' }}>
          <div>{onExcluir && (confirmar
            ? <Botao type="button" variante="fantasma" className="texto-perigo" onClick={() => void onExcluir()}>Confirmar exclusão</Botao>
            : <Botao type="button" variante="fantasma" icone={<Trash2 size={15} />} onClick={() => setConfirmar(true)}>Excluir</Botao>)}</div>
          <div className="linha" style={{ gap: 8 }}><Botao type="button" variante="fantasma" onClick={onFechar}>Cancelar</Botao><Botao type="submit" disabled={salvando}>{salvando ? 'Salvando…' : nota ? 'Salvar' : 'Registrar nota'}</Botao></div>
        </div>
      </form>
    </Janela>
  )
}
