import Joi from 'joi';

// idEmpresa saiu dos dois schemas: o restaurante vem do token. Aceitá-lo no
// corpo permitia cadastrar e mover produto no cardápio de outro restaurante.
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
    idProdutoCategoria: Joi.number().integer().required().messages({
        'any.required': 'Categoria é obrigatória',
        'number.base': 'Categoria inválida',
    }),
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
    idProdutoCategoria: Joi.number().integer().optional(),
    ativo: Joi.number().integer().valid(0, 1).optional(),
});
