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
        ORDER BY f.ativo DESC, f.papel, u.nome
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

async function AtualizarPapel(idFuncionario, papel, conn) {
    const sql = "UPDATE FUNCIONARIO SET papel = ? WHERE id_funcionario = ?";
    const result = await execute(sql, [papel, idFuncionario], "run", conn);
    return result.changes;
}

// Desligar é desativar, nunca apagar: o funcionário aparece em comandas e
// rodadas antigas, e o DELETE cascatearia o histórico de vendas junto.
async function AtualizarAtivo(idFuncionario, ativo, conn) {
    const sql = "UPDATE FUNCIONARIO SET ativo = ? WHERE id_funcionario = ?";
    const result = await execute(sql, [ativo ? 1 : 0, idFuncionario], "run", conn);
    return result.changes;
}

/**
 * Quantos gestores ativos o restaurante ainda tem.
 *
 * Serve a uma pergunta só: o último gestor não pode se rebaixar nem se
 * desligar. Se pudesse, ninguém mais conseguiria cadastrar produto, mesa ou
 * funcionário, e o restaurante ficaria trancado para fora do próprio sistema
 * sem ninguém com poder de destrancar.
 */
async function ContarGestoresAtivos(idEmpresa, conn) {
    const sql = "SELECT COUNT(*) AS total FROM FUNCIONARIO WHERE id_empresa = ? AND papel = 'gestor' AND ativo = 1";
    const linha = await execute(sql, [idEmpresa], "get", conn);
    return Number(linha?.total ?? 0);
}

/**
 * Vendas por funcionário no período.
 *
 * Soma as rodadas que ele lançou, ignorando as canceladas. Usa a data da
 * rodada, e não a do fechamento da comanda: o trabalho do garçom aconteceu no
 * lançamento, e uma mesa aberta perto da meia-noite não deve jogar o esforço
 * dele para o dia seguinte.
 *
 * LEFT JOIN de propósito — quem não vendeu no período aparece com zero, que é
 * justamente a informação que o gestor procura.
 */
async function Desempenho(idEmpresa, de, ate, conn) {
    const sql = `
        SELECT f.id_funcionario, f.papel, f.ativo, u.nome,
               COUNT(DISTINCT p.id_comanda) AS comandas,
               COUNT(p.id_pedido)           AS rodadas,
               COALESCE(SUM(p.vl_total), 0) AS vl_total
        FROM FUNCIONARIO f
        INNER JOIN USUARIO u ON u.id_usuario = f.id_usuario
        LEFT JOIN PEDIDO p
               ON p.id_funcionario = f.id_funcionario
              AND p.status <> 'cancelado'
              AND p.dt_pedido >= ? AND p.dt_pedido < ?
        WHERE f.id_empresa = ?
        GROUP BY f.id_funcionario, f.papel, f.ativo, u.nome
        ORDER BY vl_total DESC, u.nome
    `;
    return await execute(sql, [de, ate, idEmpresa], "all", conn);
}

export default {
    ListarVinculosAtivosPorUsuario, ListarPorEmpresa, ListarPorId, Criar,
    AtualizarPapel, AtualizarAtivo, ContarGestoresAtivos, Desempenho,
};
