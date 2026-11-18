import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { avancarStatus, montarItens, pendentes, FLUXO } from '../../src/contextos/salao/dominio/Pedido.js';
import { planejarFechamento, garantirAberta } from '../../src/contextos/salao/dominio/Comanda.js';
import { Conflito, EntradaInvalida } from '../../src/compartilhado/dominio/erros.js';

/**
 * Regras do salão, sem nenhuma dependência.
 *
 * Nem dublê é preciso aqui: o domínio é função pura sobre dados. É a camada
 * mais barata de testar e a que guarda as decisões que custaram mais caro.
 */

const cardapio = new Map([
  [1, { id_produto: 1, nome: 'Filé', valor: 62, ativo: 1, disponivel: 1 }],
  [2, { id_produto: 2, nome: 'Suco', valor: 14, ativo: 1, disponivel: 1 }],
  [3, { id_produto: 3, nome: 'Pudim', valor: 18, ativo: 0, disponivel: 1 }],
  [4, { id_produto: 4, nome: 'Risoto', valor: 74, ativo: 1, disponivel: 0 }],
  // Produto de banco sem a migration 004: a coluna não existe.
  [5, { id_produto: 5, nome: 'Antigo', valor: 10, ativo: 1 }],
]);

describe('fluxo da rodada na cozinha', () => {
  test('avança pelas etapas na ordem', () => {
    assert.equal(avancarStatus('enviado', 'em_preparo'), 'em_preparo');
    assert.equal(avancarStatus('em_preparo', 'pronto'), 'pronto');
    assert.equal(avancarStatus('pronto', 'entregue'), 'entregue');
  });

  test('não pula o preparo', () => {
    assert.throws(() => avancarStatus('enviado', 'entregue'), Conflito);
  });

  test('o erro diz quais transições valem', () => {
    try {
      avancarStatus('enviado', 'entregue');
      assert.fail('deveria ter estourado');
    } catch (e) {
      assert.deepEqual(e.dados.permitidos, ['em_preparo', 'cancelado']);
    }
  });

  test('prato entregue não volta nem é cancelado', () => {
    assert.throws(() => avancarStatus('entregue', 'cancelado'), Conflito);
    assert.equal(FLUXO.entregue.length, 0);
  });

  test('status desconhecido estoura em vez de passar calado', () => {
    assert.throws(() => avancarStatus('inventado', 'pronto'), Conflito);
  });
});

describe('preço da rodada', () => {
  test('sai do cardápio, nunca do que o app mandou', () => {
    const { itens } = montarItens(
      [{ idProduto: 1, quantidade: 2, vlUnitario: 0.01 }],
      cardapio
    );
    assert.equal(itens[0].vlUnitario, 62);
    assert.equal(itens[0].vlTotal, 124);
  });

  test('congela o nome do produto no item', () => {
    const { itens } = montarItens([{ idProduto: 1, quantidade: 1 }], cardapio);
    assert.equal(itens[0].nomeProduto, 'Filé');
  });

  test('subtotal soma os itens', () => {
    const { vlSubtotal } = montarItens(
      [{ idProduto: 1, quantidade: 2 }, { idProduto: 2, quantidade: 3 }],
      cardapio
    );
    assert.equal(vlSubtotal, 166);
  });

  test('preserva a observação para a cozinha', () => {
    const { itens } = montarItens([{ idProduto: 1, quantidade: 1, observacao: 'ao ponto' }], cardapio);
    assert.equal(itens[0].observacao, 'ao ponto');
  });

  test('recusa produto fora do cardápio', () => {
    assert.throws(() => montarItens([{ idProduto: 3, quantidade: 1 }], cardapio), /cardápio/);
  });

  test('recusa produto que acabou, com mensagem diferente', () => {
    assert.throws(() => montarItens([{ idProduto: 4, quantidade: 1 }], cardapio), /acabou/);
  });

  /**
   * Regressão: `!produto.disponivel` tratava undefined como falso e recusava
   * TODO pedido num banco sem a migration 004 aplicada.
   */
  test('banco sem a coluna disponivel deixa passar', () => {
    const { itens } = montarItens([{ idProduto: 5, quantidade: 1 }], cardapio);
    assert.equal(itens[0].vlUnitario, 10);
  });

  test('recusa rodada vazia', () => {
    assert.throws(() => montarItens([], cardapio), EntradaInvalida);
  });

  test('recusa quantidade zero ou fracionada', () => {
    assert.throws(() => montarItens([{ idProduto: 1, quantidade: 0 }], cardapio), EntradaInvalida);
    assert.throws(() => montarItens([{ idProduto: 1, quantidade: 1.5 }], cardapio), EntradaInvalida);
  });

  test('recusa produto que não existe', () => {
    assert.throws(() => montarItens([{ idProduto: 99, quantidade: 1 }], cardapio), Conflito);
  });
});

describe('fechamento da comanda', () => {
  const aberta = { id_comanda: 1, status: 'aberta' };
  const rodadas = [
    { id_pedido: 1, status: 'entregue' },
    { id_pedido: 2, status: 'em_preparo' },
    { id_pedido: 3, status: 'cancelado' },
  ];

  test('fecha quando tudo saiu', () => {
    const { aCancelar } = planejarFechamento(aberta, [{ id_pedido: 1, status: 'entregue' }]);
    assert.equal(aCancelar.length, 0);
  });

  test('rodada na cozinha bloqueia por padrão', () => {
    assert.throws(() => planejarFechamento(aberta, rodadas), Conflito);
  });

  test('o bloqueio informa o que está pendente', () => {
    try {
      planejarFechamento(aberta, rodadas);
      assert.fail('deveria ter estourado');
    } catch (e) {
      assert.equal(e.dados.pendentes.length, 1);
      assert.equal(e.dados.pendentes[0].idPedido, 2);
    }
  });

  test('forçar manda cancelar só as pendentes', () => {
    const { aCancelar } = planejarFechamento(aberta, rodadas, { forcar: true });
    assert.deepEqual(aCancelar.map((r) => r.id_pedido), [2]);
  });

  test('comanda já fechada não fecha de novo', () => {
    assert.throws(() => garantirAberta({ status: 'fechada' }), Conflito);
    assert.throws(() => planejarFechamento({ status: 'fechada' }, [], { forcar: true }), Conflito);
  });

  test('cancelada não conta como pendente', () => {
    assert.equal(pendentes(rodadas).length, 1);
  });
});
