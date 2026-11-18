import { executar } from '../../../infra/persistencia/mysql.js';
import { RepositorioCaixa, ConsultasDeRelatorio } from '../aplicacao/portas.js';
import { ENTRADAS } from '../dominio/Caixa.js';

// O sinal vem do domínio, não é redigitado aqui: divergir entre a soma do SQL
// e a do resumo apareceria como quebra de caixa fantasma.
const LISTA_ENTRADAS = ENTRADAS.map((t) => `'${t}'`).join(', ');
const LISTA_SAIDAS = "'despesa', 'sangria'";

class RepositorioCaixaMySQL extends RepositorioCaixa {
  async aberto(idEmpresa, ctx) {
    return await executar(`
      SELECT c.*, u.nome AS nome_abertura
      FROM CAIXA c
      LEFT JOIN FUNCIONARIO f ON f.id_funcionario = c.id_funcionario_abertura
      LEFT JOIN USUARIO u     ON u.id_usuario = f.id_usuario
      WHERE c.id_empresa_aberto = ?
    `, [idEmpresa], 'um', ctx);
  }

  async porId(idCaixa, ctx) {
    return await executar(`
      SELECT c.*, u.nome AS nome_abertura
      FROM CAIXA c
      LEFT JOIN FUNCIONARIO f ON f.id_funcionario = c.id_funcionario_abertura
      LEFT JOIN USUARIO u     ON u.id_usuario = f.id_usuario
      WHERE c.id_caixa = ?
    `, [idCaixa], 'um', ctx);
  }

  async porPeriodo(idEmpresa, de, ate, ctx) {
    return await executar(`
      SELECT c.*, u.nome AS nome_abertura
      FROM CAIXA c
      LEFT JOIN FUNCIONARIO f ON f.id_funcionario = c.id_funcionario_abertura
      LEFT JOIN USUARIO u     ON u.id_usuario = f.id_usuario
      WHERE c.id_empresa = ? AND c.dt_abertura >= ? AND c.dt_abertura < ?
      ORDER BY c.dt_abertura DESC
    `, [idEmpresa, de, ate], 'todos', ctx);
  }

  async abrir(caixa, ctx) {
    const r = await executar(`
      INSERT INTO CAIXA (id_empresa, id_funcionario_abertura, vl_abertura, observacao, status, dt_abertura)
      VALUES (?, ?, ?, ?, 'aberto', NOW())
    `, [caixa.idEmpresa, caixa.idFuncionario, caixa.vlAbertura ?? 0, caixa.observacao ?? null], 'escrita', ctx);
    return r.id;
  }

  async fechar(idCaixa, { idFuncionario, vlInformado, observacao }, ctx) {
    const r = await executar(`
      UPDATE CAIXA
      SET status = 'fechado', id_funcionario_fechamento = ?, vl_informado = ?,
          observacao = COALESCE(?, observacao), dt_fechamento = NOW()
      WHERE id_caixa = ? AND status = 'aberto'
    `, [idFuncionario, vlInformado, observacao ?? null, idCaixa], 'escrita', ctx);
    return r.afetadas;
  }

