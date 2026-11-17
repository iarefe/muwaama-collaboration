import {test,after} from 'node:test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const pdfModule=require.resolve('pdf-lib');
const {PDFDocument}=await import(pdfModule);
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
// Execute the real routes and AI orchestration with isolated storage/auth/provider adapters.
const dir=await mkdtemp(join(tmpdir(),'muwaama-flows-'));
after(()=>rm(dir,{recursive:true,force:true}));
for(const [source,target] of [['lib/budget-amount.ts','budget-amount.ts'],['lib/strategy-row-counts.ts','strategy-row-counts.ts'],['lib/strategy-gap-register.ts','strategy-gap-register.ts'],['lib/gap-rows.ts','gap-rows.ts'],['lib/model.ts','model.ts'],['lib/output-sources.ts','output-sources.ts'],['lib/readiness.ts','readiness.ts'],['lib/template-guide.ts','template-guide.ts'],['lib/ai.ts','ai.ts'],['lib/readiness-template.ts','readiness-template.ts'],['app/api/actions/route.ts','actions.ts'],['app/api/files/route.ts','files.ts']]){
 let s=await readFile(new URL('../'+source,import.meta.url),'utf8');
 s=s.replace("'../../../lib/gap-rows'","'./gap-rows.ts'").replace("'pdf-lib'",JSON.stringify(pdfModule)).replace("'cloudflare:workers'","'./env.ts'").replace("'../../chatgpt-auth'","'./auth.ts'").replaceAll("'../../../lib/model'","'./model.ts'").replaceAll("'../../../lib/store'","'./store.ts'").replaceAll("'../../../lib/ai'","'./ai.ts'").replaceAll("'../../../lib/readiness'","'./readiness.ts'").replaceAll("'./readiness'","'./readiness.ts'").replaceAll("'./readiness-template'","'./readiness-template.ts'").replaceAll("'./model'","'./model.ts'").replaceAll("'./store'","'./store.ts'");
 await writeFile(join(dir,target),s);
}
await writeFile(join(dir,'env.ts'),`export const env:any={OPENAI_API_KEY:'synthetic-test-key',BUCKET:{put:async(k,v)=>{globalThis.testBucket.set(k,v)},get:async(k)=>globalThis.testBucket.has(k)?{arrayBuffer:async()=>globalThis.testBucket.get(k)}:null,delete:async(k)=>{globalThis.testBucket.delete(k)}}};`);
await writeFile(join(dir,'auth.ts'),`export async function getChatGPTUser(){return globalThis.testUser||{userId:'owner',email:'owner@example.test',displayName:'المنشئ'}}`);
await writeFile(join(dir,'store.ts'),`import {normalizeProject,AppError} from './model.ts'; export const db=()=>({});export async function load(id){return normalizeProject(structuredClone(globalThis.testProject))} export async function save(p){if(globalThis.testBeforeSave)await globalThis.testBeforeSave(p);if(p.version!==globalThis.testProject.version)throw new AppError('conflict',409,'PROJECT_CONFLICT');p.version++;globalThis.testProject=structuredClone(p)}export async function insert(p){globalThis.testProject=structuredClone(p)}`);
const model=await import(join(dir,'model.ts')),files=await import(join(dir,'files.ts')),actions=await import(join(dir,'actions.ts')),ai=await import(join(dir,'ai.ts'));
const user={userId:'owner',email:'owner@example.test',displayName:'المنشئ'};
let requests=[],provider;
const originalFetch=globalThis.fetch;
after(()=>{globalThis.fetch=originalFetch});
globalThis.fetch=async(url,options)=>{
 assert.equal(url,'https://api.openai.com/v1/responses');
 const b=JSON.parse(options.body);requests.push(b);
 const payload=JSON.parse(b.input[0].content[0].text);
 const value=provider?await provider(payload,b):payload.jobs?{results:Object.fromEntries(payload.jobs.map(j=>[j.slot,{text:'صياغة '+j.title,differences:[]}]))}:payload.stage==='alignment_reference'?{instructions:'توجيهات متراكمة'}:payload.stage==='map_template'?{outputs:[{title:'قالب الاختبار',format:'sections',slots:[{title:'السؤال',location:'القسم الأول / خانة السؤال',requirement:'ما رأيك؟'}]}]}:{questions:Object.fromEntries(payload.slots.map(slot=>[slot.key,{prompt:'ما مساهمتك في '+slot.title+'؟',guidance:''}]))};
 return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}],usage:{total_tokens:25}});
};
const action=async(action,fields={})=>{const r=await actions.POST(new Request('https://example.test/api/actions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,project:globalThis.testProject.id,version:globalThis.testProject.version,...fields})}));return {status:r.status,value:await r.json()}};
test('unlimited uploads and source mappings are checkpointed then reviewed before applying',async()=>{
 globalThis.testProject=model.newProject(user,'space','اختبار الملفات','');globalThis.testBucket=new Map();requests=[];
 const bytes=new Uint8Array(4*1024*1024);bytes.fill(65);
 for(let i=0;i<7;i++){const form=new FormData();form.append('project',globalThis.testProject.id);form.append('kind','template');form.append('file',new File([bytes],`template-${i}.txt`,{type:'text/plain'}));const r=await files.POST(new Request('https://example.test/api/files',{method:'POST',body:form}));assert.equal(r.status,200,JSON.stringify(await r.json()));}
 assert.equal(globalThis.testProject.state.files.length,7);assert.equal(globalThis.testProject.state.files.reduce((n,f)=>n+f.size,0),28*1024*1024);
 for(let i=0;i<14;i++){const r=await action('analyze');assert.equal(r.status,200,JSON.stringify(r.value));assert.equal(r.value.analysisDone,i===13);assert.equal(r.value.project.state.outputs.length,0);}
 assert.equal(requests.length,14);const fileRequests=requests.filter(r=>r.input[0].content.some(c=>c.type==='input_file'));assert.equal(fileRequests.length,7);for(let i=0;i<7;i++)assert.equal(fileRequests[i].input[0].content.find(c=>c.type==='input_file').filename,`template-${i}.txt`);
 assert.equal(globalThis.testProject.state.analysis.ready,true);await action('analyze');assert.equal(requests.length,14);
 const applied=await action('applyAnalysis');assert.equal(applied.status,200,JSON.stringify(applied.value));assert.equal(globalThis.testProject.state.outputs.length,7);assert.equal(globalThis.testProject.state.analysis,undefined);
 for(const o of globalThis.testProject.state.outputs){assert.ok(o.sourceFileId);assert.match(o.questions[0].destination,/القسم الأول/)}
 const repeat=await action('analyze');assert.equal(repeat.status,400);assert.equal(requests.length,14);
});
test('file-size technical limit remains enforced',async()=>{
 const form=new FormData();form.append('project',globalThis.testProject.id);form.append('kind','instructions');form.append('file',new File([new Uint8Array(5*1024*1024+1)],'large.txt'));
 const r=await files.POST(new Request('https://example.test/api/files',{method:'POST',body:form}));assert.equal(r.status,400);
});
test('AI uses submitted output while excluding another output draft and retaining manual final',async()=>{
 const p=model.newProject(user,'space','اختبار المساهمة','');p.state.outputs=[{id:'a',title:'الأول',format:'sections',assignee:'owner',questions:[{id:'q1',title:'سؤال أول',prompt:'ما رأيك؟',guidance:''}]},{id:'b',title:'الثاني',format:'sections',assignee:'owner',questions:[{id:'q2',title:'سؤال ثان',prompt:'ما رأيك؟',guidance:''}]}];p.state.members.push({id:'member',name:'عضو',email:'member@example.test',permissions:[],joined:true,submitted:false});p.state.status='active';
 model.saveAnswers(p,'owner',{q1:'مساهمة مرسلة'},true,'a');model.saveAnswers(p,'owner',{q2:'مسودة سرية'},false,'b');model.setFinal(p,'owner','q1','تعديل يدوي');globalThis.testProject=p;requests=[];
 await ai.align(p.id);assert.equal(requests.length,1);const payload=JSON.parse(requests[0].input[0].content[0].text);assert.deepEqual(payload.jobs.map(j=>j.id),['q1']);assert.equal(globalThis.testProject.state.finals.q1.text,'تعديل يدوي');assert.ok(globalThis.testProject.state.finals.q1.pending);
 await ai.align(p.id);assert.equal(requests.length,1);
 const r=await action('answers',{answers:{q2:'مساهمة ثانية'},outputId:'b',submit:true});assert.equal(r.status,200,JSON.stringify(r.value));assert.equal(globalThis.testProject.state.members[0].submitted,true);
});

test('fixed slot IDs retain 57 questions and 9 outputs across interrupted batches',async()=>{
 globalThis.testProject=model.newProject(user,'space','قالب كبير','');globalThis.testBucket=new Map([['large',new TextEncoder().encode('synthetic large template').buffer]]);globalThis.testProject.state.files=[{id:'large',key:'large',name:'large.txt',kind:'template',size:24,type:'text/plain'}];requests=[];
 provider=payload=>payload.stage==='map_template'?{outputs:Array.from({length:9},(_,i)=>({title:'المخرج '+i,format:'sections',slots:Array.from({length:i<3?7:6},(_,j)=>({title:'البند '+i+'-'+j,location:'قسم '+i+' / صف '+j+' / عمود الإجابة',requirement:'محتوى الخانة'}))}))}:{questions:Object.fromEntries(payload.slots.map(slot=>[slot.key,{prompt:'السؤال '+slot.title,guidance:''}]))};
 for(let i=0;i<3;i++){const r=await action('analyze');assert.equal(r.status,200,JSON.stringify(r.value));assert.equal(r.value.analysisDone,false);}
 const checkpoint=structuredClone(globalThis.testProject);assert.equal(checkpoint.state.analysis.plan.next,20);assert.equal(checkpoint.state.analysis.outputs.flatMap(o=>o.questions).length,20);assert.equal(checkpoint.state.outputs.length,0);
 const successfulProvider=provider;provider=()=>{throw new Error('temporary network failure')};const failed=await action('analyze');assert.equal(failed.status,503);assert.deepEqual(globalThis.testProject,checkpoint);
 provider=successfulProvider;
 for(let i=0;i<4;i++){const r=await action('analyze');assert.equal(r.status,200,JSON.stringify(r.value));assert.equal(r.value.analysisDone,i===3)}
 const ready=globalThis.testProject.state.analysis;assert.equal(ready.outputs.length,9);assert.equal(ready.outputs.flatMap(o=>o.questions).length,57);assert.equal(ready.plan,undefined);assert.equal(ready.ready,true);
 const planned=checkpoint.state.analysis.plan.slots;for(const o of ready.outputs)for(const q of o.questions){const slot=planned.find(s=>s.id===q.id);assert.ok(slot);assert.equal(q.destination,slot.destination);assert.equal(o.id,slot.outputId)}
 assert.equal((await action('applyAnalysis')).status,200);assert.equal(globalThis.testProject.state.outputs.length,9);provider=undefined;
});
test('manual editor accepts more than 40 questions and more than 8 outputs',async()=>{
 const qs=Array.from({length:65},(_,i)=>({title:'البند '+i,prompt:'السؤال '+i,guidance:''}));
 const r=await action('saveOutput',{title:'مخرج إضافي',questions:qs,format:'sections'});assert.equal(r.status,200,JSON.stringify(r.value));assert.equal(globalThis.testProject.state.outputs.length,10);assert.equal(globalThis.testProject.state.outputs.at(-1).questions.length,65);
});
test('invalid model keys use source questions without losing or shifting the saved plan',async()=>{
 globalThis.testProject=model.newProject(user,'space','اختبار الاستئناف','');globalThis.testProject.state.files=[{id:'large',key:'large',name:'large.txt',kind:'template',size:24,type:'text/plain'}];
 assert.equal((await action('analyze')).status,200);const before=structuredClone(globalThis.testProject);const slot=before.state.analysis.plan.slots[0];
 provider=()=>({questions:[{id:'invented',prompt:'سؤال آخر',guidance:''}]});const r=await action('analyze');assert.equal(r.status,200);assert.equal(r.value.analysisDone,true);
 const draft=globalThis.testProject.state.analysis,q=draft.outputs[0].questions[0];assert.equal(q.id,slot.id);assert.equal(q.destination,slot.destination);assert.equal(q.guidance,slot.requirement);assert.match(q.prompt,new RegExp(slot.title));assert.notEqual(q.prompt,'سؤال آخر');assert.deepEqual(draft.fallbackQuestionIds,[slot.id]);assert.deepEqual(globalThis.testProject.state.outputs,[]);provider=undefined;
});
test('required keyed schema preserves old checkpoints and binds shuffled responses to their own fields',async()=>{
 const p=model.newProject(user,'space','استئناف الدفعة القديمة','');p.state.files=[{id:'large',key:'large',name:'large.txt',kind:'template',size:24,type:'text/plain'}];
 const slots=Array.from({length:13},(_,i)=>({id:'old-uuid-'+i,outputId:'out',title:'الوصف',destination:'الصف '+i,requirement:'متطلب '+i}));
 p.state.analysis={sourceHash:await ai.analysisHash(p),cursor:0,total:1,instructions:'',outputs:[{id:'out',title:'نموذج',format:'table',assignee:'owner',questions:[{...slots[0],prompt:'سؤال محفوظ',guidance:''}]}],plan:{fileId:'large',next:1,slots}};globalThis.testProject=p;
 provider=(payload,body)=>{const schema=body.text.format.schema.properties.questions;assert.deepEqual(schema.required,payload.slots.map(s=>s.key));assert.equal(schema.additionalProperties,false);assert.ok(payload.slots.every(s=>!('id' in s)));return {questions:Object.fromEntries([...payload.slots].reverse().map((s,i)=>[s.key,{prompt:i===0?' ':'سؤال '+s.destination,guidance:'إرشاد '+s.destination}]))}};
 let r=await action('analyze');assert.equal(r.status,200);assert.equal(r.value.analysisDone,false);let draft=globalThis.testProject.state.analysis;assert.equal(draft.plan.next,11);assert.equal(draft.outputs[0].questions[0].prompt,'سؤال محفوظ');
 for(const q of draft.outputs[0].questions.slice(1)){const source=slots.find(s=>s.id===q.id);assert.equal(q.destination,source.destination);if(!draft.fallbackQuestionIds?.includes(q.id))assert.equal(q.prompt,'سؤال '+source.destination)}
 r=await action('analyze');assert.equal(r.status,200);assert.equal(r.value.analysisDone,true);draft=globalThis.testProject.state.analysis;assert.equal(draft.outputs[0].questions.length,13);assert.equal(new Set(draft.outputs[0].questions.map(q=>q.id)).size,13);assert.equal(draft.fallbackQuestionIds.length,2);provider=undefined;
});
test('educational references alone cannot start template analysis',async()=>{
 globalThis.testProject=model.newProject(user,'space','مرجع تعليمي','');globalThis.testProject.state.files=[{id:'large',key:'large',name:'reference.txt',kind:'instructions',size:24,type:'text/plain'}];requests=[];
 const r=await action('analyze');assert.equal(r.status,400);assert.equal(requests.length,0);assert.equal(globalThis.testProject.state.analysis,undefined);
});
test('template analysis excludes all educational content and preserves independent edits and permissions',async()=>{
 const p=model.newProject(user,'space','القالب مستقل','');p.state.instructions='PRIVATE_EDUCATIONAL_TEXT';p.state.files=[{id:'template',key:'large',name:'template.txt',kind:'template',size:24,type:'text/plain'},{id:'reference',key:'large',name:'reference.txt',kind:'instructions',size:24,type:'text/plain'}];p.state.members.push({id:'designer',email:'designer@example.test',name:'مصمم',permissions:['template'],joined:true,submitted:false});globalThis.testProject=p;requests=[];
 const beforeHash=await ai.analysisHash(p);assert.equal((await action('analyze')).status,200);const checkpoint=structuredClone(globalThis.testProject.state.analysis);
 assert.equal((await action('instructions',{instructions:'UPDATED_EDUCATIONAL_TEXT'})).status,200);assert.deepEqual(globalThis.testProject.state.analysis,checkpoint);assert.equal(await ai.analysisHash(globalThis.testProject),beforeHash);
 const form=new FormData();form.append('project',p.id);form.append('kind','instructions');form.append('file',new File(['educational attachment'],'new-reference.txt',{type:'text/plain'}));assert.equal((await files.POST(new Request('https://example.test/api/files',{method:'POST',body:form}))).status,200);assert.deepEqual(globalThis.testProject.state.analysis,checkpoint);assert.equal(await ai.analysisHash(globalThis.testProject),beforeHash);
 const uploaded=globalThis.testProject.state.files.at(-1);assert.equal((await files.DELETE(new Request('https://example.test/api/files',{method:'DELETE',body:JSON.stringify({project:p.id,id:uploaded.id})}))).status,200);assert.deepEqual(globalThis.testProject.state.analysis,checkpoint);
 globalThis.testUser={userId:'designer',email:'designer@example.test',displayName:'مصمم'};try{const r=await action('analyze');assert.equal(r.status,200);assert.equal(r.value.analysisDone,true);assert.equal(r.value.project.state.analysis.instructions,undefined);assert.equal(r.value.project.state.instructions,'');assert.equal((await action('applyAnalysis')).status,200)}finally{delete globalThis.testUser}
 assert.equal(globalThis.testProject.state.instructions,'UPDATED_EDUCATIONAL_TEXT');assert.equal(requests.length,2);assert.ok(requests.every(r=>!JSON.stringify(r).includes('EDUCATIONAL_TEXT')));assert.deepEqual(requests.flatMap(r=>r.input[0].content.filter(c=>c.type==='input_file').map(c=>c.filename)),['template.txt']);assert.equal(globalThis.testProject.state.outputs.length,1);
});
test('educational attachments are checkpointed only during alignment and never alter templates',async()=>{
 const p=model.newProject(user,'space','المراجع للمواءمة','');p.state.instructions='تعليمات الصياغة النهائية';p.state.files=[{id:'ref1',key:'large',name:'ref1.txt',kind:'instructions',size:24,type:'text/plain'},{id:'ref2',key:'large',name:'ref2.txt',kind:'instructions',size:24,type:'text/plain'}];p.state.outputs=[{id:'out',title:'النموذج',format:'sections',assignee:'owner',questions:[{id:'q',title:'الهدف',prompt:'ما الهدف؟',guidance:''}]}];p.state.status='active';model.saveAnswers(p,'owner',{q:'تحسين الخدمة'},true,'out');globalThis.testProject=p;requests=[];const originalOutputs=structuredClone(p.state.outputs);
 assert.equal((await ai.align(p.id)).pending,true);assert.equal(globalThis.testProject.state.referenceContext.next,1);assert.equal(Object.keys(globalThis.testProject.state.finals).length,0);
 provider=()=>{throw new Error('temporary reference failure')};await ai.align(p.id);assert.equal(globalThis.testProject.state.referenceContext.next,1);assert.ok(globalThis.testProject.state.aiError);provider=undefined;
 assert.equal((await ai.align(p.id)).pending,true);assert.equal(globalThis.testProject.state.referenceContext.next,2);assert.equal((await ai.align(p.id)).pending,false);
 assert.deepEqual(globalThis.testProject.state.outputs,originalOutputs);assert.equal(globalThis.testProject.state.instructions,'تعليمات الصياغة النهائية');assert.equal(model.visibleProject(globalThis.testProject,'owner').state.referenceContext,undefined);
 const payloads=requests.map(r=>JSON.parse(r.input[0].content[0].text));assert.ok(payloads.slice(0,3).every(p=>p.stage==='alignment_reference'));const synthesis=payloads.at(-1);assert.equal(synthesis.instructions,'تعليمات الصياغة النهائية');assert.equal(synthesis.educationalReferences,'توجيهات متراكمة');assert.equal(synthesis.jobs[0].id,'q');const count=requests.length;await ai.align(p.id);assert.equal(requests.length,count);
 // A changed reference must refresh the cached synthesis even with unchanged answers.
 globalThis.testProject.state.files=[p.state.files[0]];assert.equal((await ai.align(p.id)).pending,true);await ai.align(p.id);assert.equal(requests.length,count+2);
});
test('large output alignment runs in small cached batches and can resume',async()=>{
 const p=model.newProject(user,'space','مواءمة كبيرة','');p.state.outputs=[{id:'a',title:'مخرج كبير',format:'sections',assignee:'owner',questions:Array.from({length:45},(_,i)=>({id:'q'+i,title:'البند '+i,prompt:'السؤال '+i,guidance:''}))}];p.state.status='active';model.saveAnswers(p,'owner',Object.fromEntries(p.state.outputs[0].questions.map(q=>[q.id,'مساهمة '+q.id])),true,'a');model.setFinal(p,'owner','q0','صياغة يدوية');globalThis.testProject=p;requests=[];
 let pending=true,calls=0;while(pending){const r=await action('align',{outputId:'a'});assert.equal(r.status,200,JSON.stringify(r.value));pending=r.value.alignmentPending;calls++;assert.ok(calls<=12)}
 assert.equal(calls,12);assert.equal(Object.keys(globalThis.testProject.state.finals).length,45);assert.equal(globalThis.testProject.state.finals.q0.text,'صياغة يدوية');assert.ok(globalThis.testProject.state.finals.q0.pending);assert.ok(requests.every(r=>JSON.parse(r.input[0].content[0].text).jobs.length<=4));
 await action('align',{outputId:'a'});assert.equal(requests.length,12);
});

test('contributor can continue only their submitted output batches without seeing others answers',async()=>{
 const p=model.newProject(user,'space','نطاق المواءمة','');p.state.members.push({id:'member',email:'member@example.test',name:'مشارك',joined:true,submitted:false,permissions:[]});p.state.outputs=[{id:'a',title:'مخرج',format:'sections',assignee:'owner',questions:Array.from({length:9},(_,i)=>({id:'q'+i,title:'بند '+i,prompt:'سؤال '+i,guidance:''}))},{id:'b',title:'آخر',format:'sections',assignee:'owner',questions:[{id:'other',title:'آخر',prompt:'آخر',guidance:''}]}];p.state.status='active';model.saveAnswers(p,'owner',{other:'مساهمة المالك'},true,'b');globalThis.testProject=p;globalThis.testUser={userId:'member',email:'member@example.test',displayName:'مشارك'};
 try{let r=await action('answers',{outputId:'a',submit:true,answers:Object.fromEntries(p.state.outputs[0].questions.map(q=>[q.id,'مساهمة']))});assert.equal(r.status,200);assert.equal(r.value.alignmentPending,true);while(r.value.alignmentPending){r=await action('align',{outputId:'a'});assert.equal(r.status,200);assert.deepEqual(r.value.project.state.finals,{});assert.equal(r.value.project.state.answers.owner,undefined)}const forbidden=await action('align',{outputId:'b'});assert.equal(forbidden.status,403)}finally{delete globalThis.testUser}
});

test('deleting an output invalidates its old analysis draft and blocks stale apply',async()=>{
 const p=model.newProject(user,'space','حذف المخرج الخاطئ','');p.state.outputs=[{id:'wrong',title:'خاطئ',format:'sections',assignee:'owner',questions:[]}];p.state.analysis={sourceHash:await ai.analysisHash(p),cursor:1,total:1,instructions:'',outputs:structuredClone(p.state.outputs),ready:true};globalThis.testProject=p;
 const deleted=await action('deleteOutput',{outputId:'wrong'});assert.equal(deleted.status,200);assert.equal(globalThis.testProject.state.analysis,undefined);assert.deepEqual(globalThis.testProject.state.outputs,[]);assert.equal((await action('applyAnalysis')).status,400);
});
test('source positions survive manual edits and reach alignment jobs unchanged',async()=>{
 globalThis.testProject=model.newProject(user,'space','موضع اللصق','');const saved=await action('saveOutput',{title:'القالب',format:'table',questions:[{title:'الوصف',prompt:'صف النشاط',guidance:'',destination:'الجدول 2 / النشاط أ / عمود الوصف',requirement:'وصف النشاط'}]});assert.equal(saved.status,200);
 const p=globalThis.testProject,o=p.state.outputs[0];p.state.status='active';model.saveAnswers(p,'owner',{[o.questions[0].id]:'نص الإجابة'},true,o.id);requests=[];await ai.align(p.id,o.id);const job=JSON.parse(requests[0].input[0].content[0].text).jobs[0];assert.equal(job.destination,'الجدول 2 / النشاط أ / عمود الوصف');assert.equal(job.requirement,'وصف النشاط');
});

test('six-axis table expands each editable cell and preserves fixed columns and rating choices',async()=>{
 const p=model.newProject(user,'space','جدول المحاور','');p.state.files=[{id:'large',key:'large',name:'table.txt',kind:'template',size:24,type:'text/plain'}];globalThis.testProject=p;
 const rows=['الاستراتيجية','الحوكمة','الثقافة','التقنية','البيانات','الخدمات'],choices=['مبتدئ','متوسط','متقدم'];
 provider=payload=>payload.stage==='map_template'?{outputs:[{title:'تقرير',format:'sections',slots:[],tables:[{title:'تقييم المحاور',location:'صفحة 4 / جدول الملخص',rowHeading:'المحور',rows,columns:[{label:'الوزن',kind:'fixed',fixedValues:rows.map((_,i)=>String(i+1)),options:[],requirement:''},{label:'التقييم',kind:'choice',options:choices,fixedValues:[],requirement:'اختر مستوى النضج'},{label:'أهم عائق',kind:'text',options:[],fixedValues:[],requirement:'حدد العائق'}]}]}]}:{questions:Object.fromEntries(payload.slots.map(slot=>[slot.key,{prompt:'أجب عن '+slot.table.row+' / '+slot.table.column,guidance:slot.requirement}]))};
 assert.equal((await action('analyze')).status,200);const planned=globalThis.testProject.state.analysis.plan.slots;assert.equal(planned.length,12);assert.equal(new Set(planned.map(s=>s.destination)).size,12);
 assert.equal((await action('analyze')).status,200);assert.equal((await action('analyze')).value.analysisDone,true);assert.equal((await action('applyAnalysis')).status,200);provider=undefined;
 const out=globalThis.testProject.state.outputs[0];assert.deepEqual(out.tables[0].rows,rows);assert.deepEqual(out.tables[0].columns.map(c=>c.label),['الوزن','التقييم','أهم عائق']);assert.equal(out.questions.length,12);assert.equal(out.questions.filter(q=>q.input.kind==='choice').length,6);assert.ok(out.questions.every(q=>q.table.row===rows[q.table.rowIndex]));assert.deepEqual(out.questions[0].input.options,choices);
 const updated=await action('saveOutput',{outputId:out.id,title:out.title,format:out.format,questions:out.questions.map(q=>({...q,prompt:q.prompt+'؟'}))});assert.equal(updated.status,200);assert.deepEqual(globalThis.testProject.state.outputs[0].tables,out.tables);assert.deepEqual(globalThis.testProject.state.outputs[0].questions[0].input,out.questions[0].input);
 globalThis.testProject.state.status='active';assert.throws(()=>model.saveAnswers(globalThis.testProject,'owner',{[out.questions[0].id]:'درجة مخترعة'},false,out.id),/خيارات/);
 const answers=Object.fromEntries(out.questions.map(q=>[q.id,q.input.kind==='choice'?'متوسط':'عائق '+q.table.row]));model.saveAnswers(globalThis.testProject,'owner',answers,true,out.id);requests=[];await ai.align(p.id,out.id);const payload=JSON.parse(requests[0].input[0].content[0].text);assert.equal(payload.jobs[0].table.row,'الاستراتيجية');assert.equal(payload.jobs[0].table.column,'التقييم');assert.deepEqual(payload.jobs[0].input.options,choices);assert.equal(globalThis.testProject.state.answers.owner[out.questions[3].id].text,'عائق الحوكمة');
});

test('owner reopens with an immutable saved round before clearing current submissions',async()=>{
 const p=model.newProject(user,'space','إعادة التحليل','');p.state.members.push({id:'member',name:'مشارك',email:'member@example.test',joined:true,submitted:false,permissions:[]});p.state.outputs=[{id:'out',title:'النموذج القديم',format:'sections',assignee:'owner',questions:[{id:'q',title:'الخانة القديمة',prompt:'سؤال قديم',guidance:''}]}];p.state.files=[{id:'file',key:'large',name:'template.txt',kind:'template',size:24,type:'text/plain'}];p.state.status='active';model.saveAnswers(p,'owner',{q:'إجابة المالك'},true,'out');model.saveAnswers(p,'member',{q:'مسودة خاصة للمشارك'},false,'out');model.setFinal(p,'owner','q','صياغة يدوية محفوظة');p.state.aiLock=new Date().toISOString();p.state.analyzedFiles='cached';globalThis.testProject=p;globalThis.testBucket=new Map();
 globalThis.testUser={userId:'member',email:'member@example.test',displayName:'مشارك'};try{assert.equal((await action('reopenSetup')).status,403)}finally{delete globalThis.testUser}
 const before=structuredClone(globalThis.testProject);const r=await action('reopenSetup');assert.equal(r.status,200,JSON.stringify(r.value));const current=globalThis.testProject;assert.equal(current.state.status,'draft');assert.equal(current.state.round,1);assert.equal(current.state.history.length,1);assert.deepEqual(current.state.answers,{});assert.deepEqual(current.state.finals,{});assert.ok(current.state.members.every(m=>!m.submitted&&!m.submittedOutputs.length));assert.equal(current.state.outputs[0].closedAt,undefined);assert.equal(current.state.outputs[0].participants,undefined);assert.equal(current.state.aiLock,undefined);assert.equal(current.state.analyzedFiles,undefined);assert.deepEqual(current.state.files,before.state.files);
 const meta=current.state.history[0],key=current.id+'/rounds/'+meta.id+'.json';const stored=JSON.parse(new TextDecoder().decode(globalThis.testBucket.get(key)));assert.equal(stored.state.answers.member.q.text,'مسودة خاصة للمشارك');assert.equal(stored.state.finals.q.text,'صياغة يدوية محفوظة');assert.equal(stored.state.history,undefined);
 const ownerView=await action('roundSnapshot',{snapshotId:meta.id});assert.equal(ownerView.status,200);assert.equal(ownerView.value.snapshot.state.answers.member,undefined);assert.equal(ownerView.value.snapshot.state.finals.q.text,'صياغة يدوية محفوظة');
 globalThis.testUser={userId:'member',email:'member@example.test',displayName:'مشارك'};try{const view=await action('roundSnapshot',{snapshotId:meta.id});assert.equal(view.status,200);assert.equal(view.value.snapshot.state.answers.member.q.text,'مسودة خاصة للمشارك');assert.equal(view.value.snapshot.state.answers.owner,undefined);assert.deepEqual(view.value.snapshot.state.finals,{});}finally{delete globalThis.testUser}
});
test('old snapshots survive deleting templates and stale round autosaves are rejected',async()=>{
 const p=globalThis.testProject,meta=p.state.history[0];assert.equal((await action('launch')).status,200);const old=await action('answers',{outputId:'out',answers:{q:'نص قديم متأخر'},round:0});assert.equal(old.status,409);assert.deepEqual(globalThis.testProject.state.answers,{});
 assert.equal((await action('answers',{outputId:'out',answers:{q:'مسودة الجولة الجديدة'},round:1})).status,200);assert.equal((await action('reopenSetup')).status,200);assert.equal(globalThis.testProject.state.history.length,2);assert.equal((await action('deleteOutput',{outputId:'out'})).status,200);
 const view=await action('roundSnapshot',{snapshotId:meta.id});assert.equal(view.status,200);assert.equal(view.value.snapshot.state.outputs[0].title,'النموذج القديم');assert.equal(view.value.snapshot.state.answers.owner.q.text,'إجابة المالك');
 globalThis.testProject.state.members.push({id:'late',name:'عضو جديد',email:'late@example.test',joined:true,submitted:false,permissions:[]});globalThis.testUser={userId:'late',email:'late@example.test',displayName:'عضو جديد'};try{assert.equal((await action('roundSnapshot',{snapshotId:meta.id})).status,403);assert.deepEqual(model.visibleProject(globalThis.testProject,'late').state.history,[])}finally{delete globalThis.testUser}
});
test('failed snapshot storage leaves all live data unchanged',async()=>{
 const p=model.newProject(user,'space','فشل النسخة','');p.state.status='active';p.state.answers={owner:{q:{text:'لا يفقد',updated:p.updated}}};globalThis.testProject=p;const before=structuredClone(p),env=(await import(join(dir,'env.ts'))).env,put=env.BUCKET.put;env.BUCKET.put=async()=>{throw new Error('storage unavailable')};try{assert.equal((await action('reopenSetup')).status,500);assert.deepEqual(globalThis.testProject,before)}finally{env.BUCKET.put=put}
});
test('concurrent reopen is rejected and its orphan snapshot is cleaned up',async()=>{
 const p=model.newProject(user,'space','تعارض النسخة','');p.state.status='complete';globalThis.testProject=p;globalThis.testBucket=new Map();const env=(await import(join(dir,'env.ts'))).env,put=env.BUCKET.put;env.BUCKET.put=async(k,v)=>{await put(k,v);globalThis.testProject.version++};try{assert.equal((await action('reopenSetup')).status,409);assert.equal(globalThis.testProject.state.status,'complete');assert.equal(globalThis.testProject.state.history,undefined);assert.equal(globalThis.testBucket.size,0)}finally{env.BUCKET.put=put}
});

test('long template labels, rubric options and fixed cells survive analysis, review and manual save',async()=>{
 const p=model.newProject(user,'space','النصوص الطويلة','');p.state.files=[{id:'long',key:'long',name:'long-template.txt',kind:'template',size:4,type:'text/plain'}];globalThis.testProject=p;globalThis.testBucket=new Map([['long',new TextEncoder().encode('test').buffer]]);
 const title='عنوان طويل '.repeat(25),row='محور بتفاصيله '.repeat(30),column='تقييم مفصل '.repeat(25),location='مسار القسم '.repeat(110),fixed='وصف ثابت '.repeat(300),option='وصف مستوى النضج '.repeat(430),requirement='متطلب أصلي '.repeat(220);
 provider=payload=>payload.stage==='map_template'?{outputs:[{title,format:'table',slots:[{title:row,location,requirement}],tables:[{title,location,rowHeading:'المحور',rows:[row],columns:[{label:'الوصف',kind:'fixed',fixedValues:[fixed],options:[],requirement:''},{label:column,kind:'choice',fixedValues:[],options:[option],requirement}]}]}]}:{questions:Object.fromEntries(payload.slots.map(s=>[s.key,{prompt:'ما تقييمك لهذه الخانة؟',guidance:''}]))};
 try{
  let r=await action('analyze');assert.equal(r.status,200,JSON.stringify(r.value));r=await action('analyze');assert.equal(r.status,200);assert.equal(r.value.analysisDone,true);assert.equal((await action('applyAnalysis')).status,200);
  let out=globalThis.testProject.state.outputs[0];assert.equal(out.title,title.trim());assert.equal(out.tables[0].rows[0],row.trim());assert.equal(out.tables[0].columns[0].fixedValues[0],fixed.trim());const cell=out.questions.find(q=>q.table);assert.equal(cell.title,row.trim()+' — '+column.trim());assert.equal(cell.destination,location.trim()+' / المحور: '+row.trim()+' / '+column.trim());assert.deepEqual(cell.input.options,[option.trim()]);assert.equal(cell.requirement,requirement.trim());
  r=await action('saveOutput',{outputId:out.id,title:out.title,format:out.format,questions:out.questions});assert.equal(r.status,200,JSON.stringify(r.value));assert.equal(globalThis.testProject.state.outputs[0].questions.find(q=>q.table).destination,cell.destination);
  assert.equal((await action('launch')).status,200);r=await action('answers',{outputId:out.id,answers:{[cell.id]:option.trim()},submit:false});assert.equal(r.status,200,JSON.stringify(r.value));
 }finally{provider=undefined}
});

test('overlong generated question wording falls back to the mapped field and resumes without losing checkpoints',async()=>{
 const p=model.newProject(user,'space','صياغة طويلة','');p.state.files=[{id:'long',key:'long',name:'long-template.txt',kind:'template',size:4,type:'text/plain'}];globalThis.testProject=p;
 assert.equal((await action('analyze')).status,200);const plan=structuredClone(globalThis.testProject.state.analysis.plan);
 provider=()=>({questions:{field_1:{prompt:'س'.repeat(1001),guidance:'ت'.repeat(2001)}}});
 try{const r=await action('analyze');assert.equal(r.status,200,JSON.stringify(r.value));assert.equal(r.value.analysisDone,true);const draft=globalThis.testProject.state.analysis,q=draft.outputs[0].questions[0];assert.equal(q.id,plan.slots[0].id);assert.equal(q.destination,plan.slots[0].destination);assert.equal(q.guidance,plan.slots[0].requirement);assert.deepEqual(draft.fallbackQuestionIds,[q.id]);assert.equal((await action('applyAnalysis')).status,200)}finally{provider=undefined}
});

test('invalid source labels identify the file and exact field without blaming required form inputs',async()=>{
 const p=model.newProject(user,'space','خانة مفقودة','');p.state.files=[{id:'long',key:'long',name:'source-template.txt',kind:'template',size:4,type:'text/plain'}];globalThis.testProject=p;const before=structuredClone(p);
 provider=()=>({outputs:[{title:'نموذج',format:'sections',slots:[{title:'',location:'القسم الأول',requirement:'محتوى'}],tables:[]}]});
 try{const r=await action('analyze');assert.equal(r.status,502);assert.match(r.value.error,/عنوان الخانة/);assert.match(r.value.error,/source-template.txt/);assert.match(r.value.error,/الدفعات السابقة محفوظة/);assert.deepEqual(globalThis.testProject,before)}finally{provider=undefined}
});

test('manual validation names the missing field and reports the actual length',async()=>{
 globalThis.testProject=model.newProject(user,'space','تحقق واضح','');const fields={title:'',questions:[{title:'بند',prompt:'سؤال',guidance:''}]};let r=await action('saveOutput',fields);assert.equal(r.status,400);assert.match(r.value.error,/أكمل اسم المخرج/);
 r=await action('saveOutput',{...fields,title:'مخرج',questions:[{title:'بند',prompt:'س'.repeat(1001),guidance:''}]});assert.equal(r.status,400);assert.match(r.value.error,/سؤال المساهمة/);assert.match(r.value.error,/1000/);assert.match(r.value.error,/1001/);
});

test('document-control tables retain unnamed rows and columns through checkpoints and contribution entry',async()=>{
 const p=model.newProject(user,'space','ضبط الوثيقة','');p.state.files=[{id:'control',key:'control',name:'قالب 2 - تقرير الجاهزية.docx',kind:'template',size:4,type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}];globalThis.testProject=p;globalThis.testBucket=new Map([['control',new TextEncoder().encode('test').buffer]]);
 const rows=['','  ','مراجعة','','',''];
 const respond=payload=>payload.stage==='map_template'?{outputs:[{title:'تقرير الجاهزية',format:'sections',slots:[],tables:[{title:'ضبط الوثيقة',location:'جدول ضبط الوثيقة',rowHeading:'',rows,columns:[{label:'رقم الإصدار',kind:'text',fixedValues:[],options:[],requirement:'رقم الإصدار'},{label:'',kind:'text',fixedValues:[],options:[],requirement:''},{label:'الحالة',kind:'fixed',fixedValues:rows.map((_,i)=>'حالة '+i),options:[],requirement:''}]}]}]}:{questions:Object.fromEntries(payload.slots.map(s=>[s.key,{prompt:'عبّئ الخانة المحددة في القالب.',guidance:s.requirement}]))};
 provider=respond;
 try{
  let r=await action('analyze');assert.equal(r.status,200,JSON.stringify(r.value));const draft=globalThis.testProject.state.analysis,table=draft.outputs[0].tables[0],slots=draft.plan.slots;
  assert.deepEqual(table.rows,rows.map(s=>s.trim()));assert.equal(table.rowHeading,'');assert.equal(table.columns[1].label,'');assert.equal(slots.length,12);assert.equal(new Set(slots.map(s=>s.id)).size,12);assert.equal(new Set(slots.map(s=>s.destination)).size,12);assert.equal(slots[0].table.row,'');assert.equal(slots[1].table.column,'');assert.equal(slots[0].title,'الصف 1 — رقم الإصدار');assert.equal(slots[1].destination,'جدول ضبط الوثيقة / الصف 1 / العمود 2');
  r=await action('analyze');assert.equal(r.status,200);const checkpoint=structuredClone(globalThis.testProject);assert.equal(checkpoint.state.analysis.plan.next,10);
  provider=()=>{throw new Error('temporary failure')};r=await action('analyze');assert.equal(r.status,503);assert.deepEqual(globalThis.testProject,checkpoint);provider=respond;
  r=await action('analyze');assert.equal(r.status,200);assert.equal(r.value.analysisDone,true);assert.equal((await action('applyAnalysis')).status,200);
  const out=globalThis.testProject.state.outputs[0];assert.equal(out.questions.length,12);assert.deepEqual(out.tables[0],table);for(const q of out.questions){const mapped=slots.find(s=>s.id===q.id);assert.deepEqual(q.table,mapped.table);assert.equal(q.destination,mapped.destination)}
  assert.equal((await action('launch')).status,200);const answers=Object.fromEntries(out.questions.map((q,i)=>[q.id,'قيمة '+i]));r=await action('answers',{outputId:out.id,answers,submit:false});assert.equal(r.status,200);for(const q of out.questions)assert.equal(globalThis.testProject.state.answers.owner[q.id].text,answers[q.id]);
 }finally{provider=undefined}
});

test('positional display names do not overwrite template labels',()=>{
 assert.equal(model.tablePositionLabel('','row',0),'الصف 1');assert.equal(model.tablePositionLabel('  ','column',3),'العمود 4');assert.equal(model.tablePositionLabel('الاستراتيجية','row',0),'الاستراتيجية');
});

test('creator reviews, edits, excludes and restores questions before applying; delegates are enforced',async()=>{
 const p=model.newProject(user,'space','مراجعة قبل الاعتماد','');p.state.files=[{id:'review',key:'review',name:'review.txt',kind:'template',size:4,type:'text/plain'}];globalThis.testProject=p;globalThis.testBucket=new Map([['review',new TextEncoder().encode('test').buffer]]);
 await action('analyze');await action('analyze');const q=globalThis.testProject.state.analysis.outputs[0].questions[0];
 assert.equal((await action('reviewAnalysis',{questionId:q.id,prompt:'سؤال بعد المراجعة',guidance:'توجيه مراجع'})).status,200);assert.equal(globalThis.testProject.state.outputs.length,0);
 assert.equal((await action('reviewAnalysis',{questionId:q.id,exclude:true})).status,200);assert.equal((await action('applyAnalysis')).status,400);
 assert.equal((await action('reviewAnalysis',{questionId:q.id,exclude:false})).status,200);
 globalThis.testProject.state.members.push({id:'member',name:'عضو',email:'member@example.test',joined:true,submitted:false,permissions:[]});globalThis.testUser={userId:'member',email:'member@example.test',displayName:'عضو'};
 try{assert.equal((await action('reviewAnalysis',{questionId:q.id,exclude:true})).status,403)}finally{delete globalThis.testUser}
 assert.equal((await action('applyAnalysis')).status,200);assert.equal(globalThis.testProject.state.outputs[0].questions[0].prompt,'سؤال بعد المراجعة');assert.equal(globalThis.testProject.state.outputs[0].questions[0].guidance,'توجيه مراجع');
});

async function repeatingFixture(){
 const p=model.newProject(user,'space','سجل الفجوات','');p.state.members.push({id:'member',name:'عضو',email:'member@example.test',joined:true,submitted:false,submittedOutputs:[],permissions:[]});p.state.files=[{id:'records',key:'records',name:'readiness.txt',kind:'template',size:4,type:'text/plain'}];globalThis.testProject=p;globalThis.testBucket=new Map([['records',new TextEncoder().encode('test').buffer]]);
 provider=payload=>payload.stage==='map_template'?{outputs:[{title:'تقرير الجاهزية',templateInstructions:'الدرجة 1–5 وفق الدليل؛ الأمثلة تُستبدل.',format:'sections',slots:[{title:'الملخص',location:'صفحة 1',requirement:'250–400 كلمة'}],tables:[{title:'الفجوات ذات الأولوية',location:'8.2',rowMode:'repeatable',rowHeading:'الرمز',rows:['G-05','',''],instructions:'رتّب 8–12 فجوة حسب الأولوية.',examples:['G-05: مثال رمادي لا يثبت واقع الفريق'],columns:[{label:'الفجوة',kind:'fixed',fixedValues:['لا استقلال للأمن','',''],options:[],requirement:'صف الفجوة',hints:[]},{label:'الأثر',kind:'text',fixedValues:[],options:[],requirement:'حدد الأثر',hints:[]}]}]}]}:{questions:Object.fromEntries(payload.slots.map(s=>[s.key,{prompt:'أدخل '+s.title,guidance:s.requirement}]))};
 try{assert.equal((await action('analyze')).status,200);assert.equal((await action('analyze')).status,200);assert.equal((await action('applyAnalysis')).status,200)}finally{provider=undefined}
 return globalThis.testProject.state.outputs[0];
}

test('example-filled record tables start blank, keep examples separate and create private rows per contributor',async()=>{
 let out=await repeatingFixture();const table=out.tables[0];assert.equal(table.rowMode,'repeatable');assert.deepEqual(table.rows,['']);assert.equal(table.columns[0].label,'الرمز');assert.ok(table.columns.every(c=>c.kind==='text'&&!c.fixedValues.length));assert.match(table.examples[0],/G-05/);assert.deepEqual(globalThis.testProject.state.answers,{});
 assert.equal((await action('launch')).status,200);out=globalThis.testProject.state.outputs[0];assert.equal(out.questions.length,7);assert.equal(model.contributionQuestions(out,'owner').length,4);assert.equal(model.contributionQuestions(out,'member').length,4);
 const ownerRow=out.questions.find(q=>q.table?.addedBy==='owner'),otherRow=out.questions.find(q=>q.table?.addedBy==='member');assert.notEqual(ownerRow.table.rowId,otherRow.table.rowId);
 assert.ok(!model.visibleProject(globalThis.testProject,'owner').state.outputs[0].questions.some(q=>q.id===otherRow.id));
 const forged=await action('answers',{outputId:out.id,answers:{[otherRow.id]:'تعديل غير مصرح'}});assert.equal(forged.status,400);
 const added=await action('addTableRow',{outputId:out.id,tableId:table.id,round:0});assert.equal(added.status,200,JSON.stringify(added.value));assert.ok(added.value.rowId);out=globalThis.testProject.state.outputs[0];assert.equal(model.contributionQuestions(out,'owner').length,7);assert.equal(model.contributionQuestions(out,'member').length,4);
 assert.equal((await action('removeTableRow',{outputId:out.id,tableId:table.id,rowId:otherRow.table.rowId,round:0})).status,403);
 assert.equal((await action('removeTableRow',{outputId:out.id,tableId:table.id,rowId:added.value.rowId,round:0})).status,200);
 assert.equal((await action('removeTableRow',{outputId:out.id,tableId:table.id,rowId:ownerRow.table.rowId,round:0})).status,400);
});

test('each submitted record keeps all its cells together in synthesis and never borrows another contributor row',async()=>{
 let out=await repeatingFixture();await action('launch');out=globalThis.testProject.state.outputs[0];const own=model.contributionQuestions(out,'owner');model.saveAnswers(globalThis.testProject,'owner',Object.fromEntries(own.map(q=>[q.id,q.table?.column==='الرمز'?'G-01':q.table?.column==='الفجوة'?'فجوة فعلية':'دليل فعلي'])),true,out.id);
 const other=model.contributionQuestions(out,'member');model.saveAnswers(globalThis.testProject,'member',Object.fromEntries(other.map(q=>[q.id,'مساهمة العضو الآخر'])),false,out.id);requests=[];await ai.align(globalThis.testProject.id,out.id);
 const jobs=JSON.parse(requests[0].input[0].content[0].text).jobs,recordJobs=jobs.filter(j=>j.table);assert.equal(recordJobs.length,3);for(const job of recordJobs){assert.equal(job.contributions.length,1);assert.equal(job.rowContext.length,3);assert.ok(job.rowContext.some(c=>c.value==='G-01'));assert.ok(!JSON.stringify(job).includes('مساهمة العضو الآخر'));assert.ok(!JSON.stringify(job).includes('G-05'));assert.match(job.templateInstructions,/8–12/)}
 const res=await action('addTableRow',{outputId:out.id,tableId:out.tables[0].id,round:0});assert.equal(res.status,200);assert.equal(model.submittedTo(model.member(globalThis.testProject,'owner'),globalThis.testProject.state.outputs[0]),false);
});

test('fixed-table extra rows require explicit review setting; stale rounds and closed outputs reject additions',async()=>{
 let out=await repeatingFixture();globalThis.testProject.state.outputs[0].tables[0].rowMode='fixed';globalThis.testProject.state.outputs[0].tables[0].allowExtraRows=false;await action('launch');out=globalThis.testProject.state.outputs[0];
 assert.equal((await action('addTableRow',{outputId:out.id,tableId:out.tables[0].id,round:0})).status,400);out.tables[0].allowExtraRows=true;
 assert.equal((await action('addTableRow',{outputId:out.id,tableId:out.tables[0].id,round:9})).status,409);assert.equal((await action('addTableRow',{outputId:out.id,tableId:out.tables[0].id,round:0})).status,200);
 globalThis.testProject.state.outputs[0].closedAt=model.now();assert.equal((await action('addTableRow',{outputId:out.id,tableId:out.tables[0].id,round:0})).status,409);
});

test('reopening a repeated-record round restores its template while historical rows and answers remain readable',async()=>{
 let out=await repeatingFixture();await action('launch');out=globalThis.testProject.state.outputs[0];const own=model.contributionQuestions(out,'owner');model.saveAnswers(globalThis.testProject,'owner',Object.fromEntries(own.map(q=>[q.id,'إجابة محفوظة'])),false,out.id);
 const reopened=await action('reopenSetup');assert.equal(reopened.status,200);const current=globalThis.testProject.state.outputs[0];assert.equal(current.questions.length,4);assert.ok(current.questions.every(q=>!q.table?.addedBy));assert.equal(current.tables[0].rowTemplate,undefined);
 const past=await action('roundSnapshot',{snapshotId:globalThis.testProject.state.history[0].id});assert.equal(past.status,200);assert.ok(past.value.snapshot.state.outputs[0].questions.some(q=>q.table?.addedBy==='owner'));assert.ok(Object.values(past.value.snapshot.state.answers.owner).every(a=>a.text==='إجابة محفوظة'));
 await action('launch');assert.equal(model.contributionQuestions(globalThis.testProject.state.outputs[0],'owner').length,4);assert.deepEqual(globalThis.testProject.state.answers,{});
});

test('PDF extraction checkpoints every physical page, skips instruction-only pages and never sends preceding pages again',async()=>{
 const pdf=await PDFDocument.create();for(let i=0;i<3;i++){const page=pdf.addPage();page.drawText('Page '+(i+1))}const bytes=await pdf.save();
 const p=model.newProject(user,'space','قراءة جميع الصفحات','');p.state.files=[{id:'pdf',key:'pdf',name:'three.pdf',kind:'template',size:bytes.length,type:'application/pdf'}];globalThis.testProject=p;globalThis.testBucket=new Map([['pdf',bytes]]);const mapped=[];
 provider=async(payload,b)=>{if(payload.stage==='map_template'){mapped.push(payload.pageNumber);const content=b.input[0].content.find(c=>c.type==='input_file');const part=await PDFDocument.load(Buffer.from(content.file_data.split(',')[1],'base64'));assert.equal(part.getPageCount(),1);assert.equal(payload.pageCount,3);return {outputs:[{title:'نموذج واحد',format:'sections',templateInstructions:payload.pageNumber===2?'الدرجة وفق الدليل.':'',slots:payload.pageNumber===2?[]:[{title:'بند الصفحة '+payload.pageNumber,location:'صفحة '+payload.pageNumber,requirement:'مطلوب'}],tables:[]}]}}return {questions:Object.fromEntries(payload.slots.map(s=>[s.key,{prompt:'سؤال '+s.title,guidance:''}]))}};
 try{
  assert.equal((await action('analyze')).status,200);assert.equal((await action('analyze')).status,200);assert.equal(globalThis.testProject.state.analysis.cursor,0);assert.equal(globalThis.testProject.state.analysis.filePage,1);assert.equal(globalThis.testProject.state.analysis.ready,false);
  assert.equal((await action('analyze')).status,200);assert.equal(globalThis.testProject.state.analysis.filePage,2);const saved=structuredClone(globalThis.testProject);
  const success=provider;provider=()=>{throw new Error('interrupted')};assert.equal((await action('analyze')).status,503);assert.deepEqual(globalThis.testProject,saved);provider=success;
  await action('analyze');const done=await action('analyze');assert.equal(done.value.analysisDone,true);assert.deepEqual(mapped,[1,2,3]);assert.equal(globalThis.testProject.state.analysis.outputs.length,1);assert.equal(globalThis.testProject.state.analysis.outputs[0].questions.length,2);assert.match(globalThis.testProject.state.analysis.outputs[0].templateInstructions,/وفق الدليل/);
 }finally{provider=undefined}
});

test('reviewed readiness PDF has 24 fixed criteria, six axes and seven repeated registers with examples separated',async()=>{
 const {READINESS_PDF_SHA256,reviewedReadinessPage}=await import(join(dir,'readiness-template.ts'));assert.equal(reviewedReadinessPage('another-file',0),null);
 const pages=Array.from({length:8},(_,i)=>reviewedReadinessPage(READINESS_PDF_SHA256,i));const tables=pages.flatMap(p=>p.outputs[0].tables);const criteria=tables.filter(t=>t.rowHeading==='الرمز'&&t.rows[0]?.startsWith('R'));
 assert.equal(criteria.length,6);assert.equal(criteria.flatMap(t=>t.rows).length,24);assert.equal(new Set(criteria.flatMap(t=>t.rows)).size,24);
 for(const t of criteria){assert.equal(t.rowMode,'fixed');assert.equal(t.columns.find(c=>c.label==='الإلزام والمرجع').kind,'fixed');assert.deepEqual(t.columns.find(c=>c.label==='الدرجة').options,['1','2','3','4','5']);assert.equal(t.columns.find(c=>c.label==='الفجوة').required,false);assert.equal(t.columns.find(c=>c.label==='الدليل من الحالة').kind,'text')}
 assert.equal(tables.filter(t=>t.rowMode==='repeatable').length,7);assert.equal(tables.find(t=>t.title.includes('الاستجابة للعقبات')).rows.length,6);assert.equal(tables.find(t=>t.title==='ملخص المحاور الستة').rows.length,6);assert.equal(pages[1].outputs[0].tables.length,0);assert.match(pages[1].outputs[0].templateInstructions,/0.5/);assert.ok(criteria[0].examples.length);assert.ok(tables.filter(t=>t.rowMode==='repeatable').every(t=>t.columns.every(c=>c.kind!=='fixed')));
});

test('nonapplicable optional cells do not prevent submission while required evidence remains mandatory',async()=>{
 const p=model.newProject(user,'space','خانات عند الانطباق','');p.state.status='active';p.state.outputs=[{id:'out',title:'معيار',format:'sections',assignee:'owner',questions:[{id:'evidence',title:'الدليل',prompt:'دليل',guidance:''},{id:'gap',title:'الفجوة',prompt:'فجوة',guidance:'',required:false}]}];
 assert.throws(()=>model.saveAnswers(p,'owner',{gap:''},true,'out'),/أكمل/);model.saveAnswers(p,'owner',{evidence:'دليل موثق',gap:''},true,'out');assert.equal(p.state.status,'complete');
});

test('clean readiness plan is assignee-only, bounded and invalidates stale review confirmations',async()=>{
 const {buildReadiness}=await import(join(dir,'readiness.ts'));const p=model.newProject(user,'space','خطة الجاهزية','');const o=buildReadiness({id:'clean',name:'clean.pdf',type:'application/pdf',key:'clean',kind:'template',size:10},'owner');p.state.outputs=[o];p.state.members.push({id:'member',email:'member@example.test',name:'عضو',joined:true,submitted:false,permissions:[]});globalThis.testProject=p;
 globalThis.testUser={userId:'member',email:'member@example.test',displayName:'عضو'};try{assert.equal((await action('readinessPlan',{outputId:o.id,plan:{}})).status,403)}finally{delete globalThis.testUser}
 assert.equal((await action('readinessPlan',{outputId:o.id,plan:{1:{target2027:'6'}}})).status,400);
 assert.equal((await action('readinessPlan',{outputId:o.id,excludedRecords:['foreign-row']})).status,400);
 assert.equal((await action('readinessPlan',{outputId:o.id,excludedGaps:['G-99']})).status,400);
 assert.equal((await action('readinessPlan',{outputId:o.id,check:'codes'})).status,200);
 assert.equal((await action('readinessPlan',{outputId:o.id,check:'document'})).status,200);
 assert.deepEqual(globalThis.testProject.state.outputs[0].readiness.checks,{codes:true,document:true});
 assert.equal((await action('readinessPlan',{outputId:o.id,plan:{1:{target2027:'3',target2029:'4',initiatives:'INIT-01',budgetReference:'خطة معتمدة ص5'}}})).status,200);
 assert.equal((await action('readinessPlan',{outputId:o.id,check:'codes'})).status,200);
 assert.deepEqual(globalThis.testProject.state.outputs[0].readiness.checks,{codes:true});
 assert.equal((await action('readinessPlan',{outputId:o.id,methodology:{1:{scope:'الجامعة كاملة',evidence:'ملحق ب-1',team:'المقيّم والمراجع',limits:'حالة دراسية'}}})).status,200);
 assert.equal(globalThis.testProject.state.outputs[0].readiness.methodology[1].scope,'الجامعة كاملة');
 assert.equal((await action('readinessPlan',{outputId:o.id,methodology:{1:{scope:'س'.repeat(6001)}}})).status,400);
 globalThis.testProject.state.status='archived';assert.equal((await action('readinessPlan',{outputId:o.id,check:'document'})).status,400);
});
test('manual review preserves calculation keys and profile metadata',async()=>{
 const {buildReadiness}=await import(join(dir,'readiness.ts'));const p=model.newProject(user,'space','مراجعة الجاهزية','');const o=buildReadiness({id:'clean',name:'clean.pdf',type:'application/pdf',key:'clean',kind:'template',size:10},'owner');p.state.outputs=[o];globalThis.testProject=p;
 const res=await action('saveOutput',{outputId:o.id,title:o.title,format:o.format,questions:o.questions.map(q=>({...q,fieldKey:'tampered'}))});assert.equal(res.status,200,JSON.stringify(res.value));assert.deepEqual(globalThis.testProject.state.outputs[0].readiness,{version:1});assert.deepEqual(globalThis.testProject.state.outputs[0].questions.map(q=>q.fieldKey),o.questions.map(q=>q.fieldKey));
});
test('readiness choice fields never reach language-model synthesis',async()=>{
 const p=model.newProject(user,'space','عدم تخمين التقييم','');p.state.outputs=[{id:'o',title:'الجاهزية',format:'sections',assignee:'owner',readiness:{version:1},questions:[{id:'grade',title:'الدرجة',prompt:'اختر',guidance:'',input:{kind:'choice',options:['1','2','3','4','5']}},{id:'reason',title:'مبرر',prompt:'وضح',guidance:''}]}];p.state.status='complete';p.state.members[0].submittedOutputs=['o'];p.state.answers.owner={grade:{text:'2',updated:'now'},reason:{text:'دليل حقيقي',updated:'now'}};globalThis.testProject=p;requests=[];await ai.align(p.id,'o');assert.equal(requests.length,1);assert.deepEqual(JSON.parse(requests[0].input[0].content[0].text).jobs.map(j=>j.id),['reason']);assert.equal(globalThis.testProject.state.finals.grade,undefined);
});

test('template viewing is scoped to authorized source outputs and never grants educational-file access',async()=>{
 const p=model.newProject(user,'space','عرض المصدر','');p.state.status='active';p.state.members.push({id:'member',email:'member@example.test',name:'عضو',joined:true,submitted:false,permissions:[]});
 p.state.files=[{id:'template',key:'pdf',name:'القالب.pdf',kind:'template',type:'application/pdf',size:4},{id:'reference',key:'ref',name:'التوجيهات.pdf',kind:'instructions',type:'application/pdf',size:4},{id:'unrelated',key:'other',name:'آخر.pdf',kind:'template',type:'application/pdf',size:4}];
 p.state.outputs=[{id:'out',title:'المخرج',format:'sections',assignee:'owner',participants:['owner','member'],sourceFileId:'template',questions:[]}];globalThis.testProject=p;globalThis.testBucket=new Map([['pdf',new Uint8Array([1,2]).buffer],['ref',new Uint8Array([3]).buffer],['other',new Uint8Array([4]).buffer]]);
 const get=(id,view='1')=>files.GET(new Request('https://example.test/api/files?project='+p.id+'&id='+id+'&view='+view));
 globalThis.testUser={userId:'member',email:'member@example.test',displayName:'عضو'};try{
  let r=await get('template');assert.equal(r.status,200);assert.match(r.headers.get('Content-Disposition'),/^inline;/);assert.equal(r.headers.get('Cache-Control'),'private, no-store');assert.match((await get('template','0')).headers.get('Content-Disposition'),/^attachment;/);
  assert.equal((await get('reference')).status,403);assert.equal((await get('unrelated')).status,403);
  globalThis.testProject.state.status='draft';assert.equal((await get('template')).status,403);
  globalThis.testProject.state.outputs[0].assignee='member';assert.equal((await get('template')).status,200);
  globalThis.testUser={userId:'outsider',email:'x@example.test',displayName:'خارج'};assert.equal((await get('template')).status,403);
 }finally{delete globalThis.testUser}
});

function patchProject(){
 const p=model.newProject(user,'space','حفظ مستقل','');p.state.status='active';
 p.state.members.push({id:'member',name:'عضو',email:'member@example.test',permissions:[],joined:true,submitted:false,submittedOutputs:[]});
 p.state.outputs=[{id:'out',title:'تقرير',format:'table',assignee:'owner',questions:[{id:'criterion',title:'مبرر المعيار',prompt:'وضح',guidance:''},{id:'summary',title:'أولوية المعالجة الأولى',prompt:'وضح',guidance:''},{id:'quick',title:'المكسب السريع',prompt:'وضح',guidance:''}]}];
 globalThis.testProject=p;return p;
}
test('answer patches merge stale project versions without overwriting earlier sections or another member',async()=>{
 const p=patchProject(),version=p.version;
 assert.equal((await action('answers',{outputId:'out',answers:{criterion:'مبرر المحور'},baseAnswers:{criterion:''},version})).status,200);
 globalThis.testUser={userId:'member',email:'member@example.test',displayName:'عضو'};
 try{assert.equal((await action('answers',{outputId:'out',answers:{summary:'مساهمة أخرى'},baseAnswers:{summary:''},version})).status,200)}finally{delete globalThis.testUser}
 const res=await action('answers',{outputId:'out',answers:{summary:'أولوية المعالجة\nخطوة ثانية',quick:'مكسب خلال 90 يومًا'},baseAnswers:{summary:'',quick:''},version});
 assert.equal(res.status,200,JSON.stringify(res.value));assert.equal(globalThis.testProject.state.answers.owner.criterion.text,'مبرر المحور');assert.equal(globalThis.testProject.state.answers.member.summary.text,'مساهمة أخرى');assert.equal(globalThis.testProject.state.answers.owner.summary.text,'أولوية المعالجة\nخطوة ثانية');
});
test('same member can save different fields from stale views, but same-field changes reject atomically',async()=>{
 patchProject();const version=globalThis.testProject.version;
 await action('answers',{outputId:'out',answers:{summary:'أولوية معتمدة'},baseAnswers:{summary:''},version});
 assert.equal((await action('answers',{outputId:'out',answers:{quick:'مكسب جديد'},baseAnswers:{quick:''},version})).status,200);
 const res=await action('answers',{outputId:'out',answers:{criterion:'لا يُحفظ جزئيًا',summary:'كتابة من نافذة قديمة'},baseAnswers:{criterion:'',summary:''},version});
 assert.equal(res.status,409);assert.equal(res.value.code,'ANSWER_CONFLICT');assert.match(res.value.error,/أولوية المعالجة الأولى/);assert.equal(globalThis.testProject.state.answers.owner.criterion,undefined);assert.equal(globalThis.testProject.state.answers.owner.summary.text,'أولوية معتمدة');
 // An acknowledgement lost in transit can be retried with the original baseline.
 assert.equal((await action('answers',{outputId:'out',answers:{summary:'أولوية معتمدة'},baseAnswers:{summary:''},version})).status,200);
});
test('answer patch retries storage contention against latest data without losing concurrent updates',async()=>{
 patchProject();let attempts=0;
 globalThis.testBeforeSave=()=>{if(attempts++<2){globalThis.testProject.version++;globalThis.testProject.state.answers.member={criterion:{text:'تحديث متزامن '+attempts,updated:'now'}}}};
 try{const r=await action('answers',{outputId:'out',answers:{summary:'خلاصة محفوظة'},baseAnswers:{summary:''}});assert.equal(r.status,200,JSON.stringify(r.value));assert.equal(attempts,3);assert.equal(globalThis.testProject.state.answers.member.criterion.text,'تحديث متزامن 2');assert.equal(globalThis.testProject.state.answers.owner.summary.text,'خلاصة محفوظة')}finally{delete globalThis.testBeforeSave}
});
test('answer patch retries never overwrite a same-field concurrent change and stop at a bounded limit',async()=>{
 patchProject();globalThis.testBeforeSave=()=>{globalThis.testProject.version++;globalThis.testProject.state.answers.owner={summary:{text:'أحدث من نافذة ثانية',updated:'now'}}};
 try{const r=await action('answers',{outputId:'out',answers:{summary:'نص قديم'},baseAnswers:{summary:''}});assert.equal(r.value.code,'ANSWER_CONFLICT');assert.equal(globalThis.testProject.state.answers.owner.summary.text,'أحدث من نافذة ثانية')}finally{delete globalThis.testBeforeSave}
 patchProject();let attempts=0;globalThis.testBeforeSave=()=>{attempts++;globalThis.testProject.version++};
 try{const r=await action('answers',{outputId:'out',answers:{summary:'خلاصة'},baseAnswers:{summary:''}});assert.equal(r.status,409);assert.equal(r.value.code,'PROJECT_CONFLICT');assert.equal(attempts,3);assert.equal(globalThis.testProject.state.answers.owner,undefined)}finally{delete globalThis.testBeforeSave}
});
test('patch saves preserve round, closure, ownership and legacy version guards',async()=>{
 patchProject();globalThis.testProject.state.round=2;
 let r=await action('answers',{outputId:'out',answers:{summary:'جولة قديمة'},baseAnswers:{summary:''},round:1});assert.equal(r.value.code,'ROUND_CHANGED');
 r=await action('answers',{outputId:'out',answers:{summary:'قاعدة ناقصة'},baseAnswers:{},round:2});assert.equal(r.status,400);
 r=await action('answers',{outputId:'out',answers:{unknown:'حقل غريب'},baseAnswers:{unknown:''},round:2});assert.equal(r.status,400);
 globalThis.testUser={userId:'outsider',email:'outsider@example.test',displayName:'غير مشارك'};
 try{assert.equal((await action('answers',{outputId:'out',answers:{summary:'تجاوز'},baseAnswers:{summary:''},round:2})).status,403)}finally{delete globalThis.testUser}
 globalThis.testProject.state.outputs[0].closedAt=model.now();r=await action('answers',{outputId:'out',answers:{summary:'مغلق'},baseAnswers:{summary:''},round:2});assert.equal(r.value.code,'OUTPUT_CLOSED');
 patchProject();globalThis.testProject.version=4;r=await action('answers',{outputId:'out',answers:{summary:'قديم'},version:1});assert.equal(r.value.code,'PROJECT_CONFLICT');
});

test('only the creator can request a grounded single-field draft without writing an answer',async()=>{
 const p=model.newProject(user,'space','اختبار التوليف','');
 p.state.instructions='اربط الإجابة بالحالة';
 const q={id:'grade',title:'المستهدف',prompt:'حدد المستوى',guidance:'استخدم السلم',input:{kind:'choice',options:['عالية','منخفضة']}};
 p.state.outputs=[{id:'out',title:'الخطة',format:'sections',assignee:'delegate',templateInstructions:'طبق سلم القالب',questions:[q]}];
 p.state.members.push({id:'delegate',name:'المكلّف',email:'d@example.test',permissions:[...model.PERMISSIONS],joined:true,submitted:false});
 p.state.status='active';globalThis.testProject=p;requests=[];
 const fields={outputId:'out',questionId:'grade',values:{grade:'منخفضة'}};
 globalThis.testUser={userId:'delegate'};
 try{
  assert.equal((await action('suggestField',fields)).status,403);
  assert.equal(requests.length,0);
  globalThis.testUser=user;
  provider=payload=>{assert.equal(payload.projectInstructions,p.state.instructions);assert.equal(payload.templateInstructions,'طبق سلم القالب');assert.equal(payload.current,'منخفضة');return {answer:'عالية',note:'وفق السلم'}};
  const result=await action('suggestField',fields);assert.equal(result.status,200);assert.equal(result.value.answer,'عالية');
  assert.deepEqual(p.state.answers,{});
  provider=()=>({answer:'خارج السلم',note:''});assert.equal((await action('suggestField',fields)).status,502);
  p.state.outputs[0].closedAt=new Date().toISOString();assert.equal((await action('suggestField',fields)).status,409);
 }finally{globalThis.testUser=undefined;provider=undefined;}
});

test('field suggestions strip echoed headings but retain substantive labels and paragraphs',async()=>{
 const row='الاستراتيجية والحوكمة والقيادة',column='ما يعنيه للخطة';
 const q={id:'implication',title:row+' — '+column,prompt:column,guidance:'',table:{id:'axis',title:'ملف الجاهزية',rowHeading:'المحور',row,column,rowIndex:0,columnIndex:0}};
 const p=model.newProject(user,'space','الخطة','');p.state.status='active';p.state.outputs=[{id:'plan',title:'الخطة',format:'sections',assignee:user.userId,questions:[q]}];globalThis.testProject=p;
 const body='تعتمد الجامعة أهدافًا رقمية قابلة للقياس.\nمؤشر المتابعة: نسبة الأهداف المرتبطة بمؤشرات.';
 try{
  for(const prefix of ['',row+' - '+column+': ','**الإجابة المقترحة:**\n**'+column+'**\n']){
   provider=()=>({answer:prefix+body,note:''});
   const result=await action('suggestField',{outputId:'plan',questionId:q.id});
   assert.equal(result.value.answer,body);
  }
 }finally{provider=undefined}
});

test('pillar fields distinguish a name from its description and use the selected row',async()=>{
 const p=model.newProject(user,'space','الخطة','');
 const cells=['الركيزة','الوصف'].map((column,i)=>({id:'c'+i,title:column,prompt:column,guidance:'',table:{id:'strategy-13',title:'2.1',rowHeading:'الرمز',row:'P2',column,rowIndex:1,columnIndex:i,rowId:'r2'}}));
 p.state.status='active';p.state.outputs=[{id:'plan',strategyWord:true,sourceReviewed:true,title:'الخطة',format:'sections',assignee:user.userId,questions:cells}];globalThis.testProject=p;
 try{
  provider=payload=>{assert.equal(payload.target.row,'P2');assert.equal(payload.target.field,'الركيزة');assert.match(payload.answerFormat,/عبارة اسمية/);return {answer:'الحوكمة الرقمية المتكاملة',note:''}};
  assert.equal((await action('suggestField',{outputId:'plan',questionId:'c0'})).value.answer,'الحوكمة الرقمية المتكاملة');
  assert.equal((await action('suggestField',{outputId:'plan',questionId:'c1'})).value.answer,'');
  provider=payload=>{assert.equal(payload.target.field,'الوصف');assert.equal(payload.values[0].value,'الحوكمة الرقمية المتكاملة');return {answer:'توحيد مسؤوليات القرار الرقمي بين وحدات الجامعة.',note:''}};
  assert.match((await action('suggestField',{outputId:'plan',questionId:'c1',values:{c0:'الحوكمة الرقمية المتكاملة'}})).value.answer,/توحيد/);
  provider=()=>({answer:'P2',note:''});
  assert.equal((await action('suggestField',{outputId:'plan',questionId:'c0'})).value.answer,'');
 }finally{provider=undefined}
});

test('provider quota and temporary rate limits give distinct actionable errors',async()=>{
 const previous=globalThis.fetch;
 const p=model.newProject(user,'space','اختبار',''),q={id:'q',title:'اسم',prompt:'اسم',guidance:''};
 const o={id:'out',title:'مخرج',format:'sections',assignee:user.userId,questions:[q]};
 try{
  for(const [reason,expected] of [['insufficient_quota','AI_QUOTA'],['rate_limit_exceeded','AI_RATE_LIMIT'],['','AI_429']]){
   globalThis.fetch=async(url,opts)=>{
    assert.equal(JSON.parse(opts.body).max_output_tokens,1200);
    return Response.json({error:{code:reason}},{status:429,headers:{'retry-after':'8'}});
   };
   await assert.rejects(ai.suggestField(p,o,q,{}),e=>e.code===expected&&(expected!=='AI_RATE_LIMIT'||e.message.includes('8')));
  }
 }finally{globalThis.fetch=previous}
});

test('SMART goal codes fill the first free number across stored and unsaved rows without AI',async()=>{
 const p=model.newProject(user,'space','اختبار',''),o={id:'plan',title:'الخطة',format:'sections',assignee:user.userId,sourceReviewed:true,strategyWord:true,questions:[]};
 o.questions=['a','b','c','d'].map((id,i)=>({id,title:'الرمز',prompt:'الرمز',guidance:'',table:{id:'strategy-15',column:'الرمز',columnIndex:0,rowIndex:i,rowId:id}}));
 p.state.outputs=[o];p.state.status='active';p.state.answers={other:{a:{text:'DO-01'}},[user.userId]:{a:{text:'DO-01'},b:{text:'DO-04'}}};globalThis.testProject=p;requests=[];
 const suggest=values=>action('suggestField',{outputId:'plan',questionId:'d',values});
 assert.equal((await suggest({c:'DO-02'})).value.answer,'DO-03');
 assert.equal((await suggest({d:'DO-07'})).value.answer,'DO-07');
 assert.equal((await suggest({d:'DO-01'})).value.answer,'DO-02');
 assert.throws(()=>model.saveAnswers(p,user.userId,{d:'DO-01'},false,'plan'),/مستخدم/);
 assert.equal(requests.length,0);
});

test('field suggestion reuse avoids provider calls and invalidates on context changes',async()=>{
 const p=model.newProject(user,'space','الخطة',''),q={id:'q',title:'اسم',prompt:'اسم',guidance:''};
 const o={id:'out',title:'مخرج',format:'sections',assignee:user.userId,questions:[q]};
 globalThis.testBucket=new Map();requests=[];provider=()=>({answer:'هدف مقترح',note:''});
 try{
  await ai.suggestField(p,o,q,{},'reuse');
  assert.equal((await ai.suggestField(p,o,q,{},'reuse')).reused,true);
  assert.equal(requests.length,1);
  await ai.suggestField(p,o,q,{},'refresh');assert.equal(requests.length,2);
  p.state.instructions='صياغة جديدة';await ai.suggestField(p,o,q,{},'reuse');assert.equal(requests.length,3);
 }finally{provider=undefined}
});

test('reviewed gap suggestions send the matching report page and retain educational references',async()=>{
 const p=model.newProject(user,'space','الخطة',''),table={id:'strategy-10',title:'الفجوات',instructions:'استعن بدليل الفجوة',columns:[]};
 const qs=['الرمز','المستهدف'].map((column,i)=>({id:'f'+i,title:column,prompt:column,guidance:'',table:{id:table.id,column,columnIndex:i?3:0,rowId:'r',rowIndex:0}}));
 const o={id:'plan',title:'الخطة',sourceFileId:'doc',sourceReviewed:true,strategyWord:true,tables:[table],questions:qs};
 const report=await PDFDocument.create();for(let n=0;n<30;n++)report.addPage([200+n,300]);
 globalThis.testBucket=new Map([['approved',await report.save()],['ref',new TextEncoder().encode('guidance')]]);
 p.state.files=[{id:'doc',kind:'template',key:'unused-doc',name:'plan.docx'},{id:'ref',kind:'instructions',key:'ref',name:'reference.txt',type:'text/plain'}];
 p.state.outputs=[o,{finalReportKey:'approved'}];
 provider=async(payload,b)=>{
  const files=b.input[0].content.filter(c=>c.type==='input_file');assert.equal(files.length,2);assert.equal(files[0].filename,'reference.txt');
  const selected=await PDFDocument.load(Buffer.from(files[1].file_data.split(',')[1],'base64'));assert.equal(selected.getPageCount(),1);assert.equal(selected.getPage(0).getWidth(),199+payload.selectedGap.page);
  return {answer:'مستهدف مقترح',note:''};
 };
 try{assert.equal((await ai.suggestField(p,o,qs[1],{f0:'G-05'})).answer,'مستهدف مقترح')}finally{provider=undefined}
});

test('row synthesis uses a single call, preserves filled cells, scopes results and reuses the preview',async()=>{
 const p=model.newProject(user,'space','الخطة','');
 const questions=['الرمز','الهدف الرقمي (SMART)','المالك'].map((column,i)=>({id:'c'+i,title:column,prompt:column,guidance:'',table:{id:'strategy-15',title:'الأهداف',row:'',rowId:'a',rowIndex:0,column,columnIndex:i}}));
 questions.push({...questions[1],id:'outside',table:{...questions[1].table,rowId:'b',rowIndex:1}});
 p.state.status='active';p.state.outputs=[{id:'out',title:'الخطة',format:'sections',assignee:user.userId,strategyWord:true,sourceReviewed:true,questions}];globalThis.testProject=p;globalThis.testBucket=new Map();requests=[];
 const fields={outputId:'out',questionId:'c1',fields:questions.map(x=>x.id),values:{c2:'مكتب التحول'}};
 try{
  provider=payload=>{assert.deepEqual(payload.fields.map(x=>x.id),['c1']);assert.equal(payload.prepared[0].value,'DO-01');return {answers:{c1:'رفع تبنّي الخدمات الرقمية.'},note:''}};
  const first=await action('suggestRow',fields);assert.equal(first.status,200);assert.deepEqual(first.value.answers,{c0:'DO-01',c1:'رفع تبنّي الخدمات الرقمية.'});assert.equal(first.value.charged,true);
  assert.equal((await action('suggestRow',fields)).value.reused,true);assert.equal(requests.length,1);assert.deepEqual(p.state.answers,{});
 }finally{provider=undefined}
});

test('KPI and other strategic registers allocate distinct codes for fields and rows, including cached requests',async()=>{
 for(const [table,prefix] of [['strategy-17','KPI'],['strategy-19','INIT'],['strategy-58','UC'],['strategy-52','EA'],['strategy-64','RISK']]){
  const p=model.newProject(user,'space','الخطة','');
  const q=(id,row,col)=>({id,title:col?'الاسم':'الرمز',prompt:'',guidance:'',table:{id:table,column:col?'الاسم':'الرمز',columnIndex:col,rowId:row,rowIndex:row==='new'?1:0}});
  const o={id:'plan',title:'الخطة',format:'sections',assignee:user.userId,sourceReviewed:true,strategyWord:true,questions:[q('a','old',0),q('b','new',0),q('name','new',1)]};
  p.state.outputs=[o];p.state.status='active';p.state.answers={[user.userId]:{a:{text:prefix+'-٠١'}}};globalThis.testProject=p;globalThis.testBucket=new Map();requests=[];
  const fields={outputId:'plan',questionId:'b',values:{b:prefix+'-01'}};
  assert.equal((await action('suggestField',fields)).value.answer,prefix+'-02');assert.equal(requests.length,0);
  provider=()=>({answers:{name:'وصف'},note:''});
  try{
   const r=await action('suggestRow',{...fields,fields:['b','name']});assert.equal(r.value.answers.b,prefix+'-02');
   assert.throws(()=>model.saveAnswers(p,user.userId,{b:prefix+'-01'},false,'plan'),/مستخدم/);
   p.state.answers[user.userId].a.text=prefix+'-02';
   const next=await action('suggestRow',{...fields,values:{b:''},fields:['b','name']});assert.equal(next.value.answers.b,prefix+'-01');
  }finally{provider=undefined}
 }
});

test('actual readiness criterion strings are replaced in KPI row proposals and legacy answer cells only',async()=>{
 const p=model.newProject(user,'space','الخطة','');p.state.status='active';
 const o={id:'out',format:'sections',title:'الخطة',assignee:user.userId,questions:[]};
 for(let i=0;i<4;i++)o.questions.push({id:'k'+i,title:'الرمز',table:{id:'legacy-table',title:'2.3 مؤشرات الأداء الرئيسة',column:'الرمز',columnIndex:1,rowIndex:i,rowId:'r'+i}});
 p.state.outputs=[o];p.state.answers={[user.userId]:Object.fromEntries(['KPI-01','5.1R','R5.1','٥.١R'].map((text,i)=>['k'+i,{text}]))};
 const draft=p.state.answers[user.userId];draft.other={text:'R5.1'};globalThis.testProject=p;requests=[];
 let r=await action('suggestRow',{outputId:'out',questionId:'k1',fields:['k1'],values:{k1:'5.1R'}});
 assert.equal(r.value.answers.k1,'KPI-02');assert.equal(requests.length,0);
 model.repairReadinessCodes(p,o);model.repairReadinessCodes(p,o);
 assert.deepEqual(Object.values(draft).map(a=>a.text),['KPI-01','KPI-02','KPI-03','KPI-04','R5.1']);
 assert.throws(()=>model.saveAnswers(p,user.userId,{k1:'5.1R'},false,'out'),/معيار جاهزية/);
});

test('a stale KPI patch keeps the corrected server code and saves the other row fields',async()=>{
 const p=model.newProject(user,'space','الخطة','');p.state.status='active';
 const qs=['الرمز','المؤشر'].map((column,i)=>({id:'f'+i,title:'الصف 4 — '+column,table:{id:'strategy-17',title:'2.3 مؤشرات الأداء الرئيسة',column,columnIndex:i,rowIndex:3,rowId:'r4'}}));
 p.state.outputs=[{id:'plan',format:'sections',title:'الخطة',assignee:user.userId,questions:qs}];p.state.answers={[user.userId]:{f0:{text:'KPI-04'}}};globalThis.testProject=p;
 for(const [base,local] of [['5.1R','KPI-01'],['','R5.1'],['','KPI-02']]){
  const r=await action('answers',{outputId:'plan',answers:{f0:local,f1:'رضا المستفيد'},baseAnswers:{f0:base,f1:''},round:0});
  assert.equal(r.status,200);assert.equal(r.value.project.state.answers[user.userId].f0.text,'KPI-04');assert.equal(r.value.project.state.answers[user.userId].f1.text,'رضا المستفيد');
 }
 const r=await action('answers',{outputId:'plan',answers:{f0:'KPI-08'},baseAnswers:{f0:'KPI-03'},round:0});assert.equal(r.value.code,'ANSWER_CONFLICT');
});

test('whole table generates all permitted rows together, allocating distinct codes and preserving existing cells',async()=>{
 const p=model.newProject(user,'space','الخطة','');p.state.status='active';
 const qs=['first','next','private'].flatMap((rowId,rowIndex)=>['الرمز','المؤشر','المالك'].map((column,columnIndex)=>({id:rowId+columnIndex,title:column,table:{id:'strategy-17',title:'المؤشرات',column,columnIndex,rowId,rowIndex,addedBy:rowId==='private'?'other':user.userId}})));
 p.state.outputs=[{id:'plan',format:'sections',title:'الخطة',assignee:user.userId,questions:qs}];globalThis.testProject=p;globalThis.testBucket=new Map();requests=[];
 const fields={outputId:'plan',questionId:'first1',fields:qs.map(q=>q.id),values:{first2:'مالك محفوظ'}};
 provider=payload=>{assert.equal(payload.stage,'suggest_table');assert.equal(payload.rows.length,2);assert.deepEqual(payload.fields.map(x=>x.id),['f1','f2','f3']);return {answers:Object.fromEntries(payload.fields.map(x=>[x.id,'اقتراح '+x.id])),note:''}};
 try{
  const r=await action('suggestTable',fields);assert.equal(r.status,200);assert.equal(r.value.answers.first0,'KPI-01');assert.equal(r.value.answers.next0,'KPI-02');assert.equal(r.value.answers.first2,undefined);assert.equal(r.value.answers.private1,undefined);
  assert.equal((await action('suggestTable',fields)).value.reused,true);assert.equal(requests.length,1);assert.deepEqual(p.state.answers,{});
 }finally{provider=undefined}
});

test('2027 plan uses portfolio input and gives one actionable message before calling AI if it is absent',async()=>{
 const p=model.newProject(user,'space','الخطة','');p.state.status='active';
 const mk=(id,table,column,idx)=>({id,title:column,prompt:column,table:{id:table,title:table,row:'',rowId:table+'-r',rowIndex:0,column,columnIndex:idx}});
 const qs=[mk('source','strategy-19','المبادرة',1),mk('plan-name','strategy-25','المبادرة',0),mk('milestone','strategy-25','إنجاز 2027',1)];
 p.state.outputs=[{id:'out',title:'الخطة',format:'sections',assignee:user.userId,questions:qs}];globalThis.testProject=p;globalThis.testBucket=new Map();requests=[];
 const body={outputId:'out',questionId:'plan-name',fields:['plan-name','milestone'],values:{}};
 const empty=await action('suggestTable',body);assert.equal(empty.status,422);assert.match(empty.value.error,/3.1/);assert.equal(requests.length,0);
 p.state.answers[user.userId]={source:{text:'حوكمة البيانات'}};
 provider=payload=>{assert.equal(payload.initiativePortfolio[0]['المبادرة'],'حوكمة البيانات');return {answers:{f1:'حوكمة البيانات',f2:'اعتماد سياسة البيانات'},note:''}};
 try{const r=await action('suggestTable',body);assert.equal(r.status,200);assert.equal(r.value.answers.milestone,'اعتماد سياسة البيانات')}finally{provider=undefined}
});

test('optimistic row field IDs survive stale versions, retried creation and typing before acknowledgement',async()=>{
 await repeatingFixture();await action('launch');
 const p=globalThis.testProject,out=p.state.outputs[0],table=out.tables[0],requestId=crypto.randomUUID();
 const preview=structuredClone(out);
 const local=model.appendRow(preview,preview.tables[0],'owner',requestId);
 const fields={outputId:out.id,tableId:table.id,round:0,requestId,version:p.version-1};
 const added=await action('addTableRow',fields);assert.equal(added.status,200);assert.equal(added.value.questionId,local.questionId);
 const retry=await action('addTableRow',fields);assert.equal(retry.status,200);assert.equal(retry.value.project.version,added.value.project.version);
 const result=await action('answers',{outputId:out.id,answers:{[local.questionId]:'نص أثناء الحفظ'},baseAnswers:{[local.questionId]:''},round:0});
 assert.equal(result.value.project.state.answers.owner[local.questionId].text,'نص أثناء الحفظ');
 assert.equal((await action('addTableRow',{...fields,round:4})).status,409);
});

test('budget table repairs occupied invalid cells, retains clear Arabic amounts and checks caps',async()=>{
 const p=model.newProject(user,'space','الخطة','');p.state.status='active';
 const qs=['أ','ب'].map((row,i)=>({id:'b'+i,title:row,prompt:'ميزانية',table:{id:'strategy-23',title:'3.3',column:'2027 (أ)',columnIndex:0,row,rowId:row,rowIndex:i}}));
 p.state.outputs=[{id:'out',title:'الخطة',format:'sections',assignee:user.userId,questions:qs}];globalThis.testProject=p;globalThis.testBucket=new Map();
 const fields={outputId:'out',questionId:'b0',fields:['b0','b1'],values:{b0:'٠٫٧٥ مليون ريال',b1:'يوزع بين المكونات'}};
 provider=payload=>{assert.equal(payload.fields.length,1);return {answers:{f1:1.25},note:'مقترح'}};
 try{const r=await action('suggestTable',fields);assert.equal(r.status,200);assert.deepEqual(r.value.answers,{b1:'1.25'});provider=()=>({answers:{f1:7},note:''});fields.values.b1='توزيع آخر';assert.equal((await action('suggestTable',fields)).status,200)}finally{provider=undefined}
});

test('submitted private rows sharing DO-02 contribute to one final per column, excluding drafts',async()=>{
 const p=model.newProject(user,'space','خطة','');p.state.status='active';
 const ids=['owner','member','draft'];
 p.state.members=ids.map(id=>({id,name:id,joined:true,submitted:id!=='draft',submittedOutputs:id==='draft'?[]:['plan'],permissions:[]}));
 const qs=ids.flatMap((id,r)=>['الرمز','الهدف الرقمي (SMART)','سلسلة التتبع'].map((column,c)=>({id:id+c,title:column,prompt:column,table:{id:'strategy-15',title:'الأهداف',column,columnIndex:c,rowId:id,rowIndex:r,addedBy:id}})));
 const o={id:'plan',title:'الخطة',format:'sections',assignee:'owner',questions:qs};p.state.outputs=[o];p.state.answers=Object.fromEntries(ids.map(id=>[id,{[id+0]:{text:'DO-02'},[id+1]:{text:id},[id+2]:{text:'تتبع '+id}}]));globalThis.testProject=p;requests=[];
 await ai.align(p.id);
 const jobs=JSON.parse(requests[0].input[0].content[0].text).jobs;
 assert.equal(jobs.length,3);
 assert.equal(jobs[0].table.columnIndex,1);
 for(const job of jobs)assert.equal(globalThis.testProject.state.finals[job.id].text,'صياغة '+job.title);
 assert.deepEqual(jobs.find(j=>j.table.columnIndex===1).contributions.map(c=>c.text),['owner','member']);
 const {submittedOutput}=await import(join(dir,'output-sources.ts'));
 assert.equal(submittedOutput(p,o).questions.length,3);
});

test('budget synthesis remains restricted to the project creator',async()=>{
 const p=model.newProject(user,'space','الخطة','');p.state.status='active';p.owner='creator';
 p.state.outputs=[{id:'out',title:'الخطة',format:'sections',strategyWord:true,sourceReviewed:true,assignee:user.userId,questions:[{id:'money',title:'ميزانية',prompt:'ميزانية',table:{id:'strategy-23',title:'3.3',column:'2027 (أ)',columnIndex:0,row:'أ',rowIndex:0}}]}];
 globalThis.testProject=p;requests=[];
 const result=await action('suggestTable',{outputId:'out',questionId:'money',fields:['money'],values:{money:'توزيع تقديري'}});
 assert.equal(result.status,403);assert.equal(requests.length,0);
});

test('budget proposals reject cached prose and generate only millions as numeric strings',async()=>{
 const p=model.newProject(user,'space','الخطة','');p.state.status='active';
 const q={id:'amount',title:'ميزانية',prompt:'بيّن المبلغ وأسبابه',table:{id:'strategy-23',title:'3.3',column:'2027 (أ)',columnIndex:0,row:'الحوكمة',rowIndex:0}};
 const o={id:'out',title:'الخطة',format:'sections',assignee:user.userId,questions:[q]};p.state.outputs=[o];globalThis.testProject=p;globalThis.testBucket=new Map();requests=[];
 provider=()=>({answer:1.75,note:'توزيع تقديري'});
 try{
  const first=await ai.suggestField(p,o,q,{},'reuse');assert.equal(first.answer,'1.75');
  const [key,bytes]=[...globalThis.testBucket][0];const cached=JSON.parse(new TextDecoder().decode(bytes));cached.answer='ميزانية مقترحة 1.75 مليون ريال';globalThis.testBucket.set(key,new TextEncoder().encode(JSON.stringify(cached)));
  const second=await ai.suggestField(p,o,q,{},'reuse');assert.equal(second.answer,'1.75');assert.equal(requests.length,2);
  assert.equal((await ai.suggestField(p,o,q,{},'reuse')).reused,true);
  provider=()=>({answer:'المبلغ المقترح 1.75 مليون ريال',note:''});await assert.rejects(ai.suggestField(p,o,q,{}),/مبلغ صالح/);
 }finally{provider=undefined}
});

test('budget repair rebalances numeric over-cap columns and preserves valid columns',async()=>{
 const p=model.newProject(user,'space','الخطة','');p.state.status='active';
 const qs=[0,1,2].map(i=>({id:'repair'+i,title:'مبلغ '+i,prompt:'ميزانية',table:{id:'strategy-23',title:'3.3',column:i===2?'2028 (أ)':'2027 (أ)',columnIndex:i===2?1:0,row:'مكوّن '+i,rowIndex:i}}));
 const o={id:'out',title:'الخطة',format:'sections',strategyWord:true,sourceReviewed:true,assignee:user.userId,questions:qs};p.state.outputs=[o];globalThis.testProject=p;globalThis.testBucket=new Map();
 const fields={outputId:'out',questionId:'repair0',fields:qs.map(q=>q.id),values:{repair0:'4',repair1:'4',repair2:'1.75'}};
 provider=payload=>{assert.deepEqual(payload.budgetColumnsToRebalance,[0]);assert.equal(payload.budgetIssues.length,1);assert.equal(payload.fields.length,2);return {answers:{f1:2.8,f2:3},note:'توزيع ضمن السقف'}};
 try{
  const r=await action('suggestTable',fields);assert.equal(r.status,200,JSON.stringify(r.value));assert.deepEqual(r.value.answers,{repair0:'2.8',repair1:'3'});
  const merged={...fields.values,...r.value.answers};const readiness=await import(join(dir,'readiness.ts'));assert.equal(readiness.contributionIssues(o,merged).length,0);
  fields.values.repair0='5';provider=()=>({answers:{f1:4,f2:4},note:'لم يتغير'});const repaired=await action('suggestTable',fields);assert.equal(repaired.status,200);assert.deepEqual(repaired.value.answers,{repair0:'3',repair1:'3'});assert.match(repaired.value.note,/حسابيًا/);
 }finally{provider=undefined}
});

test('shared cells show submitted text until synthesis and distinguish disagreements and empty cells',async()=>{
 const {outputCell}=await import(join(dir,'output-sources.ts'));
 const p=model.newProject(user,'space','خطة','');
 const o={id:'plan',questions:[]},q={id:'first',alignmentSources:{owner:'first',other:'second',draft:'third'}};
 p.state.members=[{id:'owner',joined:true,submittedOutputs:['plan']},{id:'other',joined:true,submittedOutputs:['plan']},{id:'draft',joined:true}];
 p.state.answers={draft:{third:{text:'خاص'}}};
 assert.match(outputCell(p,o,q).status,/لم تُسلّم/);
 p.state.answers.owner={first:{text:'هدف'}};p.state.answers.other={second:{text:'هدف'}};
 assert.equal(outputCell(p,o,q).text,'هدف');
 p.state.answers.other.second.text='هدف مختلف';assert.match(outputCell(p,o,q).status,/مختلفة/);
 p.state.finals.first={text:'الصياغة المعتمدة'};assert.equal(outputCell(p,o,q).text,'الصياغة المعتمدة');
});
