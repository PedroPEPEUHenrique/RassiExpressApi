import Joi from 'joi';

// idEmpresa é opcional: só quem tem vínculo com mais de um restaurante precisa
// escolher, e o login responde 409 com a lista quando a escolha falta.
export const loginSchema = Joi.object({
    email: Joi.string().email().required().messages({
        'any.required': 'E-mail é obrigatório',
        'string.empty': 'E-mail é obrigatório',
        'string.email': 'E-mail inválido',
    }),
    senha: Joi.string().required().messages({
        'any.required': 'Senha é obrigatória',
        'string.empty': 'Senha é obrigatória',
    }),
    idEmpresa: Joi.number().integer().optional(),
});

export const atualizarUsuarioSchema = Joi.object({
    nome: Joi.string().max(100).optional(),
    telefone: Joi.string().max(20).allow('', null).optional(),
});

export const alterarSenhaSchema = Joi.object({
    senhaAtual: Joi.string().required().messages({
        'any.required': 'Senha atual é obrigatória',
        'string.empty': 'Senha atual é obrigatória',
    }),
    novaSenha: Joi.string().min(6).max(50).required().messages({
        'any.required': 'Nova senha é obrigatória',
        'string.empty': 'Nova senha é obrigatória',
        'string.min': 'Nova senha deve ter no mínimo 6 caracteres',
        'string.max': 'Nova senha deve ter no máximo 50 caracteres',
    }),
});
