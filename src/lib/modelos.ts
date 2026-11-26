import type { Tabela } from './planilhas'

/** Planilhas modelo com as colunas que o Luminy reconhece na importação. */
export const MODELO_LEADS: Tabela = {
  colunas: ['Nome', 'WhatsApp', 'E-mail', 'Plano de saúde', 'Segmentos', 'Aceita campanhas', 'Etapa'],
  linhas: [['Maria Souza', '(61) 99999-0000', 'maria@exemplo.com', 'Unimed', 'Risco de diabetes', 'Sim', 'Novo']],
}

export const MODELO_ESTOQUE: Tabela = {
  colunas: ['Nome', 'Categoria', 'Unidade', 'Quantidade', 'Mínimo', 'Local', 'Validade'],
  linhas: [['Fitas de glicemia', 'Saúde', 'caixa', 10, 5, 'Armário 2', '31/12/2027'], ['Squeeze Novembro Azul', 'Brindes', 'un', 140, 50, 'Depósito', null]],
}


/** Modelo da planilha de gastos do Financeiro. */
export const MODELO_GASTOS: Tabela = {
  colunas: ['Data', 'Descrição', 'Valor', 'Categoria', 'Fornecedor', 'Situação'],
  linhas: [
    ['05/11/2026', 'Banners do Novembro Azul', '1.350,00', 'Gráfica e impressos', 'Gráfica Central', 'Pago'],
    ['12/11/2026', 'Impulsionamento Instagram', '800,00', 'Anúncios e impulsionamento', '', 'Pago'],
    ['28/11/2026', 'Brindes do Natal', '2.100,00', 'Brindes', 'Brindes & Cia', 'Previsto'],
  ],
}

/** Modelo da planilha de verba do marketing (um mês por linha). */
export const MODELO_VERBAS: Tabela = {
  colunas: ['Mês', 'Verba'],
  linhas: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'].map((m) => [`${m}/${new Date().getFullYear() + 1}`, '15.000,00']),
}
