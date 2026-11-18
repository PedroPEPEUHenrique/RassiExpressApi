import cors from "cors";

/**
 * CORS com lista de permissão.
 *
 * O que estava no lugar era `cors()` sem opções, que devolve
 * `Access-Control-Allow-Origin: *` — qualquer página da internet podia chamar
 * esta API a partir do navegador de quem estivesse logado.
 *
 * Detalhe que decide o desenho: **o app nativo não envia cabeçalho Origin**.
 * CORS é uma regra que o navegador aplica; requisição de React Native, curl ou
 * servidor chega sem Origin e precisa passar. Recusar origem ausente
 * derrubaria o aplicativo inteiro ao mesmo tempo em que não protegeria nada,
 * porque quem não usa navegador simplesmente ignora CORS.
 *
 * Por isso: origem ausente passa; origem presente só passa se estiver na
 * lista. Com CORS_ORIGINS vazio, só o app nativo é atendido — que é o padrão
 * certo para uma API que hoje só tem cliente móvel.
 */

const origensPermitidas = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

const opcoes = {
    origin(origin, callback) {
        // Sem Origin: app nativo, curl, chamada entre servidores. Ver acima.
        if (!origin) return callback(null, true);

        if (origensPermitidas.includes(origin)) return callback(null, true);

        // Erro com status, para cair no errorHandler da API e responder no
        // mesmo formato das outras recusas em vez de um 500 opaco.
        return callback({ status: 403, mensagem: "Origem não autorizada" });
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    // Authorization carrega o Bearer; sem listá-lo o preflight barraria toda
    // requisição autenticada vinda de navegador.
    allowedHeaders: ["Content-Type", "Authorization"],
    // Expostos para o cliente poder recuar sozinho ao se aproximar do limite.
    exposedHeaders: ["RateLimit", "RateLimit-Policy", "Retry-After"],
    // false de propósito: a autenticação é por Bearer em cabeçalho, não por
    // cookie. Ligar credentials sem necessidade abriria a porta para CSRF.
    credentials: false,
    maxAge: 86400,
};

export default cors(opcoes);
export { origensPermitidas };
