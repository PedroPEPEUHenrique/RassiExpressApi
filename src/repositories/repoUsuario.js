import { execute } from "../database/sqlite.js"

async function Listar() {
    const sql = "SELECT * FROM USUARIO";
    return await execute(sql);
}

async function ListarPorId(idUsuario) {
    const sql = "SELECT id_usuario, nome, email, telefone, cep, endereco, numero, complemento, bairro, cidade, estado, dt_cadastro FROM USUARIO WHERE id_usuario = ?";
    return await execute(sql, [idUsuario], "get");
}

async function ListarPorEmail(email) {
    const sql = "SELECT * FROM USUARIO WHERE email = ?";
    return await execute(sql, [email], "get");
}

async function Criar(usuario) {
    const sql = `
        INSERT INTO USUARIO (nome, email, senha, telefone, cep, endereco, numero, complemento, bairro, cidade, estado, dt_cadastro)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `;
    const params = [
        usuario.nome, usuario.email, usuario.senha, usuario.telefone,
        usuario.cep, usuario.endereco, usuario.numero, usuario.complemento,
        usuario.bairro, usuario.cidade, usuario.estado
    ];
    const result = await execute(sql, params, "run");
    return result.lastID;
}

async function Atualizar(idUsuario, usuario) {
    const sql = `
        UPDATE USUARIO SET nome = ?, telefone = ?, cep = ?, endereco = ?, numero = ?,
        complemento = ?, bairro = ?, cidade = ?, estado = ?
        WHERE id_usuario = ?
    `;
    const params = [
        usuario.nome, usuario.telefone, usuario.cep, usuario.endereco,
        usuario.numero, usuario.complemento, usuario.bairro, usuario.cidade,
        usuario.estado, idUsuario
    ];
    const result = await execute(sql, params, "run");
    return result.changes;
}

export default { Listar, ListarPorId, ListarPorEmail, Criar, Atualizar };
