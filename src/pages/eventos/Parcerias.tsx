import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, ChevronsLeft, Snowflake } from 'lucide-react'
import { Chip } from '../../components/ui'
import { useSessao } from '../../lib/sessao'
import { posicaoEntre, useArrastar, useColunasMinimizadas, type Vaga } from '../../lib/arrastar'
import { CardVoando, FaixaColuna, VagaCard } from '../../components/Arrastar'
import { ETAPAS, esfriando, haQuanto, listarEmpresas, prazo, salvarEmpresa, type Empresa, type Resumo } from '../../lib/parcerias'
import '../kanban.css'

function ConteudoEmpresa({ emp, r }: { emp: Empresa; r?: Resumo }) {
  const p = emp.proximo_passo_em ? prazo(emp.proximo_passo_em) : null
  return (
    <>
      <strong className="card__titulo">{emp.nome}</strong>
      {emp.convenios.length > 0 && <div className="card__etiquetas">{emp.convenios.map((c) => <Chip key={c} tom="neutro">{c}</Chip>)}</div>}
      <div className="card__empresa-meta">
        {r?.ultima_interacao
          ? <span className="pequeno">{esfriando(emp, r.ultima_interacao) && <Snowflake size={12} style={{ color: 'var(--info)', verticalAlign: -1 }} />} Último contato {haQuanto(r.ultima_interacao)}</span>
          : <span className="pequeno" style={{ color: 'var(--info)' }}><Snowflake size={12} style={{ verticalAlign: -1 }} /> Nenhum contato ainda</span>}
        {emp.proximo_passo && (
          <span className="pequeno linha" style={{ color: 'var(--marca)' }}><CalendarClock size={12} /> {emp.proximo_passo}
            {p && <Chip tom={p.tom}>{p.texto}</Chip>}</span>
        )}
      </div>
    </>
  )
}

/** Quadro das parcerias: cada empresa é um card que anda pelas etapas, da prospecção à parceria ativa. */
export function Parcerias() {
  const { cliente } = useSessao()
  const navegar = useNavigate()
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [resumos, setResumos] = useState<Map<string, Resumo>>(new Map())

  const carregar = useCallback(async () => {
    if (!cliente) return
    const r = await listarEmpresas(cliente.id)
    setEmpresas(r.empresas); setResumos(r.resumos)
  }, [cliente])
  useEffect(() => { void Promise.resolve().then(carregar) }, [carregar])

  const daEtapa = (etapa: string) => empresas.filter((x) => x.etapa === etapa).sort((a, b) => a.posicao - b.posicao)

  function soltarEm(emp: Empresa, { coluna, indice }: Vaga) {
    const etapa = ETAPAS.find((e) => e.id === coluna)?.id
    if (!etapa) return
    const todos = daEtapa(etapa)
    if (emp.etapa === etapa && todos.findIndex((x) => x.id === emp.id) === indice) return
    const posicao = posicaoEntre(todos.filter((x) => x.id !== emp.id), indice)
    // Atualiza na hora; a mudança de etapa entra sozinha no histórico da empresa
    setEmpresas((lista) => lista.map((x) => (x.id === emp.id ? { ...x, etapa, posicao } : x)))
    quicar(emp.id)
    void salvarEmpresa(emp.id, emp.etapa === etapa ? { posicao } : { etapa, posicao }).then(carregar)
  }

  const { arraste, vaga, chegou, quadroRef, voandoRef, iniciar, acabouDeSoltar, quicar } = useArrastar<Empresa>({ idDe: (e) => e.id, aoSoltar: soltarEm })
  const colunas = useColunasMinimizadas(cliente ? `luminy.parcerias.colunas.${cliente.id}` : null, vaga)

  return (
    <>
      <div className="quadro quadro-parcerias" style={{ marginRight: -40 }} ref={quadroRef}>
        {ETAPAS.map((et) => {
          const lista = daEtapa(et.id)
          const visiveis = lista.filter((x) => x.id !== arraste?.id)
          const vagaAqui = arraste && vaga?.coluna === et.id ? vaga.indice : -1
          const slot = <VagaCard key="vaga" altura={arraste?.altura} />
          if (colunas.recolhida(et.id, lista.length)) {
            return <FaixaColuna key={et.id} id={et.id} nome={et.nome} cor={et.cor} total={lista.length} arrastando={!!arraste} onAbrir={() => colunas.alternar(et.id, lista.length)} />
          }
          return (
            <section key={et.id} data-coluna={et.id} className={`coluna${vagaAqui >= 0 ? ' coluna--alvo' : ''}`} aria-label={et.nome}>
              <header className="coluna__topo">
                <span className="coluna__ponto" style={{ background: et.cor }} />
                <strong>{et.nome}</strong><span className="pequeno">{lista.length}</span>
                <button className="coluna__mais" type="button" aria-label={`Minimizar coluna ${et.nome}`} title="Minimizar coluna" onClick={() => colunas.alternar(et.id, lista.length)}><ChevronsLeft size={16} /></button>
              </header>
              {visiveis.map((emp, i) => [
                i === vagaAqui && slot,
                <article key={emp.id} data-card={emp.id} className={`card${chegou === emp.id ? ' card--chegou' : ''}`} tabIndex={0} role="link"
                  aria-label={`Abrir ${emp.nome}`}
                  onPointerDown={(e) => iniciar(e, emp)}
                  onClick={() => { if (!acabouDeSoltar()) navegar(`/eventos/empresas/${emp.id}`) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') navegar(`/eventos/empresas/${emp.id}`) }}>
                  <ConteudoEmpresa emp={emp} r={resumos.get(emp.id)} />
                </article>,
              ])}
              {vagaAqui >= visiveis.length && slot}
              {lista.length === 0 && vagaAqui < 0 && <p className="pequeno" style={{ padding: '4px 8px' }}>Arraste uma empresa para cá</p>}
            </section>
          )
        })}
      </div>
      {arraste && <CardVoando arraste={arraste} voandoRef={voandoRef}><ConteudoEmpresa emp={arraste.item} r={resumos.get(arraste.id)} /></CardVoando>}
    </>
  )
}