  async criarMovimento(mov, ctx) {
    const r = await executar(`
      INSERT INTO MOVIMENTO_CAIXA (id_caixa, id_empresa, id_funcionario, tipo, descricao, valor, id_comanda, dt_movimento)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      mov.idCaixa, mov.idEmpresa, mov.idFuncionario ?? null,
      mov.tipo, mov.descricao ?? null, mov.valor, mov.idComanda ?? null,
    ], 'escrita', ctx);
    return r.id;
  }

  async movimentos(idCaixa, ctx) {
    return await executar(`
      SELECT m.*, u.nome AS nome_funcionario, c.id_mesa, mesa.numero AS numero_mesa
      FROM MOVIMENTO_CAIXA m
      LEFT JOIN FUNCIONARIO f ON f.id_funcionario = m.id_funcionario
      LEFT JOIN USUARIO u     ON u.id_usuario = f.id_usuario
      LEFT JOIN COMANDA c     ON c.id_comanda = m.id_comanda
      LEFT JOIN MESA mesa     ON mesa.id_mesa = c.id_mesa
      WHERE m.id_caixa = ?
      ORDER BY m.dt_movimento DESC, m.id_movimento DESC
    `, [idCaixa], 'todos', ctx);
  }

  /**
   * Totais por tipo e saldo, somados no banco e numa consulta só.
   *
   * O saldo não sai de uma soma em JavaScript sobre a lista de movimentos: é
   * o número que o gestor confere contra o dinheiro contado, e precisa ser o
   * mesmo independente de quantos movimentos a tela carregou.
   */
  async totais(idCaixa, ctx) {
    return await executar(`
      SELECT
        COALESCE(SUM(CASE WHEN tipo = 'venda'         THEN valor ELSE 0 END), 0) AS vendas,
        COALESCE(SUM(CASE WHEN tipo = 'venda_externa' THEN valor ELSE 0 END), 0) AS vendas_externas,
        COALESCE(SUM(CASE WHEN tipo = 'suprimento'    THEN valor ELSE 0 END), 0) AS suprimentos,
        COALESCE(SUM(CASE WHEN tipo = 'despesa'       THEN valor ELSE 0 END), 0) AS despesas,
        COALESCE(SUM(CASE WHEN tipo = 'sangria'       THEN valor ELSE 0 END), 0) AS sangrias,
        COALESCE(SUM(CASE WHEN tipo IN (${LISTA_ENTRADAS}) THEN valor ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN tipo IN (${LISTA_SAIDAS})   THEN valor ELSE 0 END), 0) AS saldo_movimentos,
        COUNT(*) AS movimentos
      FROM MOVIMENTO_CAIXA WHERE id_caixa = ?
    `, [idCaixa], 'um', ctx);
  }
}

class ConsultasDeRelatorioMySQL extends ConsultasDeRelatorio {
  // Usa a data de FECHAMENTO: a venda é reconhecida quando a conta fecha,
  // senão uma mesa aberta antes da meia-noite cairia no dia anterior.
  async resumo(idEmpresa, de, ate, ctx) {
    return await executar(`
      SELECT COUNT(*) AS comandas,
             COALESCE(SUM(vl_total), 0) AS faturamento,
             COALESCE(AVG(vl_total), 0) AS ticket_medio
      FROM COMANDA
      WHERE id_empresa = ? AND status = 'fechada'
        AND dt_fechamento >= ? AND dt_fechamento < ?
    `, [idEmpresa, de, ate], 'um', ctx);
  }

  async porDia(idEmpresa, de, ate, ctx) {
    return await executar(`
      SELECT DATE(dt_fechamento) AS dia, COUNT(*) AS comandas,
             COALESCE(SUM(vl_total), 0) AS faturamento
      FROM COMANDA
      WHERE id_empresa = ? AND status = 'fechada'
        AND dt_fechamento >= ? AND dt_fechamento < ?
      GROUP BY DATE(dt_fechamento) ORDER BY dia
    `, [idEmpresa, de, ate], 'todos', ctx);
  }

  /**
   * Agrupa por nome_produto, não por id: o nome foi congelado no item no
   * momento da venda, então o relatório continua correto mesmo para produto
   * renomeado ou tirado do cardápio depois.
   *
   * LIMIT não aceita placeholder em prepared statement — o MySQL responde
   * ER_WRONG_ARGUMENTS. Interpolar é seguro porque o valor é forçado a
   * inteiro antes de entrar no SQL, nunca chegando como texto do cliente.
   */
  async maisVendidos(idEmpresa, de, ate, limite, ctx) {
    const topo = Math.max(1, Math.min(100, Math.trunc(Number(limite)) || 10));
    return await executar(`
      SELECT ip.nome_produto, SUM(ip.quantidade) AS quantidade, SUM(ip.vl_total) AS faturamento
      FROM ITENS_PEDIDO ip
      INNER JOIN PEDIDO p  ON p.id_pedido = ip.id_pedido
      INNER JOIN COMANDA c ON c.id_comanda = p.id_comanda
      WHERE c.id_empresa = ? AND c.status = 'fechada' AND p.status <> 'cancelado'
        AND c.dt_fechamento >= ? AND c.dt_fechamento < ?
      GROUP BY ip.nome_produto
      ORDER BY quantidade DESC, faturamento DESC
      LIMIT ${topo}
    `, [idEmpresa, de, ate], 'todos', ctx);
  }

  // Quantas mesas fecharam em cada faixa de horário — o dado que diz onde
  // escalar mais gente.
  async porHora(idEmpresa, de, ate, ctx) {
    return await executar(`
      SELECT HOUR(dt_fechamento) AS hora, COUNT(*) AS comandas,
             COALESCE(SUM(vl_total), 0) AS faturamento
      FROM COMANDA
      WHERE id_empresa = ? AND status = 'fechada'
        AND dt_fechamento >= ? AND dt_fechamento < ?
      GROUP BY HOUR(dt_fechamento) ORDER BY hora
    `, [idEmpresa, de, ate], 'todos', ctx);
  }

  async rodadasCanceladas(idEmpresa, de, ate, ctx) {
    const linha = await executar(`
      SELECT COUNT(*) AS total
      FROM PEDIDO p
      INNER JOIN COMANDA c ON c.id_comanda = p.id_comanda
      WHERE c.id_empresa = ? AND p.status = 'cancelado'
        AND p.dt_pedido >= ? AND p.dt_pedido < ?
    `, [idEmpresa, de, ate], 'um', ctx);
    return Number(linha?.total ?? 0);
  }
}

export { RepositorioCaixaMySQL, ConsultasDeRelatorioMySQL };
