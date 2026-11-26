import { supabase } from './supabase'
import { linksArquivos, type Card } from './kanban'

export type SituacaoAprovacao = 'pendente' | 'aprovado' | 'ajuste' | 'substituida'
export type ImagemAprovacao = { url: string; nome: string }
export type Aprovacao = {
  id: string; cliente_id: string; card_id: string; token: string; situacao: SituacaoAprovacao
  titulo: string; legenda: string | null; tipo_conteudo: string | null; redes: string[]; postagem_em: string | null; imagens: ImagemAprovacao[]
  mensagem: string | null; aprovador: string | null; resposta: string | null; respondido_por_nome: string | null; respondido_em: string | null
  enviado_por: string; enviado_em: string; expira_em: string
}
export type AprovacaoPublica =
  | { situacao: 'inexistente' } | { situacao: 'expirada'; cliente: string }
  | { situacao: 'pendente' | 'aprovado' | 'ajuste'; cliente: string; cor: string; titulo: string; legenda: string | null; tipo: string | null; redes: string[]
      postagem_em: string | null; imagens: ImagemAprovacao[]; mensagem: string | null; aprovador: string | null; resposta: string | null; respondido_por: string | null; respondido_em: string | null }

export const linkAprovacao = (token: string) => `${window.location.origin}/aprovar/${token}`
const DIAS_VALIDADE = 14

