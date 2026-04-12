const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT id, name, stock, "createdAt" FROM product ORDER BY "createdAt" DESC LIMIT 5').then(r => console.log(r.rows)).finally(() => pool.end());
