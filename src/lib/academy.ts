export function gradeAttempt(courseId:string, answers:unknown){return {courseId,score:0,passed:false,answersReceived:answers?Object.keys(answers as object).length:0};}
