import 'dotenv/config';
import { migrar, conectarEm, garantirBanco } from '../src/infra/persistencia/migrador.js';

/**
 * Prova que a sequência de migrations reproduz o banco que está rodando.
 *
 * É a guarda que faltava. O projeto já teve schema.sql e as migrations
 * descrevendo a mesma estrutura em dois lugares, e elas divergiram: o
 * ON DELETE CASCADE que o MySQL recusa em coluna-base de coluna gerada
 * precisou ser corrigido duas vezes, e nada avisaria se eu tivesse esquecido
 * um dos dois.
 *
 * schema.sql deixou de existir, mas o risco continua de outra forma: alguém
 * altera o banco à mão e a sequência deixa de reproduzi-lo. Este script
 * constrói um banco descartável só com as migrations e compara coluna a
 * coluna com o real.
 */

const BANCO_REAL = process.env.DB_NAME || 'foodexpress';
const BANCO_TESTE = `${BANCO_REAL}_verificacao`;

/** Estrutura comparável: nome, tipo, nulidade, padrão e coluna gerada. */
const SQL_ESTRUTURA = `
  SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE,
         COALESCE(COLUMN_DEFAULT, '~') AS COLUMN_DEFAULT,
         EXTRA, COALESCE(GENERATION_EXPRESSION, '') AS GENERATION_EXPRESSION
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = ? AND TABLE_NAME <> 'schema_migrations'
  ORDER BY TABLE_NAME, COLUMN_NAME
`;

/** Índices: é onde moram as garantias de unicidade que seguram o negócio. */
const SQL_INDICES = `
  SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE,
         GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS COLUNAS
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = ? AND TABLE_NAME <> 'schema_migrations'
  GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE
  ORDER BY TABLE_NAME, INDEX_NAME
`;

async function estruturaDe(nomeBanco) {
  const conexao = await conectarEm(nomeBanco);
  try {
    const [colunas] = await conexao.query(SQL_ESTRUTURA, [nomeBanco]);
    const [indices] = await conexao.query(SQL_INDICES, [nomeBanco]);
    return {
      colunas: new Map(colunas.map((c) => [
        `${c.TABLE_NAME}.${c.COLUMN_NAME}`,
        `${c.COLUMN_TYPE}|${c.IS_NULLABLE}|${c.COLUMN_DEFAULT}|${c.EXTRA}|${c.GENERATION_EXPRESSION}`,
      ])),
      indices: new Map(indices.map((i) => [
        `${i.TABLE_NAME}.${i.INDEX_NAME}`,
        `${i.NON_UNIQUE ? 'indice' : 'UNICO'}(${i.COLUNAS})`,
      ])),
    };
  } finally {
    await conexao.end();
  }
}

function comparar(rotulo, real, reconstruido) {
  const problemas = [];
  for (const [chave, valorReal] of real) {
    if (!reconstruido.has(chave)) {
      problemas.push(`  ${chave}: existe no banco real, as migrations não criam`);
    } else if (reconstruido.get(chave) !== valorReal) {
      problemas.push(`  ${chave}:\n      real       ${valorReal}\n      migrations ${reconstruido.get(chave)}`);
    }
  }
  for (const chave of reconstruido.keys()) {
    if (!real.has(chave)) problemas.push(`  ${chave}: as migrations criam, não existe no banco real`);
  }
  console.log(`${problemas.length ? 'FALHOU' : 'PASSOU'}  ${rotulo}`);
  problemas.forEach((p) => console.log(p));
  return problemas.length;
}

async function apagar(nomeBanco) {
  const conexao = await conectarEm(process.env.DB_NAME || 'mysql').catch(() => null);
  if (!conexao) return;
  try {
    await conexao.query(`DROP DATABASE IF EXISTS \`${nomeBanco}\``);
  } finally {
    await conexao.end();
  }
}

console.log(`Reconstruindo "${BANCO_TESTE}" só com as migrations...\n`);

await apagar(BANCO_TESTE);
await garantirBanco(BANCO_TESTE);

let falhas = 0;
try {
  await migrar({ nomeBanco: BANCO_TESTE, silencioso: true });

  const real = await estruturaDe(BANCO_REAL);
  const reconstruido = await estruturaDe(BANCO_TESTE);

  falhas += comparar('Colunas idênticas', real.colunas, reconstruido.colunas);
  falhas += comparar('Índices idênticos', real.indices, reconstruido.indices);

  console.log(
    falhas
      ? `\n${falhas} divergência(s): a sequência de migrations NÃO reproduz o banco atual.`
      : `\nA sequência reproduz o banco atual: ${real.colunas.size} colunas e ${real.indices.size} índices conferem.`
  );
} catch (erro) {
  console.error(`\nFalhou ao reconstruir: ${erro.message}`);
  falhas = 1;
} finally {
  await apagar(BANCO_TESTE);
}

process.exit(falhas ? 1 : 0);
