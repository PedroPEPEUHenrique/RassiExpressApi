import { execute } from "../database/mysql.js"

async function ListarPorUsuario(idUsuario) {
    const sql = `
        SELECT uf.*, e.nome AS nome_empresa, e.icone AS icone_empresa,
               p.nome AS nome_produto, p.icone AS icone_produto, p.valor
        FROM USER_FAVORITO uf
        INNER JOIN EMPRESA e ON e.id_empresa = uf.id_empresa
        INNER JOIN PRODUTO p ON p.id_produto = uf.id_produto
        WHERE uf.id_usuario = ?
        ORDER BY uf.dt_favoritado DESC
    `;
    return await execute(sql, [idUsuario]);
}

async function BuscarExistente(idUsuario, idEmpresa, idProduto) {
    const sql = "SELECT * FROM USER_FAVORITO WHERE id_usuario = ? AND id_empresa = ? AND id_produto = ?";
    return await execute(sql, [idUsuario, idEmpresa, idProduto], "get");
}

async function Criar(favorito) {
    const sql = `
        INSERT INTO USER_FAVORITO (id_usuario, id_empresa, id_produto, dt_favoritado)
        VALUES (?, ?, ?, NOW())
    `;
    const params = [favorito.idUsuario, favorito.idEmpresa, favorito.idProduto];
    const result = await execute(sql, params, "run");
    return result.lastID;
}

async function Deletar(idFavorito) {
    const sql = "DELETE FROM USER_FAVORITO WHERE id_favorito = ?";
    const result = await execute(sql, [idFavorito], "run");
    return result.changes;
}

export default { ListarPorUsuario, BuscarExistente, Criar, Deletar };
