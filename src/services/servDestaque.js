import repoDestaque from "../repositories/repoDestaque.js"

async function ListarPorEmpresa(idEmpresa) {
    return await repoDestaque.ListarPorEmpresa(idEmpresa);
}

async function Listar() {
    return await repoDestaque.Listar();
}

export default { Listar, ListarPorEmpresa };
