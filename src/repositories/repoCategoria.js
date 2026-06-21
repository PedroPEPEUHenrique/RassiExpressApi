import { execute } from "../database/mysql.js"

async function Listar() {

    const sql = "SELECT * FROM CATEGORIAS ORDER BY ORDEM";
    const categorias = await execute(sql, []);

    return categorias;
    
}

export default { Listar };