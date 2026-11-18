import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  montarResumo, validarLancamento, garantirPodeFechar, validarAbertura,
} from '../../src/contextos/financeiro/dominio/Caixa.js';
import {
  planejarMovimento, calcularConsumo, calcularMargem, validarUnidade,
} from '../../src/contextos/estoque/dominio/Estoque.js';
import { Conflito, EntradaInvalida } from '../../src/compartilhado/dominio/erros.js';

describe('resumo do caixa', () => {
  const totais = {
    vendas: 166, vendas_externas: 80, suprimentos: 0,
    despesas: 0, sangrias: 80, saldo_movimentos: 166, movimentos: 3,
  };

  test('saldo esperado é abertura mais movimentos', () => {
    const r = montarResumo({ vl_abertura: 200, vl_informado: null }, totais);
    assert.equal(r.vlEsperado, 366);
  });

  test('turno aberto não tem diferença ainda', () => {
    const r = montarResumo({ vl_abertura: 200, vl_informado: null }, totais);
    assert.equal(r.vlDiferenca, null);
  });

  test('quebra de caixa é registrada, não escondida', () => {
    const r = montarResumo({ vl_abertura: 200, vl_informado: 362 }, totais);
    assert.equal(r.vlDiferenca, -4);
  });

  test('sobra aparece positiva', () => {
    const r = montarResumo({ vl_abertura: 200, vl_informado: 370 }, totais);
    assert.equal(r.vlDiferenca, 4);
  });
});

describe('lançamento manual no caixa', () => {
  test('aceita os quatro tipos manuais', () => {
    for (const tipo of ['venda_externa', 'despesa', 'sangria', 'suprimento']) {
      assert.doesNotThrow(() => validarLancamento({ tipo, valor: 10 }));
    }
  });

  /** Venda de mesa entra sozinha no fechamento; lançar à mão duplicaria. */
  test('recusa venda de mesa com mensagem explicativa', () => {
    assert.throws(() => validarLancamento({ tipo: 'venda', valor: 10 }), /fechamento da comanda/);
  });

  test('recusa valor zero ou negativo', () => {
    assert.throws(() => validarLancamento({ tipo: 'despesa', valor: 0 }), EntradaInvalida);
    assert.throws(() => validarLancamento({ tipo: 'despesa', valor: -5 }), EntradaInvalida);
  });

  test('recusa abertura negativa', () => {
    assert.throws(() => validarAbertura(-1), EntradaInvalida);
  });
});

describe('fechamento do caixa', () => {
  const aberto = { status: 'aberto' };

  test('fecha sem mesa aberta', () => {
    assert.doesNotThrow(() => garantirPodeFechar(aberto, 100, 0));
  });

  /** Essas vendas cairiam no turno seguinte e o caixa fecharia com buraco. */
  test('mesa aberta trava o fechamento', () => {
    assert.throws(() => garantirPodeFechar(aberto, 100, 2), Conflito);
  });

  test('forçar passa por cima', () => {
    assert.doesNotThrow(() => garantirPodeFechar(aberto, 100, 2, { forcar: true }));
  });

  test('caixa já fechado não fecha de novo', () => {
    assert.throws(() => garantirPodeFechar({ status: 'fechado' }, 100, 0), Conflito);
  });
});

describe('movimento de estoque', () => {
  const insumo = { qtd_atual: 10, vl_custo_medio: 30 };

  test('entrada soma ao saldo e recalcula custo', () => {
    const p = planejarMovimento({ tipo: 'entrada', quantidade: 5, vlUnitario: 40 }, insumo);
    assert.equal(p.variacao, 5);
    assert.equal(p.recalcularCusto, true);
  });

  test('perda subtrai e não mexe no custo', () => {
    const p = planejarMovimento({ tipo: 'perda', quantidade: 2 }, insumo);
    assert.equal(p.variacao, -2);
    assert.equal(p.recalcularCusto, false);
  });

  /** Contagem física corrige o sistema: somar exigiria cálculo de cabeça. */
  test('ajuste DEFINE o saldo em vez de somar', () => {
    const p = planejarMovimento({ tipo: 'ajuste', quantidade: 7 }, insumo);
    assert.equal(p.variacao, -3);
  });

  test('entrada sem custo unitário é recusada', () => {
    assert.throws(() => planejarMovimento({ tipo: 'entrada', quantidade: 5 }, insumo), EntradaInvalida);
  });

  test('saída de venda não se lança à mão', () => {
    assert.throws(() => planejarMovimento({ tipo: 'saida_venda', quantidade: 1 }, insumo), EntradaInvalida);
  });

  test('unidade fora da lista é recusada', () => {
    assert.throws(() => validarUnidade('arroba'), EntradaInvalida);
    assert.equal(validarUnidade('kg'), 'kg');
  });
});

describe('consumo pela ficha técnica', () => {
  const fichas = [
    { id_produto: 1, id_insumo: 10, quantidade: 0.25, vl_custo_medio: 35 },
    { id_produto: 1, id_insumo: 11, quantidade: 0.05, vl_custo_medio: 40 },
    { id_produto: 2, id_insumo: 10, quantidade: 0.1, vl_custo_medio: 35 },
  ];

  test('multiplica a receita pela quantidade vendida', () => {
    const c = calcularConsumo([{ idProduto: 1, quantidade: 4 }], fichas);
    assert.equal(c.get(10).quantidade, 1);
    assert.equal(c.get(11).quantidade, 0.2);
  });

  /** Dois pratos com o mesmo insumo viram um movimento só. */
  test('agrega o mesmo insumo de pratos diferentes', () => {
    const c = calcularConsumo(
      [{ idProduto: 1, quantidade: 2 }, { idProduto: 2, quantidade: 3 }],
      fichas
    );
    assert.equal(c.get(10).quantidade, 0.8); // 0,25×2 + 0,1×3
    assert.equal(c.size, 2);
  });

  /** Ficha é opcional por desenho: sem ela o restaurante usa o sistema igual. */
  test('produto sem ficha não movimenta nada', () => {
    const c = calcularConsumo([{ idProduto: 99, quantidade: 5 }], fichas);
    assert.equal(c.size, 0);
  });
});

describe('margem do prato', () => {
  test('custo é a soma da ficha', () => {
    const m = calcularMargem(62, [
      { quantidade: 0.25, vl_custo_medio: 35 },
      { quantidade: 0.05, vl_custo_medio: 40 },
    ]);
    assert.equal(m.vlCusto, 10.75);
    assert.equal(m.vlMargem, 51.25);
  });

  /** Sem receita o custo é desconhecido, não zero — zero viraria 100%. */
  test('sem ficha a margem é null, não 100%', () => {
    const m = calcularMargem(62, []);
    assert.equal(m.vlCusto, 0);
    assert.equal(m.vlMargem, null);
    assert.equal(m.percMargem, null);
  });
});
