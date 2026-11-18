import jwt from 'jsonwebtoken';

function autenticar(req, res, next) {
    const header = req.headers.authorization || "";
    const [esquema, token] = header.split(" ");

    if (esquema !== "Bearer" || !token) {
        return next({ status: 401, mensagem: "Token de acesso não informado" });
    }

    let payload;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return next({ status: 401, mensagem: "Token inválido ou expirado" });
    }

    // Token emitido antes dos papéis existirem não carrega empresa nem papel.
    // Recusar aqui é essencial: sem isso, autorizarPapel compararia contra
    // undefined e um token antigo passaria por rotas que exigem papel.
    if (!payload.idEmpresa || !payload.papel) {
        return next({ status: 401, mensagem: "Sessão desatualizada. Faça login novamente." });
    }

    req.usuario = {
        id: payload.id,
        email: payload.email,
        idEmpresa: payload.idEmpresa,
        idFuncionario: payload.idFuncionario,
        papel: payload.papel,
    };
    next();
}

// Garante que o usuário do token é o dono do recurso. Vale para o próprio
// cadastro ("meu perfil"); acesso a dado do restaurante usa escopoEmpresa.
const autorizarProprietario = param => (req, res, next) => {
    if (Number(req.params[param]) !== req.usuario.id) {
        return next({ status: 403, mensagem: "Acesso negado a recurso de outro usuário" });
    }
    next();
};

// Restringe a rota a determinados papéis. Ex.: autorizarPapel("gestor") no
// cadastro de cardápio, autorizarPapel("cozinha", "gestor") no painel da cozinha.
const autorizarPapel = (...papeis) => (req, res, next) => {
    if (!papeis.includes(req.usuario.papel)) {
        return next({ status: 403, mensagem: "Seu perfil não tem permissão para esta operação" });
    }
    next();
};

// Barra o acesso a dados de outro restaurante quando o id da empresa vem pela
// URL. Para operações que não recebem esse id, o valor correto é sempre
// req.usuario.idEmpresa — nunca o corpo da requisição, que o cliente controla.
const escopoEmpresa = (param = "idEmpresa") => (req, res, next) => {
    if (Number(req.params[param]) !== req.usuario.idEmpresa) {
        return next({ status: 403, mensagem: "Acesso negado a dados de outro restaurante" });
    }
    next();
};

export { autenticar, autorizarProprietario, autorizarPapel, escopoEmpresa };
