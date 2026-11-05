import Joi from 'joi';

export const criarFavoritoSchema = Joi.object({
    idEmpresa: Joi.number().integer().required().messages({
        'any.required': 'Empresa é obrigatória',
        'number.base': 'Empresa inválida',
    }),
    // Nulo/ausente significa favoritar a empresa inteira, não um produto.
    idProduto: Joi.number().integer().allow(null).optional().messages({
        'number.base': 'Produto inválido',
    }),
});
