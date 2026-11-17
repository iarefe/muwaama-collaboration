import {rowKeys,rowRule} from './strategy-row-counts.ts';
import {completedGapCodes,gapMinimum,isGap} from './gap-rows.ts';
import {contributionIssues,choiceBasis,isRatingQuestion,readinessIssues,type ReadinessConfig} from './readiness.ts';
export const PERMISSIONS = ['instructions','template','invite','permissions','output'] as const;
export type Permission = typeof PERMISSIONS[number];
export type User={userId:string,email:string,displayName:string};
export type Member={id:string,name:string,email:string,permissions:Permission[],submitted:boolean,submittedOutputs?:string[],joined:boolean,tokenHash?:string,expires?:string};
export type TableCell={id:string,title:string,rowHeading:string,row:string,column:string,rowIndex:number,columnIndex:number,rowId?:string,addedBy?:string};
export const tablePositionLabel=(label:string|undefined,axis:'row'|'column',index:number)=>label?.trim()||(axis==='row'?'الصف ':'العمود ')+(index+1);
export type QuestionInput={kind:'text'|'choice',options:string[]};
export type Question={alignmentSources?:Record<string,string>,id:string,title:string,prompt:string,guidance:string,fieldKey?:string,required?:boolean,destination?:string,requirement?:string,sourceContext?:string,table?:TableCell,input?:QuestionInput};
export type TemplateTable={id:string,title:string,rowHeading:string,rows:string[],columns:{label:string,kind:'text'|'choice'|'fixed',fixedValues:string[]}[],rowMode?:'fixed'|'repeatable',allowExtraRows?:boolean,instructions?:string,examples?:string[],rowTemplate?:Question[]};
export type Output={id:string,title:string,format:'sections'|'table',assignee:string,sourceFileId?:string,sourceFileName?:string,sourceReviewed?:boolean,strategyWord?:boolean,teamRows?:Record<string,string[]>,rowChecks?:string[],otherSubmittedGaps?:string[],reservedGapCodes?:string[],strategyExcluded?:string[],readiness?:ReadinessConfig,templateInstructions?:string,participants?:string[],closedAt?:string,finalReportKey?:string,tables?:TemplateTable[],questions:Question[]};
export type Answer={text:string,updated:string};
export type Revision={text:string,by:string,at:string};
export type Final={text:string,aiText:string,manual:boolean,by:string,updated:string,differences:{difference:string,treatment:string,reason:string}[],pending?:string,sourceHash?:string,choiceBasis?:string,revisions:Revision[]};
export type Attachment={id:string,name:string,kind:'instructions'|'template',size:number,type:string,key:string};
export type TemplateSlot={id:string,outputId:string,title:string,destination:string,requirement:string,required?:boolean,sourceContext?:string,table?:TableCell,input?:QuestionInput};
export type TemplatePlan={fileId:string,next:number,slots:TemplateSlot[]};
export type AnalysisDraft={sourceHash:string,cursor:number,total:number,instructions?:string,outputs:Output[],filePage?:number,filePageCount?:number,pageCursor?:string,pages?:number,plan?:TemplatePlan,ready?:boolean,fallbackQuestionIds?:string[],excludedQuestionIds?:string[]};
export type RoundSnapshot={id:string,at:string,by:string,round:number,members:string[],outputCount:number};
export type State={round?:number,history?:RoundSnapshot[],description:string,instructions:string,status:'draft'|'active'|'complete'|'archived',members:Member[],outputs:Output[],answers:Record<string,Record<string,Answer>>,finals:Record<string,Final>,files:Attachment[],activity:{text:string,by:string,at:string}[],aiError?:string,aiCalls:number,aiTokens:number,aiLock?:string,analyzedFiles?:string,analysis?:AnalysisDraft,referenceContext?:{sourceHash:string,next:number,text:string}};
export type Project={id:string,space:string,owner:string,title:string,state:State,version:number,created:string,updated:string};
export class AppError extends Error {status:number;code?:string;constructor(message:string,status=400,code?:string){super(message);this.status=status;this.code=code}}
export const now=()=>new Date().toISOString();
export const uid=()=>crypto.randomUUID();
export const member=(p:Project,id:string)=>p.state.members.find(m=>m.id===id&&m.joined);
export function can(p:Project,id:string,perm:Permission){return p.owner===id||!!member(p,id)?.permissions.includes(perm)}
export function requireMember(p:Project,id:string){const m=member(p,id);if(!m)throw new AppError('لا تملك صلاحية الوصول إلى هذا المشروع.',403);return m;}
export function allow(p:Project,id:string,perm:Permission){requireMember(p,id);if(!can(p,id,perm))throw new AppError('هذا الإجراء غير متاح ضمن صلاحياتك.',403)}
export function canEditOutput(p:Project,id:string,o:Output){return !o.finalReportKey&&(p.owner===id||o.assignee===id);}
export function canViewOutput(p:Project,id:string){return can(p,id,'output')||p.state.outputs.some(o=>o.assignee===id)}
export const questions=(p:Project)=>p.state.outputs.flatMap(o=>o.questions);
export const contributionQuestions=(o:Output,user:string)=>o.questions.filter(q=>(!q.table?.addedBy||q.table.addedBy===user)&&(!o.strategyWord||o.assignee===user||!['strategy-1','strategy-2','strategy-3','strategy-7'].includes(q.table?.id||'')));
export const outputForQuestion=(p:Project,qid:string)=>p.state.outputs.find(o=>o.questions.some(q=>q.id===qid));
export const participants=(p:Project,o:Output)=>p.state.members.filter(m=>!o.participants||o.participants.includes(m.id));
export const submittedTo=(m:Member,o:Output)=>m.joined&&(m.submittedOutputs?m.submittedOutputs.includes(o.id):m.submitted);
export const outputComplete=(p:Project,o:Output)=>!!o.closedAt||(participants(p,o).length>0&&participants(p,o).every(m=>submittedTo(m,o)));
export function participationClosed(p:Project){
 return ['active','complete'].includes(p.state.status)&&p.state.outputs.length>0&&p.state.outputs.every(o=>outputComplete(p,o));
}
export const outputProgress=(p:Project,o:Output)=>participants(p,o).filter(m=>submittedTo(m,o)).length;
export function normalizeProject(p:Project){
 for(const m of p.state.members)m.submittedOutputs??=m.submitted?p.state.outputs.map(o=>o.id):[];
 if(p.state.status!=='draft')for(const o of p.state.outputs){o.participants??=p.state.members.map(m=>m.id);if(outputComplete(p,o))o.closedAt??=p.updated;}
 for(const m of p.state.members){const assigned=p.state.outputs.filter(o=>participants(p,o).some(x=>x.id===m.id));m.submitted=m.joined&&assigned.length>0&&assigned.every(o=>submittedTo(m,o));}
 return p;
}
export function addParticipant(p:Project,m:Member){
 normalizeProject(p);p.state.members.push(m);
 if(p.state.status==='active')for(const o of p.state.outputs)if(!o.closedAt)o.participants!.push(m.id);
}
export function progress(p:Project,qid:string){const o=outputForQuestion(p,qid);return o?participants(p,o).filter(m=>submittedTo(m,o)&&p.state.answers[m.id]?.[qid]?.text.trim()).length:0;}
export function log(p:Project,by:string,text:string){p.state.activity.unshift({by,text,at:now()});p.state.activity=p.state.activity.slice(0,100)}
export function text(value:unknown,max=10000,required=false,label='النص'){
 if(typeof value!=='string')throw new AppError('تعذّر قراءة '+label+' كنص. حدّث الصفحة وأعد المحاولة.');
 if(required&&!value.trim())throw new AppError('أكمل '+label+' قبل المتابعة.');
 if(value.length>max)throw new AppError(label+' أطول من الحد المتاح ('+max+' حرفًا؛ الطول الحالي '+value.length+').');
 return value.trim();
}
// Source labels can be whole sentences or rubric descriptions. Preserve them verbatim.
export const TEMPLATE_TEXT_MAX=100000;
export function editable(p:Project){if(p.state.status!=='draft')throw new AppError('يتاح تعديل بنية المشروع في مرحلة الإعداد فقط.');}
function otherGapCodes(p:Project,o:Output,user:string){
 return [...new Set(participants(p,o).filter(m=>m.id!==user&&submittedTo(m,o)).flatMap(m=>completedGapCodes(contributionQuestions(o,m.id),q=>p.state.answers[m.id]?.[q.id]?.text||'')))];
}
function teamRowContext(p:Project,o:Output,user:string){
 const others=participants(p,o).filter(m=>m.id!==user);
 const last=others.every(m=>submittedTo(m,o));
 const teamRows:Record<string,string[]>={},rowChecks:string[]=[];
 const submitted=others.filter(m=>submittedTo(m,o)).map(m=>({questions:contributionQuestions(o,m.id),values:Object.fromEntries(Object.entries(p.state.answers[m.id]||{}).map(([id,a])=>[id,a.text]))}));
 for(const t of o.tables||[]){
  if(!rowRule(t))continue;
  teamRows[t.id]=submitted.flatMap(m=>rowKeys(m.questions,m.values,t.id));
  if(last||(['strategy-2','strategy-3'].includes(t.id)&&user===o.assignee))rowChecks.push(t.id);
 }
 return {teamRows,rowChecks};
}
function reservedByOthers(p:Project,o:Output,user:string){
 const codes=new Set<string>();
 for(const m of participants(p,o)){
  if(m.id===user)continue;
  for(const q of contributionQuestions(o,m.id)){
   if(!isGap(q)||q.table?.columnIndex!==0)continue;
   const code=p.state.answers[m.id]?.[q.id]?.text;
   if(code)codes.add(code);
  }
 }
 return [...codes];
}
const codeSeries:Record<string,string>={'strategy-15':'DO','strategy-17':'KPI','strategy-19':'INIT','strategy-52':'EA','strategy-58':'UC','strategy-64':'RISK'};
export function seriesPrefix(q:Question){
 const t=q.table;if(!t)return undefined;
 if(codeSeries[t.id]&&t.columnIndex===0)return codeSeries[t.id];
 if(/^(?:الرمز|رمز المؤشر)(?:\s*\(KPI\))?$/.test(t.column.trim())&&/مؤشرات الأداء الرئيس/.test(t.title||''))return 'KPI';
}
export function isReadinessCode(value:string){
 const s=value.trim().replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069\s]/g,'').replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632));
 return /^(?:R\d+[.٫]\d+|\d+[.٫]\d+R)$/i.test(s);
}
export function repairReadinessCodes(p:Project,o:Output){
 if(p.state.status!=='active'||o.closedAt||o.finalReportKey)return;
 const cells=o.questions.filter(q=>seriesPrefix(q)==='KPI');
 for(const answers of Object.values(p.state.answers)){
  const used=new Set<number>(),wrong:Answer[]=[];
  for(const q of cells){
   const a=answers[q.id];if(!a?.text)continue;
   const n=seriesNumber(a.text,'KPI');
   if(n!==undefined)used.add(n);else if(isReadinessCode(a.text))wrong.push(a);
  }
  let n=1;for(const a of wrong){while(used.has(n))n++;a.text='KPI-'+String(n++).padStart(2,'0');}
 }
}
export const isSeriesCode=(q:Question)=>!!seriesPrefix(q);
export function seriesNumber(value:string|undefined,prefix:string){
 const normalized=value?.trim().toUpperCase().replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[–—‑]/g,'-');
 const match=normalized?.match(/^([A-Z]+)\s*-\s*(\d+)$/);
 return match&&match[1]===prefix?Number(match[2]):undefined;
}
export function usedSeriesNumbers(p:Project,o:Output,q:Question,user:string,drafts:Record<string,string>){
 const numbers=new Set<number>(),prefix=seriesPrefix(q)!;
 for(const cell of o.questions.filter(x=>seriesPrefix(x)===prefix)){
  if(cell.id===q.id)continue;
  const n=seriesNumber(drafts[cell.id]??p.state.answers[user]?.[cell.id]?.text,prefix);
  if(n!==undefined)numbers.add(n);
 }
 return numbers;
}
export function saveAnswers(p:Project,user:string,answers:Record<string,string>,submit:boolean,outputId?:string){
 const m=requireMember(p,user);normalizeProject(p);
 const o=outputId?p.state.outputs.find(o=>o.id===outputId):p.state.outputs.length===1?p.state.outputs[0]:undefined;
 if(!o)throw new AppError('حدّد المخرج الذي تساهم فيه.');
 if((o.strategyWord&&!o.sourceReviewed)||p.state.status!=='active'||outputComplete(p,o))throw new AppError('أُغلق تعديل إجابات هذا المخرج أو لم تبدأ المشاركة بعد.',409,'OUTPUT_CLOSED');
 if(!participants(p,o).some(x=>x.id===user))throw new AppError('أنت غير مشارك في هذا المخرج.',403);
 const own=contributionQuestions(o,user),ids=new Set(own.map(q=>q.id));const next={...(p.state.answers[user]||{})};
 for(const [id,value] of Object.entries(answers)){if(!ids.has(id))throw new AppError('البند لا ينتمي إلى نموذج هذا المخرج.');const q=o.questions.find(q=>q.id===id)!,answer=text(value,q.input?.kind==='choice'?TEMPLATE_TEXT_MAX:6000,false,'الإجابة');if(answer&&q.input?.kind==='choice'&&!q.input.options.includes(answer))throw new AppError('اختر تقييمًا من الخيارات المحددة في القالب.');next[id]={text:answer,updated:now()};}
 {
  for(const q of own.filter(isSeriesCode)){
   const code=answers[q.id]?.trim();
   if(code&&seriesPrefix(q)==='KPI'&&isReadinessCode(code))throw new AppError('هذا رمز معيار جاهزية. استخدم رمز مؤشر مثل KPI-01 أو ولّف خانة الرمز.');
   const n=seriesNumber(code,seriesPrefix(q)!);
   if(n!==undefined&&code!==p.state.answers[user]?.[q.id]?.text&&usedSeriesNumbers(p,o,q,user,answers).has(n))
    throw new AppError('الرمز '+code+' مستخدم في صف آخر من مساهمتك. اختر رمزًا مختلفًا لهذا الصف.',409,'ROW_CODE_USED');
  }
  const reserved=new Set(reservedByOthers(p,o,user));
  for(const q of own.filter(q=>isGap(q)&&q.table?.columnIndex===0)){
   const code=next[q.id]?.text;
   if(code&&code!==p.state.answers[user]?.[q.id]?.text&&reserved.has(code))
    throw new AppError('حفظ مشارك آخر الفجوة '+code+'. اختر رمزًا آخر لهذا الصف.',409,'GAP_RESERVED');
  }
 }
 if((submit||submittedTo(m,o))&&o.strategyWord){const issue=contributionIssues({...o,...teamRowContext(p,o,user),questions:own},Object.fromEntries(Object.entries(next).map(([id,a])=>[id,a.text])))[0];if(issue)throw new AppError(issue.message);}
 if((submit||submittedTo(m,o))&&o.readiness){const issues=readinessIssues({...o,questions:own},Object.fromEntries(Object.entries(next).map(([id,a])=>[id,a.text])));if(issues.length)throw new AppError('تحقق من النموذج: '+issues.slice(0,4).join(' '));}
 if((submit||submittedTo(m,o))&&(!own.length||own.some(q=>q.required!==false&&!next[q.id]?.text.trim())))throw new AppError('أكمل إجابات جميع بنود هذا المخرج قبل إتمام المشاركة.');
 if(submit&&o.strategyWord&&own.some(q=>isGap(q)&&q.table?.columnIndex===0)&&participants(p,o).every(m=>m.id===user||submittedTo(m,o))){
  const codes=new Set([...otherGapCodes(p,o,user),...completedGapCodes(own,q=>next[q.id]?.text||'')]);
  if(codes.size<gapMinimum)throw new AppError('قبل إغلاق مساهمات الفريق، أكملوا '+gapMinimum+' فجوات مختلفة في القسم 1.2. المكتمل حاليًا '+codes.size+'.');
 }
 p.state.answers[user]=next;
 if(submit&&!submittedTo(m,o)){m.submittedOutputs!.push(o.id);log(p,m.name,'أكمل مشاركته في «'+o.title+'»');}
 if(outputComplete(p,o)){o.closedAt=now();log(p,'موائمة','اكتملت مشاركة الجميع وأُغلق نموذج «'+o.title+'»');}
 normalizeProject(p);
 if(p.state.outputs.every(o=>outputComplete(p,o))){p.state.status='complete';log(p,'موائمة','اكتملت المشاركة في جميع المخرجات');}
}
export function saveAnswerPatch(p:Project,user:string,answers:Record<string,string>,baseAnswers:Record<string,string>,submit:boolean,outputId:string,round:number){
 requireMember(p,user);
 if((p.state.round||0)!==round)throw new AppError('بدأت جولة جديدة للمشروع. إجاباتك السابقة لم تُنقل إليها؛ راجع الجولة الحالية.',409,'ROUND_CHANGED');
 if(!answers||typeof answers!=='object'||Array.isArray(answers)||!baseAnswers||typeof baseAnswers!=='object'||Array.isArray(baseAnswers))throw new AppError('الإجابات غير صحيحة.');
 const o=p.state.outputs.find(o=>o.id===outputId);if(!o)throw new AppError('حدّد المخرج الذي تساهم فيه.');
 const own=new Map(contributionQuestions(o,user).map(q=>[q.id,q]));
 const merged={...answers};
 for(const [id,value] of Object.entries(answers)){
  const q=own.get(id);if(!q)throw new AppError('البند لا ينتمي إلى نموذج هذا المخرج.');
  if(typeof value!=='string'||typeof baseAnswers[id]!=='string')throw new AppError('الإجابات غير صحيحة.');
  const current=p.state.answers[user]?.[id]?.text||'';
  // A stale tab can still hold the readiness identifier replaced during load.
  // Keep the server's valid KPI while allowing the rest of this patch to commit.
  if(seriesPrefix(q)==='KPI'&&seriesNumber(current,'KPI')&&current!==value.trim()&&
     (isReadinessCode(value)||(isReadinessCode(baseAnswers[id])&&seriesNumber(value,'KPI'))||
      (!baseAnswers[id].trim()&&seriesNumber(value,'KPI')))){
   delete merged[id];continue;
  }
  if(current!==baseAnswers[id].trim()&&current!==value.trim())throw new AppError('عُدّلت إجابتك عن «'+q.title+'» من نافذة أخرى. النص الحالي لم يُستبدل؛ انسخ تعديلك وافتح النموذج في تبويب جديد للمقارنة.',409,'ANSWER_CONFLICT');
 }
 saveAnswers(p,user,merged,submit,outputId);
}
export function setFinal(p:Project,id:string,qid:string,value:string){const o=p.state.outputs.find(o=>o.questions.some(q=>q.id===qid));if(!o||!canEditOutput(p,id,o))throw new AppError('تحرير هذا المخرج متاح للمكلّف به والمنشئ فقط.',403);if(p.state.status==='archived')throw new AppError('المشروع مؤرشف.');const q=o.questions.find(q=>q.id===qid)!;if(o.readiness&&isRatingQuestion(q))throw new AppError('درجة المعيار محسوبة تلقائيًا بمتوسط المساهمات المسلّمة؛ تُعدّل درجات المشاركين من نماذجهم.');if(o.readiness&&q.input?.kind==='choice'&&!q.input.options.includes(value))throw new AppError('اختر قيمة من خيارات الحقل؛ لا يقبل التقييم نصًا أو متوسطًا.');const f=p.state.finals[qid];const t=now();p.state.finals[qid]={text:text(value,20000,true),aiText:f?.aiText||'',manual:true,choiceBasis:o.readiness&&q.input?.kind==='choice'?choiceBasis(p,o,q):undefined,by:member(p,id)!.name,updated:t,differences:f?.differences||[],sourceHash:f?.sourceHash,revisions:[...(f?.revisions||[]),...(f?[{text:f.text,by:f.by,at:f.updated}]:[])].slice(-20)};log(p,member(p,id)!.name,'عدّل الصياغة النهائية');}
export function mergeAI(p:Project,qid:string,value:string,differences:Final['differences'],hash:string){const f=p.state.finals[qid];if(f?.manual){f.pending=value;f.aiText=value;f.differences=differences;f.sourceHash=hash;}else p.state.finals[qid]={text:value,aiText:value,manual:false,by:'موائمة',updated:now(),differences,sourceHash:hash,revisions:f?[...f.revisions,{text:f.text,by:f.by,at:f.updated}].slice(-20):[]};}
export function visibleProject(p:Project,id:string){requireMember(p,id);const s=structuredClone(p);delete s.state.referenceContext;s.state.history=s.state.history?.filter(h=>p.owner===id||h.members.includes(id));if(!can(p,id,'template'))delete s.state.analysis;if(s.state.analysis)delete s.state.analysis.instructions;s.state.members.forEach(m=>{delete m.tokenHash;delete m.expires;if(!can(p,id,'invite')&&m.id!==id) m.email=''});if(!can(p,id,'instructions')){s.state.instructions='';s.state.files=s.state.files.filter(f=>f.kind!=='instructions')};if(!can(p,id,'template'))s.state.files=s.state.files.filter(f=>f.kind!=='template');s.state.files.forEach(f=>{f.key=''});if(!canViewOutput(p,id)){s.state.answers={[id]:s.state.answers[id]||{}};s.state.finals={};}else{const allowed=p.state.outputs.filter(o=>can(p,id,'output')||o.assignee===id).flatMap(o=>o.questions.map(q=>q.id));s.state.finals=Object.fromEntries(Object.entries(s.state.finals).filter(([k])=>allowed.includes(k)));s.state.answers=Object.fromEntries(Object.entries(s.state.answers).map(([u,a])=>[u,u===id?a:Object.fromEntries(Object.entries(a).filter(([k])=>{const o=outputForQuestion(p,k),m=member(p,u);return allowed.includes(k)&&!!o&&!!m&&submittedTo(m,o)}))]).filter(([u,a])=>u===id||Object.keys(a).length>0));}for(const o of s.state.outputs){if(o.strategyWord){Object.assign(o,teamRowContext(p,o,id));o.otherSubmittedGaps=otherGapCodes(p,o,id);o.reservedGapCodes=reservedByOthers(p,o,id);}if(o.readiness&&!(can(p,id,'output')||o.assignee===id))o.readiness={version:1};o.questions=o.questions.filter(q=>!q.table?.addedBy||q.table.addedBy===id||((can(p,id,'output')||o.assignee===id)&&!!member(p,q.table.addedBy)&&submittedTo(member(p,q.table.addedBy)!,o)));}return s;}
export function newProject(user:User,space:string,title:string,description:string):Project {const t=now();return {id:uid(),space,owner:user.userId,title,version:0,created:t,updated:t,state:{description,instructions:'',status:'draft',members:[{id:user.userId,name:user.displayName,email:user.email.toLowerCase(),permissions:[...PERMISSIONS],submitted:false,submittedOutputs:[],joined:true}],outputs:[],answers:{},finals:{},files:[],activity:[{text:'أنشأ المشروع',by:user.displayName,at:t}],aiCalls:0,aiTokens:0}};}

