import { NextResponse } from 'next/server';
import { getRepo } from '../../../../../lib/repo';
import { currentUser, jsonError, isSameOrigin } from '../../../../../lib/http';
import { gradeAttempt } from '../../../../../lib/academy';
export async function POST(request:Request){if(!isSameOrigin(request))return jsonError('Origine refusée',403);const user=await currentUser(request);if(!user)return jsonError('Authentification requise',401);const body=await request.json().catch(()=>null);if(!body||typeof body.courseId!=='string')return jsonError('Données invalides',400);try{const result=gradeAttempt(body.courseId,body.answers);await getRepo().recordAttempt(user.id,{courseId:body.courseId,score:result.score??0,answers:body.answers});return NextResponse.json(result);}catch(e){console.error(e);return jsonError('Correction indisponible',503);}}
