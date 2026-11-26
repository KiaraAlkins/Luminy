/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'

/**
 * Quem está usando o app e em qual cliente.
 * Depois de criar a conta, a pessoa escolhe nos Primeiros passos: entrar numa equipe (convite)
 * ou criar a própria agência. A tela esconde o que a pessoa não pode ver, mas quem garante o
 * sigilo é o banco (RLS).
 */
export type ClienteSessao = { id: string; nome: string; slug: string; cor: string; papel: 'proprietario' | 'admin' | 'membro'; acesso_leads: boolean }
type Dados = { usuario: { id: string; nome: string; foto_url?: string | null }; agencia: { id: string; nome: string } | null; clientes: ClienteSessao[] }

export type Sessao = {
  estado: 'carregando' | 'deslogado' | 'primeiro_acesso' | 'pronto'
  usuario: { id: string; nome: string; foto_url?: string | null }
  agencia: { id: string; nome: string } | null
  clientes: ClienteSessao[]
  /** Cliente selecionado; null quando a pessoa ainda não tem nenhum. */
  cliente: ClienteSessao | null
  ehProprietario: boolean
  ehAdminCliente: boolean
  acessoLeads: boolean
  aviso: string | null
  trocarCliente: (id: string) => void
  recarregar: () => Promise<void>
  sair: () => Promise<void>
}

const CLIENTE_DEMO: ClienteSessao = { id: 'hospital', nome: 'Hospital Santa Marta', slug: 'hospital-santa-marta', cor: '#E5484D', papel: 'proprietario', acesso_leads: true }
const CHAVE_CLIENTE = 'luminy.cliente'
export const CHAVE_CONVITE = 'luminy.convite'

const Contexto = createContext<Sessao | null>(null)

function ler(chave: string) { try { return localStorage.getItem(chave) } catch { return null } }
function gravar(chave: string, valor: string | null) {
  try { if (valor === null) localStorage.removeItem(chave); else localStorage.setItem(chave, valor) } catch { /* sem armazenamento */ }
}

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Sessao['estado']>(supabase ? 'carregando' : 'pronto')
  const [dados, setDados] = useState<Dados>(supabase
    ? { usuario: { id: '', nome: '' }, agencia: null, clientes: [] }
    : { usuario: { id: 'demo', nome: 'Dilan Freitas' }, agencia: { id: 'demo', nome: 'Luminy' }, clientes: [CLIENTE_DEMO] })
  const [clienteId, setClienteId] = useState<string | null>(() => ler(CHAVE_CLIENTE))
  const [aviso, setAviso] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    if (!supabase) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setEstado('deslogado'); return }

    // Convite aberto antes do login: aceita agora
    const convite = ler(CHAVE_CONVITE)
    if (convite) {
      gravar(CHAVE_CONVITE, null)
      const r = await supabase.rpc('aceitar_convite', { p_token: convite })
      if (r.error) setAviso(`Não foi possível aceitar o convite: ${r.error.message}`)
      else { setAviso(`Você entrou na equipe do ${(r.data as { cliente: string }).cliente}.`); setClienteId((r.data as { cliente_id: string }).cliente_id) }
    }

    const { data, error } = await supabase.rpc('minha_sessao')
    if (error || !data) { setEstado('deslogado'); return }
    const d = data as Dados
    setDados(d)
    // Sem agência própria e sem equipe: cai nos Primeiros passos para escolher o caminho
    setEstado(!d.agencia && d.clientes.length === 0 ? 'primeiro_acesso' : 'pronto')
  }, [])

  useEffect(() => {
    if (!supabase) return
    void Promise.resolve().then(recarregar)
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT') void recarregar()
    })
    return () => data.subscription.unsubscribe()
  }, [recarregar])

  const cliente = dados.clientes.find((c) => c.id === clienteId) ?? dados.clientes[0] ?? null
  const valor: Sessao = {
    estado,
    usuario: dados.usuario,
    agencia: dados.agencia,
    clientes: dados.clientes,
    cliente,
    ehProprietario: dados.agencia !== null,
    ehAdminCliente: cliente?.papel === 'proprietario' || cliente?.papel === 'admin',
    acessoLeads: cliente?.acesso_leads ?? false,
    aviso,
    trocarCliente: (id) => { setClienteId(id); gravar(CHAVE_CLIENTE, id) },
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
