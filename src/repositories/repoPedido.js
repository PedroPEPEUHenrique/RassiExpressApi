import { execute } from "../database/mysql.js"

async function ListarPorComanda(idComanda, conn) {
    const sql = `
        SELECT p.*, u.nome AS nome_garcom
        FROM PEDIDO p
        LEFT JOIN FUNCIONARIO f ON f.id_funcionario = p.id_funcionario
        LEFT JOIN USUARIO u     ON u.id_usuario = f.id_usuario
        WHERE p.id_comanda = ?
        ORDER BY p.dt_pedido
    `;
    return await execute(sql, [idComanda], "all", conn);
}

async function ListarPorId(idPedido, conn) {
    const sql = `
        SELECT p.*, c.id_mesa, m.numero AS numero_mesa, u.nome AS nome_garcom
        FROM PEDIDO p
        LEFT JOIN COMANDA c     ON c.id_comanda = p.id_comanda
        LEFT JOIN MESA m        ON m.id_mesa = c.id_mesa
        LEFT JOIN FUNCIONARIO f ON f.id_funcionario = p.id_funcionario
        LEFT JOIN USUARIO u     ON u.id_usuario = f.id_usuario
        WHERE p.id_pedido = ?
    `;
    return await execute(sql, [idPedido], "get", conn);
}

async function ListarPorIdLocal(idLocal, conn) {
    const sql = "SELECT * FROM PEDIDO WHERE id_local = ?";
    return await execute(sql, [idLocal], "get", conn);
}

/**
 * Fila da cozinha: rodadas ainda não entregues, mais antigas primeiro.
 *
 * O prato que entrou primeiro sai primeiro — ordenar por data é o que mantém
 * a fila justa quando a cozinha está cheia.
 */
async function ListarFilaCozinha(idEmpresa, conn) {
    const sql = `
        SELECT p.id_pedido, p.status, p.dt_pedido, p.tipo, p.id_comanda,
               m.numero AS numero_mesa, u.nome AS nome_garcom
        FROM PEDIDO p
        LEFT JOIN COMANDA c     ON c.id_comanda = p.id_comanda
        LEFT JOIN MESA m        ON m.id_mesa = c.id_mesa
        LEFT JOIN FUNCIONARIO f ON f.id_funcionario = p.id_funcionario
        LEFT JOIN USUARIO u     ON u.id_usuario = f.id_usuario
        WHERE p.id_empresa = ? AND p.status IN ('enviado', 'em_preparo', 'pronto')
        ORDER BY p.dt_pedido
    `;
    return await execute(sql, [idEmpresa], "all", conn);
}

async function Criar(pedido, conn) {
    const sql = `
        INSERT INTO PEDIDO (id_empresa, id_comanda, id_funcionario, tipo, id_local,
                            vl_subtotal, vl_taxa_entrega, vl_total, dt_pedido, status)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?, NOW(), 'enviado')
    `;
    const params = [
        pedido.idEmpresa, pedido.idComanda, pedido.idFuncionario,
        pedido.tipo ?? 'mesa', pedido.idLocal ?? null,
        pedido.vlSubtotal, pedido.vlTotal,
    ];
    const result = await execute(sql, params, "run", conn);
    return result.lastID;
}

async function AtualizarStatus(idPedido, status, conn) {
    const sql = "UPDATE PEDIDO SET status = ? WHERE id_pedido = ?";
    const result = await execute(sql, [status, idPedido], "run", conn);
    return result.changes;
}

export default {
    ListarPorComanda, ListarPorId, ListarPorIdLocal, ListarFilaCozinha,
    Criar, AtualizarStatus,
};
