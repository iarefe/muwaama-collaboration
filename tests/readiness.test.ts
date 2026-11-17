import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildReadiness,readinessResults,readinessIssues,contributionIssues,hasInitiativeCode,readinessLevel,reportValues,reportChecklist,reportSignature,readinessExport,type Values} from '../lib/readiness.ts';
import {newProject,initializeRepeatingRows,changeContributionRow,saveAnswers,setFinal,visibleProject,type Output} from '../lib/model.ts';
const user={userId:'owner',email:'owner@example.test',displayName:'المنشئ'};
const file={id:'clean',name:'قالب الجاهزية المنظف.pdf',type:'application/pdf',kind:'template' as const,key:'clean',size:325485};
function fixture(){const p=newProject(user,'space','اختبار الجاهزية','');const o=buildReadiness(file,'owner');o.readiness!.methodology=Object.fromEntries(Array.from({length:6},(_,i)=>[i+1,{scope:'نطاق تجريبي',evidence:'ملحق ب-1',team:'فريق التقييم',limits:'حدود موثقة'}]));p.state.outputs=[o];o.participants=['owner'];p.state.status='active';initializeRepeatingRows(p);const compliance=o.tables!.find(t=>t.title==='عينة متطلبات الامتثال')!;for(let i=1;i<10;i++)changeContributionRow(p,'owner',o.id,compliance.id);return {p,o};}
function completeValues(o:Output){const v:Values={};for(const q of o.questions){const k=q.fieldKey||'';let text=q.required===false?'':'دليل موثق ب-1، الصفحة 2';if(k.endsWith('.grade'))text=k.startsWith('R1.')||k.startsWith('R2.')?'2':'4';if(k.endsWith('.mandatory'))text='غير ملزم';if(k.endsWith('.status'))text='ممتثل';if(/^R[12]\./.test(k)){if(k.endsWith('.gap'))text='وصف الفجوة '+k;if(k.endsWith('.impact'))text='تأخر الخدمة';if(k.endsWith('.priority'))text='عالية';if(k.endsWith('.initiative'))text='INIT-01 مبادرة المعالجة'}if(k==='gate.initiative')text='INIT-01 مبادرة';v[q.id]=text;}return v;}
function key(o:Output,k:string){return o.questions.find(q=>q.fieldKey===k)!.id;}
test('clean map contains 24 real rating inputs and no duplicate totals or summaries',()=>{const o=buildReadiness(file,'owner');assert.equal(o.questions.filter(q=>q.fieldKey?.endsWith('.grade')).length,24);assert.equal(o.questions.filter(q=>q.fieldKey?.endsWith('.reason')).length,24);assert.equal(o.questions.filter(q=>q.fieldKey?.endsWith('.mandatory')).length,24);assert.ok(!o.questions.some(q=>/الملخص التنفيذي|الدرجة الحالية|المعادلة والنتيجة|مستهدف 2027/.test(q.title)));assert.equal(o.tables?.filter(t=>t.rowMode==='repeatable').length,5);assert.ok(o.tables?.find(t=>t.title==='عينة متطلبات الامتثال')?.examples?.length);assert.ok(!o.questions.some(q=>q.input?.options.includes('غير ممتثل')&&q.prompt.includes('تتبع مدير التقنية')))});
test('axis averages, general index and readiness thresholds follow exact rules',()=>{const {o}=fixture(),v=completeValues(o),r=readinessResults(o,v);assert.deepEqual(r.axis.map(a=>a.score),[2,2,4,4,4,4]);assert.equal(r.total,3.33);assert.equal(r.level,'جاهزية جزئية');assert.equal(r.weakest[0].id,1);for(const [n,label] of [[1.79,'جاهزية ابتدائية'],[1.8,'جاهزية ناشئة'],[2.6,'جاهزية جزئية'],[3.4,'جاهز'],[4.2,'جاهزية متقدمة']] as const)assert.equal(readinessLevel(n),label)});
test('mandatory score 1 caps axis level without falsifying its numeric mean',()=>{const {o}=fixture(),v=completeValues(o);for(let i=1;i<=4;i++)v[key(o,`R1.${i}.grade`)]=i===1?'1':'5';v[key(o,'R1.1.mandatory')]='ملزم';v[key(o,'R1.1.reference')]='مرجع 1.2';const r=readinessResults(o,v);assert.equal(r.axis[0].score,4);assert.equal(r.axis[0].level,'جاهزية جزئية');assert.equal(r.blockers.length,1);assert.match(r.executive,/R1.1/)});
test('blank, invalid or deleted rating never becomes zero or a partial denominator',()=>{const {o}=fixture(),v=completeValues(o);v[key(o,'R1.1.grade')]='';assert.equal(readinessResults(o,v).axis[0].score,null);assert.equal(readinessResults(o,v).total,null);v[key(o,'R1.1.grade')]='3.5';assert.equal(readinessResults(o,v).total,null);o.questions=o.questions.filter(q=>q.fieldKey!=='R1.1.grade');assert.equal(readinessResults(o,v).total,null);assert.ok(readinessIssues(o,v).some(x=>x.startsWith('R1.1')))});
test('compliance excludes nonapplicable, weights partial and refuses zero denominator or missing reason',()=>{const {o}=fixture(),v=completeValues(o);const states=o.questions.filter(q=>q.fieldKey==='compliance.status');states.forEach((q,i)=>v[q.id]=i<4?'ممتثل':i<8?'ممتثل جزئيًا':'غير منطبق');let r=readinessResults(o,v);assert.equal(r.percentage,75);assert.equal(r.applicable,8);v[o.questions.find(q=>q.table?.rowId===states[9].table?.rowId&&q.fieldKey==='compliance.evidence')!.id]='';assert.equal(readinessResults(o,v).percentage,null);states.forEach(q=>v[q.id]='غير منطبق');assert.equal(readinessResults(o,v).percentage,null)});
test('submit validation enforces reasons, mandatory references, conditional gaps and complete records',()=>{const {p,o}=fixture(),v=completeValues(o);assert.deepEqual(readinessIssues(o,v),[]);v[key(o,'R1.1.reason')]='';assert.throws(()=>saveAnswers(p,'owner',v,true,o.id),/مبرر الدرجة/);v[key(o,'R1.1.reason')]='دليل';v[key(o,'R1.1.mandatory')]='ملزم';assert.throws(()=>saveAnswers(p,'owner',v,true,o.id),/مرجع الإلزام/);v[key(o,'R1.1.reference')]='مرجع 1';v[key(o,'R1.1.gap')]='';assert.throws(()=>saveAnswers(p,'owner',v,true,o.id),/صف الفجوة/);assert.doesNotThrow(()=>saveAnswers(p,'owner',v,false,o.id))});
test('gaps and quick wins reuse the same source and stable codes after edits or exclusions',()=>{const {o}=fixture(),v=completeValues(o);let r=readinessResults(o,v);assert.equal(r.gaps.length,8);assert.equal(r.gaps[0].code,'G-01');assert.equal(r.gaps[0].axis,r.axis[0].name);v[key(o,'R1.1.gap')]='فجوة محدثة';v[key(o,'A1.quick.value')]='إجراء جديد';r=readinessResults(o,v);assert.equal(r.gaps[0].gap,'فجوة محدثة');assert.equal(r.gaps[0].code,'G-01');assert.match(r.executive,/إجراء جديد/);o.readiness!.excludedGaps=['G-01'];r=readinessResults(o,v);assert.equal(r.gaps.length,7);assert.equal(r.allGaps.length,8);assert.equal(r.gaps[0].code,'G-02')});
test('non-numeric choices still require consensus or explicit review, while grades use the submitted average',()=>{
 const {p,o}=fixture(),v=completeValues(o);p.state.members.push({id:'m',name:'عضو',email:'m@example.test',joined:true,submitted:false,submittedOutputs:[],permissions:[]});o.participants!.push('m');
 const grade=key(o,'R1.1.grade'),mandatory=key(o,'R1.1.mandatory');p.state.answers.owner=Object.fromEntries(Object.entries(v).map(([k,text])=>[k,{text,updated:'now'}]));p.state.members[0].submittedOutputs=[o.id];p.state.answers.m={[grade]:{text:'5',updated:'now'},[mandatory]:{text:'ملزم',updated:'now'}};
 assert.equal(reportValues(p,o).values[grade],'2');p.state.members[1].submittedOutputs=[o.id];assert.equal(reportValues(p,o).values[grade],'3.5');assert.equal(reportValues(p,o).values[mandatory],undefined);assert.deepEqual(reportValues(p,o).conflicts.map(q=>q.id),[mandatory]);
 assert.throws(()=>setFinal(p,'owner',grade,'3.5'),/محسوبة تلقائيًا/);setFinal(p,'owner',mandatory,'غير ملزم');assert.equal(reportValues(p,o).values[mandatory],'غير ملزم');p.state.answers.m[mandatory].text='غير ملزم';assert.equal(reportValues(p,o).values[mandatory],'غير ملزم');assert.throws(()=>setFinal(p,'m',mandatory,'ملزم'),/للمكلّف/);
});
test('readiness planning data remains private from ordinary participants',()=>{const {p,o}=fixture();p.state.members.push({id:'m',name:'عضو',email:'m@example.test',joined:true,submitted:false,submittedOutputs:[],permissions:[]});o.readiness!.plan={1:{target2027:'3',target2029:'4',initiatives:'INIT-01',budgetReference:'خاص'}};assert.deepEqual(visibleProject(p,'m').state.outputs[0].readiness,{version:1});assert.equal(visibleProject(p,'owner').state.outputs[0].readiness?.plan?.[1].budgetReference,'خاص')});
test('checklist never invents targets and invalidates human checks after source or plan changes',()=>{const {p,o}=fixture(),v=completeValues(o);saveAnswers(p,'owner',v,true,o.id);let c=reportChecklist(p,o);assert.ok(!c.checks[4].ok);o.readiness!.plan=Object.fromEntries(Array.from({length:6},(_,i)=>[i+1,{target2027:'3',target2029:'4',initiatives:'INIT-01',budgetReference:'الميزانية ص5'}]));o.readiness!.checks={codes:true,document:true};o.readiness!.checkedAgainst=reportSignature(o,reportValues(p,o).values);c=reportChecklist(p,o);assert.ok(c.checks.every(x=>x.ok),JSON.stringify(c.checks));setFinal(p,'owner',key(o,'R1.1.reason'),'مبرر جديد');assert.ok(!reportChecklist(p,o).checks[5].ok);assert.ok(!reportChecklist(p,o).checks[6].ok)});
test('report export includes calculated results and selected records, never examples or educational instructions',()=>{const {p,o}=fixture(),v=completeValues(o);saveAnswers(p,'owner',v,true,o.id);p.state.instructions='تعليمات سرية للاختبار';const row=o.questions.find(q=>q.fieldKey==='compliance.requirement')!;p.state.answers.owner[row.id].text='متطلب مستبعد فريد';o.readiness!.excludedRecords=[row.table!.rowId!];const out=readinessExport(p,o);assert.match(out,/3.33/);assert.match(out,/8.2 سجل الفجوات/);assert.match(out,/G-01/);assert.ok(!out.includes('تتبع مدير التقنية'));assert.ok(!out.includes('تعليمات سرية للاختبار'));assert.ok(!out.includes('متطلب مستبعد فريد'))});

