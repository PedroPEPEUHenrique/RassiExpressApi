/** Portas do contexto Financeiro: caixa do turno e relatórios de venda. */

function naoImplementado(n) { throw new Error(`${n} não implementado`); }

class RepositorioCaixa {
  async aberto(_idEmpresa, _ctx) { naoImplementado('RepositorioCaixa.aberto'); }
  async porId(_idCaixa, _ctx) { naoImplementado('RepositorioCaixa.porId'); }
  async porPeriodo(_idEmpresa, _de, _ate, _ctx) { naoImplementado('RepositorioCaixa.porPeriodo'); }
  async abrir(_caixa, _ctx) { naoImplementado('RepositorioCaixa.abrir'); }
  async fechar(_idCaixa, _dados, _ctx) { naoImplementado('RepositorioCaixa.fechar'); }
  async criarMovimento(_mov, _ctx) { naoImplementado('RepositorioCaixa.criarMovimento'); }
  async movimentos(_idCaixa, _ctx) { naoImplementado('RepositorioCaixa.movimentos'); }
  /** Totais por tipo e saldo, somados no banco. */
  async totais(_idCaixa, _ctx) { naoImplementado('RepositorioCaixa.totais'); }
}

/**
 * Consultas de relatório.
 *
 * Todas partem de COMANDA fechada, não de MOVIMENTO_CAIXA: são fontes com
 * propósitos diferentes. COMANDA responde "quanto o restaurante faturou" e
 * existe mesmo sem caixa aberto; CAIXA responde "o que passou pela gaveta" e
 * inclui despesa e sangria, que não são venda.
 */
class ConsultasDeRelatorio {
  async resumo(_idEmpresa, _de, _ate, _ctx) { naoImplementado('ConsultasDeRelatorio.resumo'); }
  async porDia(_idEmpresa, _de, _ate, _ctx) { naoImplementado('ConsultasDeRelatorio.porDia'); }
  async maisVendidos(_idEmpresa, _de, _ate, _limite, _ctx) { naoImplementado('ConsultasDeRelatorio.maisVendidos'); }
  async porHora(_idEmpresa, _de, _ate, _ctx) { naoImplementado('ConsultasDeRelatorio.porHora'); }
  async rodadasCanceladas(_idEmpresa, _de, _ate, _ctx) { naoImplementado('ConsultasDeRelatorio.rodadasCanceladas'); }
}

export { RepositorioCaixa, ConsultasDeRelatorio };
