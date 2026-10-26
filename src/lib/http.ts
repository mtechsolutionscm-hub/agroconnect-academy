import { NextResponse } from 'next/server';
import { SESSION_COOKIE, issueSession, verifySession } from './auth';
import { getRepo } from './repo';
import type { User } from './repo/types';
export function jsonError(message:string,status=400){return NextResponse.json({error:message},{status});}
export function isSameOrigin(request:Request){const origin=request.headers.get('origin');if(!origin)return true;try{return new URL(origin).host===new URL(request.url).host;}catch{return false;}}
export function setSessionCookie(res:NextResponse,userId:string){res.cookies.set(SESSION_COOKIE,issueSession(userId),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:Number(process.env.SESSION_DAYS||30)*86400});}
export function clearSessionCookie(res:NextResponse){res.cookies.set(SESSION_COOKIE,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:0});}
export async function currentUser(request:Request):Promise<User|null>{const c=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(SESSION_COOKIE+'='))?.slice(SESSION_COOKIE.length+1);if(!c)return null;const id=verifySession(decodeURIComponent(c));return id?getRepo().findUserById(id):null;}
