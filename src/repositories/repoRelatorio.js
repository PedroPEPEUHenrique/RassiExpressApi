import { execute } from "../database/mysql.js"

/**
 * Relatórios do período.
 *
 * Todos partem de COMANDA fechada, não de MOVIMENTO_CAIXA. São fontes com
 * propósitos diferentes e misturá-las produziria números que não batem:
 *
 *   COMANDA  — o que o salão vendeu. Existe mesmo sem caixa aberto, e é o
 *              que responde "quanto o restaurante faturou".
 *   CAIXA    — o que passou pela gaveta no turno. Inclui despesa e sangria,
 *              que não são venda, e exclui venda feita com o caixa fechado.
 *
 * Faturamento sai de COMANDA. A gaveta é assunto do fechamento de caixa.
 */

// Usa a data de FECHAMENTO: a venda é reconhecida quando a conta fecha, senão
// uma mesa aberta antes da meia-noite cairia no dia anterior ao do pagamento.
async function Resumo(idEmpresa, de, ate, conn) {
    const sql = `
        SELECT COUNT(*)                     AS comandas,
               COALESCE(SUM(vl_total), 0)   AS faturamento,
               COALESCE(AVG(vl_total), 0)   AS ticket_medio
        FROM COMANDA
        WHERE id_empresa = ? AND status = 'fechada'
          AND dt_fechamento >= ? AND dt_fechamento < ?
    `;
    return await execute(sql, [idEmpresa, de, ate], "get", conn);
}

async function PorDia(idEmpresa, de, ate, conn) {
    const sql = `
        SELECT DATE(dt_fechamento)        AS dia,
               COUNT(*)                   AS comandas,
               COALESCE(SUM(vl_total), 0) AS faturamento
        FROM COMANDA
        WHERE id_empresa = ? AND status = 'fechada'
          AND dt_fechamento >= ? AND dt_fechamento < ?
        GROUP BY DATE(dt_fechamento)
        ORDER BY dia
    `;
    return await execute(sql, [idEmpresa, de, ate], "all", conn);
}

/**
 * Mais vendidos.
 *
 * Agrupa por nome_produto, não por id_produto: o nome foi congelado no item
 * no momento da venda, então o relatório continua correto mesmo para produto
 * renomeado ou tirado do cardápio depois.
 */
async function MaisVendidos(idEmpresa, de, ate, limite, conn) {
    const sql = `
        SELECT ip.nome_produto,
               SUM(ip.quantidade) AS quantidade,
               SUM(ip.vl_total)   AS faturamento
        FROM ITENS_PEDIDO ip
        INNER JOIN PEDIDO p  ON p.id_pedido = ip.id_pedido
        INNER JOIN COMANDA c ON c.id_comanda = p.id_comanda
        WHERE c.id_empresa = ? AND c.status = 'fechada'
          AND p.status <> 'cancelado'
          AND c.dt_fechamento >= ? AND c.dt_fechamento < ?
        GROUP BY ip.nome_produto
        ORDER BY quantidade DESC, faturamento DESC
        LIMIT ?
    `;
    return await execute(sql, [idEmpresa, de, ate, limite], "all", conn);
}

// Quantas mesas fecharam em cada faixa de horário — o dado que diz onde
// escalar mais gente.
async function PorHora(idEmpresa, de, ate, conn) {
    const sql = `
        SELECT HOUR(dt_fechamento)        AS hora,
               COUNT(*)                   AS comandas,
               COALESCE(SUM(vl_total), 0) AS faturamento
        FROM COMANDA
        WHERE id_empresa = ? AND status = 'fechada'
          AND dt_fechamento >= ? AND dt_fechamento < ?
        GROUP BY HOUR(dt_fechamento)
        ORDER BY hora
    `;
    return await execute(sql, [idEmpresa, de, ate], "all", conn);
}

async function ComandasCanceladas(idEmpresa, de, ate, conn) {
    const sql = `
        SELECT COUNT(*) AS total
        FROM PEDIDO p
        INNER JOIN COMANDA c ON c.id_comanda = p.id_comanda
        WHERE c.id_empresa = ? AND p.status = 'cancelado'
          AND p.dt_pedido >= ? AND p.dt_pedido < ?
    `;
    const linha = await execute(sql, [idEmpresa, de, ate], "get", conn);
    return Number(linha?.total ?? 0);
}

// Mesas ainda abertas: trava o fechamento de caixa, porque essas vendas
// cairiam no turno seguinte.
async function ContarComandasAbertas(idEmpresa, conn) {
    const sql = "SELECT COUNT(*) AS total FROM COMANDA WHERE id_empresa = ? AND status = 'aberta'";
    const linha = await execute(sql, [idEmpresa], "get", conn);
    return Number(linha?.total ?? 0);
}

export default { Resumo, PorDia, MaisVendidos, PorHora, ComandasCanceladas, ContarComandasAbertas };
