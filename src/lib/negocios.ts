import { supabase } from './supabase'

/** Negócios do marketing do cliente: fornecedores, orçamentos, verba, gastos e contratos (só administradores). */

export type Fornecedor = { id: string; cliente_id: string; nome: string; categoria: string | null; contato: string | null; telefone: string | null; email: string | null; observacoes: string | null; nota: number | null; ativo: boolean; criado_em: string }
export type Contrato = {
  id: string; cliente_id: string; fornecedor_id: string | null; titulo: string; categoria: string | null; valor: number; periodicidade: 'mensal' | 'anual' | 'unico'
  inicio: string; fim: string | null; renovacao_automatica: boolean; aviso_dias: number; situacao: 'vigente' | 'para_assinar' | 'encerrado'; arquivo_path: string | null; observacoes: string | null; criado_em: string
  referente_tipo: ReferenteTipo | null; referente: string | null; nota_mensal: boolean
}
export type ReferenteTipo = 'outdoor' | 'evento' | 'material' | 'servico' | 'outro'
export const REFERENTES: { valor: ReferenteTipo; rotulo: string; dica: string }[] = [
  { valor: 'outdoor', rotulo: 'Outdoor', dica: 'Ex.: Av. Central, ponto 12 · campanha Novembro Azul' },
  { valor: 'evento', rotulo: 'Evento', dica: 'Ex.: estrutura e som da corrida' },
  { valor: 'material', rotulo: 'Lona / material', dica: 'Ex.: lona 3x1 m da fachada · Dezembro Vermelho' },
  { valor: 'servico', rotulo: 'Serviço', dica: 'Ex.: cobertura fotográfica de novembro' },
  { valor: 'outro', rotulo: 'Outro', dica: 'Do que é esta nota' },
]
export type NotaFiscal = {
  id: string; cliente_id: string; numero: string | null; fornecedor_id: string | null; fornecedor_nome: string | null; contrato_id: string | null
  valor: number | null; emissao: string | null; competencia: string; referente_tipo: ReferenteTipo; referente: string | null; evento_id: string | null
  recebida_em: string; recebida_por: string | null; assinada_em: string | null; assinada_por: string | null; arquivo_path: string | null; digitalizada_em: string | null
  entregue_em: string | null; entregue_por: string | null; entregue_para: string | null; protocolo: string | null; lancamento_id: string | null; observacao: string | null
  criado_por: string; criado_em: string
}
export type EtapaNota = 'assinar' | 'digitalizar' | 'entregar' | 'concluida'
/** Próximo passo da nota: assinar → digitalizar → entregar ao almoxarifado. */
export const etapaNota = (n: NotaFiscal): EtapaNota => (!n.assinada_em ? 'assinar' : !n.arquivo_path ? 'digitalizar' : !n.entregue_em ? 'entregar' : 'concluida')
export type Cotacao = { id: string; orcamento_id: string; fornecedor_id: string | null; fornecedor_nome: string | null; valor: number; prazo_entrega: string | null; observacao: string | null; arquivo_path: string | null; criado_em: string }
export type Orcamento = { id: string; cliente_id: string; titulo: string; descricao: string | null; categoria: string | null; prazo: string | null; situacao: 'cotando' | 'aprovado' | 'cancelado'; cotacao_escolhida: string | null; criado_por: string; criado_em: string; cotacoes: Cotacao[] }
export type Lancamento = {
  id: string; cliente_id: string; data: string; descricao: string; categoria: string | null; valor: number; situacao: 'previsto' | 'pago'
  fornecedor_id: string | null; orcamento_id: string | null; contrato_id: string | null; comprovante_path: string | null; observacao: string | null; criado_em: string
}
export type Verba = { cliente_id: string; mes: string; valor: number }

