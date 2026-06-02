function Listar(req, res) {
    try {
    

        res.status(200).json([
            { id_categoria: 1, categoria: "Burguers" },
            { id_categoria: 2, categoria: "Pizzas" },
            { id_categoria: 3, categoria: "Fritas" }
        ]);

    } catch (error) {
        res.status(500).json({ error });
    }
}

export default { Listar };