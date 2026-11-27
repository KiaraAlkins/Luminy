import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronUp, Clock, Presentation } from 'lucide-react'
import { useSessao } from '../lib/sessao'
import { supabase } from '../lib/supabase'
import { comemorar } from '../lib/comemorar'
import {
  carregarConfig, cicloDe, deMinutos, definirLembretes, diaIso, saldoPeriodo, saldoTexto, ignorarHoje, ignoradosHoje, jornadaDoDia, lembretesLigados, listarPontos, minutos, salvarPonto,
  type ConfigPonto, type Ponto,
} from '../lib/ponto'
import { minhasReunioes, type Reuniao } from '../lib/reunioes'
import './ponto.css'

/** Horário com setinhas: ▲▼ nas horas e nos minutos (segurar acelera). Também aceita as setas do teclado. */
export function SeletorHora({ valor, onMudar, rotulo }: { valor: string; onMudar: (v: string) => void; rotulo: string }) {
  const atual = useRef(valor)
  useEffect(() => { atual.current = valor }, [valor])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const passo = (delta: number) => { const n = deMinutos(minutos(atual.current) + delta); atual.current = n; onMudar(n) }
  function segurar(delta: number) {
    passo(delta)
    let espera = 380
    const repetir = () => { passo(delta); espera = Math.max(50, espera * 0.75); timer.current = setTimeout(repetir, espera) }
    timer.current = setTimeout(repetir, espera)
  }
  const soltar = () => { if (timer.current) clearTimeout(timer.current); timer.current = null }
  useEffect(() => soltar, [])
  const [h, m] = valor.split(':')
  const seta = (delta: number, icone: React.ReactNode, nome: string) => (
    <button type="button" className="hora-seta" aria-label={nome} onPointerDown={(e) => { e.preventDefault(); segurar(delta) }} onPointerUp={soltar} onPointerLeave={soltar}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); passo(delta) } }}>{icone}</button>
  )
  return (
    <div className="hora" role="group" aria-label={rotulo} tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'ArrowUp') { e.preventDefault(); passo(e.shiftKey ? 60 : 1) } if (e.key === 'ArrowDown') { e.preventDefault(); passo(e.shiftKey ? -60 : -1) } }}>
      <div className="hora__coluna">
        {seta(60, <ChevronUp size={20} />, 'Mais uma hora')}
        <span className="hora__numero">{h}</span>
        {seta(-60, <ChevronDown size={20} />, 'Menos uma hora')}
      </div>
      <span className="hora__dois-pontos">:</span>
      <div className="hora__coluna">
        {seta(1, <ChevronUp size={20} />, 'Mais um minuto')}
        <span className="hora__numero">{m}</span>
        {seta(-1, <ChevronDown size={20} />, 'Menos um minuto')}
      </div>
    </div>
  )
}

type Etapa = 'entrada' | 'almoco' | 'saida'
const agoraMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() }

/**
 * Pergunta o ponto na hora certa: ao abrir pela primeira vez no dia (entrada), entre 11h e 14h (almoço)
 * e a partir de 10 min antes da saída (17h50; 16h50 na sexta). Pode ignorar clicando fora ou em "Ignorar".
 */