export const CATEGORIAS = [
  { nome: 'Gráfica e impressos', cor: '#3D2EF9' },
  { nome: 'Brindes', cor: '#EE46BC' },
  { nome: 'Anúncios e impulsionamento', cor: '#F79009' },
  { nome: 'Foto e vídeo', cor: '#7A5AF8' },
  { nome: 'Eventos', cor: '#12A15F' },
  { nome: 'Ferramentas e assinaturas', cor: '#2E90FA' },
  { nome: 'Agência e freelancers', cor: '#E5484D' },
  { nome: 'Outros', cor: '#98A2B3' },
]
export const corCategoria = (c: string | null) => CATEGORIAS.find((x) => x.nome === c)?.cor ?? '#98A2B3'

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const reais = (v: number) => fmt.format(v)
export const reaisCurto = (v: number) => (Math.abs(v) >= 10_000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : fmt.format(v))
/** "1.250,90" ou "1250.9" → 1250.9 */
export function lerValor(t: string): number | null {
  const limpo = t.replace(/[^\d,.-]/g, '')
  if (!limpo) return null
  const n = Number(/,\d{1,2}$/.test(limpo) ? limpo.replace(/\./g, '').replace(',', '.') : limpo.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}
export const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
export const mesIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
export const dataBr = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '')
const diaLocal = (iso: string) => { const [a, m, d] = iso.slice(0, 10).split('-').map(Number); return new Date(a, m - 1, d) }
export const diasAte = (iso: string, agora = Date.now()) => Math.ceil((diaLocal(iso).getTime() - new Date(new Date(agora).toDateString()).getTime()) / 86_400_000)

// ---------------------------------------------------------------- contratos: situação
export type SituacaoContrato = 'ativo' | 'renovar' | 'para_assinar' | 'vencido' | 'encerrado'
export function situacaoContrato(c: Contrato, agora = Date.now()): SituacaoContrato {
  if (c.situacao === 'encerrado') return 'encerrado'
  if (c.situacao === 'para_assinar') return 'para_assinar'
  const fim = fimVigente(c, agora)
  if (!fim || c.renovacao_automatica) return 'ativo'          // sem fim, ou renova sozinho
  const d = diasAte(fim, agora)
  return d < 0 ? 'vencido' : d <= c.aviso_dias ? 'renovar' : 'ativo'
}
/** Fim da vigência atual (contratos que renovam sozinhos avançam de ano em ano). */
export function fimVigente(c: Contrato, agora = Date.now()): string | null {
  if (!c.fim) return null
  if (!c.renovacao_automatica) return c.fim
  let fim = diaLocal(c.fim)
  while (fim.getTime() < agora) fim = new Date(fim.getFullYear() + 1, fim.getMonth(), fim.getDate())
  return `${fim.getFullYear()}-${String(fim.getMonth() + 1).padStart(2, '0')}-${String(fim.getDate()).padStart(2, '0')}`
}
/** Quanto o contrato pesa por mês na verba. */
export const custoMensal = (c: Contrato) => (c.periodicidade === 'mensal' ? c.valor : c.periodicidade === 'anual' ? c.valor / 12 : 0)

