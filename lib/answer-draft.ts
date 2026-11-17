export type AnswerValues=Record<string,string>;
export function answerPatch(values:AnswerValues,base:AnswerValues){
 const answers:AnswerValues={},baseAnswers:AnswerValues={};
 for(const [id,value] of Object.entries(values))if(value.trim()!==(base[id]||'').trim()){answers[id]=value;baseAnswers[id]=base[id]||''}
 return {answers,baseAnswers};
}
// A per-user, per-output, per-round backup is restored only in the same browser tab.
export function restoreAnswerDraft(raw:string|null,saved:AnswerValues){
 if(!raw)return null;
 try{const d=JSON.parse(raw);if(!d||typeof d.answers!=='object'||typeof d.baseAnswers!=='object')return null;
 const values={...saved},base={...saved};let changed=false;
 for(const id of Object.keys(saved))if(typeof d.answers[id]==='string'&&typeof d.baseAnswers[id]==='string'&&d.answers[id].trim()!==saved[id].trim()){values[id]=d.answers[id];base[id]=d.baseAnswers[id];changed=true}
 return changed?{values,base}:null;
 }catch{return null}
}
