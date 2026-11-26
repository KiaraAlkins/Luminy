import { ImportarPlanilha, type Conversao } from '../../components/Planilha'
import { dataIso, normalizar, numero, textoDe, type Valor } from '../../lib/planilhas'
import { MODELO_GASTOS } from '../../lib/modelos'
import { CATEGORIAS, dataBr, importarGastos, reais, type Fornecedor, type GastoImportado } from '../../lib/negocios'

const SINONIMOS: Record<string, string[]> = {
  data: ['data', 'dia', 'data do pagamento', 'pagamento', 'vencimento', 'competencia'],
  descricao: ['descricao', 'descrição', 'o que foi', 'item', 'gasto', 'historico', 'despesa'],
  valor: ['valor', 'total', 'preco', 'preço', 'custo', 'valor pago'],
  categoria: ['categoria', 'tipo', 'grupo', 'centro de custo'],
  fornecedor: ['fornecedor', 'empresa', 'favorecido', 'prestador'],
  situacao: ['situacao', 'situação', 'status', 'pago'],
}


const categoria = (t: string) => {
  if (!t) return null
  const n = normalizar(t)
  return CATEGORIAS.find((c) => normalizar(c.nome) === n || normalizar(c.nome).startsWith(n) || n.startsWith(normalizar(c.nome).split(' ')[0]))?.nome ?? 'Outros'
}

function converter(l: Valor[], m: Record<string, number>): Conversao<GastoImportado> {
  const bruto = (c: string) => (m[c] === undefined ? null : l[m[c]])
  const v = (c: string) => textoDe(bruto(c)).trim()
  const descricao = v('descricao')
  if (!descricao) return { ok: false, erro: 'sem descrição' }
  const data = dataIso(bruto('data') ?? null)
  if (!data) return { ok: false, erro: `${descricao}: data "${v('data')}" (use dd/mm/aaaa)` }
  const b = bruto('valor')
  const valor = typeof b === 'number' ? b : numero(String(b ?? '').replace(/[^\d,.-]/g, ''))
  if (valor == null || valor <= 0) return { ok: false, erro: `${descricao}: valor "${v('valor')}" não é um valor válido` }
  const s = normalizar(v('situacao'))
  const situacao: GastoImportado['situacao'] = /^(previsto|a pagar|pendente|aberto|nao|não|n)$/.test(s) ? 'previsto' : 'pago'
  return { ok: true, item: { data, descricao, valor: Math.round(valor * 100) / 100, categoria: categoria(v('categoria')), fornecedor: v('fornecedor') || null, situacao } }
}

/** Importar gastos do Financeiro (Excel, CSV ou Google Planilhas). */
export function ImportarGastos({ clienteId, fornecedores, onFechar, onImportado }: { clienteId: string; fornecedores: Fornecedor[]; onFechar: () => void; onImportado: () => Promise<void> }) {
  return (
    <ImportarPlanilha<GastoImportado>
      titulo="Importar gastos de planilha" nome="gastos-marketing" modelo={MODELO_GASTOS}
      sinonimos={SINONIMOS} obrigatorias={['data', 'descricao', 'valor']} converter={converter}
      previa={[
        { rotulo: 'Data', valor: (g) => dataBr(g.data) },
        { rotulo: 'Descrição', valor: (g) => g.descricao },
        { rotulo: 'Valor', valor: (g) => reais(g.valor) },
        { rotulo: 'Categoria', valor: (g) => g.categoria ?? '—' },
        { rotulo: 'Fornecedor', valor: (g) => g.fornecedor ?? '—' },
        { rotulo: 'Situação', valor: (g) => (g.situacao === 'pago' ? 'Pago' : 'Previsto') },
      ]}
      aviso={<p className="faixa-dica">Precisa das colunas Data, Descrição e Valor. Categoria, Fornecedor e Situação (Pago ou Previsto) são opcionais; sem situação, entra como pago. Cada gasto vai para o mês da data dele.</p>}
      enviar={async (itens) => {
        const n = await importarGastos(clienteId, fornecedores, itens)
        await onImportado()
        return `${n} ${n === 1 ? 'gasto importado' : 'gastos importados'}.`
      }}
      onFechar={onFechar} />
  )
}
