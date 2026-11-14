import { execute } from "../database/mysql.js"

async function Listar() {
    const sql = "SELECT * FROM PRODUTO_CATEGORIA";
    return await execute(sql);
}

async function ListarPorEmpresa(idEmpresa) {
    const sql = "SELECT * FROM PRODUTO_CATEGORIA WHERE id_empresa = ? ORDER BY ordem";
    return await execute(sql, [idEmpresa]);
}

// Traz o id_empresa para o service checar o dono antes de alterar ou de
// devolver os produtos da categoria.
async function ListarPorId(idProdutoCategoria) {
    const sql = "SELECT * FROM PRODUTO_CATEGORIA WHERE id_produto_categoria = ?";
    return await execute(sql, [idProdutoCategoria], "get");
}

async function Criar(produtoCategoria) {
    const sql = "INSERT INTO PRODUTO_CATEGORIA (id_empresa, categoria, ordem) VALUES (?, ?, ?)";
    const params = [produtoCategoria.idEmpresa, produtoCategoria.categoria, produtoCategoria.ordem ?? 0];
    const result = await execute(sql, params, "run");
    return result.lastID;
}

async function Atualizar(idProdutoCategoria, produtoCategoria) {
    const sql = "UPDATE PRODUTO_CATEGORIA SET categoria = ?, ordem = ? WHERE id_produto_categoria = ?";
    const params = [produtoCategoria.categoria, produtoCategoria.ordem ?? 0, idProdutoCategoria];
    const result = await execute(sql, params, "run");
    return result.changes;
}

// Conta TUDO, inclusive produto inativo: o que importa aqui é se existe linha
// em PRODUTO apontando para esta categoria, porque é ela que a cascata
// alcançaria.
async function ContarProdutos(idProdutoCategoria, conn) {
    const sql = "SELECT COUNT(*) AS total FROM PRODUTO WHERE id_produto_categoria = ?";
    const linha = await execute(sql, [idProdutoCategoria], "get", conn);
    return Number(linha?.total ?? 0);
}

async function Deletar(idProdutoCategoria) {
    const sql = "DELETE FROM PRODUTO_CATEGORIA WHERE id_produto_categoria = ?";
    const result = await execute(sql, [idProdutoCategoria], "run");
    return result.changes;
}

export default { Listar, ListarPorEmpresa, ListarPorId, ContarProdutos, Criar, Atualizar, Deletar };
