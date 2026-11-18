import { executar } from '../../../infra/persistencia/mysql.js';
import { RepositorioProduto, RepositorioCategoria } from '../aplicacao/portas.js';

class RepositorioProdutoMySQL extends RepositorioProduto {
  /**
   * Cardápio que o garçom lança: só o que está no cardápio e tem hoje.
   * O filtro acontece aqui, e não na tela, para que um produto que acabou saia
   * da lista de todo mundo no mesmo instante.
   */
  async disponiveisPorEmpresa(idEmpresa, ctx) {
    return await executar(
      'SELECT * FROM PRODUTO WHERE id_empresa = ? AND ativo = 1 AND disponivel = 1 ORDER BY nome',
      [idEmpresa], 'todos', ctx
    );
  }

  /** Cardápio que o gestor administra: tudo, senão ele não traz nada de volta. */
  async todosPorEmpresa(idEmpresa, ctx) {
    return await executar('SELECT * FROM PRODUTO WHERE id_empresa = ? ORDER BY nome', [idEmpresa], 'todos', ctx);
  }

  async disponiveisPorCategoria(idCategoria, ctx) {
    return await executar(
      'SELECT * FROM PRODUTO WHERE id_produto_categoria = ? AND ativo = 1 AND disponivel = 1 ORDER BY nome',
      [idCategoria], 'todos', ctx
    );
  }

  async porId(idProduto, ctx) {
    return await executar('SELECT * FROM PRODUTO WHERE id_produto = ?', [idProduto], 'um', ctx);
  }

  /**
   * Vários produtos de uma vez, já restritos à empresa.
   *
   * Lançar uma rodada precisa do preço atual de N produtos; buscar um a um
   * multiplicaria as idas ao banco dentro da transação, justamente onde a
   * conexão fica presa e bloqueia as outras.
   */
  async porIds(ids, idEmpresa, ctx) {
    if (!ids.length) return [];
    const marcadores = ids.map(() => '?').join(', ');
    return await executar(
      `SELECT * FROM PRODUTO WHERE id_produto IN (${marcadores}) AND id_empresa = ?`,
      [...ids, idEmpresa], 'todos', ctx
    );
  }

  async criar(produto, ctx) {
    const r = await executar(`
      INSERT INTO PRODUTO (id_empresa, id_produto_categoria, nome, descricao, icone, valor, ativo, disponivel)
      VALUES (?, ?, ?, ?, ?, ?, 1, 1)
    `, [
      produto.idEmpresa, produto.idProdutoCategoria, produto.nome,
      produto.descricao ?? null, produto.icone ?? null, produto.valor,
    ], 'escrita', ctx);
    return r.id;
  }

  async atualizar(idProduto, produto, ctx) {
    const r = await executar(`
      UPDATE PRODUTO SET id_produto_categoria = ?, nome = ?, descricao = ?, icone = ?,
             valor = ?, ativo = ?, disponivel = ?
      WHERE id_produto = ?
    `, [
      produto.idProdutoCategoria, produto.nome, produto.descricao ?? null, produto.icone ?? null,
      produto.valor, produto.ativo, produto.disponivel, idProduto,
    ], 'escrita', ctx);
    return r.afetadas;
  }

  async atualizarDisponibilidade(idProduto, disponivel, ctx) {
    const r = await executar('UPDATE PRODUTO SET disponivel = ? WHERE id_produto = ?',
      [disponivel ? 1 : 0, idProduto], 'escrita', ctx);
    return r.afetadas;
  }

  // Desativa em vez de apagar: o produto aparece em comandas já fechadas.
  async desativar(idProduto, ctx) {
    const r = await executar('UPDATE PRODUTO SET ativo = 0 WHERE id_produto = ?', [idProduto], 'escrita', ctx);
    return r.afetadas;
  }
}

class RepositorioCategoriaMySQL extends RepositorioCategoria {
  async porEmpresa(idEmpresa, ctx) {
    return await executar('SELECT * FROM PRODUTO_CATEGORIA WHERE id_empresa = ? ORDER BY ordem',
      [idEmpresa], 'todos', ctx);
  }

  async porId(id, ctx) {
    return await executar('SELECT * FROM PRODUTO_CATEGORIA WHERE id_produto_categoria = ?', [id], 'um', ctx);
  }

  // Conta TUDO, inclusive produto inativo: o que importa é se existe linha em
  // PRODUTO apontando para esta categoria, porque é ela que a cascata
  // alcançaria.
  async contarProdutos(id, ctx) {
    const linha = await executar('SELECT COUNT(*) AS total FROM PRODUTO WHERE id_produto_categoria = ?',
      [id], 'um', ctx);
    return Number(linha?.total ?? 0);
  }

  async criar(categoria, ctx) {
    const r = await executar('INSERT INTO PRODUTO_CATEGORIA (id_empresa, categoria, ordem) VALUES (?, ?, ?)',
      [categoria.idEmpresa, categoria.categoria, categoria.ordem ?? 0], 'escrita', ctx);
    return r.id;
  }

  async atualizar(id, categoria, ctx) {
    const r = await executar(
      'UPDATE PRODUTO_CATEGORIA SET categoria = ?, ordem = ? WHERE id_produto_categoria = ?',
      [categoria.categoria, categoria.ordem ?? 0, id], 'escrita', ctx
    );
    return r.afetadas;
  }

  async remover(id, ctx) {
    const r = await executar('DELETE FROM PRODUTO_CATEGORIA WHERE id_produto_categoria = ?', [id], 'escrita', ctx);
    return r.afetadas;
  }
}

export { RepositorioProdutoMySQL, RepositorioCategoriaMySQL };
