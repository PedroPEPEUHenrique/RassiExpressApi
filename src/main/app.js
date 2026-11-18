import express from 'express';
import corsConfigurado from '../infra/http/middleware/cors.js';
import { limiteGlobal } from '../infra/http/middleware/rateLimit.js';
import { errorHandler } from '../infra/http/mapearErro.js';
import { montarContainer } from './container.js';
import { montarRotas } from './rotas.js';

/**
 * Monta o aplicativo — sem escutar porta.
 *
 * Separado de servidor.js de propósito: enquanto o `listen` morava no mesmo
 * módulo, importar `criarApp` num teste subia um servidor de verdade na porta
 * 3001 e o processo nunca encerrava. Efeito colateral no topo de módulo é o
 * tipo de coisa que só aparece quando alguém tenta testar.
 */
function criarApp() {
  const app = express();

  /**
   * Quantos proxies existem na frente da API.
   *
   * Sem isso, atrás de nginx toda requisição chega com o IP do proxy e o
   * limite por IP conta o tráfego do mundo inteiro numa chave só. O padrão é
   * 0 porque confiar em X-Forwarded-For sem necessidade é pior: o cabeçalho é
   * forjável e qualquer cliente trocaria de IP a cada requisição.
   */
  app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 0));

  // CORS antes do limite: o preflight precisa ser respondido mesmo com a cota
  // estourada, senão o 429 chega ao app disfarçado de falha de CORS.
  app.use(corsConfigurado);
  app.use(limiteGlobal);
  app.use(express.json({ limit: '256kb' }));

  app.use(montarRotas(montarContainer()));

  // Rota inexistente responde no formato de erro padrão da API.
  app.use((req, res, next) => next({ status: 404, mensagem: 'Rota não encontrada' }));
  app.use(errorHandler);

  return app;
}

export { criarApp };
