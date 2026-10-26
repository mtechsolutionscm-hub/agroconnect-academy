import { notFound } from 'next/navigation';
import { loadCourse, validId } from '../../../lib/content';
import AcademyPlayer from '../../../components/AcademyPlayer';

// Pre-render the known course pages for static hosting.
export function generateStaticParams() {
  return Array.from({ length: 18 }, (_, index) => ({ id: `f${index + 1}` }));
}

export default async function FormationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!validId(id) || !loadCourse(id)) notFound();
  return <AcademyPlayer formation={id} />;
}