// ---------------------------------------------------------------- dados de demonstração
const hoje = new Date()
const dia = (n: number) => { const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const noMes = (d: number, mesesAtras = 0) => { const x = new Date(hoje.getFullYear(), hoje.getMonth() - mesesAtras, d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }
const agoraIso = new Date().toISOString()
const C = 'hospital'
const notaBase = { cliente_id: C, numero: null, fornecedor_id: null, fornecedor_nome: null, contrato_id: null, valor: null, emissao: null, evento_id: null, recebida_por: 'p1', assinada_em: null, assinada_por: null,
  arquivo_path: null, digitalizada_em: null, entregue_em: null, entregue_por: null, entregue_para: null, protocolo: null, lancamento_id: null, observacao: null, criado_por: 'p1', criado_em: agoraIso }
const notasDemo: NotaFiscal[] = [
  { ...notaBase, id: 'nf1', numero: '4521', fornecedor_id: 'f6', contrato_id: 'ct5', valor: 2500, emissao: noMes(3), competencia: mesIso(hoje), referente_tipo: 'outdoor', referente: 'Av. Central, ponto 12 · arte Novembro Azul', recebida_em: noMes(4), assinada_em: noMes(4) + 'T10:00:00', assinada_por: 'p1', arquivo_path: 'demo/nf-4521.pdf', digitalizada_em: noMes(4) + 'T10:10:00', entregue_em: noMes(5) + 'T14:00:00', entregue_por: 'p1', entregue_para: 'Sandra (almoxarifado)', protocolo: 'ALM-1187' },
  { ...notaBase, id: 'nf2', numero: '4522', fornecedor_id: 'f6', contrato_id: 'ct5', valor: 2500, emissao: noMes(3), competencia: mesIso(hoje), referente_tipo: 'outdoor', referente: 'BR-040 km 8, ponto 7 · arte Novembro Azul', recebida_em: noMes(4), assinada_em: noMes(4) + 'T10:00:00', assinada_por: 'p1', arquivo_path: 'demo/nf-4522.pdf', digitalizada_em: noMes(4) + 'T10:12:00' },
  { ...notaBase, id: 'nf3', numero: '887', fornecedor_id: 'f7', valor: 3800, emissao: noMes(13), competencia: mesIso(hoje), referente_tipo: 'evento', referente: 'Tenda 10x10, som e lona de fundo', evento_id: 'v3', recebida_em: noMes(16), assinada_em: noMes(17) + 'T09:00:00', assinada_por: 'p2' },
  { ...notaBase, id: 'nf4', numero: '15.902', fornecedor_id: 'f1', valor: 980, emissao: noMes(6), competencia: mesIso(hoje), referente_tipo: 'material', referente: 'Folders do Novembro Azul (2.000 un.)', recebida_em: noMes(7) },
  { ...notaBase, id: 'nf5', numero: '312', fornecedor_id: 'f4', contrato_id: 'ct1', valor: 3200, emissao: noMes(5), competencia: mesIso(hoje), referente_tipo: 'servico', referente: 'Cobertura de eventos e vídeos de novembro', recebida_em: noMes(6) },
  { ...notaBase, id: 'nf6', numero: '4410', fornecedor_id: 'f6', contrato_id: 'ct5', valor: 2500, emissao: noMes(3, 1), competencia: mesIso(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)), referente_tipo: 'outdoor', referente: 'Av. Central, ponto 12 · arte Outubro Rosa', recebida_em: noMes(4, 1), assinada_em: noMes(4, 1) + 'T10:00:00', assinada_por: 'p1', arquivo_path: 'demo/nf-4410.pdf', digitalizada_em: noMes(4, 1) + 'T10:00:00', entregue_em: noMes(6, 1) + 'T10:00:00', entregue_por: 'p1', entregue_para: 'Sandra (almoxarifado)' },
]
const demo = {
  fornecedores: [
    { id: 'f1', cliente_id: C, nome: 'Gráfica Central', categoria: 'Gráfica e impressos', contato: 'Marcos', telefone: '(61) 99999-1001', email: 'orcamento@graficacentral.com.br', observacoes: 'Entrega em 3 dias úteis. Aceita boleto 28 dias.', nota: 5, ativo: true, criado_em: agoraIso },
    { id: 'f2', cliente_id: C, nome: 'Print Express', categoria: 'Gráfica e impressos', contato: 'Lívia', telefone: '(61) 98888-2002', email: null, observacoes: null, nota: 4, ativo: true, criado_em: agoraIso },
    { id: 'f3', cliente_id: C, nome: 'Brindes & Cia', categoria: 'Brindes', contato: 'Renata', telefone: '(61) 97777-3003', email: 'vendas@brindesecia.com.br', observacoes: 'Pedido mínimo de 100 unidades.', nota: 4, ativo: true, criado_em: agoraIso },
    { id: 'f4', cliente_id: C, nome: 'Lume Filmes', categoria: 'Foto e vídeo', contato: 'Thiago', telefone: '(61) 96666-4004', email: null, observacoes: 'Cobertura de eventos e vídeo institucional.', nota: 5, ativo: true, criado_em: agoraIso },
    { id: 'f6', cliente_id: C, nome: 'Mídia Exterior Outdoors', categoria: 'Anúncios e impulsionamento', contato: 'Paulo', telefone: '(61) 95555-6006', email: 'financeiro@midiaexterior.com.br', observacoes: 'Nota até o dia 5 de cada mês.', nota: 4, ativo: true, criado_em: agoraIso },
    { id: 'f7', cliente_id: C, nome: 'Palco & Som Eventos', categoria: 'Eventos', contato: 'Diego', telefone: '(61) 94444-7007', email: null, observacoes: 'Tendas, som e lonas para eventos.', nota: 5, ativo: true, criado_em: agoraIso },
    { id: 'f5', cliente_id: C, nome: 'Canva Pro', categoria: 'Ferramentas e assinaturas', contato: null, telefone: null, email: null, observacoes: null, nota: null, ativo: true, criado_em: agoraIso },
  ] as Fornecedor[],
  contratos: [
    { id: 'ct1', cliente_id: C, fornecedor_id: 'f4', titulo: 'Cobertura de eventos e vídeos mensais', categoria: 'Foto e vídeo', valor: 3200, periodicidade: 'mensal', inicio: noMes(1, 11), fim: dia(38), renovacao_automatica: false, aviso_dias: 60, situacao: 'vigente', arquivo_path: null, observacoes: null, criado_em: agoraIso },
    { id: 'ct2', cliente_id: C, fornecedor_id: 'f5', titulo: 'Assinatura Canva para equipes', categoria: 'Ferramentas e assinaturas', valor: 1260, periodicidade: 'anual', inicio: noMes(10, 5), fim: dia(160), renovacao_automatica: true, aviso_dias: 30, situacao: 'vigente', arquivo_path: null, observacoes: null, criado_em: agoraIso },
    { id: 'ct3', cliente_id: C, fornecedor_id: 'f1', titulo: 'Impressos do ano (folders, cartazes e banners)', categoria: 'Gráfica e impressos', valor: 18000, periodicidade: 'unico', inicio: noMes(1, 10), fim: dia(250), renovacao_automatica: false, aviso_dias: 60, situacao: 'vigente', arquivo_path: null, observacoes: 'Valor total do ano, pago por pedido.', criado_em: agoraIso },
    { id: 'ct6', cliente_id: C, fornecedor_id: 'f6', titulo: 'Painel de LED da Av. Brasil', categoria: 'Anúncios e impulsionamento', valor: 1800, periodicidade: 'mensal', inicio: noMes(1, 3), fim: dia(200), renovacao_automatica: false, aviso_dias: 60, situacao: 'vigente', arquivo_path: null, observacoes: null, criado_em: agoraIso,
      referente_tipo: 'outdoor', referente: 'Painel de LED · Av. Brasil, em frente ao shopping', nota_mensal: true },
    { id: 'ct4', cliente_id: C, fornecedor_id: 'f3', titulo: 'Kits de boas-vindas dos colaboradores', categoria: 'Brindes', valor: 4500, periodicidade: 'unico', inicio: dia(-20), fim: dia(120), renovacao_automatica: false, aviso_dias: 60, situacao: 'vigente', arquivo_path: null, observacoes: null, criado_em: agoraIso },
    { id: 'ct5', cliente_id: C, fornecedor_id: 'f6', titulo: 'Aluguel de 3 outdoors', categoria: 'Anúncios e impulsionamento', valor: 7500, periodicidade: 'mensal', inicio: noMes(1, 8), fim: dia(70), renovacao_automatica: false, aviso_dias: 60, situacao: 'vigente', arquivo_path: null, observacoes: 'R$ 2.500 por ponto. Arte trocada todo mês.', criado_em: agoraIso,
      referente_tipo: 'outdoor', referente: 'Pontos: Av. Central (12), BR-040 km 8 (7) e Rodoviária (3)', nota_mensal: true },
  ].map((c) => ({ referente_tipo: null, referente: null, nota_mensal: false, ...c })) as Contrato[],
  orcamentos: [
    { id: 'o1', cliente_id: C, titulo: 'Banners do Dezembro Vermelho (3 unidades, 1x2 m)', descricao: 'Lona com ilhós, para recepção, PS e ambulatório.', categoria: 'Gráfica e impressos', prazo: dia(4), situacao: 'cotando', cotacao_escolhida: null, criado_por: 'p1', criado_em: agoraIso,
      cotacoes: [
        { id: 'q1', orcamento_id: 'o1', fornecedor_id: 'f1', fornecedor_nome: null, valor: 690, prazo_entrega: '3 dias úteis', observacao: null, arquivo_path: null, criado_em: agoraIso },
        { id: 'q2', orcamento_id: 'o1', fornecedor_id: 'f2', fornecedor_nome: null, valor: 540, prazo_entrega: '5 dias úteis', observacao: 'Frete à parte', arquivo_path: null, criado_em: agoraIso },
        { id: 'q3', orcamento_id: 'o1', fornecedor_id: null, fornecedor_nome: 'Gráfica do Bairro', valor: 610, prazo_entrega: '2 dias úteis', observacao: null, arquivo_path: null, criado_em: agoraIso },
      ] },
    { id: 'o2', cliente_id: C, titulo: 'Canecas para o Dia do Médico (80 un.)', descricao: null, categoria: 'Brindes', prazo: dia(20), situacao: 'cotando', cotacao_escolhida: null, criado_por: 'p1', criado_em: agoraIso,
      cotacoes: [{ id: 'q4', orcamento_id: 'o2', fornecedor_id: 'f3', fornecedor_nome: null, valor: 2240, prazo_entrega: '15 dias', observacao: 'Personalizadas com logo', arquivo_path: null, criado_em: agoraIso }] },
    { id: 'o3', cliente_id: C, titulo: 'Folders do Novembro Azul (2.000 un.)', descricao: null, categoria: 'Gráfica e impressos', prazo: null, situacao: 'aprovado', cotacao_escolhida: 'q5', criado_por: 'p1', criado_em: agoraIso,
      cotacoes: [{ id: 'q5', orcamento_id: 'o3', fornecedor_id: 'f1', fornecedor_nome: null, valor: 980, prazo_entrega: '4 dias', observacao: null, arquivo_path: null, criado_em: agoraIso }] },
  ] as Orcamento[],
  notas_fiscais: notasDemo,
  verbas: [{ cliente_id: C, mes: mesIso(hoje), valor: 15000 }, { cliente_id: C, mes: mesIso(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)), valor: 15000 }] as Verba[],
  lancamentos: [
    { id: 'l1', data: noMes(3), descricao: 'Folders do Novembro Azul (2.000 un.)', categoria: 'Gráfica e impressos', valor: 980, situacao: 'pago', fornecedor_id: 'f1', orcamento_id: 'o3' },
    { id: 'l2', data: noMes(5), descricao: 'Mensalidade: cobertura de eventos e vídeos', categoria: 'Foto e vídeo', valor: 3200, situacao: 'pago', fornecedor_id: 'f4', contrato_id: 'ct1' },
    { id: 'l3', data: noMes(8), descricao: 'Impulsionamento campanha Novembro Azul', categoria: 'Anúncios e impulsionamento', valor: 1800, situacao: 'pago' },
    { id: 'l4', data: noMes(12), descricao: 'Camisetas da corrida Novembro Azul', categoria: 'Brindes', valor: 2650, situacao: 'pago', fornecedor_id: 'f3' },
    { id: 'l5', data: noMes(18), descricao: 'Estande no evento da Associação Comercial', categoria: 'Eventos', valor: 1500, situacao: 'pago' },
    { id: 'l6', data: noMes(28), descricao: 'Impulsionamento Dezembro Vermelho', categoria: 'Anúncios e impulsionamento', valor: 1200, situacao: 'previsto' },
    { id: 'm1', data: noMes(4, 1), descricao: 'Banners Outubro Rosa', categoria: 'Gráfica e impressos', valor: 1350, situacao: 'pago', fornecedor_id: 'f1' },
    { id: 'm2', data: noMes(5, 1), descricao: 'Mensalidade: cobertura de eventos e vídeos', categoria: 'Foto e vídeo', valor: 3200, situacao: 'pago', fornecedor_id: 'f4', contrato_id: 'ct1' },
    { id: 'm3', data: noMes(10, 1), descricao: 'Impulsionamento Outubro Rosa', categoria: 'Anúncios e impulsionamento', valor: 2400, situacao: 'pago' },
    { id: 'm4', data: noMes(15, 1), descricao: 'Laços e bottons Outubro Rosa', categoria: 'Brindes', valor: 1720, situacao: 'pago', fornecedor_id: 'f3' },
  ].map((l) => ({ cliente_id: C, fornecedor_id: null, orcamento_id: null, contrato_id: null, comprovante_path: null, observacao: null, criado_em: agoraIso, ...l })) as Lancamento[],
}
const arquivosDemo = new Map<string, string>()

