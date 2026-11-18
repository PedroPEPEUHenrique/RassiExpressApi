import 'dotenv/config';
import express from 'express';
import corsConfigurado, { origensPermitidas } from '../infra/http/middleware/cors.js';
import { limiteGlobal } from '../infra/http/middleware/rateLimit.js';
import { errorHandler } from '../infra/http/mapearErro.js';
import { montarContainer } from './container.js';
import { montarRotas } from './rotas.js';

/**
 * Ponto de entrada.
 *
 * Monta o container, pendura as rotas e sobe o Express. É a camada mais
 * externa: tudo o que é decisão de framework mora aqui ou em infra/.
 */

// Falha no boot, não na primeira requisição: sem JWT_SECRET a emissão de
// token quebraria apenas no login, com erro 500 difícil de diagnosticar.
if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET não definido. Copie .env.example para .env e defina uma chave secreta.');
  process.exit(1);
}

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

const PORT = process.env.PORT || 3001;
criarApp().listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`);
  console.log(
    origensPermitidas.length
      ? `CORS: liberado para ${origensPermitidas.join(', ')} (e clientes sem Origin)`
      : 'CORS: apenas clientes sem Origin (app nativo). Defina CORS_ORIGINS para liberar navegadores.'
  );
});

export { criarApp };
