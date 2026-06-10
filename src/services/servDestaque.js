import repoDestaque from "../repositories/repoDestaque.js"

async function ListarPorEmpresa(idEmpresa) {
    return await repoDestaque.ListarPorEmpresa(idEmpresa);
}

export default { ListarPorEmpresa };