test('source guide locates moved fields and recombines split answers in original template cells',async()=>{
 const {fieldGuide,pasteValue}=await import('../lib/template-guide.ts');const {o}=fixture(),v=completeValues(o);
 const quick=o.questions.find(q=>q.fieldKey==='A2.quickCost.value')!;
 assert.equal(fieldGuide(o,quick).page,6);assert.match(fieldGuide(o,quick).destination,/8.4/);assert.match(quick.destination!,/8.4/);assert.match(fieldGuide(o,quick).note,/لا تلصقه ضمن خلاصة المحور/);
 const priority=o.questions.find(q=>q.fieldKey==='A2.priority2.value')!;for(const i of [1,2,3])v[key(o,`A2.priority${i}.value`)]='أولوية '+i;
 assert.equal(pasteValue(o,priority,v),'1. أولوية 1\n2. أولوية 2\n3. أولوية 3');assert.match(fieldGuide(o,priority).destination,/أولويات المعالجة \(3\)/);
 v[key(o,'R1.1.mandatory')]='ملزم';v[key(o,'R1.1.reference')]='البند 7';assert.equal(pasteValue(o,o.questions.find(q=>q.fieldKey==='R1.1.reference')!,v),'ملزم — البند 7');
 assert.match(pasteValue(o,o.questions.find(q=>q.fieldKey==='R1.1.gap')!,v),/^G-01 — /);
});
test('paste guide follows source pages, combines original cells and reuses quick wins without example answers',async()=>{
 const {readinessTransfer}=await import('../lib/readiness-transfer.ts');const {o}=fixture(),v=completeValues(o),blocks=readinessTransfer(o,v);
 const summary=blocks.find(b=>b.title==='خلاصة المحور 2')!;assert.equal(summary.page,2);assert.equal(summary.rows.length,5);assert.ok(!summary.rows.some(r=>/الكلفة|المالك|الأثر/.test(r[0])));assert.equal(summary.rows.find(r=>r[0]==='أولويات المعالجة (3)')![1].split('\n').length,3);
 const quick=blocks.find(b=>b.title==='8.4 المكاسب السريعة')!;assert.equal(quick.page,6);assert.deepEqual(quick.headers,['الإجراء','المحور','الأثر','المالك','الكلفة']);assert.equal(quick.rows[1][4],v[key(o,'A2.quickCost.value')]);
 const criteria=blocks.find(b=>b.title.startsWith('المحور 1 —'))!;assert.equal(criteria.rows.length,4);assert.match(criteria.rows[0][7],/^G-01/);assert.equal(criteria.headers.length,8);
 assert.equal(blocks.find(b=>b.title==='نتيجة الامتثال وخلاصة المحور 6')!.page,5);assert.ok(!JSON.stringify(blocks).includes('تتبع مدير التقنية'));
});


