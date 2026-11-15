import 'dotenv/config';
import express from 'express'
import corsConfigurado from './middleware/cors.js';
import { limiteGlobal } from './middleware/rateLimit.js';
import router from './routes.js';
import errorHandler from './middleware/errorHandler.js';
import { origensPermitidas } from './middleware/cors.js';

// Falha no boot, não na primeira requisição: sem JWT_SECRET o jwt.sign/verify
// quebraria apenas no login, com erro 500 difícil de diagnosticar.
if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET não definido. Copie .env.example para .env e defina uma chave secreta.");
  process.exit(1);
}

const app = express()

/**
 * Quantos proxies existem na frente da API.
 *
 * Sem isso, atrás de nginx ou de um PaaS toda requisição chega com o IP do
 * proxy e o limite por IP passa a contar o tráfego do mundo inteiro numa
 * chave só — o primeiro restaurante a usar o sistema consumiria a cota de
 * todos.
 *
 * O padrão é 0 (nenhum proxy), porque confiar em X-Forwarded-For sem
 * necessidade é pior: o cabeçalho é forjável, e qualquer cliente poderia
 * trocar de IP a cada requisição para escapar do limite. Em produção, defina
 * TRUST_PROXY com o número exato de saltos.
 */
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 0));

// CORS antes do limite: o preflight OPTIONS do navegador precisa ser
// respondido mesmo quando a cota estourou, senão o erro chega ao app como
// falha de CORS e esconde o 429.
app.use(corsConfigurado);
app.use(limiteGlobal);
app.use(express.json({ limit: '256kb' }));
app.use(router);

// Rota inexistente também responde no formato de erro padrão da API.
app.use((req, res, next) => next({ status: 404, mensagem: "Rota não encontrada" }));
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`)
  console.log(
    origensPermitidas.length
      ? `CORS: liberado para ${origensPermitidas.join(', ')} (e clientes sem Origin)`
      : 'CORS: apenas clientes sem Origin (app nativo). Defina CORS_ORIGINS para liberar navegadores.'
  );
})
