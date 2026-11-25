import { useCallback, useEffect, useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock } from 'lucide-react'
import { Chip } from '../../components/ui'
import { useSessao } from '../../lib/sessao'
import { ETAPAS, dataBr, listarEmpresas, salvarEmpresa, type Empresa, type Etapa, type Resumo } from '../../lib/parcerias'
import '../kanban.css'

/** Quadro das parcerias: cada empresa é um card que anda pelas etapas, da prospecção à parceria ativa. */
export function Parcerias() {
  const { cliente } = useSessao()
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [resumos, setResumos] = useState<Map<string, Resumo>>(new Map())
  const [alvo, setAlvo] = useState<Etapa | null>(null)

  const carregar = useCallback(async () => {
    if (!cliente) return
    const r = await listarEmpresas(cliente.id)
    setEmpresas(r.empresas); setResumos(r.resumos)
  }, [cliente])
  useEffect(() => { void Promise.resolve().then(carregar) }, [carregar])

  async function soltar(e: DragEvent, etapa: Etapa) {
    e.preventDefault(); setAlvo(null)
    const id = e.dataTransfer.getData('text/plain')
    const emp = empresas.find((x) => x.id === id)
    if (!emp || emp.etapa === etapa) return
    setEmpresas(empresas.map((x) => (x.id === id ? { ...x, etapa } : x)))
    await salvarEmpresa(id, { etapa })
    await carregar()
  }

  return (
    <div className="quadro quadro-parcerias" style={{ marginRight: -40 }}>
      {ETAPAS.map((et) => {
        const lista = empresas.filter((x) => x.etapa === et.id)
        return (
          <section key={et.id} className={`coluna${alvo === et.id ? ' coluna--alvo' : ''}`} aria-label={et.nome}
            onDragOver={(e) => { e.preventDefault(); setAlvo(et.id) }} onDragLeave={() => setAlvo((a) => (a === et.id ? null : a))}
            onDrop={(e) => void soltar(e, et.id)}>
            <header className="coluna__topo">
              <span className="coluna__ponto" style={{ background: et.cor }} />
              <strong>{et.nome}</strong><span className="pequeno">{lista.length}</span>
            </header>
            {lista.map((emp) => {
              const r = resumos.get(emp.id)
              return (
                <Link key={emp.id} to={`/eventos/empresas/${emp.id}`} className="card" draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', emp.id)} style={{ color: 'inherit' }}>
                  <strong className="card__titulo">{emp.nome}</strong>
                  {emp.convenios.length > 0 && <div className="card__etiquetas">{emp.convenios.map((c) => <Chip key={c} tom="neutro">{c}</Chip>)}</div>}
                  <div className="card__empresa-meta">
                    {r?.ultima_descricao && <span className="pequeno">Último: {r.ultima_descricao}</span>}
                    {emp.proximo_passo && <span className="pequeno linha" style={{ color: 'var(--marca)' }}><CalendarClock size={12} /> {emp.proximo_passo}{emp.proximo_passo_em ? ` · ${dataBr(emp.proximo_passo_em)}` : ''}</span>}
                  </div>
                </Link>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}
