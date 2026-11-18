import mysql from "mysql2/promise";
import { UnidadeDeTrabalho } from "../../compartilhado/aplicacao/UnidadeDeTrabalho.js";

/**
 * Adaptador de persistência: MySQL.
 *
 * É a única camada que conhece mysql2. Acima daqui ninguém sabe que o banco é
 * relacional, nem o que significa ER_DUP_ENTRY.
 */

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
 * Traduz o erro do driver para vocabulário do domínio.
 *
 * Os casos de uso checam `erro.duplicado` — não `erro.code === 'ER_DUP_ENTRY'`.
 * Sem esta tradução, a regra de negócio precisaria conhecer os códigos de erro
 * do MySQL, e trocar de banco quebraria a lógica de idempotência da rodada e
 * a de mesa já ocupada.
 */
function traduzir(erro) {
    if (erro?.code === "ER_DUP_ENTRY") erro.duplicado = true;
    return erro;
}

/**
 * Executa SQL.
 *
 * `ctx` é a conexão transacional que a Unidade de Trabalho entrega. Ausente,
 * roda no pool em autocommit.
 */
async function executar(sql, params, modo = "todos", ctx) {
    try {
        const [linhas] = await (ctx ?? pool).execute(sql, params);
        if (modo === "escrita") return { id: linhas.insertId, afetadas: linhas.affectedRows };
        if (modo === "um") return linhas[0] ?? null;
        return linhas;
    } catch (erro) {
        throw traduzir(erro);
    }
}

/**
 * Unidade de Trabalho sobre transação do MySQL.
 *
 * Necessária porque cada `executar` sozinho pega uma conexão própria do pool,
 * em autocommit: uma operação de várias escritas — lançar uma rodada, fechar
 * uma conta — poderia falhar no meio e deixar o banco inconsistente.
 */
class UnidadeDeTrabalhoMySQL extends UnidadeDeTrabalho {
    async executar(fn) {
        const conexao = await pool.getConnection();
        try {
            await conexao.beginTransaction();
            const resultado = await fn(conexao);
            await conexao.commit();
            return resultado;
        } catch (erro) {
            await conexao.rollback();
            throw traduzir(erro);
        } finally {
            conexao.release();
        }
    }
}

export { pool, executar, UnidadeDeTrabalhoMySQL };
