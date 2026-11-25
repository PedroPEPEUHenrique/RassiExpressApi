import 'dotenv/config';
import { conectarEm, garantirBanco } from '../src/infra/persistencia/migrador.js';
import { estruturaDe, comparar, linhasPorTabela } from '../src/infra/persistencia/comparar.js';
import {
  criar, listar, podar, restaurar, conferirIntegridade, PASTA, detectarFerramentas,
} from '../src/infra/persistencia/backup.js';

/**
 * Backup do banco pela linha de comando.
 *
 *   npm run backup              cria um backup e descarta os vencidos
 *   npm run backup:listar       o que existe guardado
 *   npm run backup:verificar    RESTAURA o mais recente e compara com o real
 *   npm run backup:restaurar -- <arquivo> --banco=<nome>
 *
 * O comando que justifica o resto é o `verificar`. Um dump que ninguém nunca
 * restaurou não é backup: é um arquivo que se presume bom. Ele cria um banco
 * descartável, despeja o backup lá dentro e compara estrutura e contagem de
 * linhas com o banco que está rodando.
 */

const BANCO_REAL = process.env.DB_NAME || 'foodexpress';
const BANCO_TESTE = `${BANCO_REAL}_restauracao`;

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const idade = (data) => {
  const h = (Date.now() - data.getTime()) / 36e5;
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} dias`;
};

async function apagarBanco(nome) {
  const conexao = await conectarEm('mysql').catch(() => null);
  if (!conexao) return;
  try {
    await conexao.query(`DROP DATABASE IF EXISTS \`${nome}\``);
  } finally {
    await conexao.end();
  }
}

// ---------------------------------------------------------------------------

async function comandoCriar() {
  const ferramentas = await detectarFerramentas();
  console.log(`Copiando "${BANCO_REAL}" via ${ferramentas.descricao}...`);

  const r = await criar();
  console.log(`\n  ${r.nome}`);
  console.log(`  ${kb(r.bytes)} comprimido, ${kb(r.bytesSql)} de SQL`);
  console.log(`  em ${PASTA}`);

  // O repositório pode estar dentro de uma pasta sincronizada, e aí o dump
  // sobe para a nuvem junto. Isso é cópia fora da máquina de graça, mas põe
  // hash de senha e histórico de vendas num serviço de terceiro — decisão de
  // quem opera, não padrão silencioso de quem escreveu o script.
  const sincronizada = ['OneDrive', 'Dropbox', 'Google Drive', 'iCloud'].find((s) => PASTA.includes(s));
  if (sincronizada) {
    console.log(`\n  Atenção: esta pasta fica dentro do ${sincronizada} e será sincronizada.`);
    console.log('  Serve de cópia fora da máquina, mas leva hashes de senha e as vendas');
    console.log('  para a nuvem. Para guardar noutro lugar, defina BACKUP_DIR no .env.');
  }

  const poda = await podar();
  if (poda.removidos.length) {
    console.log(`\nVencidos descartados (${poda.removidos.length}):`);
    poda.removidos.forEach((n) => console.log(`  ${n}`));
  }
  console.log(`\n${poda.restantes} backup(s) guardado(s).`);
  console.log('Confirme que presta: npm run backup:verificar');
}

async function comandoListar() {
  const backups = await listar();
  if (!backups.length) {
    console.log(`Nenhum backup em ${PASTA}\nCrie o primeiro: npm run backup`);
    return;
  }
  console.log(`${backups.length} backup(s) em ${PASTA}:\n`);
  for (const b of backups) {
    console.log(`  ${b.nome}`);
    console.log(`    ${kb(b.bytes).padStart(10)}   há ${idade(b.criadoEm)}`);
  }
}

/**
 * O verificador.
 *
 * Dois modos, porque as perguntas são diferentes:
 *
 *  - padrão: "o backup que está no disco presta?" A contagem de linhas pode
 *    divergir legitimamente — o restaurante continuou vendendo depois do
 *    dump — então diferença de contagem é informação, não falha. O que falha
 *    é tabela ausente ou tabela vazia no backup e cheia no banco, que é a
 *    assinatura de um dump truncado.
 *
 *  - `--agora`: tira um backup novo e exige igualdade exata. É o modo para
 *    CI e para depois de mexer no procedimento, porque não tem margem.
 */
async function comandoVerificar({ agora }) {
  let alvo;

  if (agora) {
    console.log('Tirando um backup novo para verificar o ciclo completo...');
    const r = await criar({ etiqueta: 'verificacao' });
    alvo = { nome: r.nome, caminho: r.arquivo, bytes: r.bytes, criadoEm: new Date() };
  } else {
    const backups = await listar();
    if (!backups.length) {
      console.error(`Nenhum backup em ${PASTA} para verificar.`);
      console.error('  Crie um: npm run backup');
      process.exit(1);
    }
    alvo = backups[0];
  }

  console.log(`\nRestaurando ${alvo.nome} em "${BANCO_TESTE}"...`);
  console.log(`  (${kb(alvo.bytes)}, de há ${idade(alvo.criadoEm)})\n`);

  let falhas = 0;
  try {
    // Antes de mexer em banco nenhum: o arquivo descomprime inteiro e tem a
    // marca de fim? Sem isto o diagnóstico de um dump truncado sai como
    // "unexpected end of file" no meio de uma restauração pela metade —
    // mensagem de biblioteca, não de operação, e já com um banco sujo.
    try {
      await conferirIntegridade(alvo.caminho);
      console.log('PASSOU  Arquivo íntegro e completo');
    } catch (erro) {
      console.log(`FALHOU  Arquivo íntegro e completo\n  ${erro.message}`);
      console.log('\n1 problema: este backup NÃO restaura o banco corretamente.');
      console.log(`  Use o anterior: npm run backup:listar`);
      process.exit(1);
    }

    await apagarBanco(BANCO_TESTE);
    await garantirBanco(BANCO_TESTE);
    await restaurar({ arquivo: alvo.caminho, banco: BANCO_TESTE });

    const real = await estruturaDe(BANCO_REAL);
    const doBackup = await estruturaDe(BANCO_TESTE);
    const rotulos = { esperado: 'real', obtido: 'backup' };

    falhas += comparar('Colunas restauradas', real.colunas, doBackup.colunas, rotulos);
    falhas += comparar('Índices restaurados', real.indices, doBackup.indices, rotulos);

    // --- linhas ---
    const linhasReal = await linhasPorTabela(BANCO_REAL);
    const linhasBackup = await linhasPorTabela(BANCO_TESTE);

    const ausentes = [];
    const vazias = [];
    const divergentes = [];
    let totalReal = 0;
    let totalBackup = 0;

    for (const [tabela, n] of linhasReal) {
      totalReal += n;
      if (!linhasBackup.has(tabela)) { ausentes.push(tabela); continue; }
      const m = linhasBackup.get(tabela);
      totalBackup += m;
      if (n > 0 && m === 0) vazias.push(tabela);
      else if (n !== m) divergentes.push(`${tabela}: real ${n}, backup ${m}`);
    }

    if (ausentes.length) {
      console.log(`FALHOU  Tabelas presentes no backup`);
      ausentes.forEach((t) => console.log(`  ${t}: não veio no backup`));
      falhas += ausentes.length;
    }

    if (vazias.length) {
      // Tabela criada mas sem dado é a marca de um dump interrompido entre o
      // CREATE TABLE e os INSERTs.
      console.log(`FALHOU  Dados restaurados`);
      vazias.forEach((t) => console.log(`  ${t}: tem linhas no banco e nenhuma no backup`));
      falhas += vazias.length;
    }

    if (!ausentes.length && !vazias.length) {
      if (!divergentes.length) {
        console.log(`PASSOU  Dados restaurados (${totalReal} linhas, idênticas tabela por tabela)`);
      } else if (agora) {
        console.log('FALHOU  Contagem de linhas idêntica');
        divergentes.forEach((d) => console.log(`  ${d}`));
        falhas += divergentes.length;
      } else {
        console.log(`PASSOU  Dados restaurados (${totalBackup} linhas no backup, ${totalReal} no banco agora)`);
        console.log('        O banco seguiu em movimento depois do backup:');
        divergentes.forEach((d) => console.log(`          ${d}`));
      }
    }

    console.log(
      falhas
        ? `\n${falhas} problema(s): este backup NÃO restaura o banco corretamente.`
        : `\nO backup restaura: ${real.colunas.size} colunas, ${real.indices.size} índices e os dados conferem.`
    );
  } catch (erro) {
    console.error(`\nA restauração falhou: ${erro.message}`);
    falhas = 1;
  } finally {
    await apagarBanco(BANCO_TESTE);
  }

  process.exit(falhas ? 1 : 0);
}

async function comandoRestaurar(args) {
  const arquivo = args.find((a) => !a.startsWith('--'));
  const banco = args.find((a) => a.startsWith('--banco='))?.slice('--banco='.length);
  const confirmado = args.includes('--confirmar');

  if (!arquivo) {
    console.error('Uso: npm run backup:restaurar -- <arquivo> --banco=<nome>');
    console.error('  Veja os arquivos com: npm run backup:listar');
    process.exit(1);
  }
  if (!banco) {
    console.error('Falta --banco=<nome>: o destino de uma restauração tem de ser explícito.');
    console.error(`  Para um ensaio sem risco: --banco=${BANCO_REAL}_ensaio`);
    process.exit(1);
  }

  // Restaurar em cima do banco em uso apaga o que houver nele — o dump
  // começa com DROP TABLE. Exigir --confirmar evita que isso aconteça por
  // um erro de digitação no nome do banco.
  if (banco === BANCO_REAL && !confirmado) {
    console.error(`"${banco}" é o banco em uso. Restaurar nele APAGA os dados atuais.`);
    console.error('  Se é isso mesmo, repita com --confirmar.');
    console.error(`  Se quer só conferir o backup, use: npm run backup:verificar`);
    process.exit(1);
  }

  const caminho = arquivo.includes('/') || arquivo.includes('\\') ? arquivo : `${PASTA}/${arquivo}`;
  await garantirBanco(banco);
  console.log(`Restaurando ${arquivo} em "${banco}"...`);
  await restaurar({ arquivo: caminho, banco });
  console.log('Pronto.');
}

// ---------------------------------------------------------------------------

const [comando = 'criar', ...resto] = process.argv.slice(2);

try {
  if (comando === 'criar') await comandoCriar();
  else if (comando === 'listar') await comandoListar();
  else if (comando === 'verificar') await comandoVerificar({ agora: resto.includes('--agora') });
  else if (comando === 'restaurar') await comandoRestaurar(resto);
  else if (comando === 'podar') {
    const r = await podar();
    console.log(`${r.removidos.length} removido(s), ${r.restantes} guardado(s).`);
    r.removidos.forEach((n) => console.log(`  ${n}`));
  } else {
    console.error(`Comando desconhecido: ${comando}`);
    console.error('Use: criar | listar | verificar | restaurar | podar');
    process.exit(1);
  }
} catch (erro) {
  console.error(`\n${erro.message}`);
  process.exit(1);
}
