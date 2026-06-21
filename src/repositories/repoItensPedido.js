import { execute } from "../database/mysql.js"

async function ListarPorPedido(idPedido) {
    const sql = `
        SELECT ip.*, p.nome, p.icone
        FROM ITENS_PEDIDO ip
        INNER JOIN PRODUTO p ON p.id_produto = ip.id_produto
        WHERE ip.id_pedido = ?
    `;
    return await execute(sql, [idPedido]);
}

async function Criar(item) {
    const sql = `
        INSERT INTO ITENS_PEDIDO (id_pedido, id_produto, observacao, quantidade, vl_unitario, vl_total)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    const params = [
        item.idPedido, item.idProduto, item.observacao ?? null,
        item.quantidade, item.vlUnitario, item.vlTotal
    ];
    const result = await execute(sql, params, "run");
    return result.lastID;
}

export default { ListarPorPedido, Criar };
