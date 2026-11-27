import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PartyPopper } from 'lucide-react'
import logo from '../assets/luminy-logo.svg'
import { supabase } from '../lib/supabase'
import { tempoDesde } from '../lib/foco'
import { comemorar } from '../lib/comemorar'
import { montarCalendario, type CampanhaPropria } from '../lib/pautas'
import './tv.css'

type Pessoa = { id: string; nome: string; titulo: string | null; desde: string | null }
type Concluido = { id: string; nome: string; titulo: string; em: string }
type Painel = { cliente: string; cor: string; agora: string; pessoas: Pessoa[]; concluidos: Concluido[]; mostrar_campanhas?: boolean; campanhas?: Omit<CampanhaPropria, 'cliente_id' | 'criado_por' | 'criado_em'>[] }

const minutos = (n: number) => new Date(Date.now() - n * 60_000).toISOString()
const DEMO: Painel = {
  cliente: 'Hospital Santa Marta', cor: '#E5484D', agora: new Date().toISOString(),
  pessoas: [
    { id: '1', nome: 'Dilan', titulo: 'Finalizar carrossel Novembro Azul', desde: minutos(42) },
    { id: '2', nome: 'Kiara', titulo: 'Roteiro do vídeo da UTI', desde: minutos(18) },
    { id: '3', nome: 'Pedro', titulo: 'Proposta para a Transportadora Cerrado', desde: minutos(65) },
    { id: '4', nome: 'Braion', titulo: 'Artes da campanha da gripe', desde: minutos(7) },
    { id: '5', nome: 'Délly', titulo: null, desde: null },
    { id: '6', nome: 'Beatriz', titulo: 'Separar brindes do mutirão', desde: minutos(25) },
  ],
  mostrar_campanhas: true,
  campanhas: [{ id: 'cp1', nome: 'Aniversário de 40 anos do hospital', descricao: 'Campanha do cliente · todo ano', cor: '#7A5AF8', inicio: '2026-12-10', fim: '2026-12-10', anual: true }],
  concluidos: [{ id: 'c1', nome: 'Beatriz', titulo: 'Legendas da semana', em: minutos(50) }, { id: 'c2', nome: 'Kiara', titulo: 'Aprovação com a diretoria', em: minutos(120) }],
}

/**
 * Painel da TV do marketing. Aberto por link secreto, sem login, em tela cheia.
 * Atualiza a cada 5 segundos; quando alguém conclui a tarefa, faz festa e agradece.
 */
export function PainelTv() {
  const { token = '' } = useParams()
  const [painel, setPainel] = useState<Painel | null | undefined>(supabase ? undefined : DEMO)
  const [festa, setFesta] = useState<Concluido | null>(null)
  const vistos = useRef<Set<string> | null>(null)
  const [agora, setAgora] = useState(() => Date.now())

  useEffect(() => {
    let ativo = true
    async function buscar() {
      if (!supabase) return
      const { data } = await supabase.rpc('painel_tv', { p_token: token })
      if (!ativo) return
      const p = (data as Painel | null) ?? null
      setPainel(p)
      if (!p) return
      // Na primeira carga só memoriza; depois, cada conclusão nova vira festa
      if (vistos.current === null) { vistos.current = new Set(p.concluidos.map((c) => c.id)); return }
      const novo = p.concluidos.find((c) => !vistos.current!.has(c.id))
      p.concluidos.forEach((c) => vistos.current!.add(c.id))
      if (novo) { setFesta(novo); comemorar('grande'); setTimeout(() => setFesta(null), 8000) }
    }
    void buscar()
    const t = setInterval(() => { void buscar(); setAgora(Date.now()) }, 5000)
    return () => { ativo = false; clearInterval(t) }
  }, [token])

  useEffect(() => {
    // No modo demonstração, mostra uma comemoração de exemplo
    if (supabase) return
    const t = setTimeout(() => { setFesta({ id: 'x', nome: 'Kiara', titulo: 'Roteiro do vídeo da UTI', em: new Date().toISOString() }); comemorar('grande') }, 1200)
    return () => clearTimeout(t)
  }, [])

  if (painel === undefined) return <main className="tv"><p className="tv__aviso">Carregando painel…</p></main>
  if (painel === null) return <main className="tv"><p className="tv__aviso">Link do painel inválido ou desativado.</p></main>

  const DIA = 86_400_000
  const campanhas = painel.mostrar_campanhas === false ? [] : montarCalendario(new Date(agora),
    (painel.campanhas ?? []).map((c) => ({ ...c, cliente_id: '', criado_por: '', criado_em: '' })), 61).proximas.slice(0, 6)
  const ativos = painel.pessoas.filter((p) => p.titulo)
  const livres = painel.pessoas.filter((p) => !p.titulo)
  const dataLonga = new Date(agora).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const hoje = dataLonga.charAt(0).toUpperCase() + dataLonga.slice(1)

  return (
    <main className="tv">
      <header className="tv__topo">
        <img src={logo} alt="Luminy" className="tv__logo" />
        <div className="tv__cliente"><span>{painel.cliente}</span><strong>Fazendo agora</strong></div>
        <div className="tv__hora"><strong>{new Date(agora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong><span>{hoje}</span></div>
      </header>

      <section className="tv__grade">
        {ativos.map((p) => (
          <article key={p.id} className="tv__pessoa">
            <div className="tv__avatar">{p.nome.slice(0, 1).toUpperCase()}</div>
            <div className="tv__pessoa-texto">
              <span className="tv__nome">{p.nome}</span>
              <p className="tv__tarefa">{p.titulo}</p>
              {p.desde && <span className="tv__tempo">há {tempoDesde(p.desde, agora)}</span>}
            </div>
          </article>
        ))}
        {ativos.length === 0 && <p className="tv__aviso">Ninguém marcou o que está fazendo agora.</p>}
      </section>

      {campanhas.length > 0 && (
        <section className="tv__campanhas" aria-label="Campanhas e próximas datas">
          {campanhas.map((d) => {
            const falta = Math.ceil((d.inicio.getTime() - agora) / DIA)
            return (
              <article key={d.chave} className={`tv__campanha${falta <= 0 ? ' agora' : ''}`} style={{ '--cor': d.cor } as React.CSSProperties}>
                <span className="tv__campanha-quando">{falta <= 0 ? 'Acontecendo agora' : falta === 1 ? 'Amanhã' : `Em ${falta} dias`}</span>
                <strong>{d.nome}</strong>
                <span className="tv__campanha-desc">{d.descricao}</span>
              </article>
            )
          })}
        </section>
      )}

      <footer className="tv__rodape">
        {livres.length > 0 && <p><span className="tv__rotulo">Sem tarefa marcada</span> {livres.map((p) => p.nome).join(', ')}</p>}
        {painel.concluidos.length > 0 && (
          <p className="tv__feitas"><span className="tv__rotulo">Concluídas hoje</span>
            {painel.concluidos.slice(0, 6).map((c) => <span key={c.id} className="tv__feita">✓ {c.nome}: {c.titulo}</span>)}</p>
        )}
      </footer>

      {festa && (
        <div className="tv__festa" role="status">
          <PartyPopper size={72} aria-hidden />
          <h1>Valeu, {festa.nome}!</h1>
          <p>Concluiu: {festa.titulo}</p>
        </div>
      )}
    </main>
  )
}
