import { execute } from "../database/mysql.js"

async function ListarPorEmpresa(idEmpresa) {
    const sql = "SELECT * FROM BANNER WHERE id_empresa = ? AND ativo = 1 ORDER BY ordem";
    return await execute(sql, [idEmpresa]);
}

export default { ListarPorEmpresa };
