import { execute } from "../database/mysql.js"

// Sinal por tipo. Fica aqui, numa definição só, porque qualquer divergência
// entre esta soma e a do resumo apareceria como quebra de caixa fantasma.
const ENTRADAS = "'venda', 'venda_externa', 'suprimento'";
const SAIDAS = "'despesa', 'sangria'";

async function ListarAberto(idEmpresa, conn) {
    const sql = `
        SELECT c.*, u.nome AS nome_abertura
        FROM CAIXA c
        LEFT JOIN FUNCIONARIO f ON f.id_funcionario = c.id_funcionario_abertura
        LEFT JOIN USUARIO u     ON u.id_usuario = f.id_usuario
        WHERE c.id_empresa_aberto = ?
    `;
    return await execute(sql, [idEmpresa], "get", conn);
}

async function ListarPorId(idCaixa, conn) {
    const sql = `
        SELECT c.*, u.nome AS nome_abertura
        FROM CAIXA c
        LEFT JOIN FUNCIONARIO f ON f.id_funcionario = c.id_funcionario_abertura
        LEFT JOIN USUARIO u     ON u.id_usuario = f.id_usuario
        WHERE c.id_caixa = ?
    `;
    return await execute(sql, [idCaixa], "get", conn);
}

async function ListarPorEmpresa(idEmpresa, de, ate, conn) {
    const sql = `
        SELECT c.*, u.nome AS nome_abertura
        FROM CAIXA c
        LEFT JOIN FUNCIONARIO f ON f.id_funcionario = c.id_funcionario_abertura
        LEFT JOIN USUARIO u     ON u.id_usuario = f.id_usuario
        WHERE c.id_empresa = ? AND c.dt_abertura >= ? AND c.dt_abertura < ?
        ORDER BY c.dt_abertura DESC
    `;
    return await execute(sql, [idEmpresa, de, ate], "all", conn);
}

async function Abrir(caixa, conn) {
    const sql = `
        INSERT INTO CAIXA (id_empresa, id_funcionario_abertura, vl_abertura, observacao, status, dt_abertura)
        VALUES (?, ?, ?, ?, 'aberto', NOW())
    `;
    const params = [caixa.idEmpresa, caixa.idFuncionario, caixa.vlAbertura ?? 0, caixa.observacao ?? null];
    const result = await execute(sql, params, "run", conn);
    return result.lastID;
}

async function Fechar(idCaixa, { idFuncionario, vlInformado, observacao }, conn) {
    const sql = `
        UPDATE CAIXA
        SET status = 'fechado', id_funcionario_fechamento = ?, vl_informado = ?,
            observacao = COALESCE(?, observacao), dt_fechamento = NOW()
        WHERE id_caixa = ? AND status = 'aberto'
    `;
    const result = await execute(sql, [idFuncionario, vlInformado, observacao ?? null, idCaixa], "run", conn);
    return result.changes;
}

async function CriarMovimento(mov, conn) {
    const sql = `
        INSERT INTO MOVIMENTO_CAIXA (id_caixa, id_empresa, id_funcionario, tipo, descricao, valor, id_comanda, dt_movimento)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    const params = [
        mov.idCaixa, mov.idEmpresa, mov.idFuncionario ?? null,
        mov.tipo, mov.descricao ?? null, mov.valor, mov.idComanda ?? null,
    ];
    const result = await execute(sql, params, "run", conn);
    return result.lastID;
}

async function ListarMovimentos(idCaixa, conn) {
    const sql = `
        SELECT m.*, u.nome AS nome_funcionario, c.id_mesa, mesa.numero AS numero_mesa
        FROM MOVIMENTO_CAIXA m
        LEFT JOIN FUNCIONARIO f ON f.id_funcionario = m.id_funcionario
        LEFT JOIN USUARIO u     ON u.id_usuario = f.id_usuario
        LEFT JOIN COMANDA c     ON c.id_comanda = m.id_comanda
        LEFT JOIN MESA mesa     ON mesa.id_mesa = c.id_mesa
        WHERE m.id_caixa = ?
        ORDER BY m.dt_movimento DESC, m.id_movimento DESC
    `;
    return await execute(sql, [idCaixa], "all", conn);
}

/**
 * Totais do caixa por tipo, mais o saldo esperado na gaveta.
 *
 * O saldo sai do banco, numa consulta só, e não de uma soma em JavaScript
 * sobre a lista de movimentos: é o número que o gestor confere contra o
 * dinheiro contado, e precisa ser o mesmo independente de quantos movimentos
 * a tela carregou.
 */
async function Resumo(idCaixa, conn) {
    const sql = `
        SELECT
            COALESCE(SUM(CASE WHEN tipo = 'venda'         THEN valor ELSE 0 END), 0) AS vendas,
            COALESCE(SUM(CASE WHEN tipo = 'venda_externa' THEN valor ELSE 0 END), 0) AS vendas_externas,
            COALESCE(SUM(CASE WHEN tipo = 'suprimento'    THEN valor ELSE 0 END), 0) AS suprimentos,
            COALESCE(SUM(CASE WHEN tipo = 'despesa'       THEN valor ELSE 0 END), 0) AS despesas,
            COALESCE(SUM(CASE WHEN tipo = 'sangria'       THEN valor ELSE 0 END), 0) AS sangrias,
            COALESCE(SUM(CASE WHEN tipo IN (${ENTRADAS}) THEN valor ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN tipo IN (${SAIDAS})   THEN valor ELSE 0 END), 0) AS saldo_movimentos,
            COUNT(*) AS movimentos
        FROM MOVIMENTO_CAIXA
        WHERE id_caixa = ?
    `;
    return await execute(sql, [idCaixa], "get", conn);
}

export default {
    ListarAberto, ListarPorId, ListarPorEmpresa, Abrir, Fechar,
    CriarMovimento, ListarMovimentos, Resumo,
};
