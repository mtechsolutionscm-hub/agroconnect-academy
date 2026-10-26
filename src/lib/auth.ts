import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';
import { getRepo } from './repo';
import { env } from './env';
import type { User } from './repo/types';
export const SESSION_COOKIE='aca_session';
function passHash(password:string,salt=randomBytes(16).toString('hex')){return salt+':'+scryptSync(password,salt,64).toString('hex');}
function passVerify(password:string,stored:string){const [salt,hash]=stored.split(':');if(!salt||!hash)return false;const actual=scryptSync(password,salt,64);const expected=Buffer.from(hash,'hex');return actual.length===expected.length&&timingSafeEqual(actual,expected);}
function sign(v:string){if(!env.sessionSecret)throw new Error('SESSION_SECRET is required');return createHmac('sha256',env.sessionSecret).update(v).digest('base64url');}
export function issueSession(userId:string){const p=Buffer.from(JSON.stringify({sub:userId,exp:Date.now()+env.sessionDays*86400000})).toString('base64url');return p+'.'+sign(p);}
export function verifySession(token:string):string|null{try{const [p,s]=token.split('.');if(!p||!s)return null;const a=Buffer.from(s),b=Buffer.from(sign(p));if(a.length!==b.length||!timingSafeEqual(a,b))return null;const x=JSON.parse(Buffer.from(p,'base64url').toString());return x.exp>Date.now()&&typeof x.sub==='string'?x.sub:null;}catch{return null;}}
export async function authenticate(email:string,password:string):Promise<User|null>{const u=await getRepo().findUserByEmail(email.trim().toLowerCase());return u&&passVerify(password,u.passwordHash)?u:null;}
export async function registerUser(name:string,email:string,password:string):Promise<User>{if(password.length<10)throw new Error('Mot de passe trop court (10 caractères minimum)');return getRepo().createUser({name:name.trim(),email:email.trim().toLowerCase(),passwordHash:passHash(password)});}
