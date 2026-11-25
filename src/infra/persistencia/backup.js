import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readdir, rename, rm, stat, writeFile, chmod } from 'node:fs/promises';
import { createGzip, createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Backup e restauração do banco.
 *
 * O histórico de vendas é o dado mais insubstituível do projeto — foi por
 * ele que o delete de categoria passou a ser bloqueado em vez de cascatear.
 * Mesmo assim, até aqui um `docker volume rm` acidental levava tudo, sem
 * cópia nenhuma em lugar nenhum.
 *
 * As quatro decisões que separam isto de um arquivo .sql qualquer:
 *
 * 1. **Escrita atômica.** O dump vai para `.parcial` e só é renomeado no
 *    fim. Máquina desligada no meio deixa um `.parcial` evidente, nunca um
 *    backup pela metade com nome de backup bom — que é o pior caso possível,
 *    porque só se descobre na hora de restaurar.
 *
 * 2. **Marca de completude.** O mysqldump assina o fim com
 *    `-- Dump completed`. Conferir essa linha depois de recomprimir detecta
 *    truncamento, que o código de saída sozinho não detecta quando o
 *    processo morre por falta de espaço em disco.
 *
 * 3. **Senha fora da linha de comando.** Vai num arquivo temporário de
 *    permissão restrita passado em `--defaults-extra-file`, não em `-p`:
 *    argumento de processo é legível por qualquer um na máquina.
 *
 * 4. **Restauração testada.** `verificar()` restaura o backup mais recente
 *    num banco descartável e compara estrutura e contagem de linhas com o
 *    banco real. Backup que nunca foi restaurado não é backup — é esperança.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));

/** Fica fora de src/ de propósito: é dado, não código. Está no .gitignore. */
export const PASTA = process.env.BACKUP_DIR ?? join(AQUI, '..', '..', '..', 'backups');

const PREFIXO = 'foodexpress-';
const SUFIXO = '.sql.gz';
const MARCA_FIM = 'Dump completed';

/** Quanto tempo guardar, e quantos nunca descartar seja qual for a idade. */
const DIAS_PADRAO = Number(process.env.BACKUP_MANTER_DIAS ?? 14);
const MINIMO_PADRAO = Number(process.env.BACKUP_MANTER_MINIMO ?? 3);

const bancoPadrao = () => process.env.DB_NAME || 'foodexpress';

// ---------------------------------------------------------------------------
// Onde estão o mysqldump e o mysql
// ---------------------------------------------------------------------------

function existeNoPath(nome) {
  const r = spawn(process.platform === 'win32' ? 'where' : 'which', [nome], { stdio: 'ignore' });
  return new Promise((resolve) => {
    r.on('error', () => resolve(false));
    r.on('close', (codigo) => resolve(codigo === 0));
  });
}

/**
 * Prefere o binário do host; cai para `docker exec` quando não houver.
 *
 * A diferença não é só de caminho: rodando dentro do container, o servidor
 * está em 127.0.0.1:3306, e não no host:porta publicada que o .env descreve.
 * Usar DB_PORT ali daria "connection refused" — foi por isso que isto virou
 * uma função em vez de duas linhas.
 */
export async function detectarFerramentas() {
  const forcarDocker = process.env.BACKUP_VIA_DOCKER === '1';
  const temHost = !forcarDocker && (await existeNoPath('mysqldump')) && (await existeNoPath('mysql'));

  if (temHost) {
    return {
      viaDocker: false,
      descricao: 'mysqldump do host',
      host: process.env.DB_HOST || 'localhost',
      porta: Number(process.env.DB_PORT || 3306),
    };
  }

  return {
    viaDocker: true,
    container: process.env.BACKUP_CONTAINER ?? 'foodexpress_db',
    descricao: `mysqldump dentro do container ${process.env.BACKUP_CONTAINER ?? 'foodexpress_db'}`,
    host: '127.0.0.1',
    porta: Number(process.env.BACKUP_PORTA_INTERNA ?? 3306),
  };
}

// ---------------------------------------------------------------------------
// Credencial em arquivo, não em argumento
// ---------------------------------------------------------------------------

function conteudoCnf(ferramentas) {
  return [
    '[client]',
    `host=${ferramentas.host}`,
    `port=${ferramentas.porta}`,
    `user=${process.env.DB_USER || 'root'}`,
    `password=${process.env.DB_PASSWORD || ''}`,
    'default-character-set=utf8mb4',
    '',
  ].join('\n');
}

