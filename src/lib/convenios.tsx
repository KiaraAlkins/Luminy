import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { apagarImagem, enviarImagem } from './imagens'
import { useSessao } from './sessao'

/** Plano de saúde cadastrado no cliente. Empresas e leads guardam o nome; daqui vem o logo. */
export type Convenio = { id: string; cliente_id: string; nome: string; foto_url: string | null }

let demo: Convenio[] = ['Unimed', 'Bradesco Saúde', 'SulAmérica', 'Amil', 'Hapvida', 'Cassi'].map((nome, i) => ({ id: `cv${i}`, cliente_id: 'hospital', nome, foto_url: null }))

const normal = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

type Contexto = { convenios: Convenio[]; porNome: (nome: string) => Convenio | undefined; recarregar: () => Promise<void> }
const Ctx = createContext<Contexto>({ convenios: [], porNome: () => undefined, recarregar: async () => {} })

export function ProvedorConvenios({ children }: { children: ReactNode }) {
  const { cliente } = useSessao()
  const [convenios, setConvenios] = useState<Convenio[]>([])
  const recarregar = useCallback(async () => {
    if (!cliente) { setConvenios([]); return }
    if (!supabase) { setConvenios([...demo].sort((a, b) => a.nome.localeCompare(b.nome))); return }
    const { data } = await supabase.from('convenios').select('*').eq('cliente_id', cliente.id).order('nome')
    setConvenios((data ?? []) as Convenio[])
  }, [cliente])
  useEffect(() => { void Promise.resolve().then(recarregar) }, [recarregar])
  const valor = useMemo(() => {
    const mapa = new Map(convenios.map((c) => [normal(c.nome), c]))
    // "Unimed (Empresa X)" ou "Cassi / SulAmérica": tenta achar pelo começo do nome
    const porNome = (nome: string) => mapa.get(normal(nome)) ?? convenios.find((c) => normal(nome).startsWith(normal(c.nome)))
    return { convenios, porNome, recarregar }
  }, [convenios, recarregar])
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useConvenios = () => useContext(Ctx)

// eslint-disable-next-line react-refresh/only-export-components
export async function criarConvenio(clienteId: string, nome: string, arquivo?: File | null): Promise<void> {
  const n = nome.trim()
  if (!supabase) { demo.push({ id: crypto.randomUUID(), cliente_id: clienteId, nome: n, foto_url: arquivo ? await enviarImagem('', arquivo) : null }); return }
  const { data, error } = await supabase.from('convenios').insert({ cliente_id: clienteId, nome: n }).select('*').single()
  if (error) throw new Error(error.code === '23505' ? 'Esse plano já está cadastrado.' : 'Não foi possível cadastrar o plano.')
  if (arquivo) await trocarLogoConvenio(data as Convenio, arquivo)
}

// eslint-disable-next-line react-refresh/only-export-components
export async function trocarLogoConvenio(c: Convenio, arquivo: File) {
  const url = await enviarImagem(`${c.cliente_id}/convenios/${c.id}`, arquivo)
  if (!supabase) { demo = demo.map((x) => (x.id === c.id ? { ...x, foto_url: url } : x)); return }
  const { error } = await supabase.from('convenios').update({ foto_url: url }).eq('id', c.id)
  if (error) throw new Error('Não foi possível salvar o logo.')
  await apagarImagem(c.foto_url)
}

// eslint-disable-next-line react-refresh/only-export-components
export async function renomearConvenio(c: Convenio, nome: string) {
  if (!supabase) { demo = demo.map((x) => (x.id === c.id ? { ...x, nome } : x)); return }
  const { error } = await supabase.from('convenios').update({ nome: nome.trim() }).eq('id', c.id)
  if (error) throw new Error(error.code === '23505' ? 'Já existe um plano com esse nome.' : 'Não foi possível renomear.')
}

// eslint-disable-next-line react-refresh/only-export-components
export async function excluirConvenio(c: Convenio) {
  if (!supabase) { demo = demo.filter((x) => x.id !== c.id); return }
  const { error } = await supabase.from('convenios').delete().eq('id', c.id)
  if (error) throw new Error('Só administradores excluem planos.')
  await apagarImagem(c.foto_url)
}
