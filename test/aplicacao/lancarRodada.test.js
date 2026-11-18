import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { LancarRodada } from '../../src/contextos/salao/aplicacao/casosRodada.js';
import { UnidadeDeTrabalhoFalsa, erroDuplicado } from '../ajuda/dubles.js';

/**
 * O caso de uso mais crítico do sistema: é onde o dinheiro é calculado e onde
 * a idempotência protege a cozinha de fazer o prato duas vezes.
 *
 * Note que não há banco nem Express aqui — só objetos passados no construtor.
 * Antes da Clean Architecture este teste precisaria substituir métodos em
 * módulos importados; agora é montagem direta.
 */

const PRODUTOS = [
  { id_produto: 1, id_empresa: 1, nome: 'Filé', valor: 62, ativo: 1, disponivel: 1 },
  { id_produto: 2, id_empresa: 1, nome: 'Suco', valor: 14, ativo: 1, disponivel: 1 },
];

function montar({ comanda, rodadaExistente = null, criarEstoura = null } = {}) {
  const gravados = { rodada: null, itens: [], recalculos: [], baixas: [] };

  const repoRodada = {
    async porIdLocal() { return rodadaExistente; },
    async porId(id) { return { id_pedido: Number(id), id_empresa: 1, id_comanda: 100, status: 'enviado' }; },
    async criar(r) {
      if (criarEstoura) throw criarEstoura;
      gravados.rodada = r;
      return 777;
    },
    async criarItem(i) { gravados.itens.push(i); return gravados.itens.length; },
    async itensDaRodada() { return gravados.itens; },
  };

  const repoComanda = {
    async porId() { return comanda ?? { id_comanda: 100, id_empresa: 1, status: 'aberta' }; },
    async recalcularTotal(id) { gravados.recalculos.push(Number(id)); return 1; },
  };

  const cardapioConsulta = {
    async porIds(ids, idEmpresa) {
      return PRODUTOS.filter((p) => ids.includes(p.id_produto) && p.id_empresa === Number(idEmpresa));
    },
  };

  const baixaDeEstoque = {
    async baixarPorRodada(itens, idPedido) { gravados.baixas.push({ itens, idPedido }); return { baixas: 1 }; },
  };

  const unidadeDeTrabalho = new UnidadeDeTrabalhoFalsa();
  const caso = new LancarRodada({ repoRodada, repoComanda, cardapioConsulta, baixaDeEstoque, unidadeDeTrabalho });
  return { caso, gravados, unidadeDeTrabalho };
}

const entrada = (extra = {}) => ({
  idComanda: 100,
  itens: [{ idProduto: 1, quantidade: 2, observacao: 'ao ponto' }, { idProduto: 2, quantidade: 3 }],
  idEmpresa: 1,
  idFuncionarioAutor: 55,
  ...extra,
});

describe('lançar rodada', () => {
  test('grava a rodada com o total calculado no servidor', async () => {
    const { caso, gravados } = montar();
    await caso.executar(entrada());
    assert.equal(gravados.rodada.vlSubtotal, 166);
    assert.equal(gravados.rodada.vlTotal, 166);
  });

  test('registra quem lançou, a partir do token', async () => {
    const { caso, gravados } = montar();
    await caso.executar(entrada());
    assert.equal(gravados.rodada.idFuncionario, 55);
  });

  test('grava um item por linha, com preço do cardápio', async () => {
    const { caso, gravados } = montar();
    await caso.executar(entrada());
    assert.equal(gravados.itens.length, 2);
    assert.equal(gravados.itens[0].vlUnitario, 62);
    assert.equal(gravados.itens[0].nomeProduto, 'Filé');
  });

  test('recalcula o total da comanda', async () => {
    const { caso, gravados } = montar();
    await caso.executar(entrada());
    assert.deepEqual(gravados.recalculos, [100]);
  });

  test('baixa o estoque na mesma operação', async () => {
    const { caso, gravados } = montar();
    await caso.executar(entrada());
    assert.equal(gravados.baixas.length, 1);
    assert.equal(gravados.baixas[0].idPedido, 777);
  });

  /** Uma rodada pela metade deixaria a conta da mesa errada. */
  test('tudo acontece dentro de uma transação', async () => {
    const { caso, unidadeDeTrabalho } = montar();
    await caso.executar(entrada());
    assert.ok(unidadeDeTrabalho.commitou);
  });

  test('comanda fechada recusa o lançamento', async () => {
    const { caso } = montar({ comanda: { id_comanda: 100, id_empresa: 1, status: 'fechada' } });
    await assert.rejects(() => caso.executar(entrada()), /fechada/);
  });

  test('comanda de outro restaurante não é encontrada', async () => {
    const { caso } = montar({ comanda: { id_comanda: 100, id_empresa: 2, status: 'aberta' } });
    await assert.rejects(() => caso.executar(entrada()), /não encontrada/);
  });

  test('produto de outro restaurante não é precificado', async () => {
    const { caso } = montar();
    await assert.rejects(
      () => caso.executar(entrada({ itens: [{ idProduto: 99, quantidade: 1 }] })),
      /não encontrado no cardápio/
    );
  });
});

describe('idempotência do reenvio', () => {
  const JA_GRAVADA = { id_pedido: 555, id_empresa: 1, id_comanda: 100, status: 'enviado', id_local: 'uuid-1' };

  /**
   * Se a rede cair depois do servidor gravar mas antes da resposta chegar, o
   * garçom reenvia. Sem esta garantia o prato sairia duas vezes — pior do que
   * não ter reenvio nenhum.
   */
  test('reenvio devolve a MESMA rodada', async () => {
    const { caso } = montar({ rodadaExistente: JA_GRAVADA });
    const r = await caso.executar(entrada({ idLocal: 'uuid-1' }));
    assert.equal(r.id_pedido, 555);
  });

  test('reenvio não grava nada de novo', async () => {
    const { caso, gravados, unidadeDeTrabalho } = montar({ rodadaExistente: JA_GRAVADA });
    await caso.executar(entrada({ idLocal: 'uuid-1' }));
    assert.equal(gravados.rodada, null);
    assert.equal(gravados.itens.length, 0);
    assert.equal(unidadeDeTrabalho.diario.length, 0, 'nem abre transação');
  });

  /** Dois envios ao mesmo tempo: o índice único do banco barra o segundo. */
  test('corrida — o índice único barra e devolve a existente', async () => {
    let jaTentou = false;
    const { caso } = montar({ criarEstoura: erroDuplicado() });
    caso.repoRodada.porIdLocal = async () => (jaTentou ? JA_GRAVADA : ((jaTentou = true), null));

    const r = await caso.executar(entrada({ idLocal: 'uuid-1' }));
    assert.equal(r.id_pedido, 555);
  });

  test('reenvio de outro restaurante é recusado', async () => {
    const { caso } = montar({ rodadaExistente: { ...JA_GRAVADA, id_empresa: 2 } });
    await assert.rejects(() => caso.executar(entrada({ idLocal: 'uuid-1' })), /já utilizado/);
  });
});
