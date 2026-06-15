function errorHandler(err, req, res, next) {
    const status = err.status || 500;
    const mensagem = err.mensagem || "Erro interno do servidor";
    res.status(status).json({ mensagem });
}

export default errorHandler;
