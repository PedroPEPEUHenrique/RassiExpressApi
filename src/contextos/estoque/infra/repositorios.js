import { executar } from '../../../infra/persistencia/mysql.js';
import { RepositorioInsumo, RepositorioFicha } from '../aplicacao/portas.js';

class RepositorioInsumoMySQL extends RepositorioInsumo {
  async porEmpresa(idEmpresa, ctx) {
    return await executar(`
      SELECT *, (qtd_minima > 0 AND qtd_atual <= qtd_minima) AS repor
      FROM INSUMO WHERE id_empresa = ? AND ativo = 1
      ORDER BY repor DESC, nome
    `, [idEmpresa], 'todos', ctx);
  }

  async porId(idInsumo, ctx) {
    return await executar('SELECT * FROM INSUMO WHERE id_insumo = ?', [idInsumo], 'um', ctx);
  }

  async criar(insumo, ctx) {
    const r = await executar(`
      INSERT INTO INSUMO (id_empresa, nome, unidade, qtd_atual, qtd_minima, vl_custo_medio, ativo)
      VALUES (?, ?, ?, 0, ?, ?, 1)
    `, [insumo.idEmpresa, insumo.nome, insumo.unidade, insumo.qtdMinima ?? 0, insumo.vlCustoMedio ?? 0],
      'escrita', ctx);
    return r.id;
  }

  async atualizar(idInsumo, insumo, ctx) {
    const r = await executar('UPDATE INSUMO SET nome = ?, unidade = ?, qtd_minima = ? WHERE id_insumo = ?',
      [insumo.nome, insumo.unidade, insumo.qtdMinima ?? 0, idInsumo], 'escrita', ctx);
    return r.afetadas;
  }

  async desativar(idInsumo, ctx) {
    const r = await executar('UPDATE INSUMO SET ativo = 0 WHERE id_insumo = ?', [idInsumo], 'escrita', ctx);
    return r.afetadas;
  }

  /**
   * Aplica a variação no saldo.
   *
   * O cálculo acontece no SQL, não em JavaScript: ler o saldo, somar e gravar
   * deixaria duas baixas simultâneas sobrescreverem uma à outra — e duas
   * rodadas saindo ao mesmo tempo é o caso normal numa cozinha cheia.
   */
  async ajustarSaldo(idInsumo, variacao, ctx) {
    const r = await executar('UPDATE INSUMO SET qtd_atual = qtd_atual + ? WHERE id_insumo = ?',
      [variacao, idInsumo], 'escrita', ctx);
    return r.afetadas;
  }

  /**
   * Custo médio ponderado na entrada.
   *
   * Comprar 10kg a R$30 e depois 10kg a R$40 resulta em R$35, não R$40 —
   * usar o último preço faria o CMV pular a cada compra e tornaria a margem
   * ilegível. A média usa o saldo que havia ANTES da entrada, por isso roda
   * antes de ajustarSaldo.
   */
  async atualizarCustoMedio(idInsumo, qtdEntrada, vlUnitario, ctx) {
    const r = await executar(`
      UPDATE INSUMO
      SET vl_custo_medio = CASE
        WHEN (qtd_atual + ?) <= 0 THEN ?
        ELSE ((qtd_atual * vl_custo_medio) + (? * ?)) / (qtd_atual + ?)
      END
      WHERE id_insumo = ?
    `, [qtdEntrada, vlUnitario, qtdEntrada, vlUnitario, qtdEntrada, idInsumo], 'escrita', ctx);
    return r.afetadas;
  }

  async criarMovimento(mov, ctx) {
    const r = await executar(`
      INSERT INTO MOVIMENTO_ESTOQUE (id_empresa, id_insumo, tipo, quantidade, vl_unitario,
                                     id_pedido, id_funcionario, motivo, dt_movimento)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      mov.idEmpresa, mov.idInsumo, mov.tipo, mov.quantidade, mov.vlUnitario ?? null,
      mov.idPedido ?? null, mov.idFuncionario ?? null, mov.motivo ?? null,
    ], 'escrita', ctx);
    return r.id;
  }

  // LIMIT não aceita placeholder em prepared statement; forçar inteiro antes
  // de interpolar mantém a interpolação segura.
  async movimentos(idInsumo, limite, ctx) {
    const topo = Math.max(1, Math.min(500, Math.trunc(Number(limite)) || 50));
    return await executar(`
      SELECT m.*, u.nome AS nome_funcionario
      FROM MOVIMENTO_ESTOQUE m
      LEFT JOIN FUNCIONARIO f ON f.id_funcionario = m.id_funcionario
      LEFT JOIN USUARIO u     ON u.id_usuario = f.id_usuario
      WHERE m.id_insumo = ?
      ORDER BY m.dt_movimento DESC, m.id_movimento DESC
      LIMIT ${topo}
    `, [idInsumo], 'todos', ctx);
  }
}

class RepositorioFichaMySQL extends RepositorioFicha {
  async porProduto(idProduto, ctx) {
    return await executar(`
      SELECT ft.*, i.nome, i.unidade, i.vl_custo_medio, i.qtd_atual
      FROM FICHA_TECNICA ft
      INNER JOIN INSUMO i ON i.id_insumo = ft.id_insumo
      WHERE ft.id_produto = ? ORDER BY i.nome
    `, [idProduto], 'todos', ctx);
  }

  /**
   * Fichas de vários produtos de uma vez.
   *
   * A baixa de uma rodada precisa das fichas de N produtos dentro da
   * transação; buscar uma a uma multiplicaria as idas ao banco justamente
   * onde a conexão está presa.
   */
  async deProdutos(idsProduto, ctx) {
    if (!idsProduto.length) return [];
    const marcadores = idsProduto.map(() => '?').join(', ');
    return await executar(`
      SELECT ft.id_produto, ft.id_insumo, ft.quantidade, i.vl_custo_medio, i.nome
      FROM FICHA_TECNICA ft
      INNER JOIN INSUMO i ON i.id_insumo = ft.id_insumo
      WHERE ft.id_produto IN (${marcadores}) AND i.ativo = 1
    `, idsProduto, 'todos', ctx);
  }

  async salvarItem(item, ctx) {
    const r = await executar(`
      INSERT INTO FICHA_TECNICA (id_produto, id_insumo, quantidade)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE quantidade = VALUES(quantidade)
    `, [item.idProduto, item.idInsumo, item.quantidade], 'escrita', ctx);
    return r.id;
  }

  async removerItem(idProduto, idInsumo, ctx) {
    const r = await executar('DELETE FROM FICHA_TECNICA WHERE id_produto = ? AND id_insumo = ?',
      [idProduto, idInsumo], 'escrita', ctx);
    return r.afetadas;
  }
}

export { RepositorioInsumoMySQL, RepositorioFichaMySQL };
