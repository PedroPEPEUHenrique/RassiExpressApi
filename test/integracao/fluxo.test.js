import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import 'dotenv/config';

/**
 * Integração: o fluxo de uma noite contra o MySQL de verdade.
 *
 * Os testes de unidade provam a regra; este prova o encanamento — índice
 * único, coluna gerada, transação, agregação. Foram exatamente essas as
 * coisas que os dublês não pegaram: o ON DELETE CASCADE recusado pelo MySQL
 * em coluna-base de coluna gerada, e o LIMIT que não aceita placeholder.
 *
 * Pula sozinho sem banco, para `npm test` continuar servindo em máquina sem
 * Docker em vez de falhar por um motivo que não é o código.
 */

process.env.JWT_SECRET ??= 'segredo-de-integracao';

/**
 * A detecção do banco acontece no TOPO do módulo, com await de primeiro
 * nível — não num `before`.
 *
 * `describe` registra os testes assim que o módulo carrega, antes de qualquer
 * hook rodar. Decidir o `skip` dentro de `before` chegava tarde: a flag ainda
 * era falsa no registro e a suíte inteira se marcava como pulada mesmo com o
 * MySQL no ar.
 */
const { pool } = await import('../../src/infra/persistencia/mysql.js');

const temBanco = await (async () => {
  try {
    const conexao = await pool.getConnection();
    await conexao.ping();
    conexao.release();
    return true;
  } catch {
    return false;
  }
})();

let base;
let servidor;

before(async () => {
  if (!temBanco) return;
  const { criarApp } = await import('../../src/main/app.js');
  servidor = criarApp().listen(0);
  base = `http://127.0.0.1:${servidor.address().port}`;
});

after(async () => {
  servidor?.close();
  await pool.end();
});

async function req(metodo, caminho, { token, corpo, origin } = {}) {
  const h = {};
  if (token) h.Authorization = `Bearer ${token}`;
  if (corpo) h['Content-Type'] = 'application/json';
  if (origin) h.Origin = origin;
  const r = await fetch(base + caminho, {
    method: metodo, headers: h, body: corpo ? JSON.stringify(corpo) : undefined,
  });
  let body = null;
  try { body = await r.json(); } catch { /* 204 não tem corpo */ }
  return { status: r.status, body, headers: r.headers };
}

async function entrar(email, senha) {
  const r = await req('POST', '/usuarios/login', { corpo: { email, senha } });
  assert.equal(r.status, 200, `login de ${email}: ${JSON.stringify(r.body)}`);
  return r.body.token;
}

const pular = () => ({ skip: temBanco ? false : 'sem MySQL — suba o docker compose' });

describe('fluxo do salão contra o banco', () => {
  test('o ciclo de uma mesa, do pedido ao caixa', pular(), async () => {
    const garcom = await entrar('garcom@rassi.com', 'garcom123');
    const gestor = await entrar('gestor@rassi.com', 'gestor123');

    // --- salão ---
    const salao = await req('GET', '/mesas', { token: garcom });
    assert.equal(salao.status, 200);
    const livre = salao.body.find((m) => !m.ocupada);
    assert.ok(livre, 'precisa de uma mesa livre; rode npm run seed');

    const abertura = await req('POST', '/comandas', { token: garcom, corpo: { idMesa: livre.idMesa } });
    assert.equal(abertura.status, 201);
    const idComanda = abertura.body.id_comanda;

    // Unicidade garantida pelo índice do banco, não pela aplicação.
    const duplicada = await req('POST', '/comandas', { token: garcom, corpo: { idMesa: livre.idMesa } });
    assert.equal(duplicada.status, 409);

    // --- rodada: preço do servidor e idempotência ---
    const cardapio = (await req('GET', '/produtos/empresa/1', { token: garcom })).body;
    const prato = cardapio[0];
    const idLocal = `teste-${Date.now()}`;

    const rodada = await req('POST', `/comandas/${idComanda}/pedidos`, {
      token: garcom,
      corpo: { idLocal, itens: [{ idProduto: prato.id_produto, quantidade: 2 }] },
    });
    assert.equal(rodada.status, 201);
    assert.equal(Number(rodada.body.vl_total), Number(prato.valor) * 2);

    const reenvio = await req('POST', `/comandas/${idComanda}/pedidos`, {
      token: garcom,
      corpo: { idLocal, itens: [{ idProduto: prato.id_produto, quantidade: 2 }] },
    });
    assert.equal(reenvio.body.id_pedido, rodada.body.id_pedido, 'reenvio deve devolver a mesma rodada');

    const comanda = await req('GET', `/comandas/${idComanda}`, { token: garcom });
    assert.equal(Number(comanda.body.vl_total), Number(prato.valor) * 2, 'a conta não pode dobrar');

    // --- cozinha ---
    const idPedido = rodada.body.id_pedido;
    assert.equal((await req('PATCH', `/pedidos/${idPedido}/status`, { token: garcom, corpo: { status: 'entregue' } })).status, 409);
    assert.equal((await req('PATCH', `/pedidos/${idPedido}/status`, { token: garcom, corpo: { status: 'em_preparo' } })).status, 200);
    assert.equal((await req('PATCH', `/pedidos/${idPedido}/status`, { token: garcom, corpo: { status: 'pronto' } })).status, 200);
    assert.equal((await req('PATCH', `/pedidos/${idPedido}/status`, { token: garcom, corpo: { status: 'entregue' } })).status, 200);

    // --- caixa: a venda entra sozinha no fechamento ---
    let caixa = await req('GET', '/caixa', { token: gestor });
    if (caixa.body === null) {
      assert.equal((await req('POST', '/caixa', { token: gestor, corpo: { vlAbertura: 100 } })).status, 201);
    }
    const antes = (await req('GET', '/caixa', { token: gestor })).body.resumo.vendas;

    assert.equal((await req('PATCH', `/comandas/${idComanda}/fechar`, { token: garcom, corpo: {} })).status, 200);

    const depois = (await req('GET', '/caixa', { token: gestor })).body.resumo.vendas;
    assert.equal(depois - antes, Number(prato.valor) * 2, 'a venda da mesa entra no caixa ao fechar');

    const salaoDepois = await req('GET', '/mesas', { token: garcom });
    assert.equal(salaoDepois.body.find((m) => m.idMesa === livre.idMesa).ocupada, false);
  });

  test('isolamento entre restaurantes', pular(), async () => {
    const outro = await entrar('gestor2@rassi.com', 'gestor123');
    assert.equal((await req('GET', '/produtos/empresa/1', { token: outro })).status, 403);
    assert.equal((await req('GET', '/cozinha/fila', { token: outro })).body.length, 0);
    assert.equal((await req('GET', '/insumos', { token: outro })).body.length, 0);
  });

  test('CORS: app nativo passa, origem desconhecida não', pular(), async () => {
    const gestor = await entrar('gestor@rassi.com', 'gestor123');
    assert.equal((await req('GET', '/mesas', { token: gestor })).status, 200);
    assert.equal((await req('GET', '/mesas', { token: gestor, origin: 'https://malicioso.com' })).status, 403);
  });

  test('papéis são respeitados ponta a ponta', pular(), async () => {
    const garcom = await entrar('garcom@rassi.com', 'garcom123');
    const cozinha = await entrar('cozinha@rassi.com', 'cozinha123');
    assert.equal((await req('GET', '/relatorios/painel', { token: garcom })).status, 403);
    assert.equal((await req('POST', '/comandas', { token: cozinha, corpo: { idMesa: 1 } })).status, 403);
  });
});
