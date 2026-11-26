import { supabase } from './supabase'

export type Prioridade = 'alta' | 'comum' | 'baixa'
export type Coluna = { id: string; nome: string; posicao: number; exige_motivo: boolean }
export type Card = {
  id: string
  coluna_id: string
  titulo: string
  briefing: string | null
  tipo_conteudo: string | null
  redes: string[]
  entrega_em: string | null
  postagem_em: string | null
  prioridade: Prioridade
  posicao: number
  motivo_impedimento: string | null
  coluna_antes_impedimento: string | null
  legenda: string | null
  capa_path: string | null
  capa_cor: string | null
  checklist: ItemChecklist[]
  anexos: Anexo[]
  /** Link temporário da capa (o armazenamento é privado) */
  capa_url?: string | null
  comentarios?: number
}
export type ItemChecklist = { id: string; texto: string; feito: boolean }
export type Anexo = { id: string; tipo: 'arquivo' | 'link'; nome: string; caminho?: string; url?: string; mime?: string; criado_em: string }
export type Comentario = { id: number; card_id: string; autor_id: string; texto: string; criado_em: string; autor?: string }
export type Quadro = { id: string; nome: string; colunas: Coluna[]; cards: Card[] }

export const TIPOS = ['Post', 'Carrossel', 'Story', 'Reels', 'Vídeo', 'Campanha', 'Cobertura', 'Outro']
export const REDES = ['Instagram', 'Facebook', 'TikTok', 'LinkedIn', 'YouTube']

// ---------------------------------------------------------------- modo demonstração (sem Supabase)
const colunasDemo: Coluna[] = ['Backlog (ideias)', 'Briefing aprovado', 'Fazendo', 'Feito e aprovado', 'Postado e feito', 'Impedimento']
  .map((nome, i) => ({ id: `c${i + 1}`, nome, posicao: i + 1, exige_motivo: nome === 'Impedimento' }))
const base = { briefing: null, entrega_em: null, postagem_em: null, motivo_impedimento: null, coluna_antes_impedimento: null, legenda: null, capa_path: null, capa_cor: null, checklist: [], anexos: [] }
let cardsDemo: Card[] = [
  { ...base, id: 'k1', coluna_id: 'c1', titulo: 'Série: mitos sobre o coração', tipo_conteudo: 'Carrossel', redes: ['Instagram'], prioridade: 'comum', posicao: 1 },
  { ...base, id: 'k2', coluna_id: 'c1', titulo: 'Bastidores da maternidade', tipo_conteudo: 'Reels', redes: ['Instagram'], prioridade: 'baixa', posicao: 2 },
  { ...base, id: 'k3', coluna_id: 'c2', titulo: 'Campanha da vacina da gripe', tipo_conteudo: 'Post', redes: ['Instagram', 'Facebook'], prioridade: 'comum', posicao: 1, entrega_em: '2026-11-26T12:00:00' },
  { ...base, id: 'k4', coluna_id: 'c3', titulo: 'Carrossel Novembro Azul', tipo_conteudo: 'Carrossel', redes: ['Instagram', 'Facebook'], prioridade: 'alta', posicao: 1, entrega_em: '2026-11-24T16:00:00', postagem_em: '2026-11-24T18:00:00',
    briefing: 'Carrossel de 6 telas sobre prevenção do câncer de próstata. Tom acolhedor, sem alarmismo.', capa_cor: '#1F6FEB',
    legenda: 'Novembro Azul: cuidar de si também é um ato de coragem. 💙 Agende seu check-up.',
    checklist: [{ id: 'a', texto: 'Roteiro das telas', feito: true }, { id: 'b', texto: 'Artes', feito: true }, { id: 'c', texto: 'Revisão médica', feito: false }, { id: 'd', texto: 'Aprovação', feito: false }] },
  { ...base, id: 'k5', coluna_id: 'c3', titulo: 'Reels Dia do Homem', tipo_conteudo: 'Reels', redes: ['Instagram', 'TikTok'], prioridade: 'comum', posicao: 2, entrega_em: '2026-11-25T10:00:00' },
  { ...base, id: 'k6', coluna_id: 'c4', titulo: 'Post Doação de sangue', tipo_conteudo: 'Post', redes: ['Instagram'], prioridade: 'comum', posicao: 1, postagem_em: '2026-11-27T12:00:00', capa_cor: '#E5484D',
    checklist: [{ id: 'a', texto: 'Arte', feito: true }, { id: 'b', texto: 'Legenda', feito: true }] },
  { ...base, id: 'k7', coluna_id: 'c6', titulo: 'Vídeo institucional da UTI', tipo_conteudo: 'Vídeo', redes: ['YouTube'], prioridade: 'comum', posicao: 1,
    motivo_impedimento: 'Aguardando autorização de imagem dos pacientes', coluna_antes_impedimento: 'c3' },
]

