import { execute } from "../database/mysql.js"

async function Listar() {
    const sql = "SELECT * FROM PRODUTO";
    return await execute(sql);
}

async function ListarPorEmpresa(idEmpresa) {
    const sql = "SELECT * FROM PRODUTO WHERE id_empresa = ? AND ativo = 1 ORDER BY nome";
    return await execute(sql, [idEmpresa]);
}

async function ListarPorCategoria(idProdutoCategoria) {
    const sql = "SELECT * FROM PRODUTO WHERE id_produto_categoria = ? AND ativo = 1 ORDER BY nome";
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
        INSERT INTO PRODUTO (id_empresa, id_produto_categoria, nome, descricao, icone, valor, ativo)
        VALUES (?, ?, ?, ?, ?, ?, 1)
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
        UPDATE PRODUTO SET id_produto_categoria = ?, nome = ?, descricao = ?, icone = ?, valor = ?, ativo = ?
        WHERE id_produto = ?
    `;
    const params = [
        produto.idProdutoCategoria, produto.nome,
        produto.descricao ?? null, produto.icone ?? null, produto.valor, produto.ativo, idProduto
    ];
    const result = await execute(sql, params, "run");
    return result.changes;
}

async function Deletar(idProduto) {
    const sql = "UPDATE PRODUTO SET ativo = 0 WHERE id_produto = ?";
    const result = await execute(sql, [idProduto], "run");
    return result.changes;
}

export default { Listar, ListarPorEmpresa, ListarPorCategoria, ListarPorId, ListarPorIdsDaEmpresa, Criar, Atualizar, Deletar };
