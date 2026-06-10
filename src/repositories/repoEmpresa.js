import { execute } from "../database/sqlite.js"

async function Listar() {
    const sql = "SELECT * FROM EMPRESA WHERE ativo = 1 ORDER BY nome";
    return await execute(sql, []);
}

async function ListarPorId(idEmpresa) {
    const sql = "SELECT * FROM EMPRESA WHERE id_empresa = ?";
    return await execute(sql, [idEmpresa], "get");
}

async function ListarPorCategoria(idCategoria) {
    const sql = `
        SELECT e.*
        FROM EMPRESA e
        INNER JOIN EMPRESA_CATEGORIA ec ON ec.id_empresa = e.id_empresa
        WHERE ec.id_categoria = ? AND e.ativo = 1
        ORDER BY e.nome
    `;
    return await execute(sql, [idCategoria]);
}

async function Criar(empresa) {
    const sql = `
        INSERT INTO EMPRESA (nome, icone, taxa_entrega, cep, endereco, numero, complemento, bairro, cidade, estado, ativo, dt_cadastro)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
    `;
    const params = [
        empresa.nome, empresa.icone, empresa.taxaEntrega,
        empresa.cep, empresa.endereco, empresa.numero,
        empresa.complemento, empresa.bairro, empresa.cidade, empresa.estado
    ];
    const result = await execute(sql, params, "run");
    return result.lastID;
}

async function Atualizar(idEmpresa, empresa) {
    const sql = `
        UPDATE EMPRESA SET nome = ?, icone = ?, taxa_entrega = ?, cep = ?, endereco = ?,
        numero = ?, complemento = ?, bairro = ?, cidade = ?, estado = ?, ativo = ?
        WHERE id_empresa = ?
    `;
    const params = [
        empresa.nome, empresa.icone, empresa.taxaEntrega,
        empresa.cep, empresa.endereco, empresa.numero,
        empresa.complemento, empresa.bairro, empresa.cidade, empresa.estado,
        empresa.ativo, idEmpresa
    ];
    const result = await execute(sql, params, "run");
    return result.changes;
}

async function Deletar(idEmpresa) {
    const sql = "UPDATE EMPRESA SET ativo = 0 WHERE id_empresa = ?";
    const result = await execute(sql, [idEmpresa], "run");
    return result.changes;
}

export default { Listar, ListarPorId, ListarPorCategoria, Criar, Atualizar, Deletar };
