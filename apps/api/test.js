const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'YOUR_PASSWORD',
  database: 'YOUR_DATABASE',
});

pool.query('SELECT NOW()')
  .then(res => {
    console.log(res.rows);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });