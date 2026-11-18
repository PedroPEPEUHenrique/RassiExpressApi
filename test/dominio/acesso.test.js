import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  validarPapel, garantirTrocaDePapel, garantirDesligamento,
} from '../../src/contextos/acesso/dominio/Funcionario.js';
import { escolherVinculo } from '../../src/contextos/acesso/dominio/Sessao.js';
import { Conflito, EntradaInvalida, Proibido } from '../../src/compartilhado/dominio/erros.js';

/**
 * As duas travas de papel existem pela mesma razão: impedir que o restaurante
 * fique trancado para fora do próprio sistema, sem ninguém com poder de
 * destrancar.
 */
describe('travas de papel', () => {
  const eu = { id_funcionario: 1, papel: 'gestor' };
  const outro = { id_funcionario: 2, papel: 'garcom' };
  const outroGestor = { id_funcionario: 3, papel: 'gestor' };

  test('papel fora do enum é recusado', () => {
    assert.throws(() => validarPapel('faxineiro'), EntradaInvalida);
  });

  test('ninguém rebaixa a si mesmo', () => {
    assert.throws(() => garantirTrocaDePapel(eu, 1, 'garcom', 2), /próprio papel/);
  });

  test('mas pode "mudar" para o mesmo papel sem estourar', () => {
    assert.doesNotThrow(() => garantirTrocaDePapel(eu, 1, 'gestor', 2));
  });

  test('promover outra pessoa é livre', () => {
    assert.doesNotThrow(() => garantirTrocaDePapel(outro, 1, 'cozinha', 2));
  });

  test('o último gestor não deixa de ser gestor', () => {
    assert.throws(() => garantirTrocaDePapel(outroGestor, 1, 'garcom', 1), /único gestor/);
  });

  test('com dois gestores, rebaixar um é permitido', () => {
    assert.doesNotThrow(() => garantirTrocaDePapel(outroGestor, 1, 'garcom', 2));
  });

  test('ninguém se desliga sozinho', () => {
    assert.throws(() => garantirDesligamento(eu, 1, 2), /a si mesmo/);
  });

  test('o último gestor não é desligado', () => {
    assert.throws(() => garantirDesligamento(outroGestor, 1, 1), /único gestor/);
  });

  test('desligar um garçom não depende da contagem de gestores', () => {
    assert.doesNotThrow(() => garantirDesligamento(outro, 1, 1));
  });
});

describe('escolha do vínculo no login', () => {
  const cantina = { id_funcionario: 11, id_empresa: 1, papel: 'gestor', nome_empresa: 'Cantina' };
  const esquina = { id_funcionario: 12, id_empresa: 2, papel: 'garcom', nome_empresa: 'Esquina' };

  /** Senha correta não basta: sem vínculo ativo não há token a emitir. */
  test('sem vínculo ativo, não entra', () => {
    assert.throws(() => escolherVinculo([], undefined), Proibido);
  });

  test('vínculo único entra direto', () => {
    assert.equal(escolherVinculo([cantina], undefined).id_empresa, 1);
  });

  test('vários vínculos pedem escolha', () => {
    assert.throws(() => escolherVinculo([cantina, esquina], undefined), Conflito);
  });

  test('a recusa devolve a lista para o app perguntar', () => {
    try {
      escolherVinculo([cantina, esquina], undefined);
      assert.fail('deveria ter estourado');
    } catch (e) {
      assert.equal(e.dados.empresas.length, 2);
      assert.equal(e.dados.empresas[0].nome, 'Cantina');
    }
  });

  test('escolha válida seleciona o vínculo certo', () => {
    assert.equal(escolherVinculo([cantina, esquina], 2).id_funcionario, 12);
  });

  test('escolher restaurante sem vínculo é proibido', () => {
    assert.throws(() => escolherVinculo([cantina, esquina], 99), Proibido);
  });
});
