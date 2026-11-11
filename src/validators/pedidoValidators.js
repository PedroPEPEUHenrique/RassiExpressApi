import Joi from 'joi';

/**
 * Note o que NÃO está aqui: valor, preço unitário, total.
 *
 * O app manda o que foi pedido; quanto custa é decisão do servidor, lido de
 * PRODUTO.valor no momento do lançamento. Aceitar valor pelo corpo deixaria
 * qualquer portador de token escolher o preço da conta.
 */
export const lancarRodadaSchema = Joi.object({
    // UUID gerado no aparelho. Torna o reenvio seguro: a mesma rodada enviada
    // duas vezes devolve a primeira em vez de duplicar o prato na cozinha.
    idLocal: Joi.string().max(36).optional(),
    itens: Joi.array().min(1).required().items(
        Joi.object({
            idProduto: Joi.number().integer().required().messages({
                'any.required': 'Produto é obrigatório',
                'number.base': 'Produto inválido',
            }),
            quantidade: Joi.number().integer().min(1).required().messages({
                'any.required': 'Quantidade é obrigatória',
                'number.min': 'Quantidade deve ser ao menos 1',
            }),
            observacao: Joi.string().max(500).allow('', null).optional(),
        })
    ).messages({
        'any.required': 'A rodada precisa de ao menos um item',
        'array.min': 'A rodada precisa de ao menos um item',
    }),
});

export const atualizarStatusSchema = Joi.object({
    status: Joi.string().valid('em_preparo', 'pronto', 'entregue', 'cancelado').required().messages({
        'any.required': 'Status é obrigatório',
        'any.only': 'Status deve ser em_preparo, pronto, entregue ou cancelado',
    }),
});
