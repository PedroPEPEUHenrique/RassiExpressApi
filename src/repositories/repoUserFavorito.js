import { execute } from "../database/mysql.js"

async function ListarPorUsuario(idUsuario) {
    const sql = `
        SELECT uf.id_favorito, uf.dt_favoritado, uf.id_produto,
               e.*,
               p.nome AS nome_produto, p.icone AS icone_produto, p.valor AS valor_produto
        FROM USER_FAVORITO uf
        INNER JOIN EMPRESA e ON e.id_empresa = uf.id_empresa
        LEFT JOIN PRODUTO p ON p.id_produto = uf.id_produto
        WHERE uf.id_usuario = ?
        ORDER BY uf.dt_favoritado DESC
    `;
    return await execute(sql, [idUsuario]);
}

async function ListarPorId(idFavorito) {
    const sql = "SELECT * FROM USER_FAVORITO WHERE id_favorito = ?";
    return await execute(sql, [idFavorito], "get");
}

async function BuscarExistente(idUsuario, idEmpresa, idProduto) {
    // <=> é a igualdade null-safe do MySQL: com id_produto nulo (favorito de
    // empresa), "id_produto = NULL" nunca casaria e criaria duplicatas.
    const sql = `
        SELECT * FROM USER_FAVORITO
        WHERE id_usuario = ? AND id_empresa = ? AND id_produto <=> ?
    `;
    return await execute(sql, [idUsuario, idEmpresa, idProduto], "get");
}

async function Criar(favorito) {
    const sql = `
        INSERT INTO USER_FAVORITO (id_usuario, id_empresa, id_produto, dt_favoritado)
        VALUES (?, ?, ?, NOW())
    `;
    const params = [favorito.idUsuario, favorito.idEmpresa, favorito.idProduto ?? null];
    const result = await execute(sql, params, "run");
    return result.lastID;
}

async function Deletar(idFavorito) {
    const sql = "DELETE FROM USER_FAVORITO WHERE id_favorito = ?";
    const result = await execute(sql, [idFavorito], "run");
    return result.changes;
}

export default { ListarPorUsuario, ListarPorId, BuscarExistente, Criar, Deletar };
