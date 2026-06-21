import { execute } from "../database/mysql.js"

async function ListarPorEmpresa(idEmpresa) {
    const sql = "SELECT * FROM PRODUTO_CATEGORIA WHERE id_empresa = ? ORDER BY ordem";
    return await execute(sql, [idEmpresa]);
}

async function Criar(produtoCategoria) {
    const sql = "INSERT INTO PRODUTO_CATEGORIA (id_empresa, categoria, ordem) VALUES (?, ?, ?)";
    const params = [produtoCategoria.idEmpresa, produtoCategoria.categoria, produtoCategoria.ordem];
    const result = await execute(sql, params, "run");
    return result.lastID;
}

async function Atualizar(idProdutoCategoria, produtoCategoria) {
    const sql = "UPDATE PRODUTO_CATEGORIA SET categoria = ?, ordem = ? WHERE id_produto_categoria = ?";
    const params = [produtoCategoria.categoria, produtoCategoria.ordem, idProdutoCategoria];
    const result = await execute(sql, params, "run");
    return result.changes;
}

async function Deletar(idProdutoCategoria) {
    const sql = "DELETE FROM PRODUTO_CATEGORIA WHERE id_produto_categoria = ?";
    const result = await execute(sql, [idProdutoCategoria], "run");
    return result.changes;
}

export default { ListarPorEmpresa, Criar, Atualizar, Deletar };