// ---------------------------------------------------------------- leitura
export async function carregarNegocios(clienteId: string) {
  if (!supabase) return { fornecedores: [...demo.fornecedores], contratos: [...demo.contratos], orcamentos: demo.orcamentos.map((o) => ({ ...o, cotacoes: [...o.cotacoes] })), verbas: [...demo.verbas], lancamentos: [...demo.lancamentos], notas: [...demo.notas_fiscais] }
  const [f, c, o, v, l, n] = await Promise.all([
    supabase.from('fornecedores').select('*').eq('cliente_id', clienteId).order('nome'),
    supabase.from('contratos').select('*').eq('cliente_id', clienteId).order('fim', { nullsFirst: false }),
    supabase.from('orcamentos').select('*, cotacoes(*)').eq('cliente_id', clienteId).order('criado_em', { ascending: false }),
    supabase.from('verbas').select('*').eq('cliente_id', clienteId),
    supabase.from('lancamentos').select('*').eq('cliente_id', clienteId).order('data', { ascending: false }),
    supabase.from('notas_fiscais').select('*').eq('cliente_id', clienteId).order('recebida_em', { ascending: false }),
  ])
  const erro = f.error ?? c.error ?? o.error ?? v.error ?? l.error ?? n.error
  if (erro) throw erro
  const num = <T extends { valor: number }>(x: T) => ({ ...x, valor: Number(x.valor) })
  return {
    fornecedores: f.data as Fornecedor[],
    contratos: (c.data as Contrato[]).map(num),
    orcamentos: (o.data as Orcamento[]).map((x) => ({ ...x, cotacoes: x.cotacoes.map(num).sort((a, b) => a.valor - b.valor) })),
    verbas: (v.data as Verba[]).map(num),
    lancamentos: (l.data as Lancamento[]).map(num),
    notas: (n.data as NotaFiscal[]).map((x) => ({ ...x, valor: x.valor == null ? null : Number(x.valor) })),
  }
}
export type DadosNegocios = Awaited<ReturnType<typeof carregarNegocios>>

