import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

/**
 * Leva o contrato da API para dentro do app.
 *
 *   npm run contrato:sync       copia
 *   npm run contrato:verificar  falha se as cópias divergirem
 *
 * Por que copiar em vez de importar: são dois repositórios git separados, e
 * o empacotador do React Native não resolve caminho para fora da raiz do
 * projeto. Uma dependência local (`file:../RassiExpressApi`) funcionaria no
 * Node, mas não no Metro.
 *
 * A cópia só é segura porque existe o `contrato:verificar`: ele falha quando
 * os dois arquivos divergem, o que transforma "alguém esqueceu de
 * sincronizar" de bug silencioso em erro de CI.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const ORIGEM = `${AQUI}/../contrato/api.ts`;
const DESTINO = `${AQUI}/../../lanche-expresso/src/types/contrato.ts`;

const AVISO = `// ============================================================================
// ARQUIVO GERADO — NÃO EDITE AQUI.
//
// Fonte: RassiExpressApi/contrato/api.ts
// Atualize lá e rode: npm run contrato:sync (na API)
//
// \`npm run contrato:verificar\` falha se esta cópia estiver desatualizada.
// ============================================================================

`;

function conteudoEsperado() {
  return AVISO + readFileSync(ORIGEM, 'utf8');
}

const comando = process.argv[2] ?? 'sync';

if (!existsSync(ORIGEM)) {
  console.error(`Contrato não encontrado em ${ORIGEM}`);
  process.exit(1);
}

if (comando === 'verificar') {
  if (!existsSync(DESTINO)) {
    console.error('A cópia do contrato não existe no app. Rode npm run contrato:sync.');
    process.exit(1);
  }
  const atual = readFileSync(DESTINO, 'utf8');
  if (atual !== conteudoEsperado()) {
    console.error('O contrato do app está desatualizado em relação ao da API.');
    console.error('  Rode npm run contrato:sync e comite as duas pontas juntas.');
    process.exit(1);
  }
  console.log('Contrato sincronizado entre API e app.');
} else {
  const pasta = dirname(DESTINO);
  if (!existsSync(pasta)) mkdirSync(pasta, { recursive: true });
  writeFileSync(DESTINO, conteudoEsperado());
  console.log(`Contrato copiado para ${DESTINO}`);
}
