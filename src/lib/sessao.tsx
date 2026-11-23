import { createContext, useContext, type ReactNode } from 'react'

/**
 * Quem está usando o app e em qual cliente. Por enquanto vem de dados de demonstração;
 * ao conectar o Supabase, sai do login e da tabela membros_cliente.
 * A tela esconde o que a pessoa não pode ver, mas quem garante o sigilo é o banco (RLS).
 */
export type Sessao = {
  usuario: { id: string; nome: string }
  cliente: { id: string; nome: string }
  ehProprietario: boolean
  acessoLeads: boolean
}

const DEMO: Sessao = {
  usuario: { id: 'demo', nome: 'Dilan Freitas' },
  cliente: { id: 'hospital', nome: 'Hospital Santa Marta' },
  ehProprietario: true,
  acessoLeads: true,
}

const Contexto = createContext<Sessao>(DEMO)

export function ProvedorSessao({ valor = DEMO, children }: { valor?: Sessao; children: ReactNode }) {
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export const useSessao = () => useContext(Contexto)
