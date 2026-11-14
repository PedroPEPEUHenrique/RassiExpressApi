import { execute } from "../database/mysql.js"

async function ListarInsumos(idEmpresa, conn) {
    const sql = `
        SELECT *, (qtd_minima > 0 AND qtd_atual <= qtd_minima) AS repor
        FROM INSUMO
        WHERE id_empresa = ? AND ativo = 1
        ORDER BY repor DESC, nome
    `;
    return await execute(sql, [idEmpresa], "all", conn);
}

async function ListarInsumoPorId(idInsumo, conn) {
    const sql = "SELECT * FROM INSUMO WHERE id_insumo = ?";
    return await execute(sql, [idInsumo], "get", conn);
}

async function CriarInsumo(insumo, conn) {
    const sql = `
        INSERT INTO INSUMO (id_empresa, nome, unidade, qtd_atual, qtd_minima, vl_custo_medio, ativo)
        VALUES (?, ?, ?, 0, ?, ?, 1)
    `;
    const params = [
        insumo.idEmpresa, insumo.nome, insumo.unidade,
        insumo.qtdMinima ?? 0, insumo.vlCustoMedio ?? 0,
    ];
    const result = await execute(sql, params, "run", conn);
    return result.lastID;
}

async function AtualizarInsumo(idInsumo, insumo, conn) {
    const sql = "UPDATE INSUMO SET nome = ?, unidade = ?, qtd_minima = ? WHERE id_insumo = ?";
    const params = [insumo.nome, insumo.unidade, insumo.qtdMinima ?? 0, idInsumo];
    const result = await execute(sql, params, "run", conn);
    return result.changes;
}

async function DesativarInsumo(idInsumo, conn) {
    const sql = "UPDATE INSUMO SET ativo = 0 WHERE id_insumo = ?";
    const result = await execute(sql, [idInsumo], "run", conn);
    return result.changes;
}

/**
 * Aplica a variação no saldo.
 *
 * O cálculo acontece no SQL (`qtd_atual = qtd_atual + ?`), não em JavaScript:
 * ler o saldo, somar e gravar deixaria duas baixas simultâneas sobrescreverem
 * uma à outra — e duas rodadas saindo ao mesmo tempo é o caso normal numa
 * cozinha cheia, não a exceção.
 */
async function AjustarSaldo(idInsumo, variacao, conn) {
    const sql = "UPDATE INSUMO SET qtd_atual = qtd_atual + ? WHERE id_insumo = ?";
    const result = await execute(sql, [variacao, idInsumo], "run", conn);
    return result.changes;
}

/**
 * Custo médio ponderado na entrada.
 *
 * Comprar 10kg a R$30 e depois 10kg a R$40 tem que resultar em R$35, não R$40
 * — usar o último preço faria o CMV pular a cada compra e tornaria a margem
 * ilegível. A média é calculada sobre o saldo que havia antes da entrada.
 */
async function AtualizarCustoMedio(idInsumo, qtdEntrada, vlUnitario, conn) {
    const sql = `
        UPDATE INSUMO
        SET vl_custo_medio = CASE
            WHEN (qtd_atual + ?) <= 0 THEN ?
            ELSE ((qtd_atual * vl_custo_medio) + (? * ?)) / (qtd_atual + ?)
        END
        WHERE id_insumo = ?
    `;
    const params = [qtdEntrada, vlUnitario, qtdEntrada, vlUnitario, qtdEntrada, idInsumo];
    const result = await execute(sql, params, "run", conn);
    return result.changes;
}

