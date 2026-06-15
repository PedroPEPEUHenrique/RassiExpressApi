const validate = schema => (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
        const mensagem = error.details.map(d => d.message).join(', ');
        return next({ status: 422, mensagem });
    }
    next();
};

export default validate;
