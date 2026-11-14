import Joi from 'joi';

export const abrirCaixaSchema = Joi.object({
    vlAbertura: Joi.number().min(0).optional().messages({
        'number.min': 'O valor de abertura não pode ser negativo',
    }),
    observacao: Joi.string().max(500).allow('', null).optional(),
});

export const fecharCaixaSchema = Joi.object({
    // O que foi contado na gaveta. A diferença para o esperado é registrada,
    // não recusada: quebra de caixa acontece e esconder o número é pior.
    vlInformado: Joi.number().min(0).required().messages({
        'any.required': 'Informe o valor contado na gaveta',
        'number.min': 'O valor contado não pode ser negativo',
    }),
    observacao: Joi.string().max(500).allow('', null).optional(),
    forcar: Joi.boolean().optional(),
});

// 'venda' fora da lista de propósito: venda de mesa entra sozinha no
// fechamento da comanda, e permitir lançá-la à mão deixaria a mesma venda
// entrar duas vezes no turno.
export const lancarMovimentoSchema = Joi.object({
    tipo: Joi.string().valid('venda_externa', 'despesa', 'sangria', 'suprimento').required().messages({
        'any.required': 'Tipo é obrigatório',
        'any.only': 'Tipo deve ser venda_externa, despesa, sangria ou suprimento',
    }),
    valor: Joi.number().greater(0).required().messages({
        'any.required': 'Valor é obrigatório',
        'number.greater': 'O valor deve ser maior que zero',
    }),
    descricao: Joi.string().max(200).allow('', null).optional(),
});