// ---------------------------------------------------------------- escrita (genérica por tabela)
type Tabelas = { fornecedores: Fornecedor; contratos: Contrato; lancamentos: Lancamento; notas_fiscais: NotaFiscal }
const novoId = () => crypto.randomUUID()

export async function salvar<T extends keyof Tabelas>(tabela: T, clienteId: string, id: string | null, dados: Partial<Tabelas[T]>): Promise<string> {
  if (!supabase) {
    const lista = demo[tabela] as unknown as Tabelas[T][]
    if (id) { (demo[tabela] as unknown) = lista.map((x) => ((x as { id: string }).id === id ? { ...x, ...dados } : x)); return id }
    const novo = { id: novoId(), cliente_id: clienteId, criado_em: new Date().toISOString(), ...dados } as unknown as Tabelas[T]
    ;(demo[tabela] as unknown) = [...lista, novo]
    return (novo as { id: string }).id
  }
  if (id) {
    const { error } = await supabase.from(tabela).update(dados as never).eq('id', id)
    if (error) throw error
    return id
  }
  const { data, error } = await supabase.from(tabela).insert({ cliente_id: clienteId, ...dados }).select('id').single()
  if (error) throw error
  return data.id as string
}

export async function excluir(tabela: keyof Tabelas | 'orcamentos', id: string) {
  if (!supabase) { (demo[tabela] as unknown) = (demo[tabela] as { id: string }[]).filter((x) => x.id !== id); return }
  const { error } = await supabase.from(tabela).delete().eq('id', id)
  if (error) throw error
}

