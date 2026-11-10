function errorHandler(err, req, res, next) {
    const status = err.status || 500;
    const mensagem = err.mensagem || "Erro interno do servidor";

    // Erros 4xx são previstos (validação, autenticação, recurso inexistente) e
    // não poluem o log. Um 5xx é defeito: precisa do stack para investigação,
    // mas o cliente continua recebendo só a mensagem genérica.
    if (status >= 500) {
        console.error(`[${req.method} ${req.originalUrl}]`, err);
    }

    // Alguns erros previstos precisam levar dado junto para o app agir — o
    // login de quem trabalha em mais de um restaurante devolve a lista para a
    // escolha. Só é enviado quando o service preenche `dados` de propósito.
    const corpo = { mensagem };
    if (err.dados !== undefined) corpo.dados = err.dados;

    res.status(status).json(corpo);
}

export default errorHandler;
