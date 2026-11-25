import { useRef, useState, type FormEvent } from 'react'
import { CalendarDays, Gift, Handshake, Mail, MessageCircle, MessageSquare, Phone, QrCode, Users } from 'lucide-react'
import { hojeIso, registrarInteracao, somarDias, type TipoInteracao } from '../../lib/parcerias'

type Rapido = { tipo: TipoInteracao; rotulo: string; titulo: string; dica: string; icone: React.ElementType }

/** Botões de um toque: o que mais acontece no dia a dia com as empresas. */
const RAPIDOS: Rapido[] = [
  { tipo: 'contato', rotulo: 'Liguei', titulo: 'Ligação', dica: 'Com quem falou? O que ficou combinado?', icone: Phone },
  { tipo: 'contato', rotulo: 'WhatsApp', titulo: 'Conversa no WhatsApp', dica: 'Sobre o que foi a conversa?', icone: MessageCircle },
  { tipo: 'contato', rotulo: 'E-mail', titulo: 'E-mail enviado', dica: 'Assunto do e-mail', icone: Mail },
  { tipo: 'reuniao', rotulo: 'Reunião', titulo: 'Reunião', dica: 'Quem participou? O que foi decidido?', icone: Users },
  { tipo: 'brinde', rotulo: 'Brindes', titulo: 'Entrega de brindes', dica: 'Ex.: 50 kits Novembro Azul', icone: Gift },
  { tipo: 'evento', rotulo: 'Evento', titulo: 'Evento na empresa', dica: 'Ex.: mutirão de glicemia no refeitório', icone: CalendarDays },
  { tipo: 'coleta_leads', rotulo: 'Coleta de leads', titulo: 'Coleta de leads', dica: 'Ex.: QR no refeitório, 23 leads', icone: QrCode },
  { tipo: 'proposta', rotulo: 'Proposta', titulo: 'Proposta enviada', dica: 'O que foi proposto?', icone: Handshake },
  { tipo: 'outro', rotulo: 'Outro', titulo: 'Anotação', dica: 'O que aconteceu?', icone: MessageSquare },
]

const QUANDO = [{ rotulo: 'Hoje', valor: () => hojeIso() }, { rotulo: 'Ontem', valor: () => somarDias(-1) }]

/**
 * Registro em dois toques: escolhe o que aconteceu e aperta Enter.
 * O detalhe é opcional; a data já vem como hoje.
 */
export function RegistroRapido({ empresaId, onRegistrado, compacto = false }: {
  empresaId: string; onRegistrado: (tipo: TipoInteracao) => void | Promise<void>; compacto?: boolean
}) {
  const [escolhido, setEscolhido] = useState<Rapido | null>(null)
  const [detalhe, setDetalhe] = useState('')
  const [data, setData] = useState(hojeIso())
  const [salvando, setSalvando] = useState(false)
  const campo = useRef<HTMLInputElement>(null)

  function escolher(r: Rapido) {
    setEscolhido(escolhido === r ? null : r)
    setTimeout(() => campo.current?.focus(), 0)
  }

  async function enviar(e?: FormEvent) {
    e?.preventDefault()
    if (!escolhido || salvando) return
    setSalvando(true)
    const d = detalhe.trim()
    await registrarInteracao({ empresa_id: empresaId, tipo: escolhido.tipo, titulo: d ? `${escolhido.titulo}: ${d}` : escolhido.titulo, descricao: null, data })
    const tipo = escolhido.tipo
    setEscolhido(null); setDetalhe(''); setData(hojeIso()); setSalvando(false)
    await onRegistrado(tipo)
  }

  const outraData = !QUANDO.some((q) => q.valor() === data)
  return (
    <form className={`registro${compacto ? ' registro--compacto' : ''}`} onSubmit={enviar}>
      <span className="registro__pergunta">O que aconteceu?</span>
      <div className="registro__botoes" role="group" aria-label="Tipo de registro">
        {RAPIDOS.map((r) => {
          const Icone = r.icone
          return (
            <button key={r.rotulo} type="button" className={`registro__tipo registro__tipo--${r.tipo}${escolhido === r ? ' marcado' : ''}`}
              aria-pressed={escolhido === r} onClick={() => escolher(r)}>
              <Icone size={16} aria-hidden /> {r.rotulo}
            </button>
          )
        })}
      </div>

      {escolhido && (
        <div className="registro__detalhe">
          <input ref={campo} className="entrada" value={detalhe} onChange={(e) => setDetalhe(e.target.value)}
            placeholder={`${escolhido.dica} (opcional)`} aria-label="Detalhe (opcional)" />
          <div className="registro__quando">
            {QUANDO.map((q) => (
              <button key={q.rotulo} type="button" className={`opcao${q.valor() === data ? ' marcada' : ''}`} onClick={() => setData(q.valor())}>{q.rotulo}</button>
            ))}
            <input type="date" className={`entrada registro__data${outraData ? ' marcada' : ''}`} value={data} max={hojeIso()} onChange={(e) => setData(e.target.value || hojeIso())} aria-label="Outra data" />
          </div>
          <button type="submit" className="botao botao--primario" disabled={salvando}>Registrar</button>
          <span className="registro__atalho">ou aperte Enter</span>
        </div>
      )}
    </form>
  )
}
