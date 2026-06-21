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

export default { Listar, ListarPorEmpresa, ListarPorCategoria, ListarPorId, Criar, Atualizar, Deletar };
