import Joi from 'joi';

const enderecoFields = {
    cep: Joi.string().max(9).allow('', null).optional(),
    endereco: Joi.string().max(200).allow('', null).optional(),
    numero: Joi.string().max(10).allow('', null).optional(),
    complemento: Joi.string().max(100).allow('', null).optional(),
    bairro: Joi.string().max(100).allow('', null).optional(),
    cidade: Joi.string().max(100).allow('', null).optional(),
    estado: Joi.string().max(2).allow('', null).optional(),
};

export const criarEmpresaSchema = Joi.object({
    nome: Joi.string().max(100).required().messages({
        'any.required': 'Nome é obrigatório',
        'string.empty': 'Nome é obrigatório',
    }),
    taxaEntrega: Joi.number().min(0).required().messages({
        'any.required': 'Taxa de entrega é obrigatória',
        'number.base': 'Taxa de entrega deve ser um número',
        'number.min': 'Taxa de entrega não pode ser negativa',
    }),
    icone: Joi.string().allow('', null).optional(),
    categorias: Joi.array().items(Joi.number().integer()).optional(),
    ...enderecoFields,
});

export const atualizarEmpresaSchema = Joi.object({
    nome: Joi.string().max(100).optional(),
    taxaEntrega: Joi.number().min(0).optional().messages({
        'number.base': 'Taxa de entrega deve ser um número',
        'number.min': 'Taxa de entrega não pode ser negativa',
    }),
    icone: Joi.string().allow('', null).optional(),
    categorias: Joi.array().items(Joi.number().integer()).optional(),
    ...enderecoFields,
});
