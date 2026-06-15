import Joi from 'joi';

const itemPedidoSchema = Joi.object({
    idProduto: Joi.number().integer().required().messages({
        'any.required': 'Produto do item é obrigatório',
        'number.base': 'Produto inválido',
    }),
    quantidade: Joi.number().integer().min(1).required().messages({
        'any.required': 'Quantidade é obrigatória',
        'number.min': 'Quantidade deve ser ao menos 1',
    }),
    vlUnitario: Joi.number().min(0).required().messages({
        'any.required': 'Valor unitário é obrigatório',
        'number.base': 'Valor unitário deve ser um número',
    }),
    vlTotal: Joi.number().min(0).required().messages({
        'any.required': 'Valor total do item é obrigatório',
        'number.base': 'Valor total do item deve ser um número',
    }),
    observacao: Joi.string().max(300).allow('', null).optional(),
});

export const criarPedidoSchema = Joi.object({
    idEmpresa: Joi.number().integer().required().messages({
        'any.required': 'Empresa é obrigatória',
        'number.base': 'Empresa inválida',
    }),
    idUsuario: Joi.number().integer().required().messages({
        'any.required': 'Usuário é obrigatório',
        'number.base': 'Usuário inválido',
    }),
    vlSubtotal: Joi.number().min(0).required().messages({
        'any.required': 'Subtotal é obrigatório',
        'number.base': 'Subtotal deve ser um número',
    }),
    vlTaxaEntrega: Joi.number().min(0).required().messages({
        'any.required': 'Taxa de entrega é obrigatória',
        'number.base': 'Taxa de entrega deve ser um número',
    }),
    vlTotal: Joi.number().min(0).required().messages({
        'any.required': 'Valor total é obrigatório',
        'number.base': 'Valor total deve ser um número',
    }),
    itens: Joi.array().items(itemPedidoSchema).min(1).required().messages({
        'any.required': 'O pedido deve ter ao menos um item',
        'array.min': 'O pedido deve ter ao menos um item',
    }),
});

export const atualizarStatusSchema = Joi.object({
    status: Joi.string()
        .valid('pendente', 'confirmado', 'preparando', 'saiu_entrega', 'entregue', 'cancelado')
        .required()
        .messages({
            'any.required': 'Status é obrigatório',
            'any.only': 'Status inválido. Valores aceitos: pendente, confirmado, preparando, saiu_entrega, entregue, cancelado',
        }),
});
