import type {Output,Question,TemplateTable} from './model';
import {completedGapCodes} from './gap-rows.ts';

const templateCounts:Record<string,[number,string]>={
 'strategy-13':[3,'3–5 ركائز'],'strategy-17':[8,'8–12 مؤشرًا'],'strategy-19':[10,'10–15 مبادرة'],
 'strategy-34':[5,'خمسة إجراءات'],'strategy-49':[12,'12 خدمة على الأقل في الدرجة 2 فأعلى، منها 4 في الدرجة 3'],
 'strategy-55':[2,'خدمتان حرجتان على الأقل'],'strategy-58':[3,'ثلاث حالات استخدام على الأقل'],'strategy-64':[6,'6–8 مخاطر']
};
export function rowRule(t:TemplateTable){
 if(t.rowMode!=='repeatable'&&!t.allowExtraRows)return;
 if(t.id==='strategy-2')return {min:1,label:'سجّل إصدارًا واحدًا مكتملًا على الأقل، وأضف صفًا لكل إصدار لاحق.'};
 const specified=templateCounts[t.id];
 return {min:specified?.[0]??3,label:specified?'المطلوب في القالب: '+specified[1]:'الحد الأدنى المعتمد للفريق: 3 صفوف مكتملة'};
}
export function rowKeys(qs:Question[],values:Record<string,string>,id:string){
 const rows=new Map<string,Question[]>();
 for(const q of qs){
  if(q.table?.id!==id)continue;
  const key=q.table.rowId||String(q.table.rowIndex);
  const group=rows.get(key)||[];group.push(q);rows.set(key,group);
 }
 const keys:string[]=[];
 for(const [key,row] of rows){
  if(!row.every(q=>values[q.id]?.trim()))continue;
  if(id==='strategy-10'){keys.push(...completedGapCodes(row,q=>values[q.id]));continue}
  if(id==='strategy-49'){
   const target=values[row.find(q=>q.table?.columnIndex===3)?.id||''];
   if(Number(target)<2||!target)continue;
   if(target==='3')keys.push('level3:'+key);
  }
  keys.push(key);
 }
 return keys;
}
export function rowProgress(o:Output,t:TemplateTable,values:Record<string,string>){
 const keys=new Set([...(o.teamRows?.[t.id]||[]),...rowKeys(o.questions,values,t.id)]);
 const level3=[...keys].filter(k=>k.startsWith('level3:')).length;
 return {count:keys.size-level3,level3};
}
export function rowShortfalls(o:Output,v:Record<string,string>){
 return (o.tables||[]).flatMap(t=>{
  const rule=rowRule(t),q=o.questions.find(x=>x.table?.id===t.id);
  if(!q||!rule||!o.rowChecks?.includes(t.id))return [];
  const {count,level3}=rowProgress(o,t,v);
  if(count>=rule.min&&(t.id!=='strategy-49'||level3>=4))return [];
  return [{questionId:q.id,section:t.title,message:t.title+' — '+rule.label+'. المكتمل '+count+'، والمتبقي '+Math.max(0,rule.min-count)+(t.id==='strategy-49'?'؛ المتبقي في الدرجة 3: '+Math.max(0,4-level3):'')+'.'}];
 });
}
