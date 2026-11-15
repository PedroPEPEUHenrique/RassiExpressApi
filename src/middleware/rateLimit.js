import { rateLimit, ipKeyGenerator } from "express-rate-limit";

/**
 * Limites de requisição.
 *
 * O desenho parte de um fato do produto: todos os aparelhos de um restaurante
 * saem pelo MESMO IP público (o WiFi da casa). Um tablet de cozinha fazendo
 * polling a cada 10s, mais quatro celulares de garçom recarregando a cada
 * navegação, somam ~100 req/min de um único IP em serviço normal.
 *
 * Por isso o limite por IP é generoso — ele é escudo contra inundação, não
 * contra uso. O limite que de fato controla abuso é o por usuário
 * autenticado, que não é afetado por NAT compartilhado.
 *
 * Exceção: o login. Ali não há usuário ainda, e força bruta é a ameaça real,
 * então valem dois limites empilhados (ver abaixo).
 */

const MINUTO = 60_000;
const QUINZE_MINUTOS = 15 * MINUTO;

/**
 * Responde no formato de erro da API em vez do texto puro do pacote.
 *
 * Sem isso o app receberia "Too many requests" como corpo e o apiClient
 * mostraria a mensagem genérica de fallback, escondendo do operador o motivo
 * real da recusa.
 */
const responder = (mensagem) => (req, res, next) => next({ status: 429, mensagem });

/**
 * Chave por usuário autenticado, com IP como reserva.
 *
 * Só funciona depois de `autenticar`, que é onde req.usuario aparece — por
 * isso este limitador é montado nas rotas, não globalmente.
 *
 * ipKeyGenerator normaliza IPv6: sem ele, cada requisição de um mesmo
 * aparelho IPv6 poderia cair numa chave diferente e o limite nunca fecharia.
 */
const porUsuarioOuIp = (req) =>
    req.usuario?.id ? `u:${req.usuario.id}` : ipKeyGenerator(req.ip);

/**
 * Escudo global contra inundação. Por IP, calibrado acima do pico de uso de
 * um restaurante inteiro para nunca derrubar o salão.
 */
const limiteGlobal = rateLimit({
    windowMs: MINUTO,
    limit: Number(process.env.RATE_LIMIT_GLOBAL ?? 300),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: responder("Muitas requisições. Aguarde um instante."),
});

/**
 * Operações de escrita, por usuário.
 *
 * Um garçom em noite cheia lança talvez uma rodada por minuto; 60 escritas no
 * mesmo intervalo é folga larga para uso legítimo e ainda assim barra um laço
 * descontrolado no app ou um script com token roubado.
 */
const limiteEscrita = rateLimit({
    windowMs: MINUTO,
    limit: Number(process.env.RATE_LIMIT_ESCRITA ?? 60),
    keyGenerator: porUsuarioOuIp,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: responder("Muitas operações seguidas. Aguarde um instante."),
});

/**
 * Login, limite 1 de 2 — por IP.
 *
 * Generoso de propósito: a equipe inteira divide o IP do restaurante, e no
 * início do turno várias pessoas erram a senha ao mesmo tempo. Apertar aqui
 * trancaria a casa toda para fora do próprio sistema.
 */
const limiteLoginPorIp = rateLimit({
    windowMs: QUINZE_MINUTOS,
    limit: Number(process.env.RATE_LIMIT_LOGIN_IP ?? 40),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: responder("Muitas tentativas de acesso deste local. Tente novamente em alguns minutos."),
});

/**
 * Login, limite 2 de 2 — por e-mail.
 *
 * Este é o que impede força bruta de verdade. O limite por IP sozinho não
 * serve: um atacante com um IP limpo teria 40 tentativas, e espalhando por
 * muitos e-mails nunca seria pego. Contando por e-mail, cada conta suporta
 * poucas tentativas erradas independentemente de onde venham.
 *
 * skipSuccessfulRequests faz o acerto não consumir cota — quem entra certo
 * nunca encosta no limite, mesmo trocando de turno várias vezes no dia.
 */
const limiteLoginPorEmail = rateLimit({
    windowMs: QUINZE_MINUTOS,
    limit: Number(process.env.RATE_LIMIT_LOGIN_EMAIL ?? 8),
    keyGenerator: (req) => {
        const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
        // Sem e-mail no corpo cai no IP: senão todas as requisições malformadas
        // dividiriam a mesma chave vazia e derrubariam o login de todo mundo.
        return email ? `e:${email}` : ipKeyGenerator(req.ip);
    },
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: responder("Muitas tentativas para esta conta. Tente novamente em alguns minutos."),
});

export { limiteGlobal, limiteEscrita, limiteLoginPorIp, limiteLoginPorEmail };