// Keep stable IDs and assignees while adding successive extraction pages.
export function mergeTemplatePage(existing:Output[],page:any[],owner:string):Output[]{
 const outputs=structuredClone(existing);
 const key=(s:string)=>s.trim().replace(/\s+/g,' ');
 for(const item of page){
  const title=text(item.title,150,true);let o=(item.outputId?outputs.find(o=>o.id===item.outputId):undefined)||outputs.find(o=>key(o.title)===key(title));
  if(!o){o={id:uid(),title,format:item.format==='table'?'table':'sections',assignee:owner,questions:[]};outputs.push(o)}
  for(const q of item.questions){const next={id:uid(),title:text(q.title,150,true),prompt:text(q.prompt,1000,true),guidance:text(q.guidance||'',2000)};if(!o.questions.some(q=>key(q.title)===key(next.title)&&key(q.prompt)===key(next.prompt)))o.questions.push(next);}
 }
 return outputs;
}

export function invalidateAnalysis(p:Project){delete p.state.analysis;delete p.state.analyzedFiles;}

export function reopenForSetup(p:Project,user:string,snapshot:RoundSnapshot){
 if(user!==p.owner)throw new AppError('إعادة المشروع إلى الإعداد متاحة للمنشئ فقط.',403);
 if(!['active','complete'].includes(p.state.status))throw new AppError('يمكن إعادة المشروع المفتوح أو المكتمل إلى الإعداد.');
 p.state.history=[snapshot,...(p.state.history||[])];p.state.round=(p.state.round||0)+1;p.state.status='draft';
 const locked=p.state.outputs.filter(o=>o.finalReportKey);
 const lockedQuestions=new Set(locked.flatMap(o=>o.questions.map(q=>q.id)));
 for(const [userId,answers] of Object.entries(p.state.answers)){for(const id of Object.keys(answers))if(!lockedQuestions.has(id))delete answers[id];if(!Object.keys(answers).length)delete p.state.answers[userId];}
 for(const id of Object.keys(p.state.finals))if(!lockedQuestions.has(id))delete p.state.finals[id];
 for(const m of p.state.members){m.submitted=false;m.submittedOutputs=m.submittedOutputs?.filter(id=>locked.some(o=>o.id===id))||[];}
 for(const o of p.state.outputs){if(o.finalReportKey)continue;restoreTableTemplates(o);delete o.participants;delete o.closedAt;}
 invalidateAnalysis(p);delete p.state.aiLock;delete p.state.aiError;
 log(p,member(p,user)!.name,'أعاد المشروع إلى الإعداد وحفظ المساهمات السابقة');
}
export function visibleSnapshot(saved:Project,current:Project,user:string){
 requireMember(current,user);
 const result=structuredClone(saved);result.owner=current.owner;
 result.state.members=current.state.members.map(m=>{const old=saved.state.members.find(x=>x.id===m.id);return {...m,submitted:old?.submitted||false,submittedOutputs:old?.submittedOutputs||[]}});
 for(const o of result.state.outputs)o.assignee=current.state.outputs.find(x=>x.id===o.id)?.assignee||current.owner;
 result.state.history=[];delete result.state.analysis;delete result.state.referenceContext;
 return visibleProject(result,user);
}

