import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readdir, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync } from 'node:zlib';

/**
 * Backup: o que é testável sem banco.
 *
 * A criação do dump e a restauração precisam de MySQL e são exercitadas por
 * `npm run backup:verificar`. O que está aqui é a parte que decide o que
 * APAGAR e o que aceitar como válido — e é justamente a parte onde um erro
 * passa sem ninguém notar até o dia em que o backup é necessário.
 *
 * O diretório é um temporário próprio: um teste de poda que rodasse sobre a
 * pasta real de backups apagaria backups reais.
 */

const PASTA = await mkdtemp(join(tmpdir(), 'teste-backup-'));
process.env.BACKUP_DIR = PASTA;

// Importado DEPOIS de BACKUP_DIR estar definido: o módulo lê a variável no
// carregamento, e um import estático aqui apontaria para a pasta real.
const { listar, podar, conferirIntegridade } = await import('../../src/infra/persistencia/backup.js');

const DIA = 24 * 60 * 60 * 1000;

/** Cria um arquivo de backup com idade controlada. */
async function backupFalso(nome, diasAtras = 0) {
  const caminho = join(PASTA, nome);
  await writeFile(caminho, gzipSync('-- conteudo\n-- Dump completed on 2026-01-01\n'));
  if (diasAtras) {
    const quando = new Date(Date.now() - diasAtras * DIA);
    await utimes(caminho, quando, quando);
  }
  return caminho;
}

const nomeDe = (n) => `foodexpress-2026-01-${String(n).padStart(2, '0')}T00-00-00-000.sql.gz`;

beforeEach(async () => {
  for (const f of await readdir(PASTA)) await rm(join(PASTA, f), { force: true });
});

after(async () => {
  await rm(PASTA, { recursive: true, force: true });
});

describe('listar', () => {
  test('devolve o mais recente primeiro', async () => {
    await backupFalso(nomeDe(1), 10);
    await backupFalso(nomeDe(2), 2);
    await backupFalso(nomeDe(3), 5);

    const nomes = (await listar()).map((b) => b.nome);

    assert.deepEqual(nomes, [nomeDe(2), nomeDe(3), nomeDe(1)]);
  });

  test('ignora arquivos que não são backup', async () => {
    await backupFalso(nomeDe(1));
    await writeFile(join(PASTA, 'anotacoes.txt'), 'nada a ver');
    await writeFile(join(PASTA, 'foodexpress-2026-01-02T00-00-00-000.sql.gz.parcial'), 'incompleto');

    const nomes = (await listar()).map((b) => b.nome);

    // O .parcial é um dump interrompido. Entrar na lista o faria parecer
    // restaurável, e `verificar` escolheria justamente ele por ser o mais novo.
    assert.deepEqual(nomes, [nomeDe(1)]);
  });

  test('pasta inexistente responde lista vazia, não erro', async () => {
    // Primeira execução numa máquina nova: a pasta ainda não existe, e
    // `npm run backup:listar` tem de explicar isso em vez de estourar.
    await rm(PASTA, { recursive: true, force: true });
    assert.deepEqual(await listar(), []);
    await mkdir(PASTA, { recursive: true });
  });
});

describe('podar', () => {
  test('remove o que passou do prazo', async () => {
    await backupFalso(nomeDe(1), 30);
    await backupFalso(nomeDe(2), 20);
    await backupFalso(nomeDe(3), 1);

    const r = await podar({ dias: 14, manterMinimo: 1 });

    assert.deepEqual(r.removidos.sort(), [nomeDe(1), nomeDe(2)].sort());
    assert.equal(r.restantes, 1);
  });

  test('nunca remove os mais recentes, por velhos que sejam', async () => {
    // Um restaurante fechado um mês voltaria sem cópia nenhuma se a regra
    // fosse só de data. O mínimo é a trava contra ficar sem nada.
    await backupFalso(nomeDe(1), 400);
    await backupFalso(nomeDe(2), 390);
    await backupFalso(nomeDe(3), 380);

    const r = await podar({ dias: 14, manterMinimo: 3 });

    assert.deepEqual(r.removidos, []);
    assert.equal(r.restantes, 3);
    assert.equal((await listar()).length, 3);
  });

  test('o mínimo conta os mais recentes, não qualquer três', async () => {
    await backupFalso(nomeDe(1), 100);
    await backupFalso(nomeDe(2), 90);
    await backupFalso(nomeDe(3), 80);
    await backupFalso(nomeDe(4), 1);

    const r = await podar({ dias: 14, manterMinimo: 2 });

    // Guardados: o de 1 dia e o de 80 dias (os dois mais recentes).
    const restantes = (await listar()).map((b) => b.nome);
    assert.deepEqual(restantes, [nomeDe(4), nomeDe(3)]);
    assert.equal(r.removidos.length, 2);
  });

  test('não remove nada quando tudo está no prazo', async () => {
    await backupFalso(nomeDe(1), 3);
    await backupFalso(nomeDe(2), 1);

    const r = await podar({ dias: 14, manterMinimo: 1 });

    assert.deepEqual(r.removidos, []);
    assert.equal(r.restantes, 2);
  });

  test('pasta vazia não quebra', async () => {
    const r = await podar({ dias: 14, manterMinimo: 3 });
    assert.deepEqual(r.removidos, []);
    assert.equal(r.restantes, 0);
  });
});

describe('conferirIntegridade', () => {
  test('aceita um dump completo', async () => {
    const caminho = join(PASTA, nomeDe(1));
    const sql = '-- MySQL dump\nINSERT INTO X VALUES (1);\n-- Dump completed on 2026-01-01\n';
    await writeFile(caminho, gzipSync(sql));

    const bytes = await conferirIntegridade(caminho);

    assert.equal(bytes, Buffer.byteLength(sql));
  });

  test('recusa gzip truncado', async () => {
    const caminho = join(PASTA, nomeDe(2));
    const inteiro = gzipSync('-- MySQL dump\n'.repeat(500) + '-- Dump completed\n');
    await writeFile(caminho, inteiro.subarray(0, Math.floor(inteiro.length / 2)));

    await assert.rejects(() => conferirIntegridade(caminho), /corrompido ou incompleto/);
  });

  test('recusa dump sem a marca de fim, mesmo com gzip válido', async () => {
    // O caso perigoso: o arquivo descomprime inteiro e parece bom. Sem
    // conferir a marca, restauraria "com sucesso" e sem os dados do fim.
    const caminho = join(PASTA, nomeDe(3));
    await writeFile(caminho, gzipSync('-- MySQL dump\nINSERT INTO X VALUES (1);\n'));

    await assert.rejects(() => conferirIntegridade(caminho), /não termina com "Dump completed"/);
  });

  test('a marca precisa estar no fim, não em qualquer lugar', async () => {
    // Um dado que contenha o texto no meio não pode fazer o arquivo passar.
    const caminho = join(PASTA, nomeDe(4));
    const sql =
      "INSERT INTO LOG VALUES ('Dump completed');\n" + '-- enchimento\n'.repeat(1000);
    await writeFile(caminho, gzipSync(sql));

    await assert.rejects(() => conferirIntegridade(caminho), /não termina com/);
  });
});
