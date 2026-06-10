import repoBanner from "../repositories/repoBanner.js"

async function ListarPorEmpresa(idEmpresa) {
    return await repoBanner.ListarPorEmpresa(idEmpresa);
}

export default { ListarPorEmpresa };
