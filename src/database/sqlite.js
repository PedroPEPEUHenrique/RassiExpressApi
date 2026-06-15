import sqlite3 from "sqlite3";

const SQLite = sqlite3.verbose();

function execute(command, params, method = "all") {
    return new Promise((resolve, reject) => {
        if (method === "run") {
            db.run(command, params, function(error) {
                if (error) reject(error);
                else resolve({ lastID: this.lastID, changes: this.changes });
            });
        } else {
            db[method](command, params, (error, result) => {
                if (error) reject(error);
                else resolve(result);
            });
        }
    });
}

const db = new SQLite.Database(process.env.DB_PATH || "./src/database/banco.db", SQLite.OPEN_READWRITE, (err) => {
    if (err)
        return console.log("Erro ao conectar ao banco: " + err.message);
});

export { db, execute }

