import mysql from "mysql2/promise";

const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "foodexpress",
    waitForConnections: true,
    connectionLimit: 10,
    decimalNumbers: true,
});

async function execute(sql, params, method = "all") {
    const [rows] = await pool.execute(sql, params);
    if (method === "run") {
        return { lastID: rows.insertId, changes: rows.affectedRows };
    } else if (method === "get") {
        return rows[0] || null;
    }
    return rows;
}

export { pool, execute };
