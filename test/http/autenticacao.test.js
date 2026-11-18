import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { criarAutenticar, autorizarPapel, escopoEmpresa, autorizarProprietario }
  from '../../src/infra/http/middleware/auth.js';
import { NaoAutenticado } from '../../src/compartilhado/dominio/erros.js';

/**
 * Autenticação e autorização na borda.
 *
 * Sem jsonwebtoken e sem banco: o middleware recebe o leitor de token e a
 * consulta de vínculo pelo construtor, então o teste passa dublês.
 */

const TOKEN_VALIDO = {
  id: 7, email: 'a@b.com', idEmpresa: 3, idFuncionario: 11, papel: 'garcom',
};

function montar({ payload = TOKEN_VALIDO, ativo = true, lerEstoura = false } = {}) {
  const emissorDeToken = {
    ler(token) {
      if (lerEstoura || token === 'ruim') throw new NaoAutenticado('Token inválido ou expirado');
      return payload;
    },
  };
  const consultas = [];
  const consultaDeVinculo = {
    async estaAtivo(id) { consultas.push(id); return ativo; },
  };
  return { autenticar: criarAutenticar({ emissorDeToken, consultaDeVinculo }), consultas };
}

/** Roda o middleware e devolve o status do erro, ou 'ok'. */
async function roda(mw, req) {
  let resultado = 'ok';
  await mw(req, {}, (err) => { if (err) resultado = err.status ?? err; });
  return resultado;
}

const comToken = (t = 'bom') => ({ headers: { authorization: `Bearer ${t}` } });

describe('autenticar', () => {
  test('sem cabeçalho não passa', async () => {
    const { autenticar } = montar();
    assert.equal(await roda(autenticar, { headers: {} }), 401);
  });

  test('esquema errado não passa', async () => {
    const { autenticar } = montar();
    assert.equal(await roda(autenticar, { headers: { authorization: 'Basic bom' } }), 401);
  });

  test('token ilegível não passa', async () => {
    const { autenticar } = montar();
    assert.equal(await roda(autenticar, comToken('ruim')), 401);
  });

  /** Token anterior aos papéis compararia contra undefined em autorizarPapel. */
  test('token sem empresa, papel ou funcionário é recusado', async () => {
    for (const faltando of ['idEmpresa', 'papel', 'idFuncionario']) {
      const payload = { ...TOKEN_VALIDO, [faltando]: undefined };
      const { autenticar } = montar({ payload });
      assert.equal(await roda(autenticar, comToken()), 401, `faltando ${faltando}`);
    }
  });

  test('token bom com vínculo ativo passa', async () => {
    const { autenticar } = montar();
    assert.equal(await roda(autenticar, comToken()), 'ok');
  });

  test('preenche req.usuario a partir do token', async () => {
    const { autenticar } = montar();
    const req = comToken();
    await roda(autenticar, req);
    assert.deepEqual(req.usuario, {
      id: 7, email: 'a@b.com', idEmpresa: 3, idFuncionario: 11, papel: 'garcom',
    });
  });
});

describe('revogação de acesso', () => {
  /**
   * A falha que isto fecha: `autenticar` só verificava a assinatura do token.
   * Desligar alguém impedia novos logins, mas o token que a pessoa já tinha
   * seguia valendo por até sete dias — o gestor achava que havia cortado o
   * acesso de quem demitiu e não havia.
   */
  test('funcionário desligado perde o acesso na requisição seguinte', async () => {
    const { autenticar } = montar({ ativo: false });
    assert.equal(await roda(autenticar, comToken()), 401);
  });

  test('a mensagem explica que o acesso foi encerrado, não que o token é inválido', async () => {
    const { autenticar } = montar({ ativo: false });
    let msg;
    await autenticar(comToken(), {}, (err) => { msg = err.mensagem; });
    assert.match(msg, /encerrado/i);
  });

  test('a verificação consulta o vínculo do token, não outro', async () => {
    const { autenticar, consultas } = montar();
    await roda(autenticar, comToken());
    assert.deepEqual(consultas, [11]);
  });

  test('toda requisição autenticada verifica — não só o login', async () => {
    const { autenticar, consultas } = montar();
    await roda(autenticar, comToken());
    await roda(autenticar, comToken());
    assert.equal(consultas.length, 2);
  });
});

describe('autorização', () => {
  const req = (extra = {}) => ({ usuario: { id: 7, idEmpresa: 3, papel: 'garcom' }, ...extra });

  test('papel insuficiente leva 403', async () => {
    assert.equal(await roda(autorizarPapel('gestor'), req()), 403);
  });

  test('papel correto passa', async () => {
    assert.equal(await roda(autorizarPapel('garcom'), req()), 'ok');
    assert.equal(await roda(autorizarPapel('gestor', 'garcom'), req()), 'ok');
  });

  test('escopo barra dados de outro restaurante', async () => {
    assert.equal(await roda(escopoEmpresa(), req({ params: { idEmpresa: '99' } })), 403);
    assert.equal(await roda(escopoEmpresa(), req({ params: { idEmpresa: '3' } })), 'ok');
  });

  test('proprietário barra recurso de outro usuário', async () => {
    assert.equal(await roda(autorizarProprietario('idUsuario'), req({ params: { idUsuario: '8' } })), 403);
    assert.equal(await roda(autorizarProprietario('idUsuario'), req({ params: { idUsuario: '7' } })), 'ok');
  });
});
