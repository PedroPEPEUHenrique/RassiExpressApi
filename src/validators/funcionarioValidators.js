import Joi from 'joi';

// idEmpresa de propósito ausente: o restaurante vem do token do gestor. Se
// fosse aceito aqui, um gestor poderia admitir funcionário em outro
// restaurante.
export const criarFuncionarioSchema = Joi.object({
    nome: Joi.string().max(100).required().messages({
        'any.required': 'Nome é obrigatório',
        'string.empty': 'Nome é obrigatório',
        'string.max': 'Nome deve ter no máximo 100 caracteres',
    }),
    email: Joi.string().email().max(100).required().messages({
        'any.required': 'E-mail é obrigatório',
        'string.empty': 'E-mail é obrigatório',
        'string.email': 'E-mail inválido',
        'string.max': 'E-mail deve ter no máximo 100 caracteres',
    }),
    senha: Joi.string().min(6).max(50).required().messages({
        'any.required': 'Senha é obrigatória',
        'string.empty': 'Senha é obrigatória',
        'string.min': 'Senha deve ter no mínimo 6 caracteres',
        'string.max': 'Senha deve ter no máximo 50 caracteres',
    }),
    telefone: Joi.string().max(20).allow('', null).optional(),
    papel: Joi.string().valid('gestor', 'garcom', 'cozinha').required().messages({
        'any.required': 'Papel é obrigatório',
        'any.only': 'Papel deve ser gestor, garcom ou cozinha',
    }),
});
