import {budgetAmount,budgetCaps} from './budget-amount.ts';
import {rowShortfalls} from './strategy-row-counts.ts';
import {submittedParticipants,submittedOutput,outputSources,sourceSummary} from './output-sources.ts';
import {fieldGuide} from './template-guide.ts';
import type {Output,Question,Attachment,Project,TemplateTable} from './model';
import {axes,criteria,scoring} from './readiness-template.ts';
export {axes};
export const CLEAN_READINESS_HASH='public-example-template';
export const gradeLabels=['غائب أو ابتدائي — لا ممارسة معتمدة','ناشئ — ممارسة جزئية أو غير منتظمة','محدد — موثقة ومعتمدة ومطبقة','مدار — مقيسة بمؤشرات دورية','محسّن — تحسين مستمر بالبيانات'];
export const rubric=scoring+'\nاحتساب تقييمات الفريق: درجة كل معيار هي متوسط درجات المشاركين الذين سلّموا مساهماتهم، دون المسودات أو الدرجات الفارغة.';
export const methodologyFields=[["scope","النطاق"],["evidence","مصادر الأدلة"],["team","فريق التقييم والمراجعة"],["limits","حدود التقييم"]] as const;
export type ReadinessConfig={version:1,methodology?:Record<string,{scope:string,evidence:string,team:string,limits:string}>,plan?:Record<string,{target2027:string,target2029:string,initiatives:string,budgetReference:string}>,excludedRecords?:string[],excludedGaps?:string[],checks?:{codes?:boolean,document?:boolean},checkedAgainst?:string};
const id=()=>crypto.randomUUID();
type Col={key:string,label:string,prompt?:string,options?:string[],fixed?:string[],optional?:boolean};
export function buildReadiness(f:Attachment,owner:string):Output{
 const o:Output={id:id(),title:'تقرير جاهزية التحول الرقمي',format:'sections',assignee:owner,sourceFileId:f.id,sourceFileName:f.name,sourceReviewed:true,readiness:{version:1},templateInstructions:scoring+'\nالملخص التنفيذي وملخص درجات المحاور واللوحة والامتثال تُنشأ من الإجابات. العضو يدخل مصادر البيانات فقط؛ المستهدفات ومرجع تمويلها يعتمدها المكلّف من الخطة. لا تُرسل الأمثلة كإجابات.',questions:[],tables:[]};
 function table(title:string,location:string,rows:string[],columns:Col[],prefix:(r:number)=>string,repeat=false,instructions='',examples:string[]=[]){
  const tid=id();const t:TemplateTable={id:tid,title,rowHeading:repeat?'':'البند',rows,columns:columns.map(c=>({label:c.label,kind:c.fixed?'fixed':c.options?'choice':'text',fixedValues:c.fixed||[]})),rowMode:repeat?'repeatable':'fixed',allowExtraRows:repeat,instructions,examples};o.tables!.push(t);
  rows.forEach((row,r)=>columns.forEach((c,j)=>{if(c.fixed)return;const title=(row||'الصف 1')+' — '+c.label;o.questions.push({id:id(),title,fieldKey:prefix(r)+'.'+c.key,prompt:c.prompt||'أدخل '+c.label+' لهذا البند.',guidance:instructions,required:!c.optional,destination:location+' / '+(row||'سجل مضاف')+' / '+c.label,sourceContext:columns.filter(x=>x.fixed).map(x=>x.label+': '+x.fixed![r]).join('\n'),table:{id:tid,title:t.title,rowHeading:t.rowHeading,row,column:c.label,rowIndex:r,columnIndex:j},input:{kind:c.options?'choice':'text',options:c.options||[]}})}));
 }
 for(let a=1;a<=6;a++){
  const cs=criteria[a-1],page=Math.floor((a-1)/2)+2;
  table('المحور '+a+': '+axes[a-1],'صفحة '+page+' / المحور '+a,cs.map((_,i)=>'R'+a+'.'+(i+1)),[
   {key:'criterion',label:'المعيار',fixed:cs.map(c=>c[0])},{key:'assessment',label:'سؤال التقييم',fixed:cs.map(c=>c[1])},
   {key:'evidence',label:'الدليل من الحالة',prompt:'اذكر الدليل من الحالة بأرقامه وإحالته، أو افتراضًا موثقًا في سجل الافتراضات.'},
   {key:'grade',label:'الدرجة',prompt:'اختر درجة صحيحة وفق السلم؛ عند التردد اختر الأدنى ما لم يوجد دليل على الأعلى.',options:['1','2','3','4','5']},
   {key:'reason',label:'مبرر الدرجة',prompt:'برّر الدرجة في سطر يربط الدليل بوصف السلم.'},
   {key:'mandatory',label:'الإلزام',prompt:'هل يرتبط المعيار بمتطلب ملزم نظاميًا؟',options:['ملزم','غير ملزم']},
   {key:'reference',label:'مرجع الإلزام',prompt:'إن كان ملزمًا، اذكر المرجع ورقم البند. لا تستنتج الإلزام من مثال القالب.',optional:true},
   {key:'gap',label:'وصف الفجوة',prompt:'صف الفجوة. مطلوب إذا كانت الدرجة 2 فأقل. ينشئ النظام رمزها ويسحبها لسجل الفجوات.',optional:true}
  ],r=>'R'+a+'.'+(r+1),false,'الدليل والدرجة ومبررها مطلوبة لكل معيار. يحسب النظام درجة المحور ومستواه، ويعلّم المعيار الملزم ذي الدرجة 1 عائقًا ملزمًا.');
  table('خلاصة المحور '+a+' — المدخلات الأصلية','صفحة '+page+' / خلاصة المحور '+a,['العوائق الملزمة','أولوية المعالجة الأولى','أولوية المعالجة الثانية','أولوية المعالجة الثالثة','مكسب سريع خلال 90 يومًا','أثر المكسب السريع','مالك المكسب السريع','كلفة المكسب السريع'],[{key:'value',label:'الإجابة',prompt:'اكتب المدخل لهذا البند. عند عدم وجود عائق أو مكسب قابل للتنفيذ، وضّح ذلك وأسبابه.'}],r=>'A'+a+'.'+['blockers','priority1','priority2','priority3','quick','quickImpact','quickOwner','quickCost'][r],false,'درجة المحور ومستواه محسوبان في شاشة المكلّف. ينسخ النظام المكسب وأثره ومالكه وكلفته إلى 8.4، دون طلب إدخالها مرة أخرى.');
  table('تفاصيل فجوات المحور '+a,'القسم 8.2 / مصدر تفاصيل الفجوات',cs.map((_,i)=>'G-'+String((a-1)*4+i+1).padStart(2,'0')+' · R'+a+'.'+(i+1)),[
   {key:'impact',label:'الأثر',optional:true},{key:'priority',label:'الأولوية',options:['عالية','متوسطة','منخفضة'],optional:true},{key:'initiative',label:'المبادرة المقترحة',prompt:'رمز INIT-xx واسم المبادرة المقترحة لمعالجة الفجوة.',optional:true}
  ],r=>'R'+a+'.'+(r+1),false,'تُعبأ تفاصيل الصف عند تسجيل فجوة في المعيار نفسه. الرمز والمحور والوصف يسحبها النظام تلقائيًا إلى سجل 8.2.');
 }
 table('عينة متطلبات الامتثال','صفحة 5 / القسم 7.1',[''],[{key:'requirement',label:'المتطلب'},{key:'reference',label:'المرجع'},{key:'status',label:'الحالة',options:['ممتثل','ممتثل جزئيًا','غير ممتثل','غير منطبق']},{key:'evidence',label:'الدليل أو سبب عدم الانطباق',prompt:'اذكر دليل الحالة. غير المنطبق يحتاج سببًا، والجزئي يحتاج وصف الجزء المطبق ودليله.'}],()=> 'compliance',true,'أدخل 10–15 متطلبًا حرجًا. النظام يحسب (الممتثل + 0.5 × الجزئي) ÷ المنطبق × 100. غير المنطبق مستبعد مع تسبيب. عند تعدد المساهمين يحدد المكلّف عينة التقرير من السجلات المقدمة.',['مثال توضيحي فقط: استقلال إدارة الأمن عن التقنية؛ ECC 1-2-1؛ غير ممتثل؛ تتبع مدير التقنية. لا يُعبأ تلقائيًا.']);
 table('شروط الجاهزية للمبادرات الكبرى','صفحة 6 / القسم 8.3',[''],[{key:'initiative',label:'المبادرة',prompt:'أدخل رمز INIT-xx واسم المبادرة.'},{key:'gate',label:'الشرط المسبق'},{key:'threshold',label:'المعيار والحد الفاصل'},{key:'date',label:'الموعد'},{key:'fallback',label:'إن لم يتحقق'}],()=> 'gate',true,'أدخل شرط الإطلاق وحده الفاصل وموعده والقرار عند عدم تحققه.');
 table('الاستجابة للعقبات وبطاقة المستجد EV-2','صفحة 7 / القسم 9',['EV-2','OB-09','OB-01–OB-04','OB-07','OB-08','OB-10'],[{key:'obstacle',label:'العقبة / المستجد',fixed:['محاولة فدية على خادم التسجيل','تداخل الصلاحيات','المقاومة وفقدان الثقة','نظام قديم واعتماد على أفراد','جودة البيانات وملكيتها','الأمن والامتثال']},{key:'impact',label:'أثرها على التقييم والتوصيات'},{key:'section',label:'القسم',prompt:'حدد القسم أو المعيار المتأثر؛ لا تكتف بعبارة تمت المعالجة.'}],r=>'obstacle.'+r);
 table('سجل الافتراضات','صفحة 7 / ملحق 1',[''],[{key:'assumption',label:'الافتراض',optional:true},{key:'source',label:'المبرر أو المصدر',optional:true},{key:'impact',label:'الأثر إن لم يتحقق',optional:true}],()=> 'assumption',true,'اترك الصف فارغًا إذا لم تستخدم افتراضات. أكمل جميع خلايا كل صف تستخدمه.');
 table('المراجع','صفحة 7 / ملحق 2',[''],[{key:'reference',label:'المرجع'},{key:'authority',label:'الجهة'},{key:'edition',label:'الإصدار والتاريخ'},{key:'section',label:'البند المستخدم'}],()=> 'reference',true);
 table('الإفصاح عن استخدام أدوات الذكاء الاصطناعي','صفحة 7 / ملحق 3',[''],[{key:'tool',label:'الأداة',optional:true},{key:'purpose',label:'الغرض',optional:true},{key:'sections',label:'الأقسام',optional:true},{key:'verification',label:'كيف تحقق الفريق',optional:true}],()=> 'disclosure',true,'أدخل الأدوات التي استخدمتها فعلًا. يسجل التقرير استخدام موائمة آليًا عند إجراء الصياغة؛ يبقى تحقق المكلّف من المخرج مطلوبًا.');
 for(const q of o.questions)q.destination=fieldGuide(o,q).destination;
 return o;
}
export type Values=Record<string,string>;
const val=(o:Output,v:Values,key:string)=>v[o.questions.find(q=>q.fieldKey===key)?.id||'']?.trim()||'';
const num=(s:string)=>/^[1-5]$/.test(s)?Number(s):null;
const reportNum=(s:string)=>/^\d+(?:\.\d+)?$/.test(s)&&Number(s)>=1&&Number(s)<=5?Number(s):null;
export const isRatingQuestion=(q:Question)=>/^R[1-6]\.[1-4]\.grade$/.test(q.fieldKey||'');
export const averagingRule='درجة المعيار = مجموع الدرجات الصحيحة في المساهمات المسلّمة ÷ عددها، بوزن متساوٍ لكل مشارك. لا تدخل المسودات أو الدرجات الفارغة في المتوسط. درجة المحور متوسط معاييره الأربعة، والمؤشر العام متوسط المحاور الستة.';
export type EntryIssue={message:string,questionId?:string,section?:string};
export function hasInitiativeCode(value:string){
 const normalized=value.replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-0x660)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-0x6f0)).replace(/[‐‑‒–—−]/g,'-');
 return /\bINIT\s*-\s*\d+\b/i.test(normalized);
}
export function contributionIssues(o:Output,v:Values,report=false):EntryIssue[]{
 if(o.strategyWord){
  const started=new Set(o.questions.filter(q=>q.table&&v[q.id]?.trim()).map(q=>q.table!.id+':'+q.table!.rowIndex));
  const issues:EntryIssue[]=o.questions.filter(q=>!v[q.id]?.trim()&&(q.required!==false||(q.table&&started.has(q.table.id+':'+q.table.rowIndex)))).map(q=>({message:q.title+(q.required!==false?' — أكمل هذا البند.':' — أكمل خانات السجل الذي بدأت تعبئته.'),questionId:q.id,section:q.table?.title}));
  const caps=budgetCaps;
  for(const [col,cap] of caps.entries()){
   const entered=o.questions.filter(q=>q.table?.id==='strategy-23'&&q.table.columnIndex===col&&v[q.id]?.trim());
   let total=0;
   for(const q of entered){
    const amount=budgetAmount(v[q.id]);
    if(!Number.isFinite(amount)||amount<0)issues.push({message:q.table!.row+' · '+q.table!.column+' — أدخل مبلغًا واحدًا بملايين الريالات، مثل 0.75.',questionId:q.id,section:q.table?.title});
    else total+=amount;
   }
   if(total>cap+1e-8)issues.push({message:'تجاوز مجموع '+entered[0].table!.column+' السقف المحدد '+cap+' مليون ريال.',questionId:entered[0].id,section:entered[0].table?.title});
  }
  return [...issues,...rowShortfalls(o,v)];
 }
 if(!o.readiness)return o.questions.filter(q=>q.required!==false&&!v[q.id]?.trim()).map(q=>({message:q.title+': مطلوب.',questionId:q.id,section:q.table?.title}));
 const issues:EntryIssue[]=[];
 const add=(message:string,key?:string,q?:Question)=>{q??=o.questions.find(x=>x.fieldKey===key);issues.push({message,questionId:q?.id,section:q?.table?.title})};
 for(let a=1;a<=6;a++)for(let c=1;c<=4;c++){
  const k='R'+a+'.'+c,g=(report?reportNum:num)(val(o,v,k+'.grade'));
  if(g===null)add(k+(report?': لا توجد درجة صحيحة في المساهمات المسلّمة لهذا المعيار.':': اختر درجة صحيحة من 1 إلى 5.'),k+'.grade');
  for(const [s,label] of [['evidence','دليل الحالة بأرقامه'],['reason','مبرر الدرجة'],['mandatory','حالة الإلزام']])if(!val(o,v,k+'.'+s))add(k+': أكمل '+label+'.',k+'.'+s);
  if(val(o,v,k+'.mandatory')==='ملزم'&&!val(o,v,k+'.reference'))add(k+': مرجع الإلزام ورقم البند مطلوبان.',k+'.reference');
  if(g!==null&&g<=2&&!val(o,v,k+'.gap'))add(k+': صف الفجوة لأن الدرجة 2 فأقل.',k+'.gap');
  if(val(o,v,k+'.gap'))for(const [s,label] of [['impact','أثر الفجوة'],['priority','أولويتها'],['initiative','المبادرة المقترحة INIT-xx']])if(!val(o,v,k+'.'+s))add(k+': أكمل '+label+'.',k+'.'+s);
  if(val(o,v,k+'.initiative')&&!hasInitiativeCode(val(o,v,k+'.initiative')))add(k+': أضف رمز المبادرة مع رقمها، مثل INIT-01؛ اسم المبادرة وحده لا يكفي.',k+'.initiative');
 }
 for(const q of o.questions)if(q.required!==false&&!v[q.id]?.trim()&&!q.fieldKey?.startsWith('R'))add(q.title+': مطلوب.',undefined,q);
 for(const row of recordRows(o,v)){
  if(!row.values.some(Boolean))continue;
  const missing=row.questions.filter(q=>!v[q.id]?.trim()&&q.required===false);
  if(missing.length)add(row.title+' / '+(row.questions[0].table?.row||'الصف '+((row.questions[0].table?.rowIndex||0)+1))+': أكمل '+missing.map(q=>q.table?.column||q.title).join('، ')+'.',undefined,missing[0]);
  if(row.kind==='gate'&&row.data.initiative&&!hasInitiativeCode(row.data.initiative))add('المبادرة: أضف رمزًا مرقمًا مثل INIT-01 مع اسم المبادرة.',undefined,row.questions.find(q=>q.fieldKey?.endsWith('.initiative')));
 }
 const rows=recordRows(o,v).filter(r=>r.kind==='compliance'&&r.values.some(Boolean));
 if(rows.length<10||rows.length>15)add('عينة الامتثال يجب أن تحتوي 10–15 متطلبًا؛ الحالي '+rows.length+'.','compliance.requirement');
 return [...new Map(issues.map(issue=>[(issue.questionId||'')+'|'+issue.message,issue])).values()];
}
export function readinessIssues(o:Output,v:Values):string[]{return o.readiness?contributionIssues(o,v).map(i=>i.message):[];}
export function recordRows(o:Output,v:Values){
 const groups=new Map<string,Question[]>();for(const q of o.questions){if(!q.fieldKey||!q.table||!o.tables?.some(t=>t.id===q.table!.id&&t.rowMode==='repeatable'))continue;const k=q.table.rowId||q.table.id+':'+q.table.rowIndex;groups.set(k,[...(groups.get(k)||[]),q]);}
 return [...groups].map(([id,qs])=>({id,title:qs[0].table!.title,kind:qs[0].fieldKey!.split('.')[0],questions:qs,values:qs.map(q=>v[q.id]?.trim()||''),data:Object.fromEntries(qs.map(q=>[q.fieldKey!.split('.').at(-1)!,v[q.id]?.trim()||'']))}));
}
export function readinessLevel(score:number,blocked=false){const levels=['جاهزية ابتدائية','جاهزية ناشئة','جاهزية جزئية','جاهز','جاهزية متقدمة'];let i=score<1.8?0:score<2.6?1:score<3.4?2:score<4.2?3:4;return levels[blocked?Math.min(i,2):i];}
const round=(x:number)=>Math.round((x+Number.EPSILON)*100)/100;
export function readinessResults(o:Output,v:Values,report=false){
 const axis=axes.map((name,i)=>{const a=i+1;const cs=Array.from({length:4},(_,j)=>{const code='R'+a+'.'+(j+1);return {code,title:criteria[i][j][0],grade:(report?reportNum:num)(val(o,v,code+'.grade')),mandatory:val(o,v,code+'.mandatory'),reference:val(o,v,code+'.reference'),evidence:val(o,v,code+'.evidence'),reason:val(o,v,code+'.reason'),gap:val(o,v,code+'.gap')}});const score=cs.every(c=>c.grade!==null)?round(cs.reduce((n,c)=>n+c.grade!,0)/4):null;const blockers=cs.filter(c=>c.grade===1&&c.mandatory==='ملزم');return {id:a,name,criteria:cs,score,blockers,level:score===null?'غير مكتمل':readinessLevel(score,!!blockers.length),notes:val(o,v,'A'+a+'.blockers.value'),priorities:[1,2,3].map(n=>val(o,v,'A'+a+'.priority'+n+'.value')),quick:val(o,v,'A'+a+'.quick.value'),quickImpact:val(o,v,'A'+a+'.quickImpact.value'),quickOwner:val(o,v,'A'+a+'.quickOwner.value'),quickCost:val(o,v,'A'+a+'.quickCost.value')}});
 const total=axis.every(a=>a.score!==null)?round(axis.reduce((n,a)=>n+a.score!,0)/6):null;
 const allRecords=recordRows(o,v);const compliance=allRecords.filter(r=>r.kind==='compliance'&&r.values.some(Boolean)&&!o.readiness?.excludedRecords?.includes(r.id));const valid=compliance.every(r=>r.values.every(Boolean)&&['ممتثل','ممتثل جزئيًا','غير ممتثل','غير منطبق'].includes(r.data.status));const applicable=compliance.filter(r=>r.data.status!=='غير منطبق').length,full=compliance.filter(r=>r.data.status==='ممتثل').length,partial=compliance.filter(r=>r.data.status==='ممتثل جزئيًا').length;const percentage=valid&&applicable?round((full+0.5*partial)/applicable*100):null;
 const allGaps=axis.flatMap(a=>a.criteria.filter(c=>c.gap).map(c=>({code:'G-'+String((a.id-1)*4+Number(c.code.split('.')[1])).padStart(2,'0'),criterion:c.code,axis:a.name,gap:c.gap,impact:val(o,v,c.code+'.impact'),priority:val(o,v,c.code+'.priority'),initiative:val(o,v,c.code+'.initiative'),blocked:a.blockers.some(b=>b.code===c.code)}))).sort((a,b)=>Number(b.blocked)-Number(a.blocked)||['عالية','متوسطة','منخفضة'].indexOf(a.priority)-['عالية','متوسطة','منخفضة'].indexOf(b.priority));
 const gaps=allGaps.filter(g=>!o.readiness?.excludedGaps?.includes(g.code));
 const weakest=axis.filter(a=>a.score!==null).sort((a,b)=>a.score!-b.score!).slice(0,2);
 const blockers=axis.flatMap(a=>a.blockers.map(c=>c.code+' — '+c.title+' ('+c.reference+')'));
 // Keep the executive overview in the clean template's five-part order.
 // Excerpts remain traceable to supplied answers; full details stay in source tables.
 const brief=(text:string,limit=24)=>{const words=text.trim().split(/\s+/).filter(Boolean);return words.slice(0,limit).join(' ')+(words.length>limit?'…':'');};
 const description=total===null?'لا يمكن تحديد المستوى قبل اكتمال الدرجات.':readinessLevel(total);
 const weakLines=weakest.map(a=>{const lowest=Math.min(...a.criteria.map(c=>c.grade!));const reasons=[...new Set(a.criteria.filter(c=>c.grade===lowest).map(c=>c.reason.trim()).filter(Boolean))];return `• ${a.name} (${a.score!.toFixed(2)}/5): ${reasons.slice(0,2).map(x=>brief(x,18)).join('؛ ')||'لم يُدخل مبرر للمعايير الأقل درجة.'}`;});
 const blockerLines=axis.flatMap(a=>a.blockers.map(c=>'• '+c.code+' — '+c.title));
 const gates=allRecords.filter(r=>r.kind==='gate'&&r.data.initiative);
 const gateLines=gates.map(r=>'• '+brief(r.data.initiative,8)+': '+(brief(r.data.gate,18)||'لم يُحدد شرط البدء.')+(r.data.threshold?'؛ الحد المطلوب: '+brief(r.data.threshold,10):''));
 const quickLines=axis.filter(a=>a.quick).map(a=>'• المحور '+a.id+': '+brief(a.quick));
 const executive=[
  '1. ما مستوى الجاهزية العام؟\nإجمالي الدرجة: '+(total===null?'غير مكتمل':total.toFixed(2)+' من 5')+'\nالوصف العام: '+description,
  '2. ما أضعف محورين؟ ولماذا؟\n'+(total===null?'يتحدد الترتيب بعد اكتمال درجات المحاور الستة.':weakLines.join('\n')),
  '3. ما العوائق الملزمة؟\n'+(blockerLines.length?blockerLines.join('\n')+'\nلا يتجاوز مستوى المحاور المتأثرة «جاهزية جزئية» حتى المعالجة.':total===null?'لم تُرصد عوائق ملزمة في البيانات المتاحة؛ التقييم غير مكتمل.':'لم تُرصد معايير ملزمة درجتها 1 في التقييم الحالي.'),
  '4. ما الذي يجب أن يسبق أي توسع رقمي؟\n'+(gateLines.join('\n')||'لم تُدخل شروط البدء في جدول بوابات المبادرات.'),
  '5. ما الذي يمكن البدء به خلال 90 يومًا؟\n'+(quickLines.join('\n')||'لم تُدخل مكاسب سريعة بعد.')
 ].join('\n\n');
 return {axis,total,level:total===null?'غير مكتمل':readinessLevel(total),blockers,weakest,gaps,allGaps,allRecords,compliance,applicable,full,partial,percentage,executive};
}
// Ratings are deterministic means of all valid submitted votes (including repeats).
// Non-numeric choices still require consensus or an explicit reviewer decision.
export function reportValues(p:Project,o:Output){
 const values:Values={},conflicts:Question[]=[],ratings:Record<string,{mean:number|null,count:number,scores:number[]}>={};
 o=submittedOutput(p,o);
 const submitted=submittedParticipants(p,o);
 for(const q of o.questions){const sourceValues=submitted.filter(m=>!q.table?.addedBy||m.id===q.table.addedBy).map(m=>p.state.answers[m.id]?.[q.id]?.text?.trim()||'');
  if(isRatingQuestion(q)){const scores=sourceValues.map(num).filter((n):n is number=>n!==null),mean=scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:null;ratings[q.id]={mean,count:scores.length,scores};if(mean!==null)values[q.id]=String(mean);continue}
  const submittedValues=[...new Set(sourceValues.filter(Boolean))];const f=p.state.finals[q.id];
  if(q.input?.kind==='choice'){
   if(f?.manual&&f.choiceBasis===choiceBasis(p,o,q)&&q.input.options.includes(f.text)){values[q.id]=f.text;continue}
   if(submittedValues.length===1&&q.input.options.includes(submittedValues[0]))values[q.id]=submittedValues[0];else if(submittedValues.length>1)conflicts.push(q);
  }else values[q.id]=f?.text||submittedValues.join('\n');
 }
 return {values,conflicts,ratings};
}
export function reportSignature(o:Output,v:Values){const raw=JSON.stringify({values:v,methodology:o.readiness?.methodology||{},plan:o.readiness?.plan||{},excluded:o.readiness?.excludedRecords||[],excludedGaps:o.readiness?.excludedGaps||[]});let a=2166136261,b=5381;for(let i=0;i<raw.length;i++){a=Math.imul(a^raw.charCodeAt(i),16777619);b=Math.imul(b,33)^raw.charCodeAt(i)}return raw.length+':'+(a>>>0).toString(16)+':'+(b>>>0).toString(16);}
export function choiceBasis(p:Project,o:Output,q:Question){return JSON.stringify(submittedParticipants(p,o).filter(m=>!q.table?.addedBy||q.table.addedBy===m.id).map(m=>[m.id,p.state.answers[m.id]?.[q.id]?.text||'']).sort((a,b)=>a[0].localeCompare(b[0])));}
export function reportChecklist(p:Project,o:Output){
 o=submittedOutput(p,o);
 const sources=outputSources(p,o);
 const {values,conflicts,ratings}=reportValues(p,o),r=readinessResults(o,values,true);
 const fieldIssues=contributionIssues({...o,questions:o.questions.filter(q=>!(q.fieldKey?.startsWith('compliance.')&&o.readiness?.excludedRecords?.includes(q.table?.rowId||'')))},values,true).filter(x=>!x.message.startsWith('عينة الامتثال')&&!conflicts.some(q=>q.id===x.questionId));
 const issues=fieldIssues.map(x=>x.message);
 const planIssues=axes.flatMap((name,i)=>{const a=o.readiness?.plan?.[i+1];const missing=[!a||reportNum(a.target2027)===null?'مستهدف 2027':'',!a||reportNum(a.target2029)===null?'مستهدف 2029':'',!a||!hasInitiativeCode(a.initiatives)?'رمز المبادرة المرقّم':'',!a?.budgetReference.trim()?'مرجع التمويل':''].filter(Boolean);return missing.length?[name+': '+missing.join('، ')]:[]});
 const methodologyIssues=axes.flatMap((name,i)=>{const row=o.readiness?.methodology?.[i+1];const missing=methodologyFields.filter(([k])=>!row?.[k]?.trim()).map(([,label])=>label);return missing.length?[name+': '+missing.join('، ')]:[]});
 const plans=planIssues.length===0;
 const approved=o.readiness?.checkedAgainst===reportSignature(o,values);
 return {r,values,conflicts,ratings,issues,fieldIssues,planIssues,output:o,sources,checks:[
  {label:'اكتمال المعايير الـ24 والأدلة والمبررات والمدخلات المشروطة',ok:issues.length===0&&conflicts.length===0,detail:conflicts.length?'اختلافات في خيارات غير رقمية: '+conflicts.map(q=>q.title).join('؛ '):issues[0]||'اكتملت الحقول؛ جودة الأدلة ومدلولها يراجعها المكلّف.'},
  {label:'درجات المحاور والمؤشر والعوائق محسوبة وفق 1.3',ok:r.total!==null&&r.axis.every(a=>a.criteria.every(c=>['ملزم','غير ملزم'].includes(c.mandatory))),detail:r.total===null?'معايير بلا درجة مسلّمة: '+r.axis.flatMap(a=>a.criteria.filter(c=>c.grade===null).map(c=>c.code)).join('، '):averagingRule},
  {label:'عينة الامتثال 10–15 متطلبًا وأدلة الاستبعاد مكتملة',ok:r.compliance.length>=10&&r.compliance.length<=15&&r.percentage!==null,detail:'المنطبق '+r.applicable+'، الممتثل '+r.full+'، الجزئي '+r.partial+'. المقام صفر يعني غير قابل للحساب.'},
  {label:'سجل الفجوات 8–12 فجوة، بالرموز المسحوبة من المعايير',ok:r.gaps.length>=8&&r.gaps.length<=12,detail:'عدد الفجوات '+r.gaps.length+'. لا يولد النظام فجوات لملء العدد.'},
  {label:'مستهدفات 2027 و2029 مرتبطة بمبادرات ومرجع تمويل',ok:plans,detail:plans?'اكتملت بيانات الخطة المعتمدة.':'بيانات مطلوبة من الخطة، ولا تُستنتج من الدرجات: '+planIssues.join('؛ ')},
  {label:'مراجعة تطابق الرموز والتمويل مع الخطة الاستراتيجية',ok:approved&&!!o.readiness?.checks?.codes,detail:'تأكيد المكلّف بعد مقارنة الخطة ومراجعة الأدلة؛ يُلغى عند تغير المدخلات.'},
  {label:'مراجعة التسليم والفهرس وحذف أمثلة القالب وإرشاداته',ok:approved&&!!o.readiness?.checks?.document,detail:'التصدير يستبعد الأمثلة والإرشادات؛ ملف Word/PDF الخارجي يحتاج مراجعة المكلّف.'},
  {label:'توفر مساهمة مسلّمة للاحتساب',ok:sources.submitted>0,detail:sourceSummary(p,o)},
  {label:'النطاق ومصادر الأدلة لكل محور',ok:methodologyIssues.length===0,detail:methodologyIssues.length?methodologyIssues.join('؛ '):'اكتمل النطاق ومصادر الأدلة وفريق التقييم والمراجعة وحدود التقييم للمحاور الستة.'}
 ]};
}
export function readinessExport(p:Project,o:Output){
 o=submittedOutput(p,o);
 const {r,values,checks,fieldIssues,conflicts}=reportChecklist(p,o);
 const rows=(header:string[],data:string[][])=>[header.join('\t'),...data.map(r=>r.join('\t'))].join('\n');
 return [o.title,checks.every(c=>c.ok)?'جاهز وفق قائمة التحقق للمساهمات المسلّمة':'مسودة — توجد عناصر غير مكتملة في قائمة التحقق',sourceSummary(p,o),averagingRule,'المنهجية وقواعد التقييم — النطاق ومصادر الأدلة',rows(['المحور',...methodologyFields.map(([,label])=>label)],axes.map((name,i)=>[name,...methodologyFields.map(([k])=>o.readiness?.methodology?.[i+1]?.[k]||'لم يُدخل بعد')])),'الملخص التنفيذي',r.executive,'1.1 ملخص درجات المحاور',rows(['المحور','الدرجة','المستوى','أهم عائق'],r.axis.map(a=>[a.name,a.score?.toFixed(2)||'غير مكتمل',a.level,[...a.blockers.map(b=>b.code),a.notes].filter(Boolean).join('؛ ')])),...o.questions.filter(q=>!(q.fieldKey?.startsWith('compliance.')&&o.readiness?.excludedRecords?.includes(q.table?.rowId||''))&&!q.fieldKey?.match(/^R\d\.\d\.(impact|priority|initiative)$/)&&!q.fieldKey?.match(/^A\d\.quick(Impact|Owner|Cost)?\.value$/)).map(q=>fieldGuide(o,q).destination+'\n'+(values[q.id]?(isRatingQuestion(q)?Number(values[q.id]).toFixed(2):values[q.id]):conflicts.some(x=>x.id===q.id)?'خيار غير رقمي يحتاج مراجعة':fieldIssues.some(x=>x.questionId===q.id)?'معلومة مطلوبة غير متوفرة':'غير مطلوب في هذه الحالة / لا توجد قيمة مدخلة')),'7.1 نتيجة الامتثال',r.percentage===null?'غير قابل للحساب':`(${r.full} + 0.5 × ${r.partial}) ÷ ${r.applicable} × 100 = ${r.percentage.toFixed(2)}%`,'8.1 لوحة الجاهزية والمستهدفات',rows(['المحور','الدرجة','المستوى','العوائق الملزمة','2027','2029','المبادرات الداعمة'],r.axis.map(a=>{const plan=o.readiness?.plan?.[a.id];return[a.name,a.score?.toFixed(2)||'غير مكتمل',a.level,[...a.blockers.map(b=>b.code),a.notes].filter(Boolean).join('؛ '),plan?.target2027||'غير متوفر',plan?.target2029||'غير متوفر',plan?.initiatives||'غير متوفر']})),'8.2 سجل الفجوات',rows(['الرمز','المحور','الفجوة','الأثر','الأولوية','المبادرة'],r.gaps.map(g=>[g.code,g.axis,g.gap,g.impact,g.priority,g.initiative])),'8.4 المكاسب السريعة',rows(['الإجراء','المحور','الأثر','المالك','الكلفة'],r.axis.filter(a=>a.quick).map(a=>[a.quick,a.name,a.quickImpact,a.quickOwner,a.quickCost])),'الإفصاح الآلي عن المواءمة',o.questions.some(q=>p.state.finals[q.id]?.aiText)?'موائمة / OpenAI — صياغة مساهمات الفريق؛ مراجعة الأدلة والنتائج مسؤولية المكلّف.':'لم تُجرَ صياغة آلية لهذا المخرج بعد؛ الحسابات والربط تنفذ بقواعد ثابتة.','قائمة التحقق',...checks.map(c=>(c.ok?'✓ ':'يحتاج مراجعة: ')+c.label+'\n'+c.detail)].join('\n\n');
}
