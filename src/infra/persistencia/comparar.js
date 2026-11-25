import { conectarEm } from './migrador.js';

/**
 * Comparação de estrutura entre dois bancos.
 *
 * Nasceu dentro do verificador de migrations e saiu de lá quando o
 * verificador de backup passou a precisar da mesma coisa. Copiar as duas
 * consultas para o segundo script recriaria o problema que o projeto já
 * teve com o schema.sql: duas descrições da mesma estrutura, divergindo em
 * silêncio.
 *
 * O que é comparado foi escolhido por ter custado erro antes:
 *
 *  - `GENERATION_EXPRESSION`, porque as colunas geradas (`id_mesa_aberta`,
 *    `id_empresa_aberto`, `id_produto_key`) são o que dá unicidade parcial,
 *    e uma delas faltando quebra uma regra de negócio sem erro de sintaxe;
 *  - os índices, porque `NON_UNIQUE` é a diferença entre "uma comanda aberta
 *    por mesa" e "quantas quiser".
 */

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

export async function estruturaDe(nomeBanco) {
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

/**
 * Compara dois mapas e imprime o veredito.
 *
 * `rotulos` nomeia os dois lados nas mensagens — "migrations" e "real" num
 * caso, "backup" e "real" no outro. Sem isso, o diagnóstico sairia errado
 * num dos dois usos.
 */
export function comparar(titulo, esperado, obtido, rotulos = { esperado: 'esperado', obtido: 'obtido' }) {
  const problemas = [];

  for (const [chave, valor] of esperado) {
    if (!obtido.has(chave)) {
      problemas.push(`  ${chave}: existe em ${rotulos.esperado}, falta em ${rotulos.obtido}`);
    } else if (obtido.get(chave) !== valor) {
      problemas.push(
        `  ${chave}:\n      ${rotulos.esperado.padEnd(10)} ${valor}\n      ${rotulos.obtido.padEnd(10)} ${obtido.get(chave)}`
      );
    }
  }
  for (const chave of obtido.keys()) {
    if (!esperado.has(chave)) {
      problemas.push(`  ${chave}: existe em ${rotulos.obtido}, falta em ${rotulos.esperado}`);
    }
  }

  console.log(`${problemas.length ? 'FALHOU' : 'PASSOU'}  ${titulo}`);
  problemas.forEach((p) => console.log(p));
  return problemas.length;
}

/**
 * Contagem exata de linhas por tabela.
 *
 * `information_schema.TABLE_ROWS` seria mais barato, mas no InnoDB é uma
 * estimativa — já apareceu divergindo em dezenas de linhas de uma tabela
 * pequena. Verificação que aceita estimativa não verifica nada.
 */
export async function linhasPorTabela(nomeBanco) {
  const conexao = await conectarEm(nomeBanco);
  try {
    const [tabelas] = await conexao.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`,
      [nomeBanco]
    );
    const contagem = new Map();
    for (const { TABLE_NAME } of tabelas) {
      const [[linha]] = await conexao.query(`SELECT COUNT(*) AS n FROM \`${TABLE_NAME}\``);
      contagem.set(TABLE_NAME, Number(linha.n));
    }
    return contagem;
  } finally {
    await conexao.end();
  }
}
