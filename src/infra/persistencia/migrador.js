import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import mysql from 'mysql2/promise';

/**
 * Executor de migrations.
 *
 * Antes disto, aplicar uma migration era `docker exec ... < arquivo.sql` à mão,
 * e nada registrava o que já tinha rodado. Foi por isso que, quando a 003 e a
 * 005 falharam no meio, descobrir o estado do banco exigiu inspeção manual
 * tabela por tabela.
 *
 * A sequência 000..00N é a ÚNICA descrição da estrutura. Não há mais
 * schema.sql: ele era uma segunda descrição da mesma coisa, mantida em
 * sincronia à mão, e as duas já divergiram.
 */

const PASTA = fileURLToPath(new URL('./migrations', import.meta.url));

const CRIAR_CONTROLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    nome        VARCHAR(255) NOT NULL PRIMARY KEY,
    checksum    CHAR(64)     NOT NULL,
    aplicada_em DATETIME     NOT NULL DEFAULT NOW()
  )
`;

function listarArquivos() {
    return readdirSync(PASTA)
        .filter((n) => n.endsWith('.sql'))
        .sort() // os prefixos numéricos dão a ordem
        .map((nome) => {
            const sql = readFileSync(join(PASTA, nome), 'utf8');
            return { nome, sql, checksum: createHash('sha256').update(sql).digest('hex') };
        });
}

/**
 * Separa o arquivo em instruções.
 *
 * Statement a statement, e não o arquivo inteiro de uma vez, para o erro
 * dizer QUAL instrução falhou — que é a informação que faltou quando a 003
 * quebrou. Comentários saem antes do corte para que um `;` dentro de
 * comentário não divida nada.
 */
function instrucoes(sql) {
    return sql
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*--.*$/gm, '')
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);
}

async function conectar({ comBanco = true } = {}) {
    return await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: comBanco ? (process.env.DB_NAME || 'foodexpress') : undefined,
        multipleStatements: false,
    });
}

/** Cria o banco se ainda não existir — o runner precisa poder partir do zero. */
async function garantirBanco(nomeBanco) {
    const conexao = await conectar({ comBanco: false });
    try {
        await conexao.query(
            `CREATE DATABASE IF NOT EXISTS \`${nomeBanco}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
        );
    } finally {
        await conexao.end();
    }
}

async function aplicadas(conexao) {
    await conexao.query(CRIAR_CONTROLE);
    const [linhas] = await conexao.query('SELECT nome, checksum FROM schema_migrations');
    return new Map(linhas.map((l) => [l.nome, l.checksum]));
}

/**
 * Roda um arquivo.
 *
 * DDL no MySQL faz commit implícito: não existe transação que desfaça um
 * CREATE TABLE. Por isso o registro acontece só depois do arquivo inteiro
 * passar — se parar no meio, o nome NÃO entra na tabela de controle e a
 * mensagem diz em qual instrução parou, para a correção ser feita com o
 * estado conhecido em vez de adivinhado.
 */
async function aplicar(conexao, migration) {
    const partes = instrucoes(migration.sql);
    for (const [i, instrucao] of partes.entries()) {
        try {
            await conexao.query(instrucao);
        } catch (erro) {
            const e = new Error(
                `${migration.nome}: falhou na instrução ${i + 1} de ${partes.length} — ${erro.sqlMessage ?? erro.message}\n` +
                `  ${instrucao.slice(0, 160).replace(/\s+/g, ' ')}...`
            );
            e.causa = erro;
            throw e;
        }
    }
    await conexao.query(
        'INSERT INTO schema_migrations (nome, checksum) VALUES (?, ?)',
        [migration.nome, migration.checksum]
    );
}

/** O banco já tem estrutura além da tabela de controle? */
async function temEstrutura(conexao) {
    const [linhas] = await conexao.query(
        "SELECT COUNT(*) AS n FROM information_schema.TABLES " +
        "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME <> 'schema_migrations'"
    );
    return Number(linhas[0].n) > 0;
}

/**
 * Adota um banco que já existia antes do runner.
 *
 * Marca todas as migrations como aplicadas SEM executá-las. É o caminho para
 * o banco que foi construído à mão: a estrutura já está lá, e rodar 001
 * novamente estouraria tentando adicionar uma coluna que existe.
 *
 * Só serve uma vez, num banco que já tem as tabelas. Num banco vazio seria
 * mentira — ele ficaria registrado como migrado sem nenhuma tabela.
 */
async function adotar({ nomeBanco = process.env.DB_NAME || 'foodexpress' } = {}) {
    await garantirBanco(nomeBanco);
    const conexao = await conectarEm(nomeBanco);
    try {
        const jaAplicadas = await aplicadas(conexao);
        if (jaAplicadas.size) {
            throw new Error(`"${nomeBanco}" já tem controle de migrations (${jaAplicadas.size} registrada(s)). Nada a adotar.`);
        }
        if (!(await temEstrutura(conexao))) {
            throw new Error(
                `"${nomeBanco}" está vazio — adotar registraria migrations que nunca rodaram.\n` +
                '  Use npm run migrar para construí-lo do zero.'
            );
        }

        const arquivos = listarArquivos();
        for (const a of arquivos) {
            await conexao.query('INSERT INTO schema_migrations (nome, checksum) VALUES (?, ?)', [a.nome, a.checksum]);
        }
        return arquivos.map((a) => a.nome);
    } finally {
        await conexao.end();
    }
}

function conectarEm(nomeBanco) {
    return mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: nomeBanco,
    });
}

/** Aplica o que falta. Devolve os nomes aplicados nesta execução. */
async function migrar({ nomeBanco = process.env.DB_NAME || 'foodexpress', silencioso = false } = {}) {
    await garantirBanco(nomeBanco);

    const conexao = await conectarEm(nomeBanco);

    try {
        const jaAplicadas = await aplicadas(conexao);
        const arquivos = listarArquivos();

        // Banco com tabelas mas sem registro nenhum: foi construído antes do
        // runner existir. Aplicar 001 aqui estouraria tentando adicionar uma
        // coluna que já está lá, então a adoção precisa ser explícita.
        if (!jaAplicadas.size && (await temEstrutura(conexao))) {
            throw new Error(
                [
                    `"${nomeBanco}" já tem tabelas mas nenhuma migration registrada.`,
                    '  Se foi criado à mão, rode npm run migrar:adotar para registrar o estado atual.',
                    '  Se quer reconstruí-lo do zero, apague o banco antes.',
                ].join('\n')
            );
        }

        /**
         * Migration já aplicada que mudou de conteúdo é erro, não aviso.
         *
         * Editar um arquivo que já rodou significa que o banco de quem
         * aplicou antes e o de quem aplicar agora são diferentes, sem nada
         * registrar isso. Corrigir é criar uma migration nova.
         */
        for (const arq of arquivos) {
            const anterior = jaAplicadas.get(arq.nome);
            if (anterior && anterior !== arq.checksum) {
                throw new Error(
                    `${arq.nome} já foi aplicada mas o arquivo mudou desde então.\n` +
                    '  Bancos aplicados antes e depois ficariam diferentes sem registro.\n' +
                    '  Crie uma migration nova em vez de editar esta.'
                );
            }
        }

        const pendentes = arquivos.filter((a) => !jaAplicadas.has(a.nome));
        if (!pendentes.length) {
            if (!silencioso) console.log(`Banco "${nomeBanco}" já está atualizado (${jaAplicadas.size} migration(s)).`);
            return [];
        }

        for (const m of pendentes) {
            if (!silencioso) process.stdout.write(`  ${m.nome} ... `);
            await aplicar(conexao, m);
            if (!silencioso) console.log('ok');
        }

        if (!silencioso) console.log(`\n${pendentes.length} migration(s) aplicada(s) em "${nomeBanco}".`);
        return pendentes.map((m) => m.nome);
    } finally {
        await conexao.end();
    }
}

/** Aplicadas, pendentes e divergências — sem alterar nada. */
async function status({ nomeBanco = process.env.DB_NAME || 'foodexpress' } = {}) {
    await garantirBanco(nomeBanco);
    const conexao = await conectarEm(nomeBanco);
    try {
        const jaAplicadas = await aplicadas(conexao);
        return listarArquivos().map((a) => ({
            nome: a.nome,
            aplicada: jaAplicadas.has(a.nome),
            alterada: jaAplicadas.has(a.nome) && jaAplicadas.get(a.nome) !== a.checksum,
        }));
    } finally {
        await conexao.end();
    }
}

export { migrar, status, adotar, listarArquivos, instrucoes, garantirBanco, conectarEm };
