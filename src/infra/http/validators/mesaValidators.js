import Joi from 'joi';

// idEmpresa ausente de propósito: vem do token.
export const criarMesaSchema = Joi.object({
    numero: Joi.string().max(10).required().messages({
        'any.required': 'Número da mesa é obrigatório',
        'string.empty': 'Número da mesa é obrigatório',
        'string.max': 'Número da mesa deve ter no máximo 10 caracteres',
    }),
    setor: Joi.string().max(50).allow('', null).optional(),
    capacidade: Joi.number().integer().min(1).max(50).allow(null).optional().messages({
        'number.min': 'Capacidade deve ser ao menos 1',
    }),
});

export const atualizarMesaSchema = Joi.object({
    numero: Joi.string().max(10).optional(),
    setor: Joi.string().max(50).allow('', null).optional(),
    capacidade: Joi.number().integer().min(1).max(50).allow(null).optional(),
});