test('submission issues identify the exact conditional field and its section even when other answers are filled',()=>{
 const {o}=fixture(),v=completeValues(o);const target=key(o,'R2.2.initiative');v[target]='مبادرة تحسين البيانات';
 const issues=contributionIssues(o,v);assert.equal(issues.length,1);assert.equal(issues[0].questionId,target);assert.equal(issues[0].section,'تفاصيل فجوات المحور 2');assert.match(issues[0].message,/INIT-01/);
 v[target]='INIT‑٠٢ مبادرة تحسين البيانات';assert.deepEqual(contributionIssues(o,v),[]);
});
test('initiative codes accept Arabic digits and typographic dashes without accepting a name or placeholder',()=>{
 for(const x of ['INIT-01 مبادرة','init – ٠٢ مبادرة','INIT−۱۲ مبادرة'])assert.equal(hasInitiativeCode(x),true,x);
 for(const x of ['مبادرة تحسين البيانات','INIT-xx','بدون رمز'])assert.equal(hasInitiativeCode(x),false,x);
});
test('optional blank records stay optional, partial records point to the missing cell and row',()=>{
 const {p,o}=fixture(),v=completeValues(o),table=o.tables!.find(t=>t.title==='سجل الافتراضات')!;
 assert.deepEqual(contributionIssues(o,v),[]);changeContributionRow(p,'owner',o.id,table.id);
 const qs=o.questions.filter(q=>q.table?.id===table.id&&q.table.rowIndex===1);v[qs[0].id]='افتراض اختباري';
 const issues=contributionIssues(o,v);assert.equal(issues.length,1);assert.equal(issues[0].questionId,qs[1].id);assert.match(issues[0].message,/سجل الافتراضات/);
 v[qs[1].id]='مصدر موثق';v[qs[2].id]='أثر متوقع';assert.deepEqual(contributionIssues(o,v),[]);
});

