import jwt from 'jsonwebtoken';

function autenticar(req, res, next) {
    const header = req.headers.authorization || "";
    const [esquema, token] = header.split(" ");

    if (esquema !== "Bearer" || !token) {
        return next({ status: 401, mensagem: "Token de acesso não informado" });
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario = { id: payload.id, email: payload.email };
        next();
    } catch {
        next({ status: 401, mensagem: "Token inválido ou expirado" });
    }
}

const autorizarProprietario = param => (req, res, next) => {
    if (Number(req.params[param]) !== req.usuario.id) {
        return next({ status: 403, mensagem: "Acesso negado a recurso de outro usuário" });
    }
    next();
};

export { autenticar, autorizarProprietario };
