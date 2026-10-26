import { MysqlRepo } from './mysql';
import type { AcademyRepo } from './types';
let singleton: AcademyRepo | undefined;
export function getRepo(): AcademyRepo { if (!singleton) singleton = new MysqlRepo(); return singleton; }