/**
 * Deixa a credencial onde a ferramenta vai rodar e devolve como removê-la.
 *
 * No host é um arquivo temporário com permissão 0600. No container o arquivo
 * é criado lá dentro com `umask 077`, porque o conteúdo não pode viajar como
 * argumento de `docker exec` — argumento aparece no `ps` do host.
 */
async function prepararCredencial(ferramentas) {
  const conteudo = conteudoCnf(ferramentas);

  if (!ferramentas.viaDocker) {
    const caminho = join(tmpdir(), `.foodexpress-backup-${process.pid}.cnf`);
    await writeFile(caminho, conteudo, { mode: 0o600 });
    await chmod(caminho, 0o600).catch(() => {});
    return { caminho, limpar: () => rm(caminho, { force: true }) };
  }

  const caminho = `/tmp/.foodexpress-backup-${process.pid}.cnf`;
  await new Promise((resolve, reject) => {
    const p = spawn('docker', ['exec', '-i', ferramentas.container, 'sh', '-c', `umask 077; cat > ${caminho}`]);
    let erro = '';
    p.stderr.on('data', (d) => { erro += d; });
    p.on('error', reject);
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`não foi possível gravar a credencial no container: ${erro}`))));
    p.stdin.end(conteudo);
  });

  return {
    caminho,
    limpar: () =>
      new Promise((resolve) => {
        const p = spawn('docker', ['exec', ferramentas.container, 'rm', '-f', caminho], { stdio: 'ignore' });
        p.on('error', resolve);
        p.on('close', resolve);
      }),
  };
}

/** Monta o comando final, com ou sem docker na frente. */
function montar(ferramentas, binario, args) {
  if (!ferramentas.viaDocker) return { comando: binario, args };
  return { comando: 'docker', args: ['exec', '-i', ferramentas.container, binario, ...args] };
}

// ---------------------------------------------------------------------------
// Criar
// ---------------------------------------------------------------------------

const agoraParaNome = () => new Date().toISOString().replace(/[:.]/g, '-').replace('Z', '');

/**
 * Argumentos do dump, e o motivo de cada um que não é óbvio:
 *
 * --single-transaction  snapshot consistente sem travar as tabelas. O backup
 *                       roda durante o serviço; LOCK TABLES pararia o salão.
 * --no-tablespaces      evita exigir o privilégio PROCESS, que o MySQL 8
 *                       passou a pedir e derruba o dump com um erro que não
 *                       tem nada a ver com backup.
 * sem --databases       o dump não carrega CREATE DATABASE/USE, e por isso
 *                       pode ser restaurado em QUALQUER banco. É o que
 *                       permite a verificação restaurar num descartável em
 *                       vez de em cima do banco real.
 */
const ARGS_DUMP = [
  '--single-transaction',
  '--routines',
  '--triggers',
  '--no-tablespaces',
  '--add-drop-table',
  '--default-character-set=utf8mb4',
];

function executarCapturando(comando, args, { aoSair } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(comando, args);
    let erro = '';
    p.stderr.on('data', (d) => { erro += d; });
    p.on('error', reject);
    p.on('close', (codigo) => {
      if (codigo === 0) return resolve({ erro });
      reject(new Error(`${basename(comando)} saiu com código ${codigo}: ${erro.trim() || 'sem mensagem'}`));
    });
    aoSair?.(p);
  });
}

/** Confere que o arquivo descomprime e termina com a marca do mysqldump. */
async function conferirIntegridade(caminho) {
  let cauda = '';
  let bytes = 0;
  try {
    await pipeline(
      createReadStream(caminho),
      createGunzip(),
      async function* (fonte) {
        for await (const pedaco of fonte) {
          bytes += pedaco.length;
          // Só a cauda interessa, e manter o arquivo inteiro em memória
          // derrubaria o processo num banco grande.
          cauda = (cauda + pedaco.toString('utf8')).slice(-4096);
          yield pedaco;
        }
      },
      async function* (fonte) { for await (const _ of fonte) { /* descarta */ } }
    );
  } catch (erro) {
    // O zlib diz "unexpected end of file" e "incorrect data check". São
    // mensagens de biblioteca; quem está restaurando precisa saber o que
    // aconteceu com o arquivo dele.
    throw new Error(
      `o arquivo está corrompido ou incompleto (${erro.message}) — ` +
      `descomprimiu ${bytes} byte(s) antes de parar`
    );
  }

  if (!cauda.includes(MARCA_FIM)) {
    throw new Error(
      `o dump não termina com "${MARCA_FIM}" — foi truncado (disco cheio ou processo morto no meio)`
    );
  }
  return bytes;
}

