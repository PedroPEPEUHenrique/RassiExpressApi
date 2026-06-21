import { execute } from "../database/mysql.js"

async function ListarPorEmpresa(idEmpresa) {
    const sql = "SELECT * FROM BANNER WHERE id_empresa = ? AND ativo = 1 ORDER BY ordem";
    return await execute(sql, [idEmpresa]);
}

async function Listar() {
    const sql = "SELECT * FROM BANNER ";
    return await execute(sql);
}

export default { Listar, ListarPorEmpresa };
