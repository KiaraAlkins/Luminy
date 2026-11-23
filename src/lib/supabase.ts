import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Cliente do Supabase. Enquanto o projeto não estiver conectado (sem variáveis de ambiente),
 * o app roda em modo demonstração, com dados fictícios, para revisar as telas.
 */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null
export const modoDemonstracao = supabase === null
