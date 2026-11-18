import {
  ErroDominio, NaoEncontrado, EntradaInvalida, Conflito, NaoAutenticado, Proibido,
} from '../../compartilhado/dominio/erros.js';

/**
 * Traduz erro de domínio em resposta HTTP.
 *
 * Este é o único lugar do sistema que sabe o que 404, 409 ou 422 significam.
 * Antes, cada service lançava `{ status: 409 }` e a regra de negócio
 * carregava conhecimento de protocolo web — trocar Express por outra coisa
 * exigiria varrer doze arquivos de regra.
 */
const STATUS_POR_ERRO = new Map([
  [NaoEncontrado, 404],
  [EntradaInvalida, 400],
  [Conflito, 409],
  [NaoAutenticado, 401],
  [Proibido, 403],
]);

function statusDe(erro) {
  if (erro instanceof ErroDominio) {
    for (const [Classe, status] of STATUS_POR_ERRO) {
      if (erro instanceof Classe) return status;
    }
    return 400;
  }
  // Erros com status explícito vêm dos middlewares de borda (autenticação,
  // validação de corpo, CORS, limite de requisição) — esses nascem no mundo
  // HTTP e já falam a língua dele.
  if (typeof erro?.status === 'number') return erro.status;
  return 500;
}

function errorHandler(err, req, res, _next) {
  const status = statusDe(err);
  const mensagem = err?.mensagem || (status === 500 ? 'Erro interno do servidor' : err?.message) || 'Erro';

  // Erros 4xx são previstos e não poluem o log. Um 5xx é defeito: precisa do
  // stack para investigação, mas o cliente continua recebendo só a mensagem
  // genérica.
  if (status >= 500) console.error(`[${req.method} ${req.originalUrl}]`, err);

  const corpo = { mensagem };
  // Alguns erros levam dado junto para o cliente agir: a lista de
  // restaurantes no login múltiplo, as rodadas pendentes no fechamento.
  if (err?.dados !== undefined) corpo.dados = err.dados;

  res.status(status).json(corpo);
}

export { errorHandler, statusDe };
