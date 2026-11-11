import { execute } from "../database/mysql.js"

async function ListarAbertas(idEmpresa, conn) {
    const sql = `
        SELECT c.id_comanda, c.id_mesa, c.status, c.vl_total, c.dt_abertura,
               m.numero AS numero_mesa, m.setor,
               u.nome AS nome_garcom
        FROM COMANDA c
        INNER JOIN MESA m        ON m.id_mesa = c.id_mesa
        LEFT JOIN FUNCIONARIO f  ON f.id_funcionario = c.id_funcionario_abertura
        LEFT JOIN USUARIO u      ON u.id_usuario = f.id_usuario
        WHERE c.id_empresa = ? AND c.status = 'aberta'
        ORDER BY c.dt_abertura
    `;
    return await execute(sql, [idEmpresa], "all", conn);
}

async function ListarPorId(idComanda, conn) {
    const sql = `
        SELECT c.*, m.numero AS numero_mesa, m.setor,
               u.nome AS nome_garcom
        FROM COMANDA c
        INNER JOIN MESA m       ON m.id_mesa = c.id_mesa
        LEFT JOIN FUNCIONARIO f ON f.id_funcionario = c.id_funcionario_abertura
        LEFT JOIN USUARIO u     ON u.id_usuario = f.id_usuario
        WHERE c.id_comanda = ?
    `;
    return await execute(sql, [idComanda], "get", conn);
}

async function ListarAbertaPorMesa(idMesa, conn) {
    const sql = "SELECT * FROM COMANDA WHERE id_mesa_aberta = ?";
    return await execute(sql, [idMesa], "get", conn);
}

async function Criar(comanda, conn) {
    const sql = `
        INSERT INTO COMANDA (id_empresa, id_mesa, id_funcionario_abertura, status, vl_total, observacao, dt_abertura)
        VALUES (?, ?, ?, 'aberta', 0, ?, NOW())
    `;
    const params = [comanda.idEmpresa, comanda.idMesa, comanda.idFuncionario, comanda.observacao ?? null];
    const result = await execute(sql, params, "run", conn);
    return result.lastID;
}

/**
 * Recalcula o total a partir das rodadas não canceladas.
 *
 * A soma vem do banco, nunca do app: é o número que o cliente vai pagar e o
 * gestor vai conferir no fim da noite. Rodada cancelada sai da conta.
 */
async function RecalcularTotal(idComanda, conn) {
    const sql = `
        UPDATE COMANDA c
        SET c.vl_total = (
            SELECT COALESCE(SUM(p.vl_total), 0)
            FROM PEDIDO p
            WHERE p.id_comanda = c.id_comanda AND p.status <> 'cancelado'
        )
        WHERE c.id_comanda = ?
    `;
    const result = await execute(sql, [idComanda], "run", conn);
    return result.changes;
}

async function Fechar(idComanda, idFuncionario, conn) {
    const sql = `
        UPDATE COMANDA
        SET status = 'fechada', id_funcionario_fechamento = ?, dt_fechamento = NOW()
        WHERE id_comanda = ? AND status = 'aberta'
    `;
    const result = await execute(sql, [idFuncionario, idComanda], "run", conn);
    return result.changes;
}

export default { ListarAbertas, ListarPorId, ListarAbertaPorMesa, Criar, RecalcularTotal, Fechar };
