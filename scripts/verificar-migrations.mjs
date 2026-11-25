import 'dotenv/config';
import { migrar, conectarEm, garantirBanco } from '../src/infra/persistencia/migrador.js';
import { estruturaDe, comparar } from '../src/infra/persistencia/comparar.js';

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

  const rotulos = { esperado: 'real', obtido: 'migrations' };
  falhas += comparar('Colunas idênticas', real.colunas, reconstruido.colunas, rotulos);
  falhas += comparar('Índices idênticos', real.indices, reconstruido.indices, rotulos);

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
