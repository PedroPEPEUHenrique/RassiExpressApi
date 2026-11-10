import mysql from "mysql2/promise";

const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "foodexpress",
    waitForConnections: true,
    connectionLimit: 10,
    decimalNumbers: true,
});

/**
 * Executa uma instrução SQL.
 *
 * O parâmetro `executor` decide quem roda a query. Por padrão é o pool, que
 * entrega qualquer conexão livre em autocommit. Passando a conexão recebida de
 * withTransaction, a query entra na transação em curso — é assim que um
 * repositório participa de uma escrita atômica sem precisar conhecer a
 * transação que o envolve.
 */
async function execute(sql, params, method = "all", executor = pool) {
    const [rows] = await executor.execute(sql, params);
    if (method === "run") {
        return { lastID: rows.insertId, changes: rows.affectedRows };
    } else if (method === "get") {
        return rows[0] || null;
    }
    return rows;
}

/**
 * Roda `fn` dentro de uma transação, entregando a ela a conexão que deve ser
 * repassada aos repositórios. Commita ao final, faz rollback em qualquer erro
 * e devolve a conexão ao pool nos dois casos.
 *
 * Necessário porque `execute` sozinho roda cada statement em autocommit: uma
 * operação de várias escritas (criar funcionário, lançar uma rodada numa
 * comanda) poderia falhar no meio e deixar o banco inconsistente.
 */
async function withTransaction(fn) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const resultado = await fn(conn);
        await conn.commit();
        return resultado;
    } catch (erro) {
        await conn.rollback();
        throw erro;
    } finally {
        conn.release();
    }
}

export { pool, execute, withTransaction };
