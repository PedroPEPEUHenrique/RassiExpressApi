import repoBanner from "../repositories/repoBanner.js"

async function ListarPorEmpresa(idEmpresa) {
    return await repoBanner.ListarPorEmpresa(idEmpresa);
}

async function Listar() {
    return await repoBanner.Listar();
}

export default { Listar, ListarPorEmpresa };
