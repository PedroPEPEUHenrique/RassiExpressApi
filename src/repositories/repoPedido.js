import { execute } from "../database/sqlite.js"

async function ListarPorUsuario(idUsuario) {
    const sql = `
        SELECT p.*, e.nome AS nome_empresa, e.icone AS icone_empresa
        FROM PEDIDO p
        INNER JOIN EMPRESA e ON e.id_empresa = p.id_empresa
        WHERE p.id_usuario = ?
        ORDER BY p.dt_pedido DESC
    `;
    return await execute(sql, [idUsuario]);
}

async function ListarPorEmpresa(idEmpresa) {
    const sql = `
        SELECT p.*, u.nome AS nome_usuario
        FROM PEDIDO p
        INNER JOIN USUARIO u ON u.id_usuario = p.id_usuario
        WHERE p.id_empresa = ?
        ORDER BY p.dt_pedido DESC
    `;
    return await execute(sql, [idEmpresa]);
}

async function ListarPorId(idPedido) {
    const sql = `
        SELECT p.*, e.nome AS nome_empresa, e.icone AS icone_empresa, u.nome AS nome_usuario
        FROM PEDIDO p
        INNER JOIN EMPRESA e ON e.id_empresa = p.id_empresa
        INNER JOIN USUARIO u ON u.id_usuario = p.id_usuario
        WHERE p.id_pedido = ?
    `;
    return await execute(sql, [idPedido], "get");
}

async function Criar(pedido) {
    const sql = `
        INSERT INTO PEDIDO (id_empresa, id_usuario, vl_subtotal, vl_taxa_entrega, vl_total, dt_pedido, status)
        VALUES (?, ?, ?, ?, ?, datetime('now'), 'pendente')
    `;
    const params = [
        pedido.idEmpresa, pedido.idUsuario,
        pedido.vlSubtotal, pedido.vlTaxaEntrega, pedido.vlTotal
    ];
    const result = await execute(sql, params, "run");
    return result.lastID;
}

async function AtualizarStatus(idPedido, status) {
    const sql = "UPDATE PEDIDO SET status = ? WHERE id_pedido = ?";
    const result = await execute(sql, [status, idPedido], "run");
    return result.changes;
}

export default { ListarPorUsuario, ListarPorEmpresa, ListarPorId, Criar, AtualizarStatus };