// ---------------------------------------------------------------- API
export async function carregarQuadro(clienteId: string): Promise<Quadro | null> {
  if (!supabase) return { id: 'demo', nome: 'Redes sociais', colunas: colunasDemo, cards: cardsDemo.map((c) => ({ ...c, capa_url: c.capa_path ? arquivosDemo.get(c.capa_path) ?? null : null, comentarios: comentariosDemo.filter((x) => x.card_id === c.id).length })) }
  const { data: q, error } = await supabase.from('quadros').select('id, nome')
    .eq('cliente_id', clienteId).eq('tipo', 'oficial').order('criado_em').limit(1).maybeSingle()
  if (error) throw error
  if (!q) return null
  const [colunas, cards] = await Promise.all([
    supabase.from('colunas').select('id, nome, posicao, exige_motivo').eq('quadro_id', q.id).order('posicao'),
    supabase.from('cards').select('*, card_comentarios(count)').eq('quadro_id', q.id).order('posicao'),
  ])
  if (colunas.error) throw colunas.error
  if (cards.error) throw cards.error
  const lista = (cards.data as (Card & { card_comentarios: { count: number }[] })[]).map(({ card_comentarios, ...c }) => ({ ...c, comentarios: card_comentarios?.[0]?.count ?? 0 }))
  // Capas ficam em armazenamento privado: gera links temporários (1 hora) de uma vez
  const caminhos = lista.map((c) => c.capa_path).filter(Boolean) as string[]
  if (caminhos.length) {
    const { data } = await supabase.storage.from('cards').createSignedUrls(caminhos, 3600)
    const links = new Map((data ?? []).map((x) => [x.path, x.signedUrl]))
    lista.forEach((c) => { if (c.capa_path) c.capa_url = links.get(c.capa_path) ?? null })
  }
  return { id: q.id, nome: q.nome, colunas: colunas.data as Coluna[], cards: lista }
}

export async function moverCard(card: Card, colunaId: string, posicao: number, motivo?: string) {
  const mudanca = { coluna_id: colunaId, posicao, motivo_impedimento: motivo ?? null }
  if (!supabase) {
    cardsDemo = cardsDemo.map((c) => c.id === card.id
      ? { ...c, ...mudanca, coluna_antes_impedimento: motivo ? card.coluna_id : null } : c)
    return
  }
  const { error } = await supabase.from('cards').update(mudanca).eq('id', card.id)
  if (error) throw error
}

export async function criarCard(quadroId: string, colunaId: string, titulo: string, posicao: number) {
  if (!supabase) {
    cardsDemo = [...cardsDemo, { ...base, id: crypto.randomUUID(), coluna_id: colunaId, titulo, tipo_conteudo: null, redes: [], prioridade: 'comum', posicao }]
    return
  }
  const { error } = await supabase.from('cards').insert({ quadro_id: quadroId, coluna_id: colunaId, titulo, posicao })
  if (error) throw error
}

export type EdicaoCard = Partial<Pick<Card, 'titulo' | 'briefing' | 'tipo_conteudo' | 'redes' | 'entrega_em' | 'postagem_em' | 'prioridade' | 'legenda' | 'capa_path' | 'capa_cor' | 'checklist' | 'anexos'>>

export async function salvarCard(id: string, edicao: EdicaoCard) {
  if (!supabase) { cardsDemo = cardsDemo.map((c) => (c.id === id ? { ...c, ...edicao } : c)); return }
  const { error } = await supabase.from('cards').update(edicao).eq('id', id)
  if (error) throw error
}

export async function excluirCard(id: string) {
  if (!supabase) { cardsDemo = cardsDemo.filter((c) => c.id !== id); return }
  const { error } = await supabase.from('cards').delete().eq('id', id)
  if (error) throw error
}

