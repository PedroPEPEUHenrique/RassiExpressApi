import { execute } from "../database/mysql.js"

/**
 * Mesas com o estado do salão derivado, não armazenado.
 *
 * A comanda aberta entra por LEFT JOIN em id_mesa_aberta — a coluna gerada que
 * só tem valor enquanto a comanda está aberta. Assim "livre" e "ocupada"
 * saem de um fato só, e não de uma coluna de status que precisaria ser mantida
 * em sincronia a cada abertura e fechamento.
 */
async function ListarComEstado(idEmpresa, conn) {
    const sql = `
        SELECT m.id_mesa, m.numero, m.setor, m.capacidade,
               c.id_comanda, c.dt_abertura, c.vl_total,
               f.id_funcionario AS id_funcionario_abertura,
               u.nome AS nome_garcom
        FROM MESA m
        LEFT JOIN COMANDA c
               ON c.id_mesa_aberta = m.id_mesa
        LEFT JOIN FUNCIONARIO f ON f.id_funcionario = c.id_funcionario_abertura
        LEFT JOIN USUARIO u     ON u.id_usuario     = f.id_usuario
        WHERE m.id_empresa = ? AND m.ativo = 1
        ORDER BY m.setor, LENGTH(m.numero), m.numero
    `;
    return await execute(sql, [idEmpresa], "all", conn);
}

async function ListarPorId(idMesa, conn) {
    const sql = "SELECT * FROM MESA WHERE id_mesa = ?";
    return await execute(sql, [idMesa], "get", conn);
}

async function Criar(mesa, conn) {
    const sql = `
        INSERT INTO MESA (id_empresa, numero, setor, capacidade, ativo)
        VALUES (?, ?, ?, ?, 1)
    `;
    const params = [mesa.idEmpresa, mesa.numero, mesa.setor ?? null, mesa.capacidade ?? null];
    const result = await execute(sql, params, "run", conn);
    return result.lastID;
}

async function Atualizar(idMesa, mesa, conn) {
    const sql = "UPDATE MESA SET numero = ?, setor = ?, capacidade = ? WHERE id_mesa = ?";
    const params = [mesa.numero, mesa.setor ?? null, mesa.capacidade ?? null, idMesa];
    const result = await execute(sql, params, "run", conn);
    return result.changes;
}

// Desativa em vez de apagar: a mesa aparece em comandas já fechadas, e o
// DELETE cascatearia o histórico de faturamento junto.
async function Desativar(idMesa, conn) {
    const sql = "UPDATE MESA SET ativo = 0 WHERE id_mesa = ?";
    const result = await execute(sql, [idMesa], "run", conn);
    return result.changes;
}

export default { ListarComEstado, ListarPorId, Criar, Atualizar, Desativar };
