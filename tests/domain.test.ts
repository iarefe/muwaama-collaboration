import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProject,addParticipant,outputComplete,outputProgress,participants,newProject,saveAnswers,setFinal,mergeAI,visibleProject,allow,canEditOutput,type Project} from '../lib/model.ts';
const owner={userId:'owner',email:'owner@test.com',displayName:'المنشئ'};
function project(){const p=newProject(owner,'space','مشروع تجريبي','');p.state.members.push({id:'member',email:'member@test.com',name:'عضو',permissions:[],joined:true,submitted:false});p.state.outputs=[{id:'out',title:'مخرج',format:'sections',assignee:'owner',questions:[{id:'q1',title:'المشكلة',prompt:'ما المشكلة؟',guidance:''},{id:'q2',title:'الحل',prompt:'ما الحل؟',guidance:''}]}];p.state.status='active';return p}
test('draft save does not count as submission',()=>{const p=project();saveAnswers(p,'member',{q1:'فكرة'},false);assert.equal(p.state.members[1].submitted,false);assert.equal(p.state.status,'active')});
test('incomplete submission is rejected',()=>{const p=project();assert.throws(()=>saveAnswers(p,'member',{q1:'فكرة'},true),/أكمل/)});
test('last submission atomically closes all answer editing, keeps review',()=>{const p=project();saveAnswers(p,'member',{q1:'مشكلة',q2:'حل'},true);saveAnswers(p,'member',{q1:'مشكلة محسنة'},false);assert.equal(p.state.status,'active');saveAnswers(p,'owner',{q1:'مشكلة',q2:'حل'},true);assert.equal(p.state.status,'complete');assert.throws(()=>saveAnswers(p,'member',{q1:'تعديل'},false),/أُغلق/);const v=visibleProject(p,'member');assert.equal(v.state.answers.member.q1.text,'مشكلة محسنة')});
test('unjoined invite prevents premature completion',()=>{const p=project();p.state.members[1].joined=false;saveAnswers(p,'owner',{q1:'مشكلة',q2:'حل'},true);assert.equal(p.state.status,'active')});
test('nonmember rejected, invitations and references hidden from member',()=>{const p=project();p.state.instructions='private';p.state.members.push({id:'pending',email:'secret@test.com',name:'مدعو',permissions:[],joined:false,submitted:false,tokenHash:'secret'});assert.throws(()=>visibleProject(p,'outsider'),/صلاحية/);const v=visibleProject(p,'member');assert.equal(v.state.instructions,'');assert.equal(v.state.members[2].tokenHash,undefined);assert.equal(v.state.members[2].email,'');assert.throws(()=>allow(p,'member','permissions'),/غير متاح/)});
test('member cannot read other answers or final outputs without delegation',()=>{const p=project();saveAnswers(p,'owner',{q1:'خاص',q2:'خاص'},true);mergeAI(p,'q1','نهائي',[],'h');const v=visibleProject(p,'member');assert.deepEqual(Object.keys(v.state.answers),['member']);assert.deepEqual(v.state.finals,{})});
test('manual final remains editable after answers lock and survives AI refresh',()=>{const p=project();p.state.status='complete';setFinal(p,'owner','q1','تعديل يدوي');mergeAI(p,'q1','اقتراح جديد',[{difference:'اختلاف',treatment:'جمع',reason:'تكامل'}],'new');assert.equal(p.state.finals.q1.text,'تعديل يدوي');assert.equal(p.state.finals.q1.pending,'اقتراح جديد');assert.equal(p.state.finals.q1.manual,true)});
test('AI final saves automatically and updates when not manually edited',()=>{const p=project();mergeAI(p,'q1','أول',[],'1');mergeAI(p,'q1','ثان',[],'2');assert.equal(p.state.finals.q1.text,'ثان');assert.equal(p.state.finals.q1.revisions[0].text,'أول')});
test('output assignee is scoped to assigned output only',()=>{const p=project();p.state.outputs.push({id:'other',title:'آخر',format:'sections',assignee:'member',questions:[{id:'q3',title:'آخر',prompt:'سؤال',guidance:''}]});mergeAI(p,'q1','سري',[],'1');mergeAI(p,'q3','مسموح',[],'3');const v=visibleProject(p,'member');assert.deepEqual(Object.keys(v.state.finals),['q3']);assert.throws(()=>setFinal(p,'member','q1','تجاوز'),/للمكلّف/);assert.doesNotThrow(()=>setFinal(p,'member','q3','تعديل'))});
test('drafts from others stay private even for output viewers',()=>{const p=project();p.state.members[1].permissions=['output'];saveAnswers(p,'owner',{q1:'مسودة غير مرسلة'},false);assert.equal(visibleProject(p,'member').state.answers.owner,undefined)});
test('archived final edits are rejected',()=>{const p=project();p.state.status='archived';assert.throws(()=>setFinal(p,'owner','q1','تعديل'),/مؤرشف/)});

