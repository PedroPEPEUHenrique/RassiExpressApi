import { execute } from "../database/mysql.js"

async function ListarPorPedido(idPedido, conn) {
    const sql = `
        SELECT ip.*, p.icone
        FROM ITENS_PEDIDO ip
        LEFT JOIN PRODUTO p ON p.id_produto = ip.id_produto
        WHERE ip.id_pedido = ?
        ORDER BY ip.id_itens_pedido
    `;
    return await execute(sql, [idPedido], "all", conn);
}

// Itens de várias rodadas de uma vez, para montar a comanda sem uma consulta
// por rodada.
async function ListarPorComanda(idComanda, conn) {
    const sql = `
        SELECT ip.*, p.icone
        FROM ITENS_PEDIDO ip
        INNER JOIN PEDIDO pe ON pe.id_pedido = ip.id_pedido
        LEFT JOIN PRODUTO p  ON p.id_produto = ip.id_produto
        WHERE pe.id_comanda = ?
        ORDER BY ip.id_itens_pedido
    `;
    return await execute(sql, [idComanda], "all", conn);
}

async function Criar(item, conn) {
    const sql = `
        INSERT INTO ITENS_PEDIDO (id_pedido, id_produto, nome_produto, observacao, quantidade, vl_unitario, vl_total)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
        item.idPedido, item.idProduto, item.nomeProduto ?? null, item.observacao ?? null,
        item.quantidade, item.vlUnitario, item.vlTotal,
    ];
    const result = await execute(sql, params, "run", conn);
    return result.lastID;
}

export default { ListarPorPedido, ListarPorComanda, Criar };
