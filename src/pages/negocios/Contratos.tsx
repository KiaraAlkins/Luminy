import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, CircleDashed, FileSignature, FileText, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { Botao } from '../../components/ui'
import { Janela } from '../../components/Janela'
import { Selecao } from '../../components/Selecao'
import { useSessao } from '../../lib/sessao'
import { supabase } from '../../lib/supabase'
import { listarEventos, type Evento } from '../../lib/parcerias'
import { listarPessoas, type Pessoa } from '../../lib/kanban'
import { NotasFiscais } from './NotasFiscais'
import {
  REFERENTES, abrirArquivo, carregarNegocios, corCategoria, custoMensal, dataBr, diasAte, excluir, fimVigente, hojeIso, lerValor, mesIso, reais, salvar, situacaoContrato,
  type Contrato, type DadosNegocios, type NotaFiscal, type ReferenteTipo, type SituacaoContrato,
} from '../../lib/negocios'
import { CampoArquivo, CampoValor, ICONE_REFERENTE, SeletorFornecedor, opcoesCategoriaGasto, valorParaCampo } from './comum'
import './negocios.css'

const ROTULO: Record<SituacaoContrato, string> = { renovar: 'Renovar', vencido: 'Vencido', para_assinar: 'Para assinar', ativo: 'Ativo', encerrado: 'Encerrado' }
const ORDEM: SituacaoContrato[] = ['vencido', 'renovar', 'para_assinar', 'ativo', 'encerrado']
const PERIODO: Record<Contrato['periodicidade'], string> = { mensal: '/mês', anual: '/ano', unico: 'no total' }

