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

/**
 * Onde o app está. O padrão é o irmão `../lanche-expresso`, que é como as
 * duas pastas ficam na máquina de quem desenvolve; `APP_DIR` existe para o
 * CI, onde os dois repositórios são clonados em caminhos que ele escolhe.
 */
const APP = process.env.APP_DIR ?? `${AQUI}/../../lanche-expresso`;
const DESTINO = `${APP}/src/types/contrato.ts`;

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
    // Diz o caminho: no CI, "não existe" quase sempre é o app clonado em
    // outro lugar, não o contrato fora de sincronia.
    console.error(`A cópia do contrato não existe em ${DESTINO}`);
    console.error('  Se o app está noutro caminho, aponte APP_DIR para a raiz dele.');
    console.error('  Se é só falta de sincronia, rode npm run contrato:sync.');
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
