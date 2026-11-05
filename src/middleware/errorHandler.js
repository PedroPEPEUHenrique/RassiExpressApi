function errorHandler(err, req, res, next) {
    const status = err.status || 500;
    const mensagem = err.mensagem || "Erro interno do servidor";

    // Erros 4xx são previstos (validação, autenticação, recurso inexistente) e
    // não poluem o log. Um 5xx é defeito: precisa do stack para investigação,
    // mas o cliente continua recebendo só a mensagem genérica.
    if (status >= 500) {
        console.error(`[${req.method} ${req.originalUrl}]`, err);
    }

    res.status(status).json({ mensagem });
}

export default errorHandler;