// Repeated records belong to their contributor, never to a shared row number.
export function appendRow(o:Output,t:TemplateTable,user:string,requestId?:string){
 const prototypes=t.rowTemplate||o.questions.filter(q=>q.table?.id===t.id).filter((q,_,all)=>q.table!.rowIndex===Math.min(...all.map(x=>x.table!.rowIndex)));
 if(!prototypes.length)throw new AppError('لا توجد خانات إدخال متاحة في هذا الجدول.');
 const rowIndex=t.rows.length,rowId=requestId||uid();t.rows.push('');
 const added=prototypes.map(source=>{const q=structuredClone(source),columnIndex=q.table!.columnIndex,column=q.table!.column;q.id=requestId?rowId+'-'+columnIndex:uid();q.title=tablePositionLabel('','row',rowIndex)+' — '+tablePositionLabel(column,'column',columnIndex);q.sourceContext='';if(t.rowMode!=='repeatable'){q.guidance=t.instructions||'';q.prompt='ما مساهمتك في «'+tablePositionLabel(column,'column',columnIndex)+'» لهذا الصف؟';}q.destination=t.title+' / صف مضاف '+(rowIndex+1)+' / '+tablePositionLabel(column,'column',columnIndex);q.table={...q.table!,row:'',rowIndex,rowId,addedBy:user};return q});
 o.questions.push(...added);return {rowId,questionId:added[0].id};
}
export function initializeRepeatingRows(p:Project,user?:string){
 for(const o of p.state.outputs){if(outputComplete(p,o))continue;
  for(const t of o.tables||[]){if(t.rowMode!=='repeatable'||o.strategyWord)continue;
   if(!t.rowTemplate){const base=o.questions.filter(q=>q.table?.id===t.id&&!q.table.addedBy);if(!base.length)continue;const first=Math.min(...base.map(q=>q.table!.rowIndex));t.rowTemplate=structuredClone(base.filter(q=>q.table!.rowIndex===first));o.questions=o.questions.filter(q=>q.table?.id!==t.id);t.rows=[];}
   for(const m of participants(p,o).filter(m=>m.joined&&(!user||m.id===user))){if(!o.questions.some(q=>q.table?.id===t.id&&q.table.addedBy===m.id))appendRow(o,t,m.id);}
  }
 }
}
export function changeContributionRow(p:Project,user:string,outputId:string,tableId:string,rowId?:string,requestId?:string){
 const m=requireMember(p,user),o=p.state.outputs.find(o=>o.id===outputId),t=o?.tables?.find(t=>t.id===tableId);
 if(!o||!t)throw new AppError('الجدول غير موجود.');
 if(o.strategyWord&&rowId?.startsWith('starter-'))throw new AppError('يمكنك مسح قيم السجل الأول أو حذف سجل أضفته.');
 if(o.strategyWord&&o.assignee!==user&&['strategy-1','strategy-2','strategy-3','strategy-7'].includes(t.id))throw new AppError('هذا الجدول للمكلّف بالمخرج.',403);
 if((o.strategyWord&&!o.sourceReviewed)||p.state.status!=='active'||outputComplete(p,o))throw new AppError('أُغلق تعديل إجابات هذا المخرج أو لم تبدأ المشاركة بعد.',409,'OUTPUT_CLOSED');
 if(!participants(p,o).some(m=>m.id===user))throw new AppError('أنت غير مشارك في هذا المخرج.',403);
 if(o.readiness&&t.rowMode==='fixed')throw new AppError('صفوف المعايير والمحاور ثابتة لارتباطها بقواعد الحساب.');
 if(!(t.allowExtraRows??t.rowMode==='repeatable'))throw new AppError('صفوف هذا الجدول ثابتة وفق القالب.');
 if(rowId){
  const removed=o.questions.filter(q=>q.table?.rowId===rowId&&q.table.id===tableId);
  if(!removed.length||removed.some(q=>q.table?.addedBy!==user))throw new AppError('يمكنك حذف الصفوف التي أضفتها فقط.',403);
  if(t.rowMode==='repeatable'&&new Set(o.questions.filter(q=>q.table?.id===tableId&&q.table.addedBy===user).map(q=>q.table!.rowId)).size<=1)throw new AppError('أبقِ صفًا واحدًا على الأقل في هذا الجدول.');
  const ids=new Set(removed.map(q=>q.id));o.questions=o.questions.filter(q=>!ids.has(q.id));for(const id of ids){delete p.state.answers[user]?.[id];delete p.state.finals[id];}
  return {};
 }
 if(requestId){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))throw new AppError('معرّف الصف غير صالح.');
  const existing=o.questions.find(q=>q.table?.rowId===requestId);
  if(existing){
   if(existing.table?.id!==t.id||existing.table.addedBy!==user)throw new AppError('تعارض معرّف الصف.',409);
   return {rowId:requestId,questionId:existing.id,existing:true};
  }
 }
 // A newly added record is a draft until its contributor submits it again.
 m.submittedOutputs=(m.submittedOutputs||[]).filter(id=>id!==o.id);m.submitted=false;
 return appendRow(o,t,user,requestId);
}
export function restoreTableTemplates(o:Output){
 for(const t of o.tables||[]){if(t.rowTemplate){o.questions=o.questions.filter(q=>q.table?.id!==t.id);o.questions.push(...structuredClone(t.rowTemplate));t.rows=[''];delete t.rowTemplate;}else{o.questions=o.questions.filter(q=>!(q.table?.id===t.id&&q.table.addedBy));const last=Math.max(-1,...o.questions.filter(q=>q.table?.id===t.id).map(q=>q.table!.rowIndex));t.rows=t.rows.slice(0,last+1);}}
}
