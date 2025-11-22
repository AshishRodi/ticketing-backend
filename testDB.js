const pool = require("./config/db");

async function test() {
    try {
        const [rows] = await pool.query("SELECT 1+1 AS result");
        console.log(rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
    }
}

test();