/** Data curta para os cards: "Hoje, 16:00", "Amanhã, 10:00" ou "26/11". */
export function dataCurta(iso: string | null, agora = new Date()) {
  if (!iso) return null
  const d = new Date(iso)
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((dia(d) - dia(agora)) / 86_400_000)
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (diff === 0) return `hoje, ${hora}`
  if (diff === 1) return `amanhã, ${hora}`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// ---------------------------------------------------------------- arquivos, capa e comentários
const arquivosDemo = new Map<string, string>()
let comentariosDemo: Comentario[] = [
  { id: 1, card_id: 'k4', autor_id: 'demo', autor: 'Kiara', texto: 'Mandei a revisão para o Dr. Paulo, ele responde até amanhã.', criado_em: new Date(Date.now() - 3 * 3_600_000).toISOString() },
]
const nomeSeguro = (n: string) => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.-]+/g, '-').slice(-60)

/** Envia um arquivo do card (imagem de capa, arte, PDF…) para o armazenamento privado. Imagens grandes são reduzidas. */
export async function enviarArquivoCard(quadroId: string, cardId: string, arquivo: File): Promise<Anexo> {
  if (arquivo.size > 25 * 1024 * 1024) throw new Error('Arquivo maior que 25 MB.')
  let corpo: Blob = arquivo
  let nome = arquivo.name
  if (/^image\/(jpeg|png|webp)$/.test(arquivo.type) && arquivo.size > 600_000) {
    const { reduzirImagem } = await import('./imagens')
    corpo = await reduzirImagem(arquivo, 1600); nome = nome.replace(/\.\w+$/, '') + '.webp'
  }
  const caminho = `${quadroId}/${cardId}/${Date.now()}-${nomeSeguro(nome)}`
  const anexo: Anexo = { id: crypto.randomUUID(), tipo: 'arquivo', nome: arquivo.name, caminho, mime: corpo.type || arquivo.type, criado_em: new Date().toISOString() }
  if (!supabase) { arquivosDemo.set(caminho, URL.createObjectURL(corpo)); return anexo }
  const { error } = await supabase.storage.from('cards').upload(caminho, corpo, { contentType: corpo.type || undefined })
  if (error) throw new Error('Não foi possível enviar o arquivo.')
  return anexo
}

/** Links temporários para ver/baixar arquivos privados dos cards. */
export async function linksArquivos(caminhos: string[]): Promise<Map<string, string>> {
  if (!caminhos.length) return new Map()
  if (!supabase) return new Map(caminhos.map((c) => [c, arquivosDemo.get(c) ?? '']))
  const { data } = await supabase.storage.from('cards').createSignedUrls(caminhos, 3600)
  return new Map((data ?? []).filter((x) => x.signedUrl && x.path).map((x) => [x.path as string, x.signedUrl as string]))
}

export async function apagarArquivoCard(caminho: string) {
  if (!supabase) { arquivosDemo.delete(caminho); return }
  await supabase.storage.from('cards').remove([caminho])
}

export async function listarComentarios(cardId: string): Promise<Comentario[]> {
  if (!supabase) return comentariosDemo.filter((c) => c.card_id === cardId)
  const { data } = await supabase.from('card_comentarios').select('*').eq('card_id', cardId).order('criado_em', { ascending: false })
  const lista = (data ?? []) as Comentario[]
  const autores = [...new Set(lista.map((c) => c.autor_id))]
  if (autores.length) {
    const p = await supabase.from('perfis').select('id, nome').in('id', autores)
    const nomes = new Map((p.data ?? []).map((x: { id: string; nome: string }) => [x.id, x.nome]))
    lista.forEach((c) => { c.autor = nomes.get(c.autor_id) })
  }
  return lista
}

export async function comentar(cardId: string, texto: string) {
  if (!supabase) { comentariosDemo = [{ id: Date.now(), card_id: cardId, autor_id: 'demo', autor: 'Você', texto, criado_em: new Date().toISOString() }, ...comentariosDemo]; return }
  const { error } = await supabase.from('card_comentarios').insert({ card_id: cardId, texto })
  if (error) throw new Error('Não foi possível comentar.')
}

export async function apagarComentario(id: number) {
  if (!supabase) { comentariosDemo = comentariosDemo.filter((c) => c.id !== id); return }
  await supabase.from('card_comentarios').delete().eq('id', id)
}

/** Para o card na coluna: entrega atrasada, hoje, amanhã… */
export function situacaoPrazo(iso: string | null, concluido = false): 'atrasado' | 'hoje' | 'breve' | 'ok' | 'feito' | null {
  if (!iso) return null
  if (concluido) return 'feito'
  const d = new Date(iso).getTime(); const agora = Date.now()
  if (d < agora) return 'atrasado'
  const hoje = new Date(); hoje.setHours(23, 59, 59, 999)
  if (d <= hoje.getTime()) return 'hoje'
  if (d - agora < 2 * 86_400_000) return 'breve'
  return 'ok'
}