test('each output submits and closes independently',()=>{
 const p=project();p.state.outputs.push({id:'second',title:'المخرج الثاني',format:'sections',assignee:'owner',questions:[{id:'q3',title:'الهدف',prompt:'ما الهدف؟',guidance:''}]});
 saveAnswers(p,'member',{q1:'مشكلة',q2:'حل'},true,'out');
 assert.equal(p.state.members[1].submitted,false);
 assert.deepEqual(p.state.members[1].submittedOutputs,['out']);
 saveAnswers(p,'owner',{q1:'مشكلة',q2:'حل'},true,'out');
 assert.equal(p.state.status,'active');assert.ok(p.state.outputs[0].closedAt);assert.equal(p.state.outputs[1].closedAt,undefined);
 assert.throws(()=>saveAnswers(p,'member',{q1:'تعديل'},false,'out'),/أُغلق/);
 saveAnswers(p,'member',{q3:'هدف'},true,'second');saveAnswers(p,'owner',{q3:'هدف'},true,'second');
 assert.equal(p.state.status,'complete');
});
test('cross-output answers rejected and submitted answers cannot become empty',()=>{
 const p=project();p.state.outputs.push({id:'second',title:'آخر',format:'sections',assignee:'owner',questions:[{id:'q3',title:'هدف',prompt:'هدف؟',guidance:''}]});
 assert.throws(()=>saveAnswers(p,'member',{q1:'فكرة',q3:'تجاوز'},false,'out'),/لا ينتمي/);
 assert.equal(Object.hasOwn(p.state.answers,'member'),false);
 saveAnswers(p,'member',{q1:'فكرة',q2:'حل'},true,'out');assert.throws(()=>saveAnswers(p,'member',{q1:''},false,'out'),/أكمل/);
 assert.equal(p.state.answers.member.q1.text,'فكرة');
});
test('only submitted output answers are visible to a reviewer',()=>{
 const p=project();p.state.outputs.push({id:'second',title:'آخر',format:'sections',assignee:'owner',questions:[{id:'q3',title:'هدف',prompt:'هدف؟',guidance:''}]});
 saveAnswers(p,'member',{q1:'مرسل',q2:'مرسل'},true,'out');saveAnswers(p,'member',{q3:'مسودة سرية'},false,'second');
 const v=visibleProject(p,'owner');assert.equal(v.state.answers.member.q1.text,'مرسل');assert.equal(v.state.answers.member.q3,undefined);
});
test('legacy global submissions migrate without losing completion',()=>{
 const p=project();delete p.state.members[0].submittedOutputs;p.state.members.forEach(m=>m.submitted=true);p.state.status='complete';
 normalizeProject(p);assert.deepEqual(p.state.members[0].submittedOutputs,['out']);assert.ok(p.state.outputs[0].closedAt);assert.equal(outputProgress(p,p.state.outputs[0]),2);
});
test('late invitations join open outputs without reopening completed ones',()=>{
 const p=project();p.state.outputs.push({id:'second',title:'آخر',format:'sections',assignee:'owner',questions:[{id:'q3',title:'هدف',prompt:'هدف؟',guidance:''}]});
 saveAnswers(p,'member',{q1:'مشكلة',q2:'حل'},true,'out');saveAnswers(p,'owner',{q1:'مشكلة',q2:'حل'},true,'out');
 addParticipant(p,{id:'late',name:'لاحق',email:'late@example.test',joined:false,submitted:false,permissions:[]});
 assert.equal(outputComplete(p,p.state.outputs[0]),true);assert.equal(participants(p,p.state.outputs[0]).length,2);assert.equal(participants(p,p.state.outputs[1]).length,3);
 p.state.members[2].joined=true;assert.throws(()=>saveAnswers(p,'late',{q1:'لاحق'},false,'out'),/أُغلق/);saveAnswers(p,'late',{q3:'فكرة'},true,'second');
});
test('unfinished attachment analysis never leaks to participants',()=>{
 const p=project();p.state.analysis={sourceHash:'h',cursor:1,total:4,instructions:'مرجع خاص',outputs:[]};assert.equal(visibleProject(p,'member').state.analysis,undefined);
});

