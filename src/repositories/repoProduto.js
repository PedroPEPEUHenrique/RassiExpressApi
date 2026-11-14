import { execute } from "../database/mysql.js"

/**
 * Cardápio que o garçom lança: só o que está no cardápio e tem hoje.
 *
 * O filtro por disponivel acontece aqui, e não na tela, para que um produto
 * que acabou saia da lista de todo mundo no mesmo instante.
 */
async function ListarPorEmpresa(idEmpresa) {
    const sql = `
        SELECT * FROM PRODUTO
        WHERE id_empresa = ? AND ativo = 1 AND disponivel = 1
        ORDER BY nome
    `;
    return await execute(sql, [idEmpresa]);
}

/**
 * Cardápio que o gestor administra: tudo, inclusive o que está em falta e o
 * que foi tirado do cardápio — senão ele não teria como trazer de volta.
 */
async function ListarTodosPorEmpresa(idEmpresa, conn) {
    const sql = "SELECT * FROM PRODUTO WHERE id_empresa = ? ORDER BY nome";
    return await execute(sql, [idEmpresa], "all", conn);
}

async function ListarPorCategoria(idProdutoCategoria) {
    const sql = `
        SELECT * FROM PRODUTO
        WHERE id_produto_categoria = ? AND ativo = 1 AND disponivel = 1
        ORDER BY nome
    `;
    return await execute(sql, [idProdutoCategoria]);
}

async function ListarPorId(idProduto) {
    const sql = "SELECT * FROM PRODUTO WHERE id_produto = ?";
    return await execute(sql, [idProduto], "get");
}

/**
 * Vários produtos de uma vez, já restritos à empresa.
 *
 * Lançar uma rodada precisa do preço atual de N produtos. Buscar um a um
 * multiplicaria as idas ao banco dentro da transação — justamente onde a
 * conexão fica presa e bloqueia as outras.
 */
async function ListarPorIdsDaEmpresa(ids, idEmpresa, conn) {
    if (!ids.length) return [];
    const marcadores = ids.map(() => "?").join(", ");
    const sql = `SELECT * FROM PRODUTO WHERE id_produto IN (${marcadores}) AND id_empresa = ?`;
    return await execute(sql, [...ids, idEmpresa], "all", conn);
}

async function Criar(produto) {
    const sql = `
        INSERT INTO PRODUTO (id_empresa, id_produto_categoria, nome, descricao, icone, valor, ativo, disponivel)
        VALUES (?, ?, ?, ?, ?, ?, 1, 1)
    `;
    const params = [
        produto.idEmpresa, produto.idProdutoCategoria,
        produto.nome, produto.descricao ?? null, produto.icone ?? null, produto.valor
    ];
    const result = await execute(sql, params, "run");
    return result.lastID;
}

async function Atualizar(idProduto, produto) {
    const sql = `
        UPDATE PRODUTO SET id_produto_categoria = ?, nome = ?, descricao = ?, icone = ?,
                           valor = ?, ativo = ?, disponivel = ?
        WHERE id_produto = ?
    `;
    const params = [
        produto.idProdutoCategoria, produto.nome,
        produto.descricao ?? null, produto.icone ?? null, produto.valor,
        produto.ativo, produto.disponivel, idProduto
    ];
    const result = await execute(sql, params, "run");
    return result.changes;
}

/**
 * Toque único de "acabou" / "voltou".
 *
 * Separado do Atualizar de propósito: é a operação mais frequente do serviço
 * e não deve exigir que o app reenvie nome, preço e categoria só para dizer
 * que o filé acabou — enviar o produto inteiro abriria espaço para sobrescrever
 * preço por engano num gesto que deveria ser inofensivo.
 */
async function AtualizarDisponibilidade(idProduto, disponivel, conn) {
    const sql = "UPDATE PRODUTO SET disponivel = ? WHERE id_produto = ?";
    const result = await execute(sql, [disponivel ? 1 : 0, idProduto], "run", conn);
    return result.changes;
}

async function Deletar(idProduto) {
    const sql = "UPDATE PRODUTO SET ativo = 0 WHERE id_produto = ?";
    const result = await execute(sql, [idProduto], "run");
    return result.changes;
}

export default {
    ListarPorEmpresa, ListarTodosPorEmpresa, ListarPorCategoria, ListarPorId,
    ListarPorIdsDaEmpresa, Criar, Atualizar, AtualizarDisponibilidade, Deletar,
};
