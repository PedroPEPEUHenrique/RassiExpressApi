import { execute } from "../database/mysql.js"

const COLUNAS_PUBLICAS = "id_usuario, nome, email, telefone, cep, endereco, numero, complemento, bairro, cidade, estado, dt_cadastro";

async function Listar(conn) {
    const sql = `SELECT ${COLUNAS_PUBLICAS} FROM USUARIO`;
    return await execute(sql, undefined, "all", conn);
}

async function ListarPorId(idUsuario, conn) {
    const sql = `SELECT ${COLUNAS_PUBLICAS} FROM USUARIO WHERE id_usuario = ?`;
    return await execute(sql, [idUsuario], "get", conn);
}

async function ListarComSenhaPorId(idUsuario, conn) {
    const sql = "SELECT id_usuario, senha FROM USUARIO WHERE id_usuario = ?";
    return await execute(sql, [idUsuario], "get", conn);
}

async function ListarPorEmail(email, conn) {
    const sql = "SELECT * FROM USUARIO WHERE email = ?";
    return await execute(sql, [email], "get", conn);
}

async function Criar(usuario, conn) {
    const sql = `
        INSERT INTO USUARIO (nome, email, senha, telefone, cep, endereco, numero, complemento, bairro, cidade, estado, dt_cadastro)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    const params = [
        usuario.nome, usuario.email, usuario.senha, usuario.telefone ?? null,
        usuario.cep ?? null, usuario.endereco ?? null, usuario.numero ?? null, usuario.complemento ?? null,
        usuario.bairro ?? null, usuario.cidade ?? null, usuario.estado ?? null
    ];
    const result = await execute(sql, params, "run", conn);
    return result.lastID;
}

async function Atualizar(idUsuario, usuario, conn) {
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
    const result = await execute(sql, params, "run", conn);
    return result.changes;
}

async function AtualizarSenha(idUsuario, senhaHash, conn) {
    const sql = "UPDATE USUARIO SET senha = ? WHERE id_usuario = ?";
    const result = await execute(sql, [senhaHash, idUsuario], "run", conn);
    return result.changes;
}

export default { Listar, ListarPorId, ListarComSenhaPorId, ListarPorEmail, Criar, Atualizar, AtualizarSenha };