test('one submitted contributor produces a complete report while pending members and their private records stay open',async()=>{
 const {outputSources,submittedOutput}=await import('../lib/output-sources.ts');
 const {p,o}=fixture(),v=completeValues(o);
 p.state.members.push({id:'waiting',name:'منتظر',email:'waiting@example.test',joined:true,submitted:false,submittedOutputs:[],permissions:[]});o.participants!.push('waiting');
 initializeRepeatingRows(p,'waiting');
 const privateField=o.questions.find(q=>q.table?.addedBy==='waiting'&&q.fieldKey==='compliance.requirement')!;
 p.state.answers.waiting={[privateField.id]:{text:'مسودة خاصة لا تدخل التقرير',updated:'now'}};
 saveAnswers(p,'owner',v,true,o.id);
 o.readiness!.plan=Object.fromEntries(Array.from({length:6},(_,i)=>[i+1,{target2027:'3',target2029:'4',initiatives:'INIT-01',budgetReference:'الميزانية ص5'}]));
 o.readiness!.checks={codes:true,document:true};o.readiness!.checkedAgainst=reportSignature(o,reportValues(p,o).values);
 const snapshot=JSON.stringify(p),c=reportChecklist(p,o);
 assert.equal(c.r.total,3.33);assert.equal(c.r.percentage,100);assert.deepEqual(c.issues,[]);assert.ok(c.checks.every(x=>x.ok),JSON.stringify(c.checks));
 assert.deepEqual(outputSources(p,o),{submitted:1,total:2,pending:1});assert.ok(!submittedOutput(p,o).questions.some(q=>q.table?.addedBy==='waiting'));
 assert.equal(p.state.status,'active');assert.equal(o.closedAt,undefined);assert.deepEqual(p.state.members[1].submittedOutputs,[]);
 const exported=readinessExport(p,o);assert.match(exported,/المساهمات المحتسبة: 1 من 2/);assert.match(exported,/جاهز وفق قائمة التحقق للمساهمات المسلّمة/);assert.ok(!exported.includes('مسودة خاصة'));
 assert.equal(JSON.stringify(p),snapshot,'reporting must not submit members, close the output or change answers');
});
test('no submitted contributions never produces calculated scores or a ready report, even with a complete draft',()=>{
 const {p,o}=fixture(),v=completeValues(o);saveAnswers(p,'owner',v,false,o.id);
 const c=reportChecklist(p,o);assert.equal(c.r.total,null);assert.equal(c.r.percentage,null);assert.equal(c.sources.submitted,0);assert.equal(c.checks.find(x=>x.label==='توفر مساهمة مسلّمة للاحتساب')!.ok,false);assert.equal(c.values[key(o,'R1.1.grade')],undefined);assert.equal(c.values[key(o,'R1.1.evidence')],'');
 assert.match(readinessExport(p,o),/لم تُسلّم أي مساهمة/);
});
test('counts use submitted contributors per output and per owned row, with legacy submission support',async()=>{
 const {outputSources,questionSources}=await import('../lib/output-sources.ts');const {p,o}=fixture(),v=completeValues(o);saveAnswers(p,'owner',v,true,o.id);
 p.state.members[0].submitted=true;delete p.state.members[0].submittedOutputs;
 p.state.members.push({id:'other',name:'آخر',email:'other@example.test',joined:true,submitted:true,submittedOutputs:['different-output'],permissions:[]},{id:'outside',name:'خارج',email:'outside@example.test',joined:true,submitted:true,submittedOutputs:[o.id],permissions:[]});o.participants!.push('other');
 const grade=key(o,'R1.1.grade');p.state.answers.outside={[grade]:{text:'5',updated:'now'}};
 assert.deepEqual(outputSources(p,o),{submitted:1,total:2,pending:1});assert.equal(reportValues(p,o).values[grade],'2');
 assert.deepEqual(questionSources(p,o,o.questions.find(q=>q.id===grade)!),{count:1,total:1});assert.deepEqual(questionSources(p,o,o.questions.find(q=>q.table?.addedBy==='owner')!),{count:1,total:1});
 assert.throws(()=>setFinal(p,'owner',grade,'2'),/محسوبة تلقائيًا/);assert.equal(reportValues(p,o).values[grade],'2');
});
test('later submitted grades automatically update the average; genuinely missing criteria remain missing',()=>{
 const {p,o}=fixture(),v=completeValues(o);p.state.members.push({id:'m',name:'عضو',email:'m@example.test',joined:true,submitted:false,submittedOutputs:[],permissions:[]});o.participants!.push('m');saveAnswers(p,'owner',v,true,o.id);
 const grade=key(o,'R1.1.grade');p.state.answers.m={[grade]:{text:'5',updated:'now'}};
 assert.equal(reportChecklist(p,o).r.total,3.33);p.state.members[1].submittedOutputs=[o.id];
 let c=reportChecklist(p,o);assert.equal(c.r.axis[0].score,2.38);assert.equal(c.r.axis[1].score,2);assert.equal(c.r.total,3.4);assert.equal(c.conflicts.length,0);
 assert.throws(()=>setFinal(p,'owner',grade,'2'),/محسوبة تلقائيًا/);
 const missing=key(o,'R2.1.grade');delete p.state.answers.owner[missing];c=reportChecklist(p,o);assert.equal(c.r.axis[1].score,null);assert.equal(c.r.total,null);
});

