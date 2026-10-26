export type User = { id: string; email: string; name: string; passwordHash: string; role: string };
export type ProgressRecord = { courseId: string; progress: number; updatedAt?: string };
export type AttemptRecord = { courseId: string; score: number; answers?: unknown };
export type ActivityRecord = { courseId?: string; kind?: string; payload?: unknown };
export interface AcademyRepo {
 findUserByEmail(email:string):Promise<User|null>; findUserById(id:string):Promise<User|null>;
 createUser(input:{name:string;email:string;passwordHash:string}):Promise<User>;
 listProgress(userId:string):Promise<ProgressRecord[]>; saveProgress(userId:string,courseId:string,progress:number):Promise<void>;
 recordActivity(userId:string,activity:ActivityRecord):Promise<void>; recordAttempt(userId:string,attempt:AttemptRecord):Promise<void>; getCertificate(userId:string,courseId:string):Promise<unknown|null>;
}