test('saving a gap draft reserves its code until the contributor changes or clears it',()=>{
 const p=project(),o=p.state.outputs[0];
 o.strategyWord=true;o.sourceReviewed=true;
 o.questions[0].table={id:'strategy-10',title:'الفجوات',rowHeading:'',row:'',column:'الرمز',rowIndex:0,columnIndex:0};
 saveAnswers(p,'owner',{q1:'G-02'},false);
 assert.deepEqual(visibleProject(p,'member').state.outputs[0].reservedGapCodes,['G-02']);
 assert.throws(()=>saveAnswers(p,'member',{q1:'G-02'},false),/حفظ مشارك آخر/);
 saveAnswers(p,'owner',{q1:'G-05'},false);
 saveAnswers(p,'member',{q1:'G-02'},false);
 assert.deepEqual(visibleProject(p,'member').state.outputs[0].reservedGapCodes,['G-05']);
 saveAnswers(p,'owner',{q1:''},false);
 assert.deepEqual(visibleProject(p,'member').state.outputs[0].reservedGapCodes,[]);
});

test('team goals require three complete rows across contributors before final submission',()=>{
 const p=project(),o=p.state.outputs[0];
 o.strategyWord=true;o.sourceReviewed=true;
 const tableId='strategy-15';
 o.tables=[{id:tableId,title:'الأهداف الرقمية',rows:[],columns:[],rowHeading:'',rowMode:'repeatable'}];
 o.questions=['a','b','c'].map((row,i)=>({id:row,title:row,prompt:'',guidance:'',required:false,table:{id:tableId,title:'الأهداف الرقمية',rowHeading:'',row:'',column:'الهدف',rowIndex:i,columnIndex:0,rowId:row,addedBy:i?'member':'owner'}}));
 saveAnswers(p,'owner',{a:'الهدف الأول'},true);
 assert.throws(()=>saveAnswers(p,'member',{b:'الهدف الثاني'},true),/المتبقي 1/);
 saveAnswers(p,'member',{b:'الهدف الثاني',c:'الهدف الثالث'},true);
 assert.equal(p.state.status,'complete');
});

test('document control accepts a single complete release and rejects a missing release',()=>{
 const p=project(),o=p.state.outputs[0];
 o.strategyWord=true;o.sourceReviewed=true;
 o.tables=[{id:'strategy-2',title:'ضبط الوثيقة',rows:[],columns:[],rowHeading:'',rowMode:'repeatable'}];
 o.questions=['الإصدار','التاريخ','وصف التغيير','المعد','المراجع'].map((column,i)=>({id:'v'+i,title:column,prompt:'',guidance:'',required:false,table:{id:'strategy-2',title:'ضبط الوثيقة',rowHeading:'',row:'',column,rowIndex:0,columnIndex:i,rowId:'version-1',addedBy:'owner'}}));
 assert.throws(()=>saveAnswers(p,'owner',{},true),/المتبقي 1/);
 assert.throws(()=>saveAnswers(p,'owner',{v0:'1.0'},true),/أكمل/);
 saveAnswers(p,'owner',{v0:'1.0',v1:'2026-10-31',v2:'الإصدار الأول',v3:'المعد',v4:'المراجع'},true);
 assert.ok(p.state.members[0].submittedOutputs?.includes(o.id));
});

test('ordinary members can save the same digital goal code as another contributor',()=>{
 const p=project(),o=p.state.outputs[0];o.strategyWord=true;o.sourceReviewed=true;
 o.questions=['owner','member','member'].map((addedBy,i)=>({id:'c'+i,title:'الرمز',prompt:'',guidance:'',table:{id:'strategy-15',title:'2.2',rowHeading:'',row:'',rowId:'r'+i,rowIndex:i,column:'الرمز',columnIndex:0,addedBy}}));
 saveAnswers(p,'owner',{c0:'DO-01'},false);
 saveAnswers(p,'member',{c1:'DO-01'},false);
 assert.equal(p.state.answers.owner.c0.text,p.state.answers.member.c1.text);
 assert.throws(()=>saveAnswers(p,'member',{c2:'DO-٠١'},false),/في صف آخر من مساهمتك/);
});