/** Contratos e notas fiscais do marketing: de onde é cada nota e em que pé está, e os contratos com aviso de renovação. */
export function Contratos() {
  const { cliente, usuario } = useSessao()
  const [dados, setDados] = useState<DadosNegocios | null>(null)
  const [aba, setAba] = useState<'notas' | 'contratos'>('notas')
  const [eventos, setEventos] = useState<Evento[]>([])
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [novaNota, setNovaNota] = useState<Partial<NotaFiscal> | null>(null)
  const [filtro, setFiltro] = useState<SituacaoContrato | 'todos'>('todos')
  const [editar, setEditar] = useState<Contrato | 'novo' | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [agora] = useState(() => Date.now())

  const carregar = useCallback(async () => {
    if (!cliente) return
    try {
      const [d, e, p] = await Promise.all([carregarNegocios(cliente.id), listarEventos(cliente.id).catch(() => []), listarPessoas(cliente.id).catch(() => [])])
      setDados(d); setEventos(e); setPessoas(p)
    } catch (e) { setErro((e as Error).message) }
  }, [cliente])
  useEffect(() => { void Promise.resolve().then(carregar) }, [carregar])

  const lista = useMemo(() => (dados?.contratos ?? []).map((c) => ({ c, s: situacaoContrato(c, agora), fim: fimVigente(c, agora) }))
    .sort((a, b) => ORDEM.indexOf(a.s) - ORDEM.indexOf(b.s) || (a.fim ?? '9').localeCompare(b.fim ?? '9')), [dados, agora])
  const contagem = (s: SituacaoContrato) => lista.filter((x) => x.s === s).length
  const visiveis = lista.filter((x) => filtro === 'todos' ? x.s !== 'encerrado' : x.s === filtro)
  const mensal = lista.filter((x) => x.s === 'ativo' || x.s === 'renovar').reduce((t, x) => t + custoMensal(x.c), 0)
  const fornecedor = (id: string | null) => dados?.fornecedores.find((f) => f.id === id)?.nome ?? null
  const pendentesNotas = (dados?.notas ?? []).filter((n) => !n.entregue_em || !n.assinada_em || !n.arquivo_path).length
  const mesAtual = mesIso(new Date(agora))

  if (!cliente) return <div className="corpo"><h2>Contratos</h2><p className="texto-2">Crie um cliente primeiro.</p></div>

  return (
    <div className="corpo">
      <div className="linha" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div><h2>Contratos e notas</h2><p className="pequeno">De onde é cada nota fiscal, se já foi assinada, digitalizada e entregue ao almoxarifado, e quando cada contrato precisa ser renovado.</p></div>
        <div className="linha" style={{ gap: 10 }}>
          <div className="segmentos" role="radiogroup" aria-label="Ver">
            <button type="button" role="radio" aria-checked={aba === 'notas'} className={aba === 'notas' ? 'marcado' : ''} onClick={() => setAba('notas')}>Notas fiscais <span>{pendentesNotas}</span></button>
            <button type="button" role="radio" aria-checked={aba === 'contratos'} className={aba === 'contratos' ? 'marcado' : ''} onClick={() => setAba('contratos')}>Contratos <span>{contagem('renovar') + contagem('vencido') || lista.length - contagem('encerrado')}</span></button>
          </div>
          {aba === 'notas' ? <Botao icone={<Plus size={16} />} onClick={() => setNovaNota({ competencia: mesIso(new Date()) })}>Registrar nota</Botao>
            : <Botao icone={<Plus size={16} />} onClick={() => setEditar('novo')}>Novo contrato</Botao>}
        </div>
      </div>

      {aba === 'notas' && dados && (
        <NotasFiscais clienteId={cliente.id} eu={supabase ? usuario.id : 'p1'} dados={dados} eventos={eventos} pessoas={pessoas} recarregar={carregar} agora={agora} novaPara={novaNota} setNovaPara={setNovaNota} />
      )}
      {aba === 'notas' && !dados && <p className="pequeno">Carregando…</p>}

      {aba === 'contratos' && <>
      <div className="resumo-contratos">
        <span className="resumo-contratos__total"><small>Comprometido por mês</small><strong>{reais(mensal)}</strong></span>
        <div className="segmentos" role="radiogroup" aria-label="Filtrar contratos">
          <button type="button" role="radio" aria-checked={filtro === 'todos'} className={filtro === 'todos' ? 'marcado' : ''} onClick={() => setFiltro('todos')}>Em andamento <span>{lista.length - contagem('encerrado')}</span></button>
          {(['renovar', 'vencido', 'para_assinar', 'encerrado'] as SituacaoContrato[]).filter((s) => s === 'renovar' || contagem(s) > 0).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={filtro === s} className={filtro === s ? 'marcado' : ''} onClick={() => setFiltro(s)}>{ROTULO[s]} <span>{contagem(s)}</span></button>
          ))}
        </div>
      </div>
      {erro && <p className="importar__erro">{erro}</p>}

      {dados === null ? <p className="pequeno">Carregando…</p> : visiveis.length === 0 ? (
        <div className="vazio-grande"><FileSignature size={34} /><h3>{lista.length ? 'Nada com esse filtro' : 'Nenhum contrato ainda'}</h3><p className="texto-2">Cadastre os contratos com gráficas, fotógrafos, ferramentas e agências para não perder nenhuma renovação.</p></div>
      ) : (
        <ul className="contratos">
          {visiveis.map(({ c, s, fim }) => {
            const falta = fim ? diasAte(fim, agora) : null
            const total = fim ? Math.max(1, diasAte(fim, agora) - diasAte(c.inicio, agora)) : 1
            const andou = fim ? Math.min(100, Math.max(0, ((total - (falta ?? 0)) / total) * 100)) : 0
            return (
              <li key={c.id} className={`contrato contrato--${s}`}>
                <button type="button" className="contrato__abrir" onClick={() => setEditar(c)} aria-label={`Abrir ${c.titulo}`} />
                <div className="contrato__topo">
                  <span className={`contrato__situacao contrato__situacao--${s}`}>{ROTULO[s]}</span>
                  {c.renovacao_automatica && <span className="pequeno contrato__auto"><RefreshCw size={12} /> Renova sozinho</span>}
                  {c.categoria && <span className="pequeno"><span className="bolinha-cor" style={{ background: corCategoria(c.categoria) }} />{c.categoria}</span>}
                </div>
                <strong className="contrato__titulo">{c.titulo}</strong>
                <span className="contrato__fornecedor">{fornecedor(c.fornecedor_id) ?? 'Fornecedor não informado'}</span>
                {c.referente && <span className="contrato__referente">{(() => { const I = ICONE_REFERENTE[c.referente_tipo ?? 'outro']; return <I size={13} /> })()} {c.referente}</span>}
                <span className="contrato__valor">{reais(c.valor)} <small>{PERIODO[c.periodicidade]}</small></span>
                {fim ? (
                  <div className="contrato__vigencia">
                    <span className="contrato__trilho"><span style={{ width: `${andou}%` }} /></span>
                    <span className="pequeno">{dataBr(c.inicio)} a {dataBr(fim)} · <strong>{falta! < 0 ? `venceu há ${-falta!} dias` : falta === 0 ? 'vence hoje' : `faltam ${falta} dias`}</strong></span>
                  </div>
                ) : <span className="pequeno">Desde {dataBr(c.inicio)} · sem data de fim</span>}
                <div className="contrato__rodape">
                  {c.arquivo_path ? <button type="button" className="botao botao--fantasma botao--mini" onClick={() => void abrirArquivo(c.arquivo_path!)}><FileText size={14} /> Ver contrato</button>
                    : <span className="pequeno">Sem PDF anexado</span>}
                  {c.nota_mensal && (s === 'ativo' || s === 'renovar') && (dados.notas.some((n) => n.contrato_id === c.id && n.competencia === mesAtual)
                    ? <span className="pequeno contrato__nota ok"><CheckCircle2 size={13} /> Nota do mês chegou</span>
                    : <span className="pequeno contrato__nota"><CircleDashed size={13} /> Nota do mês não chegou</span>)}
                  {(s === 'renovar' || s === 'vencido') && <span className="pequeno contrato__dica">Hora de renovar ou cotar outro fornecedor</span>}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      </>}

      {editar && dados && <ContratoModal clienteId={cliente.id} contrato={editar === 'novo' ? null : editar} dados={dados} onFechar={() => setEditar(null)}
        onSalvar={async (c) => { await salvar('contratos', cliente.id, editar === 'novo' ? null : editar.id, c); setEditar(null); await carregar() }}
        onExcluir={editar !== 'novo' ? async () => { await excluir('contratos', editar.id); setEditar(null); await carregar() } : undefined} />}
    </div>
  )
}

function ContratoModal({ clienteId, contrato, dados, onFechar, onSalvar, onExcluir }: {
  clienteId: string; contrato: Contrato | null; dados: DadosNegocios; onFechar: () => void; onSalvar: (c: Partial<Contrato>) => Promise<void>; onExcluir?: () => Promise<void>
}) {
  const [titulo, setTitulo] = useState(contrato?.titulo ?? '')
  const [fornecedorId, setFornecedorId] = useState(contrato?.fornecedor_id ?? '')
  const [categoria, setCategoria] = useState(contrato?.categoria ?? '')
  const [valor, setValor] = useState(valorParaCampo(contrato?.valor))
  const [periodicidade, setPeriodicidade] = useState<Contrato['periodicidade']>(contrato?.periodicidade ?? 'mensal')
  const [inicio, setInicio] = useState(contrato?.inicio ?? hojeIso())
  const [fim, setFim] = useState(contrato?.fim ?? '')
  const [renova, setRenova] = useState(contrato?.renovacao_automatica ?? false)
  const [aviso, setAviso] = useState(String(contrato?.aviso_dias ?? 60))
  const [situacao, setSituacao] = useState<Contrato['situacao']>(contrato?.situacao ?? 'vigente')
  const [arquivo, setArquivo] = useState<string | null>(contrato?.arquivo_path ?? null)
  const [observacoes, setObservacoes] = useState(contrato?.observacoes ?? '')
  const [refTipo, setRefTipo] = useState<ReferenteTipo>(contrato?.referente_tipo ?? 'servico')
  const [referente, setReferente] = useState(contrato?.referente ?? '')
  const [notaMensal, setNotaMensal] = useState(contrato?.nota_mensal ?? false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [confirmar, setConfirmar] = useState(false)

  async function salvarTudo() {
    const n = lerValor(valor) ?? 0
    if (!titulo.trim()) { setErro('Diga do que é o contrato.'); return }
    if (fim && fim < inicio) { setErro('O fim não pode ser antes do início.'); return }
    setSalvando(true); setErro(null)
    try {
      await onSalvar({ titulo: titulo.trim(), fornecedor_id: fornecedorId || null, categoria: categoria || null, valor: n, periodicidade, inicio, fim: fim || null,
        renovacao_automatica: renova, aviso_dias: Math.max(0, Math.min(365, Number(aviso) || 60)), situacao, arquivo_path: arquivo, observacoes: observacoes.trim() || null,
        referente_tipo: refTipo, referente: referente.trim() || null, nota_mensal: notaMensal })
    } catch (e) { setErro((e as Error).message); setSalvando(false) }
  }
  return (
    <Janela titulo={contrato ? 'Contrato' : 'Novo contrato'} onFechar={onFechar} largura={620}>
      <form className="janela__corpo" onSubmit={(e) => { e.preventDefault(); void salvarTudo() }}>
        <div className="campo"><label htmlFor="ct-titulo">Do que é o contrato</label><input id="ct-titulo" className="entrada" autoFocus={!contrato} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Cobertura fotográfica dos eventos" /></div>
        <div className="grade-2">
          <div className="campo"><label htmlFor="ct-forn">Fornecedor</label><SeletorFornecedor id="ct-forn" valor={fornecedorId} onMudar={setFornecedorId} fornecedores={dados.fornecedores} vazio="Escolher" /></div>
          <div className="campo"><label htmlFor="ct-cat">Categoria</label><Selecao id="ct-cat" valor={categoria} onMudar={setCategoria} opcoes={opcoesCategoriaGasto} /></div>
          <div className="campo"><label htmlFor="ct-valor">Valor</label><CampoValor id="ct-valor" valor={valor} onMudar={setValor} /></div>
          <div className="campo"><label htmlFor="ct-per">Cobrança</label>
            <Selecao id="ct-per" valor={periodicidade} onMudar={(v) => setPeriodicidade(v as Contrato['periodicidade'])}
              opcoes={[{ valor: 'mensal', rotulo: 'Mensal' }, { valor: 'anual', rotulo: 'Anual' }, { valor: 'unico', rotulo: 'Valor total (único)' }]} /></div>
          <div className="campo"><label htmlFor="ct-ini">Início</label><input id="ct-ini" type="date" className="entrada" value={inicio} onChange={(e) => setInicio(e.target.value)} /></div>
          <div className="campo"><label htmlFor="ct-fim">Fim da vigência</label><input id="ct-fim" type="date" className="entrada" min={inicio} value={fim} onChange={(e) => setFim(e.target.value)} /></div>
        </div>
        <div className="campo"><span className="rotulo-campo">Referente a</span>
          <div className="referentes" role="radiogroup" aria-label="Referente a">
            {REFERENTES.map((r) => { const I = ICONE_REFERENTE[r.valor]; return (
              <button key={r.valor} type="button" role="radio" aria-checked={refTipo === r.valor} className={`referente referente--${r.valor}${refTipo === r.valor ? ' marcado' : ''}`} onClick={() => setRefTipo(r.valor)}><I size={16} /> {r.rotulo}</button>
            ) })}
          </div>
          <input className="entrada" aria-label="O que o contrato cobre" value={referente} onChange={(e) => setReferente(e.target.value)} placeholder={refTipo === 'outdoor' ? 'Ex.: Pontos Av. Central (12), BR-040 km 8 (7)' : REFERENTES.find((r) => r.valor === refTipo)?.dica} />
        </div>
        <label className="pauta-repetir-opcao">
          <input type="checkbox" checked={notaMensal} onChange={(e) => setNotaMensal(e.target.checked)} />
          <span><strong>Chega nota fiscal todo mês</strong><small>O Luminy avisa em Notas fiscais quando a nota do mês ainda não chegou.</small></span>
        </label>
        <div className="grade-2">
          <label className="pauta-repetir-opcao" style={{ margin: 0 }}>
            <input type="checkbox" checked={renova} onChange={(e) => setRenova(e.target.checked)} />
            <span><strong>Renova sozinho</strong><small>Contratos e assinaturas que renovam automaticamente todo ano.</small></span>
          </label>
          <div className="campo"><label htmlFor="ct-aviso">Avisar quantos dias antes de vencer</label><input id="ct-aviso" className="entrada" inputMode="numeric" value={aviso} onChange={(e) => setAviso(e.target.value.replace(/\D/g, ''))} /></div>
        </div>
        <div className="campo"><span className="rotulo-campo">Situação</span>
          <div className="segmentos" role="radiogroup" aria-label="Situação">
            {([['vigente', 'Em vigor'], ...(contrato?.situacao === 'para_assinar' ? [['para_assinar', 'Para assinar']] : []), ['encerrado', 'Encerrado']] as [Contrato['situacao'], string][]).map(([v, r]) => (
              <button key={v} type="button" role="radio" aria-checked={situacao === v} className={situacao === v ? 'marcado' : ''} onClick={() => setSituacao(v)}>{r}</button>
            ))}
          </div>
        </div>
        <div className="campo"><span className="rotulo-campo">Contrato em PDF</span><CampoArquivo clienteId={clienteId} pasta="contratos" caminho={arquivo} onMudar={setArquivo} rotulo="Anexar contrato" /></div>
        <div className="campo"><label htmlFor="ct-obs">Observações (opcional)</label><textarea id="ct-obs" className="entrada" rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Multa, reajuste, o que está incluso…" /></div>
        {erro && <p className="importar__erro">{erro}</p>}
        <div className="linha" style={{ justifyContent: 'space-between' }}>
          <div>{onExcluir && (confirmar
            ? <Botao type="button" variante="fantasma" className="texto-perigo" onClick={() => void onExcluir()}>Confirmar exclusão</Botao>
            : <Botao type="button" variante="fantasma" icone={<Trash2 size={15} />} onClick={() => setConfirmar(true)}>Excluir</Botao>)}</div>
          <div className="linha" style={{ gap: 8 }}><Botao type="button" variante="fantasma" onClick={onFechar}>Cancelar</Botao><Botao type="submit" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Botao></div>
        </div>
      </form>
    </Janela>
  )
}