// ---------------------------------------------------------------- demonstração
const h = (n: number) => new Date(Date.now() + n * 3_600_000).toISOString()
const svg = (cor: string, texto: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080"><rect width="100%" height="100%" fill="${cor}"/><text x="80" y="560" font-family="sans-serif" font-size="88" font-weight="700" fill="#fff">${texto}</text></svg>`)}`
let demo: Aprovacao[] = [
  { id: 'a1', cliente_id: 'hospital', card_id: 'k4', token: 'demo-pendente', situacao: 'pendente', titulo: 'Carrossel Novembro Azul', legenda: 'Novembro Azul: cuidar de si também é um ato de coragem. 💙 Agende seu check-up.', tipo_conteudo: 'Carrossel', redes: ['Instagram', 'Facebook'], postagem_em: h(30),
    imagens: [{ url: svg('#1F6FEB', 'Novembro Azul'), nome: 'capa.png' }, { url: svg('#174EA6', 'Prevenção salva'), nome: 'tela-2.png' }, { url: svg('#0B3D91', 'Agende seu check-up'), nome: 'tela-3.png' }],
    mensagem: 'Dra. Paula, segue o carrossel do Novembro Azul para aprovação. Vai ao ar amanhã às 18h.', aprovador: 'Dra. Paula (diretoria)', resposta: null, respondido_por_nome: null, respondido_em: null, enviado_por: 'p2', enviado_em: h(-5), expira_em: h(14 * 24) },
  { id: 'a2', cliente_id: 'hospital', card_id: 'k5', token: 'demo-ajuste', situacao: 'ajuste', titulo: 'Reels Dia do Homem', legenda: 'Homem que se cuida vive mais. 👊', tipo_conteudo: 'Reels', redes: ['Instagram', 'TikTok'], postagem_em: h(-170),
    imagens: [{ url: svg('#E5484D', 'Dia do Homem'), nome: 'thumb.png' }], mensagem: null, aprovador: 'Assessoria', resposta: 'Trocar a música por uma sem direitos autorais e citar o telefone da central.', respondido_por_nome: 'Carlos (assessoria)', respondido_em: h(-20), enviado_por: 'p4', enviado_em: h(-30), expira_em: h(300) },
  { id: 'a3', cliente_id: 'hospital', card_id: 'k6', token: 'demo-aprovado', situacao: 'aprovado', titulo: 'Post Doação de sangue', legenda: 'Doe sangue, doe vida. ❤️', tipo_conteudo: 'Post', redes: ['Instagram'], postagem_em: h(20),
    imagens: [{ url: svg('#B42318', 'Doe sangue'), nome: 'post.png' }], mensagem: null, aprovador: 'Dra. Paula (diretoria)', resposta: 'Perfeito!', respondido_por_nome: 'Dra. Paula', respondido_em: h(-26), enviado_por: 'p1', enviado_em: h(-28), expira_em: h(300) },
]

// ---------------------------------------------------------------- equipe
export async function listarAprovacoes(clienteId: string): Promise<Aprovacao[]> {
  if (!supabase) return [...demo].sort((a, b) => b.enviado_em.localeCompare(a.enviado_em))
  const { data, error } = await supabase.from('aprovacoes').select('*').eq('cliente_id', clienteId).neq('situacao', 'substituida').order('enviado_em', { ascending: false })
  if (error) throw error
  return data as Aprovacao[]
}

/** A aprovação mais recente de um card (para mostrar na ficha). */
export async function aprovacaoDoCard(cardId: string): Promise<Aprovacao | null> {
  if (!supabase) return demo.filter((a) => a.card_id === cardId && a.situacao !== 'substituida').sort((a, b) => b.enviado_em.localeCompare(a.enviado_em))[0] ?? null
  const { data } = await supabase.from('aprovacoes').select('*').eq('card_id', cardId).neq('situacao', 'substituida').order('enviado_em', { ascending: false }).limit(1).maybeSingle()
  return (data as Aprovacao | null) ?? null
}

/**
 * Envia o card para aprovação: guarda uma "foto" do post (título, legenda, imagens) e gera o link.
 * As imagens são privadas: o link delas vale o mesmo tempo que o link da aprovação (14 dias).
 */
export async function enviarParaAprovacao(card: Card, clienteId: string, opcoes: { caminhos: string[]; mensagem: string | null; aprovador: string | null }): Promise<Aprovacao> {
  const base = { titulo: card.titulo, legenda: card.legenda, tipo_conteudo: card.tipo_conteudo, redes: card.redes, postagem_em: card.postagem_em, mensagem: opcoes.mensagem, aprovador: opcoes.aprovador }
  if (!supabase) {
    const links = await linksArquivos(opcoes.caminhos)
    const nova: Aprovacao = { ...base, id: crypto.randomUUID(), cliente_id: clienteId, card_id: card.id, token: `demo-${Date.now()}`, situacao: 'pendente', imagens: opcoes.caminhos.map((c) => ({ url: links.get(c) ?? '', nome: c.split('/').pop() ?? '' })),
      resposta: null, respondido_por_nome: null, respondido_em: null, enviado_por: 'p1', enviado_em: new Date().toISOString(), expira_em: new Date(Date.now() + DIAS_VALIDADE * 86_400_000).toISOString() }
    demo = [nova, ...demo.map((a) => (a.card_id === card.id && a.situacao === 'pendente' ? { ...a, situacao: 'substituida' as const } : a))]
    return nova
  }
  let imagens: ImagemAprovacao[] = []
  if (opcoes.caminhos.length) {
    const { data } = await supabase.storage.from('cards').createSignedUrls(opcoes.caminhos, DIAS_VALIDADE * 86_400)
    imagens = (data ?? []).filter((x) => x.signedUrl).map((x) => ({ url: x.signedUrl as string, nome: (x.path ?? '').split('/').pop() ?? '' }))
  }
  const { data, error } = await supabase.from('aprovacoes').insert({ ...base, cliente_id: clienteId, card_id: card.id, imagens }).select('*').single()
  if (error) throw new Error('Não foi possível enviar para aprovação.')
  return data as Aprovacao
}

// ---------------------------------------------------------------- página pública (quem aprova)
export async function verAprovacao(token: string): Promise<AprovacaoPublica> {
  if (!supabase) {
    const a = demo.find((x) => x.token === token && x.situacao !== 'substituida')
    if (!a) return { situacao: 'inexistente' }
    return { situacao: a.situacao as 'pendente', cliente: 'Hospital Santa Marta', cor: '#E5484D', titulo: a.titulo, legenda: a.legenda, tipo: a.tipo_conteudo, redes: a.redes, postagem_em: a.postagem_em, imagens: a.imagens, mensagem: a.mensagem, aprovador: a.aprovador, resposta: a.resposta, respondido_por: a.respondido_por_nome, respondido_em: a.respondido_em }
  }
  const { data, error } = await supabase.rpc('ver_aprovacao', { p_token: token })
  if (error) return { situacao: 'inexistente' }
  return data as AprovacaoPublica
}

export async function responderAprovacao(token: string, aprovar: boolean, nome: string, comentario: string | null) {
  if (!supabase) {
    demo = demo.map((a) => (a.token === token ? { ...a, situacao: aprovar ? 'aprovado' : 'ajuste', resposta: comentario, respondido_por_nome: nome, respondido_em: new Date().toISOString() } : a))
    return
  }
  const { error } = await supabase.rpc('responder_aprovacao', { p_token: token, p_aprovar: aprovar, p_nome: nome, p_comentario: comentario })
  if (error) throw new Error(error.message.includes('expirou') ? 'Este link expirou. Peça um novo para a equipe.' : error.message.includes('não está mais') ? 'Este link já foi respondido ou foi substituído por um mais novo.' : error.message.includes('Escreva') ? error.message + '.' : 'Não foi possível enviar a resposta.')
}
