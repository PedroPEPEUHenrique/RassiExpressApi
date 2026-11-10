import { execute } from "../database/mysql.js"

// Vínculos que podem gerar login: funcionário ativo em restaurante ativo.
// Desativar o funcionário ou o restaurante tira o acesso sem apagar histórico.
async function ListarVinculosAtivosPorUsuario(idUsuario, conn) {
    const sql = `
        SELECT f.id_funcionario, f.id_empresa, f.papel, e.nome AS nome_empresa
        FROM FUNCIONARIO f
        INNER JOIN EMPRESA e ON e.id_empresa = f.id_empresa
        WHERE f.id_usuario = ? AND f.ativo = 1 AND e.ativo = 1
        ORDER BY e.nome
    `;
    return await execute(sql, [idUsuario], "all", conn);
}

async function ListarPorEmpresa(idEmpresa, conn) {
    const sql = `
        SELECT f.id_funcionario, f.id_usuario, f.papel, f.ativo, f.dt_admissao,
               u.nome, u.email, u.telefone
        FROM FUNCIONARIO f
        INNER JOIN USUARIO u ON u.id_usuario = f.id_usuario
        WHERE f.id_empresa = ?
        ORDER BY f.papel, u.nome
    `;
    return await execute(sql, [idEmpresa], "all", conn);
}

async function ListarPorId(idFuncionario, conn) {
    const sql = `
        SELECT f.id_funcionario, f.id_usuario, f.id_empresa, f.papel, f.ativo, f.dt_admissao,
               u.nome, u.email, u.telefone
        FROM FUNCIONARIO f
        INNER JOIN USUARIO u ON u.id_usuario = f.id_usuario
        WHERE f.id_funcionario = ?
    `;
    return await execute(sql, [idFuncionario], "get", conn);
}

async function Criar(funcionario, conn) {
    const sql = `
        INSERT INTO FUNCIONARIO (id_usuario, id_empresa, papel, ativo, dt_admissao)
        VALUES (?, ?, ?, 1, NOW())
    `;
    const params = [funcionario.idUsuario, funcionario.idEmpresa, funcionario.papel];
    const result = await execute(sql, params, "run", conn);
    return result.lastID;
}

export default { ListarVinculosAtivosPorUsuario, ListarPorEmpresa, ListarPorId, Criar };
