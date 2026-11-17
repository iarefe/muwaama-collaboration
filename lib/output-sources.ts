import {seriesPrefix,seriesNumber} from './model.ts';
import type {Project,Output,Question} from './model';

// Pending invitations and private drafts are not inputs to the shared result.
export function submittedParticipants(p:Project,o:Output){
 return p.state.members.filter(m=>(!o.participants||o.participants.includes(m.id))&&m.joined&&(m.submittedOutputs?m.submittedOutputs.includes(o.id):m.submitted));
}
export function outputSources(p:Project,o:Output){
 const submitted=submittedParticipants(p,o),total=p.state.members.filter(m=>!o.participants||o.participants.includes(m.id)).length;
 return {submitted:submitted.length,total,pending:total-submitted.length};
}
export function sourceSummary(p:Project,o:Output){
 const s=outputSources(p,o);
 return s.submitted?`المساهمات المحتسبة: ${s.submitted} من ${s.total}. `+(s.pending?`بانتظار ${s.pending} مشاركين؛ تُحتسب النتائج المتاحة دون انتظارهم، وتبقى مشاركتهم مفتوحة.`:'اكتملت مشاركة الفريق في هذا المخرج.'):'لم تُسلّم أي مساهمة لهذا المخرج بعد؛ المسودات غير محتسبة.';
}
export function submittedOutput(p:Project,o:Output):Output{
 const ids=new Set(submittedParticipants(p,o).map(m=>m.id));
 const visible=o.questions.filter(q=>!q.table?.addedBy||ids.has(q.table.addedBy));
 const rowCodes=new Map<string,string>();
 const rowKey=(q:Question)=>JSON.stringify([q.table?.id,q.table?.addedBy,q.table?.rowId??q.table?.rowIndex]);
 for(const q of visible){
  const prefix=seriesPrefix(q),owner=q.table?.addedBy;
  if(!prefix||!owner)continue;
  const n=seriesNumber(p.state.answers[owner]?.[q.id]?.text,prefix);
  if(n)rowCodes.set(rowKey(q),prefix+'-'+String(n).padStart(2,'0'));
 }
 const byColumn=new Map<string,Question[]>(),keys=new Map<string,string>();
 for(const q of visible){
  const code=rowCodes.get(rowKey(q));if(!code)continue;
  const key=JSON.stringify([q.table!.id,code,q.table!.columnIndex]);
  keys.set(q.id,key);const group=byColumn.get(key)||[];group.push(q);byColumn.set(key,group);
 }
 const questions:Question[]=[];
 for(const q of visible){
  const key=keys.get(q.id),group=key&&byColumn.get(key);
  if(!group||group.length===1){questions.push(q);continue}
  if(group[0]!==q)continue;
  const code=rowCodes.get(rowKey(q))!,t=q.table!;
  const rep=group.find(x=>p.state.finals[x.id]?.manual)||q;
  questions.push({...rep,title:code+' — '+t.column,table:{...t,row:code},alignmentSources:Object.fromEntries(group.map(x=>[x.table!.addedBy!,x.id]))});
 }
 return {...o,questions};
}
export function questionSources(p:Project,o:Output,q:Question){
 if(q.alignmentSources){const sources=Object.entries(q.alignmentSources);return {total:sources.length,count:sources.filter(([id,cell])=>p.state.answers[id]?.[cell]?.text.trim()).length}}
 const members=submittedParticipants(p,o).filter(m=>!q.table?.addedBy||q.table.addedBy===m.id);
 return {total:members.length,count:members.filter(m=>p.state.answers[m.id]?.[q.id]?.text.trim()).length};
}

// Show the submitted material while the corresponding synthesis is pending.
export function outputCell(p:Project,o:Output,q:Question){
 const participants=submittedParticipants(p,o).filter(m=>!q.table?.addedBy||!!q.alignmentSources||q.table.addedBy===m.id);
 const answers=new Set<string>();
 for(const participant of participants){
  const id=q.alignmentSources?q.alignmentSources[participant.id]:q.id;
  const answer=id&&p.state.answers[participant.id]?.[id]?.text.trim();
  if(answer)answers.add(answer);
 }
 const final=p.state.finals[q.id]?.text;
 if(final)return {text:final,status:'صياغة محفوظة'};
 if(answers.size===1)return {text:[...answers][0],status:'من المساهمات المسلّمة'};
 if(answers.size>1)return {text:'',status:'توجد إجابات مختلفة قيد المواءمة. اعرضها من التفاصيل.'};
 return {text:'',status:'لم تُسلّم إجابة لهذه الخانة'};
}
