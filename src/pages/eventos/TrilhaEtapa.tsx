import { Check, CirclePause, CircleX, Play } from 'lucide-react'
import { ETAPAS, TRILHA, nomeEtapa, type Etapa } from '../../lib/parcerias'

/**
 * Etapa da parceria como uma trilha: um clique na etapa muda tudo.
 * Pausar e encerrar ficam ao lado, porque saem do caminho normal.
 */
export function TrilhaEtapa({ etapa, onMudar }: { etapa: Etapa; onMudar: (e: Etapa) => void }) {
  const fora = etapa === 'pausada' || etapa === 'encerrada'
  const atual = TRILHA.indexOf(etapa)
  const proxima = !fora && atual < TRILHA.length - 1 ? TRILHA[atual + 1] : null

  return (
    <div className={`trilha${fora ? ' trilha--parada' : ''}`}>
      <ol className="trilha__passos" aria-label="Etapa da parceria">
        {TRILHA.map((e, i) => {
          const feito = !fora && i < atual
          const agora = !fora && i === atual
          return (
            <li key={e} className={`trilha__passo${feito ? ' feito' : ''}${agora ? ' agora' : ''}`}>
              <button type="button" onClick={() => e !== etapa && onMudar(e)} aria-current={agora ? 'step' : undefined}
                title={agora ? `Etapa atual: ${nomeEtapa(e)}` : `Mover para ${nomeEtapa(e)}`}>
                <span className="trilha__bola">{feito ? <Check size={14} strokeWidth={3} /> : i + 1}</span>
                <span className="trilha__nome">{nomeEtapa(e)}</span>
              </button>
            </li>
          )
        })}
      </ol>

      <div className="trilha__acoes">
        {fora ? (
          <>
            <span className={`trilha__selo trilha__selo--${etapa}`}>{etapa === 'pausada' ? <CirclePause size={15} /> : <CircleX size={15} />} Parceria {etapa}</span>
            <button type="button" className="botao botao--primario" onClick={() => onMudar('primeiro_contato')}><Play size={15} /> Retomar</button>
          </>
        ) : (
          <>
            {proxima && <button type="button" className="botao botao--primario" onClick={() => onMudar(proxima)}>Avançar para {nomeEtapa(proxima)} →</button>}
            <button type="button" className="botao botao--fantasma trilha__mini" onClick={() => onMudar('pausada')} title="Pausar parceria"><CirclePause size={15} /> Pausar</button>
            <button type="button" className="botao botao--fantasma trilha__mini" onClick={() => onMudar('encerrada')} title="Encerrar parceria"><CircleX size={15} /> Encerrar</button>
          </>
        )}
      </div>
    </div>
  )
}

/** Versão pequena para a lista: 5 pontinhos + nome da etapa. */
export function TrilhaMini({ etapa }: { etapa: Etapa }) {
  const atual = TRILHA.indexOf(etapa)
  const cor = ETAPAS.find((x) => x.id === etapa)?.cor
  return (
    <span className="trilha-mini" title={nomeEtapa(etapa)}>
      <span className="trilha-mini__pontos" aria-hidden>
        {TRILHA.map((e, i) => <i key={e} className={atual >= 0 && i <= atual ? 'cheio' : ''} />)}
      </span>
      <span className="trilha-mini__nome" style={atual < 0 ? { color: cor } : undefined}>{nomeEtapa(etapa)}</span>
    </span>
  )
}
