import repoEmpresa from "../repositories/repoEmpresa.js"

async function Listar() {
    return await repoEmpresa.Listar();
}

async function ListarPorId(idEmpresa) {
    const empresa = await repoEmpresa.ListarPorId(idEmpresa);
    if (!empresa) throw { status: 404, mensagem: "Empresa não encontrada" };
    return empresa;
}

async function ListarPorCategoria(idCategoria) {
    return await repoEmpresa.ListarPorCategoria(idCategoria);
}

async function Criar(empresa) {
    if (!empresa.nome) throw { status: 400, mensagem: "Nome é obrigatório" };
    if (empresa.taxaEntrega === undefined) throw { status: 400, mensagem: "Taxa de entrega é obrigatória" };
    const idEmpresa = await repoEmpresa.Criar(empresa);
    return { idEmpresa, ...empresa };
}

async function Atualizar(idEmpresa, empresa) {
    const changes = await repoEmpresa.Atualizar(idEmpresa, empresa);
    if (!changes) throw { status: 404, mensagem: "Empresa não encontrada" };
    return { idEmpresa, ...empresa };
}

async function Deletar(idEmpresa) {
    const changes = await repoEmpresa.Deletar(idEmpresa);
    if (!changes) throw { status: 404, mensagem: "Empresa não encontrada" };
}

export default { Listar, ListarPorId, ListarPorCategoria, Criar, Atualizar, Deletar };
