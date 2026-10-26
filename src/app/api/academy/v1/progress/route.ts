import { NextResponse } from 'next/server';
import { getRepo } from '../../../../../lib/repo';
import { currentUser, jsonError, isSameOrigin } from '../../../../../lib/http';
export async function GET(request: Request) {
 const user=await currentUser(request); if(!user) return jsonError('Authentification requise',401);
 try { return NextResponse.json({progress:await getRepo().listProgress(user.id)}); } catch(e){console.error(e);return jsonError('Service indisponible',503);}
}
export async function POST(request: Request) {
 if(!isSameOrigin(request)) return jsonError('Origine refusée',403);
 const user=await currentUser(request); if(!user) return jsonError('Authentification requise',401);
 const body=await request.json().catch(()=>null); if(!body||typeof body.courseId!=='string'||typeof body.progress!=='number') return jsonError('Données invalides',400);
 try { await getRepo().saveProgress(user.id,body.courseId,body.progress); return NextResponse.json({ok:true}); } catch(e){console.error(e);return jsonError('Enregistrement impossible',503);}
}
