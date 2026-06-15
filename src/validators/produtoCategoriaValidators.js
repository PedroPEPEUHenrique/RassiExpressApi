import Joi from 'joi';

export const criarProdutoCategoriaSchema = Joi.object({
    idEmpresa: Joi.number().integer().required().messages({
        'any.required': 'Empresa é obrigatória',
        'number.base': 'Empresa inválida',
    }),
    categoria: Joi.string().max(100).required().messages({
        'any.required': 'Categoria é obrigatória',
        'string.empty': 'Categoria é obrigatória',
    }),
    ordem: Joi.number().integer().optional(),
});

export const atualizarProdutoCategoriaSchema = Joi.object({
    categoria: Joi.string().max(100).optional(),
    ordem: Joi.number().integer().optional(),
});
