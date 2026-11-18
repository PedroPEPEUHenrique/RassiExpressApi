import Joi from 'joi';

const UNIDADES = ['kg', 'g', 'l', 'ml', 'un'];

export const criarInsumoSchema = Joi.object({
    nome: Joi.string().max(100).required().messages({
        'any.required': 'Nome é obrigatório',
        'string.empty': 'Nome é obrigatório',
    }),
    unidade: Joi.string().valid(...UNIDADES).required().messages({
        'any.required': 'Unidade é obrigatória',
        'any.only': `Unidade deve ser uma de: ${UNIDADES.join(', ')}`,
    }),
    qtdMinima: Joi.number().min(0).optional(),
    vlCustoMedio: Joi.number().min(0).optional(),
});

export const atualizarInsumoSchema = Joi.object({
    nome: Joi.string().max(100).optional(),
    unidade: Joi.string().valid(...UNIDADES).optional(),
    qtdMinima: Joi.number().min(0).optional(),
});

// 'saida_venda' fora da lista: essa baixa nasce do lançamento da rodada, e
// lançá-la à mão descasaria o estoque das vendas.
export const movimentarSchema = Joi.object({
    tipo: Joi.string().valid('entrada', 'perda', 'ajuste').required().messages({
        'any.required': 'Tipo é obrigatório',
        'any.only': 'Tipo deve ser entrada, perda ou ajuste',
    }),
    quantidade: Joi.number().greater(0).required().messages({
        'any.required': 'Quantidade é obrigatória',
        'number.greater': 'A quantidade deve ser maior que zero',
    }),
    vlUnitario: Joi.number().min(0).optional(),
    motivo: Joi.string().max(200).allow('', null).optional(),
});

export const salvarFichaSchema = Joi.object({
    itens: Joi.array().required().items(
        Joi.object({
            idInsumo: Joi.number().integer().required(),
            quantidade: Joi.number().greater(0).required().messages({
                'number.greater': 'A quantidade de cada insumo deve ser maior que zero',
            }),
        })
    ).messages({ 'any.required': 'Informe os itens da ficha' }),
});
