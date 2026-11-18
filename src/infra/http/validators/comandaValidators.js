import Joi from 'joi';

export const abrirComandaSchema = Joi.object({
    idMesa: Joi.number().integer().required().messages({
        'any.required': 'Mesa é obrigatória',
        'number.base': 'Mesa inválida',
    }),
    observacao: Joi.string().max(500).allow('', null).optional(),
});

// `forcar` cancela as rodadas que não saíram da cozinha. O app só manda true
// depois de confirmar com o garçom.
export const fecharComandaSchema = Joi.object({
    forcar: Joi.boolean().optional(),
});