export function PontoLembrete() {
  const { cliente, usuario } = useSessao()
  const eu = supabase ? usuario.id : 'p1'
  const [config, setConfig] = useState<ConfigPonto | null>(null)
  const [hoje, setHoje] = useState<Ponto | null | undefined>(undefined)
  const [etapa, setEtapa] = useState<Etapa | null>(null)
  const [valores, setValores] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const [dia] = useState(() => diaIso(new Date()))

  const carregar = useCallback(async () => {
    if (!cliente || !eu || !lembretesLigados(cliente.id)) { setHoje(undefined); return }
    const [c, p] = await Promise.all([carregarConfig(cliente.id), listarPontos(cliente.id, dia, dia, eu).catch(() => [])])
    setConfig(c); setHoje(p[0] ?? null)
  }, [cliente, eu, dia])
  useEffect(() => { void Promise.resolve().then(carregar) }, [carregar])

  // Decide se é hora de perguntar (confere a cada minuto, a aba costuma ficar aberta o dia todo)
  useEffect(() => {
    if (!cliente || !config || hoje === undefined) return
    function conferir() {
      if (!cliente || !config || etapa) return
      const j = jornadaDoDia(config, dia)
      if (!j || !lembretesLigados(cliente.id)) return
      const ignoradas = ignoradosHoje(cliente.id, dia)
      const agora = agoraMin()
      const saidaAviso = minutos(j.saida) - 10
      const p = hoje
      if (agora >= saidaAviso && !p?.saida && !ignoradas.includes('saida')) { abrir('saida', { saida: j.saida }); return }
      if (agora >= 11 * 60 && agora <= 14 * 60 && (!p?.almoco_saida || !p?.almoco_volta) && !ignoradas.includes('almoco')) {
        abrir('almoco', { almoco_saida: p?.almoco_saida ?? '12:00', almoco_volta: p?.almoco_volta ?? '13:00' }); return
      }
      if (!p?.entrada && !ignoradas.includes('entrada') && agora < saidaAviso) abrir('entrada', { entrada: j.entrada })
    }
    function abrir(e: Etapa, v: Record<string, string>) { setValores(v); setEtapa(e) }
    conferir()
    const t = setInterval(conferir, 60_000)
    return () => clearInterval(t)
  }, [cliente, config, hoje, etapa, dia])

  if (!cliente || !etapa) return null
  const ignorar = () => { ignorarHoje(cliente.id, dia, etapa); setEtapa(null) }
  async function confirmar() {
    if (!cliente) return
    setSalvando(true)
    const dados = etapa === 'almoco' && hoje?.almoco_saida ? { almoco_volta: valores.almoco_volta } : valores
    try {
      const p = await salvarPonto(cliente.id, eu, dia, dados)
      setHoje(p); ignorarHoje(cliente.id, dia, etapa!)
      if (etapa === 'saida') comemorar()
      setEtapa(null)
      window.dispatchEvent(new CustomEvent('luminy:ponto'))
    } finally { setSalvando(false) }
  }
  const titulos: Record<Etapa, string> = { entrada: 'Que horas você chegou?', almoco: 'E o almoço?', saida: 'Que horas você vai sair?' }
  const dicas: Record<Etapa, string> = {
    entrada: `Bom dia, ${usuario.nome.split(' ')[0] || 'tudo bem'}! Ajuste nas setinhas se chegou antes ou depois.`,
    almoco: hoje?.almoco_saida ? 'Que horas você voltou do almoço?' : 'Que horas você saiu e voltou do almoço?',
    saida: 'Ajuste se for sair antes ou depois.',
  }
  return createPortal(
    <div className="ponto-lembrete__fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) ignorar() }}>
      <div className="ponto-lembrete" role="dialog" aria-modal="true" aria-labelledby="ponto-titulo"
        onKeyDown={(e) => { if (e.key === 'Escape') ignorar(); if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON') void confirmar() }}>
        <span className="ponto-lembrete__icone"><Clock size={22} /></span>
        <h2 id="ponto-titulo">{titulos[etapa]}</h2>
        <p>{dicas[etapa]}</p>
        <div className="ponto-lembrete__horas">
          {etapa === 'almoco' ? (
            <>
              {!hoje?.almoco_saida && <div className="ponto-lembrete__campo"><span className="rotulo">Saí</span><SeletorHora rotulo="Saída para o almoço" valor={valores.almoco_saida} onMudar={(v) => setValores((x) => ({ ...x, almoco_saida: v }))} /></div>}
              <div className="ponto-lembrete__campo"><span className="rotulo">Voltei</span><SeletorHora rotulo="Volta do almoço" valor={valores.almoco_volta} onMudar={(v) => setValores((x) => ({ ...x, almoco_volta: v }))} /></div>
            </>
          ) : (
            <SeletorHora rotulo={titulos[etapa]} valor={valores[etapa]} onMudar={(v) => setValores({ [etapa]: v })} />
          )}
        </div>
        <div className="ponto-lembrete__acoes">
          <button type="button" className="botao botao--fantasma" onClick={ignorar}>Ignorar</button>
          <button type="button" className="botao botao--primario" disabled={salvando} onClick={() => void confirmar()} autoFocus>{salvando ? 'Salvando…' : 'Registrar'}</button>
        </div>
        <button type="button" className="ponto-lembrete__desligar" onClick={() => { definirLembretes(cliente.id, false); setEtapa(null) }}>Não uso o ponto aqui, não perguntar mais</button>
      </div>
    </div>,
    document.body,
  )
}

/** Caixinha do Início: horas extras ou devendo no ciclo. Só aparece para quem usa o ponto. */
export function BancoDeHoras() {
  const { cliente, usuario } = useSessao()
  const eu = supabase ? usuario.id : 'p1'
  const [info, setInfo] = useState<{ saldo: number; ciclo: string; zera: string; hoje: Ponto | null } | null>(null)
  const carregar = useCallback(async () => {
    if (!cliente || !eu) return
    const c = await carregarConfig(cliente.id)
    const ci = cicloDe(c)
    const p = await listarPontos(cliente.id, ci.inicio, ci.fim, eu).catch(() => [])
    if (!p.length) { setInfo(null); return }
    const hoje = diaIso(new Date())
    setInfo({ saldo: saldoPeriodo(p, c, ci.inicio, ci.fim).saldo, ciclo: ci.nome, zera: ci.zeraEm, hoje: p.find((x) => x.dia === hoje) ?? null })
  }, [cliente, eu])
  useEffect(() => { void Promise.resolve().then(carregar) }, [carregar])
  useEffect(() => { const f = () => void carregar(); window.addEventListener('luminy:ponto', f); return () => window.removeEventListener('luminy:ponto', f) }, [carregar])
  if (!info) return null
  return (
    <Link to="/ponto" className={`banco-inicio${info.saldo < 0 ? ' negativo' : ''}`}>
      <Clock size={18} />
      <span><small>Banco de horas · {info.ciclo}</small><strong>{info.saldo === 0 ? 'Tudo certo' : `${saldoTexto(info.saldo)} ${info.saldo > 0 ? 'de extra' : 'devendo'}`}</strong>
        <small>{info.hoje?.entrada ? `Hoje: entrou ${info.hoje.entrada}${info.hoje.saida ? `, saiu ${info.hoje.saida}` : ''}` : `Zera em ${info.zera}`}</small></span>
    </Link>
  )
}

/** Caixinha do Início: a próxima reunião de hoje ou amanhã em que a pessoa participa. */
export function ProximaReuniao() {
  const { cliente, usuario } = useSessao()
  const eu = supabase ? usuario.id : 'p1'
  const [r, setR] = useState<Reuniao | null>(null)
  const [hojeTexto] = useState(() => new Date().toDateString())
  useEffect(() => {
    if (!cliente) return
    const agora = new Date(); const ate = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 2)
    void minhasReunioes(eu, new Date(agora.getTime() - 60 * 60_000).toISOString(), ate.toISOString())
      .then((l) => setR(l.filter((x) => x.situacao === 'agendada' && x.cliente_id === cliente.id).sort((a, b) => a.inicio.localeCompare(b.inicio))[0] ?? null)).catch(() => setR(null))
  }, [cliente, eu])
  if (!r) return null
  const d = new Date(r.inicio); const hoje = d.toDateString() === hojeTexto
  return (
    <Link to={`/reunioes?r=${r.id}`} className="banco-inicio banco-inicio--reuniao">
      <Presentation size={18} />
      <span><small>Próxima reunião · {hoje ? 'hoje' : 'amanhã'} às {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small>
        <strong>{r.titulo}</strong><small>{r.pauta.length ? `${r.pauta.length} ${r.pauta.length === 1 ? 'assunto' : 'assuntos'} na pauta` : 'Pauta vazia: coloque os assuntos'}{r.local ? ` · ${r.local}` : ''}</small></span>
    </Link>
  )
}
