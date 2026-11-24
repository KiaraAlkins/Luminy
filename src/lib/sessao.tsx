/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'

/**
 * Quem está usando o app e em qual cliente.
 * A tela esconde o que a pessoa não pode ver, mas quem garante o sigilo é o banco (RLS).
 */
export type ClienteSessao = { id: string; nome: string; slug: string; cor: string; papel: 'proprietario' | 'admin' | 'membro'; acesso_leads: boolean }
type Dados = { usuario: { id: string; nome: string }; agencia: { id: string; nome: string } | null; clientes: ClienteSessao[] }

export type Sessao = {
  estado: 'carregando' | 'deslogado' | 'primeiro_acesso' | 'pronto'
  usuario: { id: string; nome: string }
  agencia: { id: string; nome: string } | null
  clientes: ClienteSessao[]
  cliente: ClienteSessao
  ehProprietario: boolean
  acessoLeads: boolean
  trocarCliente: (id: string) => void
  recarregar: () => Promise<void>
  sair: () => Promise<void>
}

const CLIENTE_DEMO: ClienteSessao = { id: 'hospital', nome: 'Hospital Santa Marta', slug: 'hospital-santa-marta', cor: '#E5484D', papel: 'proprietario', acesso_leads: true }
const VAZIO: ClienteSessao = { id: '', nome: '', slug: '', cor: '#3D2EF9', papel: 'membro', acesso_leads: false }
const CHAVE_CLIENTE = 'luminy.cliente'

const Contexto = createContext<Sessao | null>(null)

function lerClienteSalvo() {
  try { return localStorage.getItem(CHAVE_CLIENTE) } catch { return null }
}

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Sessao['estado']>(supabase ? 'carregando' : 'pronto')
  const [dados, setDados] = useState<Dados>(supabase
    ? { usuario: { id: '', nome: '' }, agencia: null, clientes: [] }
    : { usuario: { id: 'demo', nome: 'Dilan Freitas' }, agencia: { id: 'demo', nome: 'Luminy' }, clientes: [CLIENTE_DEMO] })
  const [clienteId, setClienteId] = useState<string | null>(lerClienteSalvo)

  const recarregar = useCallback(async () => {
    if (!supabase) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setEstado('deslogado'); return }
    const { data, error } = await supabase.rpc('minha_sessao')
    if (error || !data) { setEstado('deslogado'); return }
    const d = data as Dados
    setDados(d)
    setEstado(d.clientes.length === 0 ? 'primeiro_acesso' : 'pronto')
  }, [])

  useEffect(() => {
    if (!supabase) return
    // Sincroniza com o Supabase: o retorno chega depois, fora do ciclo de renderização.
    void Promise.resolve().then(recarregar)
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT') void recarregar()
    })
    return () => data.subscription.unsubscribe()
  }, [recarregar])

  const cliente = dados.clientes.find((c) => c.id === clienteId) ?? dados.clientes[0] ?? VAZIO
  const valor: Sessao = {
    estado,
    usuario: dados.usuario,
    agencia: dados.agencia,
    clientes: dados.clientes,
    cliente,
    ehProprietario: dados.agencia !== null,
    acessoLeads: cliente.acesso_leads,
    trocarCliente: (id) => { setClienteId(id); try { localStorage.setItem(CHAVE_CLIENTE, id) } catch { /* sem armazenamento */ } },
    recarregar,
    sair: async () => { await supabase?.auth.signOut() },
  }
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useSessao() {
  const s = useContext(Contexto)
  if (!s) throw new Error('useSessao fora do ProvedorSessao')
  return s
}
