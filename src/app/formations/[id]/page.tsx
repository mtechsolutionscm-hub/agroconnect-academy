import { notFound } from 'next/navigation';
import { loadCourse, validId } from '../../../lib/content';
import AcademyPlayer from '../../../components/AcademyPlayer';

export const dynamic = 'force-dynamic';

export default async function FormationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!validId(id) || !loadCourse(id)) notFound();
  return <AcademyPlayer formation={id} />;
}