export async function definirVerba(clienteId: string, mes: string, valor: number) {
  if (!supabase) { demo.verbas = [...demo.verbas.filter((v) => v.mes !== mes), { cliente_id: clienteId, mes, valor }]; return }
  const { error } = await supabase.from('verbas').upsert({ cliente_id: clienteId, mes, valor })
  if (error) throw error
}

// ---------------------------------------------------------------- orçamentos e cotações
export async function salvarOrcamento(clienteId: string, id: string | null, dados: Partial<Omit<Orcamento, 'cotacoes'>>): Promise<string> {
  if (!supabase) {
    if (id) { demo.orcamentos = demo.orcamentos.map((o) => (o.id === id ? { ...o, ...dados } : o)); return id }
    const novo: Orcamento = { id: novoId(), cliente_id: clienteId, titulo: '', descricao: null, categoria: null, prazo: null, situacao: 'cotando', cotacao_escolhida: null, criado_por: 'p1', criado_em: new Date().toISOString(), cotacoes: [], ...dados }
    demo.orcamentos = [novo, ...demo.orcamentos]; return novo.id
  }
  if (id) { const { error } = await supabase.from('orcamentos').update(dados).eq('id', id); if (error) throw error; return id }
  const { data, error } = await supabase.from('orcamentos').insert({ cliente_id: clienteId, ...dados }).select('id').single()
  if (error) throw error
  return data.id as string
}

