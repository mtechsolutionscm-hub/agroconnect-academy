import { NextResponse } from 'next/server';
import { getRepo } from '../../../../../lib/repo';
import { currentUser, jsonError } from '../../../../../lib/http';
export async function GET(request:Request){const user=await currentUser(request);if(!user)return jsonError('Authentification requise',401);const courseId=new URL(request.url).searchParams.get('courseId');if(!courseId)return jsonError('Formation requise',400);try{const certificate=await getRepo().getCertificate(user.id,courseId);if(!certificate)return jsonError('Attestation non disponible',404);return NextResponse.json(certificate);}catch(e){console.error(e);return jsonError('Service indisponible',503);}}
