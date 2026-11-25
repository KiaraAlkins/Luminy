import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Plus } from 'lucide-react'
import { Botao, Chip } from '../../components/ui'
import { Janela } from '../../components/Janela'
import { useSessao } from '../../lib/sessao'
import { FotoEmpresa, SeletorEmpresa } from '../../components/Empresa'
import { SITUACOES_EVENTO, hojeIso, listarEmpresas, listarEventos, salvarEvento, type Empresa, type Evento, type SituacaoEvento } from '../../lib/parcerias'

const TOM: Record<SituacaoEvento, 'marca' | 'sucesso' | 'neutro' | 'perigo'> = { planejado: 'neutro', confirmado: 'marca', realizado: 'sucesso', cancelado: 'perigo' }

/** Eventos do cliente, ligados (ou não) a uma empresa parceira. */
export function Agenda() {
  const { cliente } = useSessao()
  const [eventos, setEventos] = useState<Evento[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [editar, setEditar] = useState<Partial<Evento> | null>(null)

  const carregar = useCallback(async () => {
    if (!cliente) return
    const [v, e] = await Promise.all([listarEventos(cliente.id), listarEmpresas(cliente.id)])
    setEventos(v); setEmpresas(e.empresas)
  }, [cliente])
  useEffect(() => { void Promise.resolve().then(carregar) }, [carregar])

  const hoje = hojeIso()
  const proximos = useMemo(() => eventos.filter((v) => v.data >= hoje && v.situacao !== 'cancelado'), [eventos, hoje])
  const passados = useMemo(() => eventos.filter((v) => v.data < hoje || v.situacao === 'cancelado').reverse(), [eventos, hoje])
  const nomeEmpresa = (id: string | null) => empresas.find((e) => e.id === id)

  const item = (v: Evento) => {
    const d = new Date(`${v.data}T12:00:00`)
    const emp = nomeEmpresa(v.empresa_id)
    return (
      <button key={v.id} type="button" className="evento-item" onClick={() => setEditar(v)}>
        <span className="evento-data">{d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}<strong>{d.getDate()}</strong></span>
        <span>
          <strong style={{ display: 'block' }}>{v.nome}</strong>
          <span className="pequeno linha">
            {v.hora && <span>{v.hora.slice(0, 5)}</span>}
            {v.local && <span className="linha"><MapPin size={12} /> {v.local}</span>}
            {emp && <Link className="empresa-link" to={`/eventos/empresas/${emp.id}`} onClick={(e) => e.stopPropagation()}><FotoEmpresa empresa={emp} tamanho={20} /> {emp.nome}</Link>}
          </span>
        </span>
        <Chip tom={TOM[v.situacao]}>{SITUACOES_EVENTO.find((s) => s.id === v.situacao)?.nome}</Chip>
      </button>
    )
  }

  return (
    <>
      <div className="linha" style={{ justifyContent: 'space-between' }}>
        <h3>Próximos eventos</h3>
        <Botao icone={<Plus size={16} />} onClick={() => setEditar({ data: hoje, situacao: 'planejado' })}>Novo evento</Botao>
      </div>
      <div className="lista-eventos">
        {proximos.map(item)}
        {proximos.length === 0 && <p className="texto-2">Nenhum evento marcado.</p>}
      </div>
      {passados.length > 0 && (<><h3>Realizados e cancelados</h3><div className="lista-eventos">{passados.map(item)}</div></>)}
      {editar && cliente && (
        <EditarEvento evento={editar} empresas={empresas} onFechar={() => setEditar(null)}
          onSalvar={async (ev) => { await salvarEvento(cliente.id, ev); setEditar(null); await carregar() }} />
      )}
    </>
  )
}

function EditarEvento({ evento, empresas, onFechar, onSalvar }: {
  evento: Partial<Evento>; empresas: Empresa[]; onFechar: () => void; onSalvar: (e: Omit<Evento, 'id' | 'cliente_id'> & { id?: string }) => Promise<void>
}) {
  const [v, setV] = useState({ nome: evento.nome ?? '', data: evento.data ?? hojeIso(), hora: evento.hora?.slice(0, 5) ?? '', local: evento.local ?? '',
    descricao: evento.descricao ?? '', situacao: evento.situacao ?? 'planejado', empresa_id: evento.empresa_id ?? '' })
  async function enviar(e: FormEvent) {
    e.preventDefault()
    await onSalvar({ id: evento.id, nome: v.nome.trim(), data: v.data, hora: v.hora || null, local: v.local.trim() || null, descricao: v.descricao.trim() || null,
      situacao: v.situacao as SituacaoEvento, empresa_id: v.empresa_id || null })
  }
  return (
    <Janela titulo={evento.id ? 'Editar evento' : 'Novo evento'} onFechar={onFechar} largura={560}>
      <form className="janela__corpo" onSubmit={enviar}>
        <div className="campo"><label htmlFor="ev-nome">Nome do evento</label><input id="ev-nome" className="entrada" autoFocus required value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} placeholder="Ex.: Mutirão de glicemia na Empresa X" /></div>
        <div className="grade-2">
          <div className="campo"><label htmlFor="ev-data">Data</label><input id="ev-data" className="entrada" type="date" required value={v.data} onChange={(e) => setV({ ...v, data: e.target.value })} /></div>
          <div className="campo"><label htmlFor="ev-hora">Horário</label><input id="ev-hora" className="entrada" type="time" value={v.hora} onChange={(e) => setV({ ...v, hora: e.target.value })} /></div>
        </div>
        <div className="campo"><label htmlFor="ev-emp">Empresa parceira</label>
          <SeletorEmpresa id="ev-emp" empresas={empresas} valor={v.empresa_id} semEmpresa="Sem empresa (evento do hospital)" onMudar={(id) => setV({ ...v, empresa_id: id })} /></div>
        <div className="campo"><label htmlFor="ev-local">Local</label><input id="ev-local" className="entrada" value={v.local} onChange={(e) => setV({ ...v, local: e.target.value })} /></div>
        <div className="campo"><label htmlFor="ev-sit">Situação</label>
          <select id="ev-sit" className="entrada" value={v.situacao} onChange={(e) => setV({ ...v, situacao: e.target.value as SituacaoEvento })}>
            {SITUACOES_EVENTO.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select></div>
        <div className="campo"><label htmlFor="ev-desc">Detalhes</label><textarea id="ev-desc" className="entrada" rows={3} value={v.descricao} onChange={(e) => setV({ ...v, descricao: e.target.value })} placeholder="Brindes, equipe, materiais, campanha QR…" /></div>
        <div className="linha" style={{ justifyContent: 'flex-end' }}><Botao type="button" variante="fantasma" onClick={onFechar}>Cancelar</Botao><Botao type="submit">Salvar</Botao></div>
      </form>
    </Janela>
  )
}
