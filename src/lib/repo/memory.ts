import type { AcademyRepo, User, ProgressRecord, ActivityRecord, AttemptRecord } from './types';
export class MemoryRepo implements AcademyRepo {
 async findUserByEmail(_email:string):Promise<User|null>{return null;} async findUserById(_id:string):Promise<User|null>{return null;}
 async createUser(_x:{name:string;email:string;passwordHash:string}):Promise<User>{throw new Error('Persistent database required');}
 async listProgress(_id:string):Promise<ProgressRecord[]>{return [];} async saveProgress():Promise<void>{throw new Error('Persistent database required');}
 async recordActivity():Promise<void>{throw new Error('Persistent database required');} async recordAttempt():Promise<void>{throw new Error('Persistent database required');}
 async getCertificate():Promise<unknown|null>{return null;}
}
