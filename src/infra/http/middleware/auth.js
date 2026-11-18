/**
 * Autenticação e autorização na borda HTTP.
 *
 * `autenticar` é construído com suas dependências em vez de importar jwt e o
 * banco direto. Isso existe por uma razão concreta, não por estilo: ele
 * precisa consultar se o vínculo do funcionário ainda está ativo, e um
 * middleware que alcança o banco por conta própria não é testável nem
 * substituível.
 */

/**
 * @param {object} deps
 * @param {{ ler: (t: string) => object }} deps.emissorDeToken
 * @param {{ estaAtivo: (idFuncionario: number) => Promise<boolean> }} deps.consultaDeVinculo
 */
function criarAutenticar({ emissorDeToken, consultaDeVinculo }) {
  return async function autenticar(req, res, next) {
    const header = req.headers.authorization || '';
    const [esquema, token] = header.split(' ');

    if (esquema !== 'Bearer' || !token) {
      return next({ status: 401, mensagem: 'Token de acesso não informado' });
    }

    let payload;
    try {
      payload = emissorDeToken.ler(token);
    } catch {
      return next({ status: 401, mensagem: 'Token inválido ou expirado' });
    }

    // Token emitido antes dos papéis existirem não carrega empresa nem papel.
    // Recusar aqui é essencial: sem isso, autorizarPapel compararia contra
    // undefined e um token antigo passaria por rotas que exigem papel.
    if (!payload.idEmpresa || !payload.papel || !payload.idFuncionario) {
      return next({ status: 401, mensagem: 'Sessão desatualizada. Faça login novamente.' });
    }

    /**
     * O vínculo ainda vale?
     *
     * Sem esta consulta, desligar alguém só impedia NOVOS logins: o token que
     * a pessoa já tinha continuava válido por até sete dias. O gestor
     * acreditava ter cortado o acesso de quem demitiu às 14h e não tinha.
     *
     * É uma busca por chave primária, no mesmo banco que a requisição já vai
     * consultar — custo marginal. Se um dia pesar, o lugar de resolver é um
     * cache de poucos segundos aqui; qualquer janela de cache é exatamente o
     * atraso com que a revogação passa a valer.
     */
    let ativo;
    try {
      ativo = await consultaDeVinculo.estaAtivo(payload.idFuncionario);
    } catch (erro) {
      return next(erro);
    }

    if (!ativo) {
      return next({ status: 401, mensagem: 'Seu acesso a este restaurante foi encerrado.' });
    }

    req.usuario = {
      id: payload.id,
      email: payload.email,
      idEmpresa: payload.idEmpresa,
      idFuncionario: payload.idFuncionario,
      papel: payload.papel,
    };
    next();
  };
}

// Garante que o usuário do token é o dono do recurso. Vale para o próprio
// cadastro ("meu perfil"); acesso a dado do restaurante usa escopoEmpresa.
const autorizarProprietario = (param) => (req, res, next) => {
  if (Number(req.params[param]) !== req.usuario.id) {
    return next({ status: 403, mensagem: 'Acesso negado a recurso de outro usuário' });
  }
  next();
};

// Restringe a rota a determinados papéis. Ex.: autorizarPapel("gestor") no
// cadastro de cardápio, autorizarPapel("cozinha", "gestor") na fila da cozinha.
const autorizarPapel = (...papeis) => (req, res, next) => {
  if (!papeis.includes(req.usuario.papel)) {
    return next({ status: 403, mensagem: 'Seu perfil não tem permissão para esta operação' });
  }
  next();
};

// Barra o acesso a dados de outro restaurante quando o id da empresa vem pela
// URL. Para operações que não recebem esse id, o valor correto é sempre
// req.usuario.idEmpresa — nunca o corpo da requisição, que o cliente controla.
const escopoEmpresa = (param = 'idEmpresa') => (req, res, next) => {
  if (Number(req.params[param]) !== req.usuario.idEmpresa) {
    return next({ status: 403, mensagem: 'Acesso negado a dados de outro restaurante' });
  }
  next();
};

export { criarAutenticar, autorizarProprietario, autorizarPapel, escopoEmpresa };