export async function salvarCotacao(orcamentoId: string, id: string | null, dados: Partial<Cotacao>) {
  if (!supabase) {
    demo.orcamentos = demo.orcamentos.map((o) => o.id !== orcamentoId ? o : {
      ...o, cotacoes: id ? o.cotacoes.map((q) => (q.id === id ? { ...q, ...dados } : q))
        : [...o.cotacoes, { id: novoId(), orcamento_id: orcamentoId, fornecedor_id: null, fornecedor_nome: null, valor: 0, prazo_entrega: null, observacao: null, arquivo_path: null, criado_em: new Date().toISOString(), ...dados }],
    })
    return
  }
  const { error } = id ? await supabase.from('cotacoes').update(dados).eq('id', id) : await supabase.from('cotacoes').insert({ orcamento_id: orcamentoId, ...dados })
  if (error) throw error
}

export async function excluirCotacao(orcamentoId: string, id: string) {
  if (!supabase) { demo.orcamentos = demo.orcamentos.map((o) => (o.id === orcamentoId ? { ...o, cotacoes: o.cotacoes.filter((q) => q.id !== id) } : o)); return }
  const { error } = await supabase.from('cotacoes').delete().eq('id', id)
  if (error) throw error
}

/** Escolhe a cotação vencedora: aprova o orçamento e já lança o gasto como previsto no Financeiro. */
export async function aprovarCotacao(clienteId: string, o: Orcamento, q: Cotacao, fornecedorNome: string) {
  await salvarOrcamento(clienteId, o.id, { situacao: 'aprovado', cotacao_escolhida: q.id })
  await salvar('lancamentos', clienteId, null, {
    data: hojeIso(), descricao: o.titulo, categoria: o.categoria, valor: q.valor, situacao: 'previsto',
    fornecedor_id: q.fornecedor_id, orcamento_id: o.id, observacao: q.fornecedor_id ? null : `Fornecedor: ${fornecedorNome}`,
  })
}

// ---------------------------------------------------------------- arquivos (contratos, propostas, comprovantes)
const nomeSeguro = (n: string) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-').slice(-60)
export async function enviarArquivo(clienteId: string, pasta: 'contratos' | 'cotacoes' | 'comprovantes' | 'notas', arquivo: File): Promise<string> {
  if (arquivo.size > 20 * 1024 * 1024) throw new Error('Arquivo maior que 20 MB.')
  const caminho = `${clienteId}/${pasta}/${Date.now()}-${nomeSeguro(arquivo.name)}`
  if (!supabase) { arquivosDemo.set(caminho, URL.createObjectURL(arquivo)); return caminho }
  const { error } = await supabase.storage.from('negocios').upload(caminho, arquivo, { contentType: arquivo.type || undefined })
  if (error) throw new Error('Não foi possível enviar o arquivo.')
  return caminho
}
export async function abrirArquivo(caminho: string) {
  const janela = window.open('', '_blank')
  let url = arquivosDemo.get(caminho) ?? ''
  if (supabase) { const { data } = await supabase.storage.from('negocios').createSignedUrl(caminho, 300); url = data?.signedUrl ?? '' }
  if (janela) { if (url) janela.location.href = url; else janela.close() }
}
export const nomeArquivo = (caminho: string) => caminho.split('/').pop()!.replace(/^\d+-/, '')
