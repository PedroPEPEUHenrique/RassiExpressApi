import Joi from 'joi';

const enderecoFields = {
    telefone: Joi.string().max(20).allow('', null).optional(),
    cep: Joi.string().max(9).allow('', null).optional(),
    endereco: Joi.string().max(200).allow('', null).optional(),
    numero: Joi.string().max(10).allow('', null).optional(),
    complemento: Joi.string().max(100).allow('', null).optional(),
    bairro: Joi.string().max(100).allow('', null).optional(),
    cidade: Joi.string().max(100).allow('', null).optional(),
    estado: Joi.string().max(2).allow('', null).optional(),
};

export const criarUsuarioSchema = Joi.object({
    nome: Joi.string().max(100).required().messages({
        'any.required': 'Nome é obrigatório',
        'string.empty': 'Nome é obrigatório',
        'string.max': 'Nome deve ter no máximo 100 caracteres',
    }),
    email: Joi.string().email().max(100).required().messages({
        'any.required': 'E-mail é obrigatório',
        'string.empty': 'E-mail é obrigatório',
        'string.email': 'E-mail inválido',
        'string.max': 'E-mail deve ter no máximo 100 caracteres',
    }),
    senha: Joi.string().min(6).max(50).required().messages({
        'any.required': 'Senha é obrigatória',
        'string.empty': 'Senha é obrigatória',
        'string.min': 'Senha deve ter no mínimo 6 caracteres',
        'string.max': 'Senha deve ter no máximo 50 caracteres',
    }),
    ...enderecoFields,
});

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
});

export const atualizarUsuarioSchema = Joi.object({
    nome: Joi.string().max(100).optional(),
    ...enderecoFields,
});
