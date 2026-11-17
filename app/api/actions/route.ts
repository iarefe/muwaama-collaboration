import {sameFieldRow} from '../../../lib/gap-rows';
import {reportValues,reportSignature,axes,methodologyFields} from '../../../lib/readiness';
import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {isSeriesCode,AppError,contributionQuestions,participationClosed,outputComplete,initializeRepeatingRows,changeContributionRow,TEMPLATE_TEXT_MAX,reopenForSetup,visibleSnapshot,invalidateAnalysis,participants,normalizeProject,addParticipant,submittedTo,PERMISSIONS,can,canViewOutput,requireMember,allow,editable,member,newProject,uid,now,text,log,saveAnswers,saveAnswerPatch,setFinal,visibleProject,questions,type Project,type Permission} from '../../../lib/model';
import {db,load,save,insert} from '../../../lib/store';
import {aiReady,analyze,analysisHash,align,hash,suggestField} from '../../../lib/ai';
export const dynamic='force-dynamic';
const json=(v:any,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
function fail(e:unknown){if(e instanceof AppError)return json({error:e.message,code:e.code},e.status);console.error('Request failed',e instanceof Error?e.name:'Error');return json({error:'تعذّر إتمام الطلب. أعد المحاولة.'},500)}
export async function GET(req:Request){try{const user=await getChatGPTUser();if(!user)return json({error:'سجّل الدخول أولًا.'},401);const url=new URL(req.url);const id=url.searchParams.get('project');if(id)return json({project:visibleProject(await load(id),user.userId),aiReady:aiReady()});
 const spaceRows=await db().prepare('SELECT * FROM spaces WHERE owner=? ORDER BY created DESC').bind(user.userId).all();
 const rows=await db().prepare('SELECT p.* FROM projects p JOIN project_access a ON a.project=p.id WHERE a.user=? ORDER BY p.updated DESC LIMIT 100').bind(user.userId).all<any>();
 const projects=rows.results.map(r=>normalizeProject({...r,state:JSON.parse(r.state)})).filter(p=>member(p,user.userId)).map(p=>({id:p.id,space:p.space,owner:p.owner,title:p.title,updated:p.updated,status:p.state.status,participationClosed:participationClosed(p),reviewing:p.state.outputs.some(o=>o.strategyWord&&!o.sourceReviewed)&&p.state.outputs.every(o=>o.strategyWord&&!o.sourceReviewed||outputComplete(p,o)),myPending:p.state.status==='active'&&p.state.outputs.some(o=>(o.questions.length>0||(o.strategyWord&&o.sourceReviewed))&&(!o.strategyWord||o.sourceReviewed)&&!outputComplete(p,o)&&participants(p,o).some(m=>m.id===user.userId)&&!submittedTo(member(p,user.userId)!,o)),description:p.state.description,memberCount:p.state.members.length,submitted:p.state.members.filter((m:any)=>m.submitted).length,mySubmitted:member(p,user.userId)?.submitted,outputs:p.state.outputs.length,questions:questions(p).length,members:p.state.members.map((m:any)=>({name:m.name,joined:m.joined})),canOutput:canViewOutput(p,user.userId)}));
 return json({user,spaces:spaceRows.results,projects,aiReady:aiReady()});}catch(e){return fail(e)}}
export async function POST(req:Request){try{
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw new AppError('طلب من مصدر غير مسموح.',403);
 const user=await getChatGPTUser();if(!user)throw new AppError('سجّل الدخول أولًا.',401);if(Number(req.headers.get('content-length'))>2000000)throw new AppError('حجم الطلب كبير.');const b:any=await req.json();const action=b.action;
 if(action==='createSpace'){const id=uid();await db().prepare('INSERT INTO spaces(id,owner,title,created) VALUES(?,?,?,?)').bind(id,user.userId,text(b.title,100,true),now()).run();return json({id});}
 if(action==='renameSpace'){const r=await db().prepare('UPDATE spaces SET title=? WHERE id=? AND owner=?').bind(text(b.title,100,true),b.space,user.userId).run();if(!r.meta.changes)throw new AppError('المساحة غير متاحة.',403);return json({ok:true})}
 if(action==='createProject'){let space=b.space;if(!space){space=uid();await db().prepare('INSERT INTO spaces(id,owner,title,created) VALUES(?,?,?,?)').bind(space,user.userId,'مساحتي',now()).run();}else if(!await db().prepare('SELECT id FROM spaces WHERE id=? AND owner=?').bind(space,user.userId).first())throw new AppError('إنشاء المشاريع متاح لمالك المساحة.',403);const p=newProject(user,space,text(b.title,150,true),text(b.description||'',2000));await insert(p);return json({id:p.id});}
 const p=await load(text(b.project,100,true));
 if(action==='join'){const tokenHash=await hash(text(b.token,200,true));const invited=p.state.members.find(m=>!m.joined&&m.tokenHash===tokenHash&&m.email===user.email.toLowerCase());if(!invited||Date.parse(invited.expires||'')<Date.now())throw new AppError('الدعوة غير صالحة أو انتهت مدتها، أو أنك تستخدم بريدًا مختلفًا.',403);if(['complete','archived'].includes(p.state.status))throw new AppError('أُغلقت هذه المشاركة.');const old=invited.id;invited.id=user.userId;invited.name=user.displayName;invited.joined=true;delete invited.tokenHash;delete invited.expires;p.state.outputs.forEach(o=>{if(o.assignee===old)o.assignee=user.userId;if(o.participants)o.participants=o.participants.map(id=>id===old?user.userId:id)});if(p.state.status==='active')initializeRepeatingRows(p,user.userId);log(p,user.displayName,'انضم إلى الفريق');await save(p);await db().prepare('INSERT OR IGNORE INTO project_access(id,project,user) VALUES(?,?,?)').bind(p.id+':'+user.userId,p.id,user.userId).run();return json({ok:true});}
 requireMember(p,user.userId);
 if(['suggestField','suggestRow','suggestTable'].includes(action)){
  if(user.userId!==p.owner)throw new AppError('توليف الإجابة متاح لمنشئ المشروع فقط.',403);
  const o=p.state.outputs.find(x=>x.id===b.outputId);
  const preview=b.preview===true&&o?.strategyWord===true&&!o.sourceReviewed&&p.state.status!=='archived';
  if(!o||o.finalReportKey||o.closedAt||(!preview&&(p.state.status!=='active'||outputComplete(p,o)||(o.strategyWord&&!o.sourceReviewed)||!participants(p,o).some(m=>m.id===p.owner))))throw new AppError('الحقل غير متاح للتعبئة.',409);
  const own=contributionQuestions(o,p.owner),q=own.find(x=>x.id===b.questionId);
  if(!q)throw new AppError('الحقل غير متاح ضمن مساهمتك.',403);
  const drafts:Record<string,string>={};
  for(const x of own.filter(x=>x.id===q.id||(action==='suggestTable'&&q.table&&x.table?.id===q.table.id)||((isSeriesCode(q)||action==='suggestRow')&&isSeriesCode(x))||(q.table&&x.table?.id===q.table.id&&(q.table.rowId&&x.table.rowId?x.table.rowId===q.table.rowId:x.table.rowIndex===q.table.rowIndex)))){
   if(typeof b.values?.[x.id]==='string')drafts[x.id]=text(b.values[x.id],x.input?.kind==='choice'?TEMPLATE_TEXT_MAX:6000);
  }
  if(action==='suggestRow'||action==='suggestTable'){
   const wholeTable=action==='suggestTable';
   const targets=own.filter(x=>(wholeTable?!!q.table&&x.table?.id===q.table.id:sameFieldRow(x,q))&&Array.isArray(b.fields)&&b.fields.includes(x.id));
   if(!targets.length)throw new AppError('اختر صفًا به خانات قابلة للتعبئة.');
   const result=await suggestField(p,o,q,drafts,'reuse',targets,wholeTable);
   return json({answers:JSON.parse(result.answer),note:result.note,reused:!!result.reused,charged:result.tokens>0});
  }
  const result=await suggestField(p,o,q,drafts,b.reuse===true?'reuse':b.refresh===true?'refresh':'off');
  return json({answer:result.answer,note:result.note,reused:!!result.reused,canRegenerate:!!result.reused||result.tokens>0});
 }
 const locked=p.state.outputs.find(o=>o.finalReportKey&&(o.id===b.outputId||o.questions.some(q=>q.id===b.questionId)));
 if(locked&&['answers','addTableRow','removeTableRow','align','final','acceptSuggestion','readinessPlan','saveOutput','deleteOutput'].includes(action))throw new AppError('تقرير الجاهزية معتمد ومغلق.',409);
 // Changes to other members/fields can be merged, but same-field edits remain protected.
 if(action==='answers'&&b.baseAnswers!==undefined){
  let latest=p;let committed=false;let autoAI=false;
  for(let attempt=0;attempt<3;attempt++){
   if(attempt)latest=await load(p.id);
   const actor=requireMember(latest,user.userId);const o=latest.state.outputs.find(o=>o.id===b.outputId);
   autoAI=!!o&&(submittedTo(actor,o)||!!b.submit);
   saveAnswerPatch(latest,user.userId,b.answers,b.baseAnswers,!!b.submit,b.outputId,b.round||0);
   try{await save(latest);committed=true;break}catch(e){if(!(e instanceof AppError)||e.code!=='PROJECT_CONFLICT'||attempt===2)throw e}
  }
  const extra:any={};
  if(committed&&autoAI&&aiReady()){try{const r=await align(p.id,b.outputId);extra.alignmentPending=r.pending;extra.alignmentOutputId=b.outputId}catch{extra.warning='حُفظت إجاباتك، وتعذّر تحديث المواءمة الآن.'}}
  return json({project:visibleProject(await load(p.id),user.userId),...extra});
 }
 if(action==='addTableRow'&&b.requestId){
  for(let attempt=0;attempt<3;attempt++){
   const latest=attempt?await load(p.id):p;
   if((latest.state.round||0)!==(b.round||0))throw new AppError('بدأت جولة جديدة. حدّث الصفحة.',409);
   if(latest.state.outputs.find(o=>o.id===b.outputId)?.finalReportKey)throw new AppError('المخرج مغلق.',409);
   const row=changeContributionRow(latest,user.userId,b.outputId,b.tableId,undefined,text(b.requestId,50,true));
   if(!('existing' in row && row.existing))try{await save(latest)}catch(e){if(e instanceof AppError&&e.code==='PROJECT_CONFLICT'&&attempt<2)continue;throw e}
   return json({project:visibleProject(latest,user.userId),...row});
  }
 }
 if(action!=='align'&&b.version!==undefined&&p.version!==b.version)throw new AppError('تغيّر المشروع لدى عضو آخر. حدّث الصفحة ثم أعد المحاولة.',409,'PROJECT_CONFLICT');
 let extra:any={};let autoAI=false;
 if(action==='roundSnapshot'){
 const meta=p.state.history?.find(h=>h.id===b.snapshotId);if(!meta||(p.owner!==user.userId&&!meta.members.includes(user.userId)))throw new AppError('النسخة السابقة غير متاحة.',403);
 const obj=await env.BUCKET!.get(p.id+'/rounds/'+meta.id+'.json');if(!obj)throw new AppError('تعذّر قراءة النسخة السابقة.',404);
 const snapshot=JSON.parse(new TextDecoder().decode(await obj.arrayBuffer())) as Project;
 return json({snapshot:visibleSnapshot(snapshot,p,user.userId)});
 }
 if(action==='reopenSetup'){
 if(user.userId!==p.owner)throw new AppError('هذا الإجراء للمنشئ فقط.',403);
 if(!['active','complete'].includes(p.state.status))throw new AppError('المشروع ليس في مرحلة مشاركة قابلة لإعادة الإعداد.');
 const snapshot=structuredClone(p);delete snapshot.state.history;delete snapshot.state.analysis;delete snapshot.state.aiLock;
 const meta={id:uid(),at:now(),by:user.displayName,round:p.state.round||0,members:p.state.members.filter(m=>m.joined).map(m=>m.id),outputCount:p.state.outputs.length};
 const key=p.id+'/rounds/'+meta.id+'.json';
 await env.BUCKET!.put(key,new TextEncoder().encode(JSON.stringify(snapshot)),{httpMetadata:{contentType:'application/json'}});
 reopenForSetup(p,user.userId,meta);
 try{await save(p)}catch(e){await env.BUCKET!.delete(key);throw e}
 return json({project:visibleProject(p,user.userId)});
 }
 if(action==='approveStrategy'){
 allow(p,user.userId,'template');
 const output=p.state.outputs.find(o=>o.id===b.outputId);
 if(!output?.strategyWord||output.sourceReviewed||output.finalReportKey||p.state.status==='archived')throw new AppError('النموذج غير متاح للاعتماد.',409);
 const ids=new Set(output.questions.map(q=>q.id));
 if(!Array.isArray(b.excluded)||b.excluded.some((id:unknown)=>typeof id!=='string'||!ids.has(id)))throw new AppError('خانات غير معروفة.');
 const excluded=new Set<string>(b.excluded);if(excluded.size===ids.size)throw new AppError('أبقِ خانة واحدة على الأقل.');
 output.strategyExcluded=[...excluded];output.questions=output.questions.filter(q=>!excluded.has(q.id));output.sourceReviewed=true;
 p.state.status='active';delete output.closedAt;log(p,user.displayName,'اعتمد نموذج الخطة الاستراتيجية وفتح المساهمات');
 }
 else if(action==='updateProject'){if(p.owner!==user.userId)throw new AppError('هذا الإجراء للمنشئ فقط.',403);p.title=text(b.title,150,true);p.state.description=text(b.description||'',2000);}
 else if(action==='instructions'){allow(p,user.userId,'instructions');editable(p);p.state.instructions=text(b.instructions,40000);log(p,user.displayName,'حدّث التوجيهات التعليمية');}
 else if(action==='saveOutput'){allow(p,user.userId,'template');editable(p);const items=b.questions;if(!Array.isArray(items)||!items.length)throw new AppError('أضف بندًا واحدًا على الأقل.');const old=p.state.outputs.find(o=>o.id===b.outputId);const output={id:old?.id||uid(),title:text(b.title,TEMPLATE_TEXT_MAX,true,'اسم المخرج'),format:b.format==='table'?'table' as const:'sections' as const,assignee:old?.assignee||p.owner,sourceFileId:old?.sourceFileId,sourceFileName:old?.sourceFileName,sourceReviewed:old?.sourceReviewed,readiness:old?.readiness,templateInstructions:old?.templateInstructions,tables:old?.tables,questions:items.map((q:any)=>({id:old?.questions.some(x=>x.id===q.id)?q.id:uid(),title:text(q.title,TEMPLATE_TEXT_MAX,true,'عنوان البند'),prompt:text(q.prompt,1000,true,'سؤال المساهمة'),guidance:text(q.guidance||'',TEMPLATE_TEXT_MAX,false,'التوجيه المساعد'),destination:text(q.destination||'',TEMPLATE_TEXT_MAX,false,'موضع اللصق'),requirement:text(q.requirement||'',TEMPLATE_TEXT_MAX,false,'متطلب الخانة'),fieldKey:old?.questions.find(x=>x.id===q.id)?.fieldKey,required:old?.questions.find(x=>x.id===q.id)?.required,sourceContext:old?.questions.find(x=>x.id===q.id)?.sourceContext,table:old?.questions.find(x=>x.id===q.id)?.table,input:old?.questions.find(x=>x.id===q.id)?.input}))};if(old)p.state.outputs=p.state.outputs.map(o=>o.id===old.id?output:o);else p.state.outputs.push(output);invalidateAnalysis(p);log(p,user.displayName,'حدّث قالب المخرج');}
 else if(action==='deleteOutput'){allow(p,user.userId,'template');editable(p);p.state.outputs=p.state.outputs.filter(o=>o.id!==b.outputId);invalidateAnalysis(p);}
 else if(action==='invite'){allow(p,user.userId,'invite');if(!['draft','active'].includes(p.state.status))throw new AppError('المشاركة مغلقة.');if(p.state.members.length>=20)throw new AppError('الحد الأقصى 20 عضوًا للمشروع.');const email=text(b.email,254,true).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new AppError('أدخل بريدًا صحيحًا.');if(p.state.members.some(m=>m.email===email))throw new AppError('هذا البريد موجود بالفعل.');const token=uid()+uid();addParticipant(p,{id:uid(),name:text(b.name||email.split('@')[0],100,true),email,permissions:[],joined:false,submitted:false,submittedOutputs:[],tokenHash:await hash(token),expires:new Date(Date.now()+14*86400000).toISOString()});extra={invitePath:`/join?project=${p.id}&token=${token}`};log(p,user.displayName,'أنشأ دعوة لعضو جديد');}
 else if(action==='renewInvite'){allow(p,user.userId,'invite');if(!['draft','active'].includes(p.state.status))throw new AppError('المشاركة مغلقة.');const m=p.state.members.find(m=>m.id===b.memberId&&!m.joined);if(!m)throw new AppError('الدعوة غير موجودة.');const token=uid()+uid();m.tokenHash=await hash(token);m.expires=new Date(Date.now()+14*86400000).toISOString();extra={invitePath:`/join?project=${p.id}&token=${token}`};}
 else if(action==='removeMember'){allow(p,user.userId,'invite');editable(p);const m=p.state.members.find(m=>m.id===b.memberId);if(!m||m.id===p.owner)throw new AppError('لا يمكن حذف المنشئ.');p.state.members=p.state.members.filter(x=>x.id!==m.id);p.state.outputs.forEach(o=>{if(o.assignee===m.id)o.assignee=p.owner});}
 else if(action==='permissions'){allow(p,user.userId,'permissions');const m=p.state.members.find(m=>m.id===b.memberId);if(!m||m.id===p.owner)throw new AppError('لا يمكن تعديل صلاحيات المنشئ.');if(!Array.isArray(b.permissions)||b.permissions.some((s:any)=>!PERMISSIONS.includes(s)))throw new AppError('صلاحيات غير صحيحة.');if(p.owner!==user.userId&&(b.permissions.includes('permissions')||b.permissions.some((s:Permission)=>!can(p,user.userId,s))))throw new AppError('لا يمكنك تفويض صلاحيات أعلى من صلاحياتك.',403);m.permissions=b.permissions;log(p,user.displayName,'حدّث صلاحيات أحد الأعضاء');}
 else if(action==='assign'){allow(p,user.userId,'permissions');const o=p.state.outputs.find(o=>o.id===b.outputId);if(!o||!p.state.members.some(m=>m.id===b.memberId))throw new AppError('اختر عضوًا ومخرجًا صالحين.');o.assignee=b.memberId;log(p,user.displayName,'أسند مراجعة المخرج');}
 else if(action==='launch'){if(p.owner!==user.userId)throw new AppError('هذا الإجراء للمنشئ فقط.',403);editable(p);if(p.state.analysis)throw new AppError('راجع خانات القالب المستخرجة واعتمدها، أو ألغِ نتيجة التحليل قبل فتح المشاركة.');if(!questions(p).length)throw new AppError('أضف قالب مخرج يحتوي على سؤال واحد على الأقل.');p.state.outputs.forEach(o=>{if(o.finalReportKey)return;o.participants=p.state.members.map(m=>m.id)});p.state.status='active';initializeRepeatingRows(p);log(p,user.displayName,'فتح المشاركة للفريق');}
 else if(action==='answers'){if((p.state.round||0)!==(b.round||0))throw new AppError('بدأت جولة جديدة للمشروع. حدّث الصفحة قبل حفظ إجاباتك.',409);if(!b.answers||typeof b.answers!=='object')throw new AppError('الإجابات غير صحيحة.');const o=p.state.outputs.find(o=>o.id===b.outputId);if(!o)throw new AppError('حدّد المخرج الذي تساهم فيه.');const wasSubmitted=submittedTo(member(p,user.userId)!,o);saveAnswers(p,user.userId,b.answers,!!b.submit,o.id);autoAI=wasSubmitted||!!b.submit;}
 else if(action==='addTableRow'||action==='removeTableRow'){
 if((p.state.round||0)!==(b.round||0))throw new AppError('بدأت جولة جديدة. حدّث الصفحة قبل تعديل الصفوف.',409);
 extra=changeContributionRow(p,user.userId,text(b.outputId,100,true),text(b.tableId,100,true),action==='removeTableRow'?text(b.rowId,100,true):undefined);
 }
 else if(action==='readinessPlan'){
 const o=p.state.outputs.find(o=>o.id===b.outputId);if(!o?.readiness||!(p.owner===user.userId||o.assignee===user.userId))throw new AppError('هذا الإجراء للمكلّف بالمخرج والمنشئ فقط.',403);if(p.state.status==='archived')throw new AppError('المشروع مؤرشف.');
 if(b.methodology){const methodology:NonNullable<typeof o.readiness.methodology>={};for(let i=1;i<=axes.length;i++){const row=b.methodology[i]||{};methodology[i]={scope:'',evidence:'',team:'',limits:''};for(const [key,label] of methodologyFields)methodology[i][key]=text(row[key]||'',6000,false,'المحور '+i+' — '+label);}o.readiness.methodology=methodology;}
 if(b.plan){const plan:NonNullable<typeof o.readiness.plan>={};for(let i=1;i<=axes.length;i++){const row=b.plan[i]||{};const target2027=text(row.target2027||'',10),target2029=text(row.target2029||'',10);for(const v of [target2027,target2029])if(v&&!/^(?:[1-4](?:\.\d{1,2})?|5(?:\.0{1,2})?)$/.test(v))throw new AppError('المستهدف درجة بين 1 و5 بمنزلتين عشريتين كحد أقصى.');plan[i]={target2027,target2029,initiatives:text(row.initiatives||'',2000),budgetReference:text(row.budgetReference||'',2000)}}o.readiness.plan=plan;}
 if(Array.isArray(b.excludedRecords)){const ids=new Set(o.questions.filter(q=>q.fieldKey?.startsWith('compliance.')).map(q=>q.table?.rowId));if(b.excludedRecords.some((id:unknown)=>typeof id!=='string'||!ids.has(id)))throw new AppError('سجل الامتثال غير موجود.');o.readiness.excludedRecords=[...new Set<string>(b.excludedRecords)];}
 if(Array.isArray(b.excludedGaps)){if(b.excludedGaps.some((x:unknown)=>typeof x!=='string'||!/^G-(?:0[1-9]|1[0-9]|2[0-4])$/.test(x)))throw new AppError('رمز فجوة غير صالح.');o.readiness.excludedGaps=[...new Set<string>(b.excludedGaps)];}
 if(b.check==='codes'||b.check==='document'){const signature=reportSignature(o,reportValues(p,o).values);o.readiness.checks={...(o.readiness.checkedAgainst===signature?o.readiness.checks:{}),[b.check]:true};o.readiness.checkedAgainst=signature;}
 log(p,user.displayName,'حدّث بيانات الخطة ومراجعة تقرير الجاهزية');
 }
 else if(action==='final'){setFinal(p,user.userId,text(b.questionId,100,true),b.text);}
 else if(action==='acceptSuggestion'){const f=p.state.finals[b.questionId];if(!f?.pending)throw new AppError('لا يوجد تحديث مقترح.');setFinal(p,user.userId,b.questionId,f.pending);}
 else if(action==='archive'||action==='unarchive'){if(p.owner!==user.userId)throw new AppError('هذا الإجراء للمنشئ فقط.',403);if(action==='archive'){if(p.state.status!=='complete')throw new AppError('تتاح الأرشفة بعد اكتمال المشاركة.');p.state.status='archived'}else{if(p.state.status!=='archived')throw new AppError('المشروع غير مؤرشف.');p.state.status='complete'}log(p,user.displayName,action==='archive'?'أرشف المشروع':'أعاد المشروع من الأرشيف');}
 else if(action==='analyze'){
 allow(p,user.userId,'template');editable(p);
 const checksum=await analysisHash(p);if(p.state.analyzedFiles===checksum)throw new AppError('تم تحليل هذه النسخة بالفعل. يمكنك تعديل البنود يدويًا.');
 const r=await analyze(p);const fresh=await load(p.id);if(fresh.version!==p.version)throw new AppError('تغيّر المشروع أثناء التحليل. استأنف التحليل لتطبيق آخر التغييرات.',409);
 const {tokens,...draft}=r;p.state.analysis=draft;
 if(tokens){p.state.aiCalls++;p.state.aiTokens+=tokens;}
 extra.analysisDone=!!draft.ready;
 }
 else if(action==='reviewAnalysis'){
 allow(p,user.userId,'template');editable(p);const draft=p.state.analysis;
 if(!draft?.ready)throw new AppError('أكمل التحليل أولًا قبل مراجعة النموذج.');
 if(draft.sourceHash!==await analysisHash(p))throw new AppError('تغيّر القالب. أعد التحليل قبل تعديل النتيجة.',409);
 const q=draft.outputs.flatMap(o=>o.questions).find(q=>q.id===b.questionId);
 if(!q)throw new AppError('السؤال غير موجود في نتيجة التحليل.');
 if(typeof b.exclude==='boolean'){const excluded=new Set(draft.excludedQuestionIds||[]);if(b.exclude)excluded.add(q.id);else excluded.delete(q.id);draft.excludedQuestionIds=[...excluded];}
 if(b.prompt!==undefined){q.prompt=text(b.prompt,1000,true,'سؤال المساهمة');q.guidance=text(b.guidance||'',TEMPLATE_TEXT_MAX,false,'التوجيه المساعد');}
 }
 else if(action==='reviewTable'){
 allow(p,user.userId,'template');editable(p);const draft=p.state.analysis;
 if(!draft?.ready||draft.sourceHash!==await analysisHash(p))throw new AppError('أكمل تحليل القالب الحالي أولًا.');
 const table=draft.outputs.flatMap(o=>o.tables||[]).find(t=>t.id===b.tableId);if(!table)throw new AppError('الجدول غير موجود.');
 if(b.allowExtraRows&&table.rowMode==='fixed'&&draft.outputs.some(o=>o.readiness&&o.tables?.some(t=>t.id===table.id)))throw new AppError('المعايير والمحاور ثابتة ومرتبطة بقواعد الحساب؛ تتاح الصفوف الإضافية للسجلات.');table.allowExtraRows=!!b.allowExtraRows;
 }
 else if(action==='applyAnalysis'){
 allow(p,user.userId,'template');editable(p);
 const draft=p.state.analysis;if(!draft?.ready)throw new AppError('لم يكتمل استخراج خانات القالب بعد.');
 if(draft.sourceHash!==await analysisHash(p))throw new AppError('تغيّرت إعدادات المشروع بعد التحليل. أعد التحليل قبل اعتماد الخانات.',409);
 const excluded=new Set(draft.excludedQuestionIds||[]);const reviewed=draft.outputs.map(o=>({...o,questions:o.questions.filter(q=>!excluded.has(q.id))})).filter(o=>o.questions.length);if(!reviewed.length)throw new AppError('أبقِ سؤالًا واحدًا على الأقل قبل اعتماد النموذج.');const published=p.state.outputs.filter(o=>o.finalReportKey);p.state.outputs=[...published,...reviewed.filter(o=>!published.some(pr=>pr.id===o.id||(pr.sourceFileId&&pr.sourceFileId===o.sourceFileId)))];delete p.state.analysis;p.state.analyzedFiles=await analysisHash(p);log(p,user.displayName,'راجع خانات القالب واعتمد ربطها بنماذج المساهمة');
 }
 else if(action==='discardAnalysis'){
 allow(p,user.userId,'template');editable(p);invalidateAnalysis(p);
 }
 else if(action==='align'){
 const o=p.state.outputs.find(o=>o.id===b.outputId);
 const contributed=!!o&&participants(p,o).some(m=>m.id===user.userId)&&submittedTo(member(p,user.userId)!,o);
 if(!can(p,user.userId,'output')&&!(o?.assignee===user.userId)&&!contributed)throw new AppError('غير مسموح.',403);
 if(b.outputId&&!o)throw new AppError('المخرج غير موجود.',404);
 if(!aiReady())throw new AppError('المواءمة الذكية بحاجة إلى تفعيل مفتاح الخدمة.',503);
 const result=await align(p.id,o?.id);return json({project:visibleProject(await load(p.id),user.userId),warning:result.busy?'تجري مواءمة أخرى الآن. يمكنك متابعة الإجابات المسلّمة.':undefined,alignmentPending:result.pending,alignmentOutputId:o?.id});
 }
 else throw new AppError('إجراء غير معروف.');
 await save(p);if(autoAI&&aiReady()){const result=await align(p.id,b.outputId);extra.alignmentPending=result.pending;extra.alignmentOutputId=b.outputId;}return json({project:visibleProject(await load(p.id),user.userId),...extra});
 }catch(e){return fail(e)}}
