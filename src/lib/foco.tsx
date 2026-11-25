/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { useSessao } from './sessao'

/**
 * "Fazendo agora": a tarefa que a própria pessoa escolhe mostrar para a equipe e para a TV.
 * Tarefas pessoais continuam privadas; aqui só aparece o que a pessoa definir.
 */
export type Foco = { id: string; titulo: string; card_id: string | null; iniciado_em: string }

type Ctx = {
  foco: Foco | null
  definir: (titulo: string, cardId?: string | null) => Promise<void>
  concluir: () => Promise<boolean>
  limpar: () => Promise<void>
}

const Contexto = createContext<Ctx | null>(null)
let focoDemo: Foco | null = { id: 'demo', titulo: 'Finalizar carrossel Novembro Azul', card_id: null, iniciado_em: new Date(Date.now() - 42 * 60_000).toISOString() }

export function ProvedorFoco({ children }: { children: ReactNode }) {
  const { cliente, usuario } = useSessao()
  const [foco, setFoco] = useState<Foco | null>(null)
  const clienteId = cliente?.id

  const carregar = useCallback(async () => {
    if (!clienteId) { setFoco(null); return }
    if (!supabase) { setFoco(focoDemo); return }
    const { data } = await supabase.from('focos').select('id, titulo, card_id, iniciado_em')
      .eq('cliente_id', clienteId).eq('usuario_id', usuario.id).is('concluido_em', null).is('trocado_em', null).maybeSingle()
    setFoco((data as Foco) ?? null)
  }, [clienteId, usuario.id])
  useEffect(() => { void Promise.resolve().then(carregar) }, [carregar])

  const valor: Ctx = {
    foco,
    definir: async (titulo, cardId = null) => {
      if (!clienteId) return
      if (!supabase) { focoDemo = { id: crypto.randomUUID(), titulo, card_id: cardId, iniciado_em: new Date().toISOString() }; setFoco(focoDemo); return }
      await supabase.rpc('definir_foco', { p_cliente: clienteId, p_titulo: titulo, p_card: cardId })
      await carregar()
    },
    concluir: async () => {
      if (!foco) return false
      if (supabase) { const { error } = await supabase.rpc('concluir_foco', { p_foco: foco.id }); if (error) return false }
      focoDemo = null; setFoco(null); return true
    },
    limpar: async () => {
      if (!foco) return
      if (supabase) await supabase.from('focos').update({ trocado_em: new Date().toISOString() }).eq('id', foco.id)
      focoDemo = null; setFoco(null)
    },
  }
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useFoco() {
  const c = useContext(Contexto)
  if (!c) throw new Error('useFoco fora do ProvedorFoco')
  return c
}

/** "12 min", "1 h 05" */
export function tempoDesde(iso: string, agora = Date.now()) {
  const min = Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 60_000))
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`
}
