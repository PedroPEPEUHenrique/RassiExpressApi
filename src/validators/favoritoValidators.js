import Joi from 'joi';

export const criarFavoritoSchema = Joi.object({
    idUsuario: Joi.number().integer().required().messages({
        'any.required': 'Usuário é obrigatório',
        'number.base': 'Usuário inválido',
    }),
    idEmpresa: Joi.number().integer().required().messages({
        'any.required': 'Empresa é obrigatória',
        'number.base': 'Empresa inválida',
    }),
    idProduto: Joi.number().integer().required().messages({
        'any.required': 'Produto é obrigatório',
        'number.base': 'Produto inválido',
    }),
});
