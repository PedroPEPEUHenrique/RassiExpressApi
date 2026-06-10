import repoUserFavorito from "../repositories/repoUserFavorito.js"

async function ListarPorUsuario(idUsuario) {
    return await repoUserFavorito.ListarPorUsuario(idUsuario);
}

async function Criar(favorito) {
    if (!favorito.idUsuario) throw { status: 400, mensagem: "Usuário é obrigatório" };
    if (!favorito.idEmpresa) throw { status: 400, mensagem: "Empresa é obrigatória" };
    if (!favorito.idProduto) throw { status: 400, mensagem: "Produto é obrigatório" };

    const existente = await repoUserFavorito.BuscarExistente(favorito.idUsuario, favorito.idEmpresa, favorito.idProduto);
    if (existente) return existente;

    const idFavorito = await repoUserFavorito.Criar(favorito);
    return { idFavorito, ...favorito };
}

async function Deletar(idFavorito) {
    const changes = await repoUserFavorito.Deletar(idFavorito);
    if (!changes) throw { status: 404, mensagem: "Favorito não encontrado" };
}

export default { ListarPorUsuario, Criar, Deletar };
