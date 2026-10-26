import { NextResponse } from 'next/server';
import { loadCourse } from '../../../../../lib/content';
import { jsonError } from '../../../../../lib/http';
export async function GET(_request: Request, context: { params: Promise<{id:string}> }) {
  const { id } = await context.params;
  const course = loadCourse(id);
  if (!course) return jsonError('Formation introuvable', 404);
  return NextResponse.json(course);
}