test('rating means count every submitted vote, exclude blanks and drafts, and ignore stale manual rating decisions',async()=>{
 const {p,o}=fixture(),v=completeValues(o),grade=key(o,'R1.1.grade');
 for(const id of ['same','high','blank','draft']){p.state.members.push({id,name:id,email:id+'@example.test',joined:true,submitted:false,submittedOutputs:id==='draft'?[]:[o.id],permissions:[]});o.participants!.push(id)}
 p.state.answers.owner=Object.fromEntries(Object.entries(v).map(([k,text])=>[k,{text,updated:'now'}]));p.state.members[0].submittedOutputs=[o.id];p.state.answers.owner[grade].text='1';
 for(const [id,text] of [['same','1'],['high','5'],['blank',''],['draft','5']])p.state.answers[id]={[grade]:{text,updated:'now'}};
 p.state.finals[grade]={text:'5',manual:true,aiText:'',by:'old',updated:'now',differences:[],revisions:[]};
 const c=reportChecklist(p,o);assert.equal(Number(c.values[grade]),7/3);assert.deepEqual(c.ratings[grade],{mean:7/3,count:3,scores:[1,1,5]});assert.equal(c.conflicts.length,0);assert.equal(c.r.axis[0].score,2.08);assert.ok(!c.fieldIssues.some(x=>x.questionId===grade));
 const {readinessTransfer}=await import('../lib/readiness-transfer.ts');const {pasteValue}=await import('../lib/template-guide.ts');
 assert.equal(pasteValue(o,o.questions.find(q=>q.id===grade)!,c.values),'2.33');assert.ok(readinessTransfer(c.output,c.values).find(b=>b.title.startsWith('المحور 1 —'))!.rows[0].includes('2.33'));assert.match(readinessExport(p,o),/2\.33/);
});
test('one submitted rating is used as-is, invalid ratings never count as votes, and contribution input remains integer-only',()=>{
 const {p,o}=fixture(),v=completeValues(o),grade=key(o,'R1.1.grade');p.state.members.push({id:'m',name:'m',email:'m@example.test',joined:true,submitted:false,submittedOutputs:[],permissions:[]});o.participants!.push('m');
 v[grade]='3.5';assert.throws(()=>saveAnswers(p,'owner',v,true,o.id),/الخيارات المحددة/);v[grade]='4';saveAnswers(p,'owner',v,true,o.id);p.state.members[1].submittedOutputs=[o.id];
 for(const text of ['','not a rating','0','6','3.5']){p.state.answers.m={[grade]:{text,updated:'now'}};const r=reportValues(p,o);assert.equal(r.values[grade],'4');assert.equal(r.ratings[grade].count,1)}
 p.state.answers.owner[grade].text='';assert.equal(reportChecklist(p,o).r.total,null);assert.equal(reportValues(p,o).ratings[grade].count,0);
});
test('missing report inputs identify their fields and plan axes while optional empty fields are not marked incomplete',()=>{
 const {p,o}=fixture(),v=completeValues(o);saveAnswers(p,'owner',v,true,o.id);const reason=key(o,'R1.1.reason');delete p.state.answers.owner[reason];
 const c=reportChecklist(p,o);assert.equal(c.fieldIssues.find(x=>x.questionId===reason)?.section,'المحور 1: الاستراتيجية والحوكمة والقيادة');assert.equal(c.planIssues.length,6);assert.match(c.planIssues[0],/مستهدف 2027.*مستهدف 2029.*مرجع التمويل/);
 const exported=readinessExport(p,o);assert.match(exported,/معلومة مطلوبة غير متوفرة/);assert.match(exported,/غير مطلوب في هذه الحالة/);
});

 test('template guidance exposes fixed methodology and auto-numbers assumption and reference records',async()=>{
 const {readinessTransfer}=await import('../lib/readiness-transfer.ts');const {tableGuide}=await import('../lib/template-guide.ts');const {o}=fixture(),v=completeValues(o);
 const aq=o.questions.find(q=>q.fieldKey==='assumption.assumption')!;v[aq.id]='افتراض اختبار';
 const blocks=readinessTransfer(o,v),method=blocks.find(b=>b.title==='المنهجية وقواعد التقييم')!,assumptions=blocks.find(b=>b.title.startsWith('ملحق 1'))!,refs=blocks.find(b=>b.title.startsWith('ملحق 2'))!;
 assert.match(method.instruction,/قواعد الاحتساب ثابتة/);assert.match(method.rows[0][1],/1.80/);assert.equal(assumptions.headers[0],'#');assert.equal(assumptions.rows[0][0],'1');assert.equal(assumptions.rows[0][1],'افتراض اختبار');assert.equal(refs.headers[0],'#');assert.match(tableGuide(o,aq),/ترقيم تسلسلي آلي/);
 });

test('methodology is required per axis, exported and invalidates review when edited',async()=>{const {p,o}=fixture();const {readinessTransfer}=await import('../lib/readiness-transfer.ts');const before=reportSignature(o,{});assert.ok(reportChecklist(p,o).checks[8].ok);o.readiness!.methodology![1].scope='';assert.ok(!reportChecklist(p,o).checks[8].ok);assert.match(reportChecklist(p,o).checks[8].detail,/النطاق/);assert.notEqual(reportSignature(o,{}),before);o.readiness!.methodology![1].scope='كل وحدات الجامعة';assert.match(readinessExport(p,o),/كل وحدات الجامعة/);assert.equal(readinessTransfer(o,{}).find(b=>b.title==='النطاق ومصادر الأدلة — المحور 1')!.rows[0][1],'كل وحدات الجامعة');});
