import { NextResponse } from 'next/server';
import { getRepo } from '../../../../../lib/repo';
import { currentUser, jsonError, isSameOrigin } from '../../../../../lib/http';
export async function POST(request:Request){if(!isSameOrigin(request))return jsonError('Origine refusée',403);const user=await currentUser(request);if(!user)return jsonError('Authentification requise',401);const body=await request.json().catch(()=>null);if(!body)return jsonError('Données invalides',400);try{await getRepo().recordActivity(user.id,body);return NextResponse.json({ok:true});}catch(e){console.error(e);return jsonError('Enregistrement impossible',503);}}
