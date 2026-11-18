import Joi from 'joi';

// idEmpresa saiu: o restaurante vem do token.
export const criarProdutoCategoriaSchema = Joi.object({
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
