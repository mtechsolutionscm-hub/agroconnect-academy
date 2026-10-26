import fs from 'node:fs'; import path from 'node:path'; import { env } from './env';
export function formationIds():string[]{try{return fs.readdirSync(path.join(process.cwd(),env.contentDir)).filter(f=>/^f\d+\.json$/.test(f)).map(f=>f.replace('.json','')).sort((a,b)=>Number(a.slice(1))-Number(b.slice(1)));}catch{return [];}}
export function loadCourse(id:string):any{if(!/^f\d+$/.test(id))return null;try{return JSON.parse(fs.readFileSync(path.join(process.cwd(),env.contentDir,id+'.json'),'utf8'));}catch{return null;}}
