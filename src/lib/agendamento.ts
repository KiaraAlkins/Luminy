import { supabase } from './supabase'
import { linksArquivos, salvarCard, type Anexo, type Card, type Coluna } from './kanban'

export const REDES_SOCIAIS = ['Instagram', 'Facebook', 'TikTok', 'LinkedIn', 'YouTube'] as const
export type Rede = (typeof REDES_SOCIAIS)[number]
export type ContaSocial = { id: string; cliente_id: string; rede: Rede; usuario: string | null; situacao: 'manual' | 'aguardando' | 'conectada'; conectada_em: string | null }

let contasDemo: ContaSocial[] = [
  { id: 'cs1', cliente_id: 'hospital', rede: 'Instagram', usuario: '@hospitalsantamarta', situacao: 'manual', conectada_em: null },
  { id: 'cs2', cliente_id: 'hospital', rede: 'Facebook', usuario: 'Hospital Santa Marta', situacao: 'manual', conectada_em: null },
]

export async function listarContas(clienteId: string): Promise<ContaSocial[]> {
  if (!supabase) return contasDemo.filter((c) => c.cliente_id === clienteId)
  const { data } = await supabase.from('contas_sociais').select('*').eq('cliente_id', clienteId)
  return (data ?? []) as ContaSocial[]
}

export async function salvarConta(clienteId: string, rede: Rede, usuario: string | null) {
  if (!supabase) {
    const c = contasDemo.find((x) => x.rede === rede)
    if (c) c.usuario = usuario; else contasDemo.push({ id: crypto.randomUUID(), cliente_id: clienteId, rede, usuario, situacao: 'manual', conectada_em: null })
    return
  }
  const { error } = await supabase.from('contas_sociais').upsert({ cliente_id: clienteId, rede, usuario }, { onConflict: 'cliente_id,rede' })
  if (error) throw new Error('Só administradores mudam as contas das redes.')
}

/** Link para abrir a rede no navegador (para postar à mão). */
export function linkRede(rede: Rede, usuario: string | null) {
  const u = (usuario ?? '').replace(/^@/, '').trim()
  switch (rede) {
    case 'Instagram': return u ? `https://www.instagram.com/${u}/` : 'https://www.instagram.com/'
    case 'Facebook': return 'https://business.facebook.com/latest/composer'
    case 'TikTok': return 'https://www.tiktok.com/upload'
    case 'LinkedIn': return 'https://www.linkedin.com/feed/'
    case 'YouTube': return 'https://studio.youtube.com/'
  }
}

/** Imagens do card na ordem do carrossel: a capa primeiro, depois as outras imagens anexadas. */
export function imagensDoCard(card: Card): Anexo[] {
  const imgs = card.anexos.filter((a) => a.tipo === 'arquivo' && /^image\//.test(a.mime ?? '') && a.caminho)
  return [...imgs.filter((a) => a.caminho === card.capa_path), ...imgs.filter((a) => a.caminho !== card.capa_path)]
}

/** Baixa as artes numeradas (01-, 02-…) para subir na ordem certa. */
export async function baixarImagens(card: Card, anexos: Anexo[]) {
  const links = await linksArquivos(anexos.map((a) => a.caminho!))
  const base = card.titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').slice(0, 40)
  for (const [i, a] of anexos.entries()) {
    const url = links.get(a.caminho!); if (!url) continue
    const blob = await (await fetch(url)).blob()
    const ext = (a.mime ?? 'image/webp').split('/')[1]?.replace('jpeg', 'jpg') ?? 'webp'
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${String(i + 1).padStart(2, '0')}-${base}.${ext}`; link.click()
    await new Promise((r) => setTimeout(r, 350))
  }
}

/** Marca como publicado: guarda quando, quem e o link, e leva o card para "Postado e feito". */
export async function marcarPostado(card: Card, colunas: Coluna[], usuarioId: string | null, link: string | null) {
  const destino = colunas.find((c) => /^postado/i.test(c.nome))
  const dados = { postado_em: new Date().toISOString(), postado_por: usuarioId, link_post: link?.trim() || null }
  await salvarCard(card.id, dados)
  if (destino && destino.id !== card.coluna_id) {
    const { moverCard } = await import('./kanban')
    await moverCard(card, destino.id, Date.now() / 1e6)
  }
}
