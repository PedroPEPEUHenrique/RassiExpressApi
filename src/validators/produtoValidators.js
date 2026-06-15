import Joi from 'joi';

export const criarProdutoSchema = Joi.object({
    nome: Joi.string().max(100).required().messages({
        'any.required': 'Nome é obrigatório',
        'string.empty': 'Nome é obrigatório',
    }),
    descricao: Joi.string().max(500).allow('', null).optional(),
    icone: Joi.string().allow('', null).optional(),
    valor: Joi.number().min(0).required().messages({
        'any.required': 'Valor é obrigatório',
        'number.base': 'Valor deve ser um número',
        'number.min': 'Valor não pode ser negativo',
    }),
    idEmpresa: Joi.number().integer().required().messages({
        'any.required': 'Empresa é obrigatória',
        'number.base': 'Empresa inválida',
    }),
    idProdutoCategoria: Joi.number().integer().allow(null).optional(),
    ativo: Joi.number().integer().valid(0, 1).optional(),
});

export const atualizarProdutoSchema = Joi.object({
    nome: Joi.string().max(100).optional(),
    descricao: Joi.string().max(500).allow('', null).optional(),
    icone: Joi.string().allow('', null).optional(),
    valor: Joi.number().min(0).optional().messages({
        'number.base': 'Valor deve ser um número',
        'number.min': 'Valor não pode ser negativo',
    }),
    idProdutoCategoria: Joi.number().integer().allow(null).optional(),
    ativo: Joi.number().integer().valid(0, 1).optional(),
});
