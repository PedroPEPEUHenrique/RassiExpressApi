import servBanner from "../services/servBanner.js";
import asyncHandler from "../middleware/asyncHandler.js";

const ListarPorEmpresa = asyncHandler(async (req, res) => {
    const { idEmpresa } = req.params;
    const banners = await servBanner.ListarPorEmpresa(idEmpresa);
    res.status(200).json(banners);
});

export default { ListarPorEmpresa };
