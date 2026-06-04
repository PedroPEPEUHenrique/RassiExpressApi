import repositoryCategoria from "../repositories/repoCategoria.js";

async function Listar() {

    const categorias = await repositoryCategoria.Listar();
    return categorias;
}

export default { Listar };