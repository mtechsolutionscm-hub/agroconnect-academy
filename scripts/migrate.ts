import { createPool } from '../src/lib/repo/mysql';
import { readFile } from 'node:fs/promises';
async function main(){const pool=createPool();try{const sql=await readFile('db/schema.sql','utf8');for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await pool.query(statement);console.log('Migration terminée.');}finally{await pool.end();}}
main().catch(e=>{console.error(e);process.exit(1);});