export async function criar({ etiqueta } = {}) {
  const banco = bancoPadrao();
  const ferramentas = await detectarFerramentas();
  await mkdir(PASTA, { recursive: true });

  const nome = `${PREFIXO}${agoraParaNome()}${etiqueta ? `-${etiqueta}` : ''}${SUFIXO}`;
  const destino = join(PASTA, nome);
  const parcial = `${destino}.parcial`;

  const credencial = await prepararCredencial(ferramentas);
  try {
    const { comando, args } = montar(ferramentas, 'mysqldump', [
      `--defaults-extra-file=${credencial.caminho}`,
      ...ARGS_DUMP,
      banco,
    ]);

    // O gzip roda aqui no Node: não depender de um gzip externo mantém o
    // script igual no Windows de quem desenvolve e no Linux do servidor.
    const filho = spawn(comando, args);
    let erro = '';
    filho.stderr.on('data', (d) => { erro += d; });

    const saida = createWriteStream(parcial);
    const encerrou = new Promise((resolve, reject) => {
      filho.on('error', reject);
      filho.on('close', (codigo) =>
        codigo === 0 ? resolve() : reject(new Error(`mysqldump falhou (código ${codigo}): ${erro.trim()}`))
      );
    });

    await Promise.all([pipeline(filho.stdout, createGzip({ level: 9 }), saida), encerrou]);

    const bytesSql = await conferirIntegridade(parcial);
    await rename(parcial, destino);

    const { size } = await stat(destino);
    return { arquivo: destino, nome, bytes: size, bytesSql, via: ferramentas.descricao };
  } catch (e) {
    await rm(parcial, { force: true });
    throw e;
  } finally {
    await credencial.limpar();
  }
}

// ---------------------------------------------------------------------------
// Listar e podar
// ---------------------------------------------------------------------------

export async function listar() {
  let nomes;
  try {
    nomes = await readdir(PASTA);
  } catch {
    return [];
  }

  const backups = [];
  for (const nome of nomes) {
    if (!nome.startsWith(PREFIXO) || !nome.endsWith(SUFIXO)) continue;
    const caminho = join(PASTA, nome);
    const info = await stat(caminho);
    backups.push({ nome, caminho, bytes: info.size, criadoEm: info.mtime });
  }
  // Mais recente primeiro: é o que quase toda operação quer.
  return backups.sort((a, b) => b.criadoEm - a.criadoEm);
}

/**
 * Descarta os antigos, com uma trava: nunca derruba os `manterMinimo` mais
 * recentes, seja qual for a idade deles. Um restaurante que fica um mês
 * fechado voltaria sem nenhuma cópia se a regra fosse só de data.
 */
export async function podar({ dias = DIAS_PADRAO, manterMinimo = MINIMO_PADRAO } = {}) {
  const backups = await listar();
  const limite = Date.now() - dias * 24 * 60 * 60 * 1000;
  const candidatos = backups.slice(manterMinimo).filter((b) => b.criadoEm.getTime() < limite);

  for (const b of candidatos) await rm(b.caminho, { force: true });
  return { removidos: candidatos.map((b) => b.nome), restantes: backups.length - candidatos.length };
}

// ---------------------------------------------------------------------------
// Restaurar
// ---------------------------------------------------------------------------

/**
 * Despeja um backup dentro de um banco que já exista.
 *
 * Não cria o banco e não escolhe o destino sozinho: restaurar é destrutivo
 * (o dump tem DROP TABLE), e o destino tem de ser uma decisão explícita de
 * quem chama, não um padrão conveniente.
 */
export async function restaurar({ arquivo, banco }) {
  if (!banco) throw new Error('restaurar() exige o banco de destino');
  const ferramentas = await detectarFerramentas();
  const credencial = await prepararCredencial(ferramentas);

  try {
    const { comando, args } = montar(ferramentas, 'mysql', [
      `--defaults-extra-file=${credencial.caminho}`,
      '--default-character-set=utf8mb4',
      banco,
    ]);

    const filho = spawn(comando, args);
    let erro = '';
    filho.stderr.on('data', (d) => { erro += d; });

    const encerrou = new Promise((resolve, reject) => {
      filho.on('error', reject);
      filho.on('close', (codigo) =>
        codigo === 0 ? resolve() : reject(new Error(`mysql falhou (código ${codigo}): ${erro.trim()}`))
      );
    });

    await Promise.all([
      pipeline(createReadStream(arquivo), createGunzip(), filho.stdin),
      encerrou,
    ]);

    return { banco, arquivo };
  } finally {
    await credencial.limpar();
  }
}

export { executarCapturando, conferirIntegridade, MARCA_FIM, PREFIXO, SUFIXO };
