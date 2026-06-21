import { execute } from "../database/mysql.js"

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
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    const params = [
        usuario.nome, usuario.email, usuario.senha, usuario.telefone ?? null,
        usuario.cep ?? null, usuario.endereco ?? null, usuario.numero ?? null, usuario.complemento ?? null,
        usuario.bairro ?? null, usuario.cidade ?? null, usuario.estado ?? null
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
        usuario.nome ?? null, usuario.telefone ?? null, usuario.cep ?? null, usuario.endereco ?? null,
        usuario.numero ?? null, usuario.complemento ?? null, usuario.bairro ?? null, usuario.cidade ?? null,
        usuario.estado ?? null, idUsuario
    ];
    const result = await execute(sql, params, "run");
    return result.changes;
}

export default { ListarPorId, ListarPorEmail, Criar, Atualizar };
