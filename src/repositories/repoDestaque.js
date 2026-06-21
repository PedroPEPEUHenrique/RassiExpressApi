import { execute } from "../database/mysql.js"

async function ListarPorEmpresa(idEmpresa) {
    const sql = `
        SELECT d.*, p.nome, p.descricao, p.icone, p.valor
        FROM DESTAQUE d
        INNER JOIN PRODUTO p ON p.id_produto = d.id_produto
        WHERE d.id_empresa = ?
        ORDER BY d.ordem
    `;
    return await execute(sql, [idEmpresa]);
}

export default { ListarPorEmpresa };