async function CriarMovimento(mov, conn) {
    const sql = `
        INSERT INTO MOVIMENTO_ESTOQUE (id_empresa, id_insumo, tipo, quantidade, vl_unitario, id_pedido, id_funcionario, motivo, dt_movimento)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    const params = [
        mov.idEmpresa, mov.idInsumo, mov.tipo, mov.quantidade,
        mov.vlUnitario ?? null, mov.idPedido ?? null, mov.idFuncionario ?? null, mov.motivo ?? null,
    ];
    const result = await execute(sql, params, "run", conn);
    return result.lastID;
}

async function ListarMovimentos(idInsumo, limite, conn) {
    const sql = `
        SELECT m.*, u.nome AS nome_funcionario
        FROM MOVIMENTO_ESTOQUE m
        LEFT JOIN FUNCIONARIO f ON f.id_funcionario = m.id_funcionario
        LEFT JOIN USUARIO u     ON u.id_usuario = f.id_usuario
        WHERE m.id_insumo = ?
        ORDER BY m.dt_movimento DESC, m.id_movimento DESC
        LIMIT ?
    `;
    return await execute(sql, [idInsumo, limite], "all", conn);
}

// ---------------------------------------------------------------------------
// Ficha técnica
// ---------------------------------------------------------------------------

async function ListarFicha(idProduto, conn) {
    const sql = `
        SELECT ft.*, i.nome, i.unidade, i.vl_custo_medio, i.qtd_atual
        FROM FICHA_TECNICA ft
        INNER JOIN INSUMO i ON i.id_insumo = ft.id_insumo
        WHERE ft.id_produto = ?
        ORDER BY i.nome
    `;
    return await execute(sql, [idProduto], "all", conn);
}

/**
 * Fichas de vários produtos de uma vez.
 *
 * A baixa de uma rodada precisa das fichas de N produtos dentro da transação;
 * buscar uma a uma multiplicaria as idas ao banco justamente onde a conexão
 * está presa.
 */
async function ListarFichasDeProdutos(idsProduto, conn) {
    if (!idsProduto.length) return [];
    const marcadores = idsProduto.map(() => "?").join(", ");
    const sql = `
        SELECT ft.id_produto, ft.id_insumo, ft.quantidade, i.vl_custo_medio, i.nome
        FROM FICHA_TECNICA ft
        INNER JOIN INSUMO i ON i.id_insumo = ft.id_insumo
        WHERE ft.id_produto IN (${marcadores}) AND i.ativo = 1
    `;
    return await execute(sql, idsProduto, "all", conn);
}

async function SalvarItemFicha(item, conn) {
    const sql = `
        INSERT INTO FICHA_TECNICA (id_produto, id_insumo, quantidade)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE quantidade = VALUES(quantidade)
    `;
    const result = await execute(sql, [item.idProduto, item.idInsumo, item.quantidade], "run", conn);
    return result.lastID;
}

async function RemoverItemFicha(idProduto, idInsumo, conn) {
    const sql = "DELETE FROM FICHA_TECNICA WHERE id_produto = ? AND id_insumo = ?";
    const result = await execute(sql, [idProduto, idInsumo], "run", conn);
    return result.changes;
}

/**
 * Custo dos insumos consumidos (CMV) no período.
 *
 * Usa o custo registrado no próprio movimento, não o custo médio atual do
 * insumo: o preço de hoje não deve reescrever o custo de uma venda de dois
 * meses atrás.
 */
async function CustoDasVendas(idEmpresa, de, ate, conn) {
    const sql = `
        SELECT COALESCE(SUM(quantidade * COALESCE(vl_unitario, 0)), 0) AS cmv
        FROM MOVIMENTO_ESTOQUE
        WHERE id_empresa = ? AND tipo = 'saida_venda'
          AND dt_movimento >= ? AND dt_movimento < ?
    `;
    const linha = await execute(sql, [idEmpresa, de, ate], "get", conn);
    return Number(linha?.cmv ?? 0);
}

export default {
    ListarInsumos, ListarInsumoPorId, CriarInsumo, AtualizarInsumo, DesativarInsumo,
    AjustarSaldo, AtualizarCustoMedio, CriarMovimento, ListarMovimentos,
    ListarFicha, ListarFichasDeProdutos, SalvarItemFicha, RemoverItemFicha, CustoDasVendas,
};
