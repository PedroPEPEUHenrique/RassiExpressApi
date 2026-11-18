import 'dotenv/config';
import { criarApp } from './app.js';
import { origensPermitidas } from '../infra/http/middleware/cors.js';

/**
 * Ponto de entrada do processo.
 *
 * Só isto escuta porta. Quem precisa do aplicativo sem subir servidor — o
 * teste de integração — importa `criarApp` de app.js.
 */

// Falha no boot, não na primeira requisição: sem JWT_SECRET a emissão de
// token quebraria apenas no login, com erro 500 difícil de diagnosticar.
if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET não definido. Copie .env.example para .env e defina uma chave secreta.');
  process.exit(1);
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
