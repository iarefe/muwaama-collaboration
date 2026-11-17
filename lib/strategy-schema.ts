import blocks from './strategy-word.json';
import type {Output,Project,Question,TemplateTable} from './model';

const assigneeBlocks=new Set([1,2,3,7]);
const prompts:Record<number,string>={
 9:'ما القرار أو الأولوية التي تفرضها نتيجة هذا المحور على الخطة؟',
 10:'اختر فجوة ذات أولوية من التقرير المعتمد، وحدد المستهدف الذي سيعالجها.',
 15:'صغ هدفًا يحدد التحسن المطلوب وخط البداية والمستهدف والموعد.',
 17:'عرّف مؤشرًا يمكن قياسه وحدد مصدره وخط الأساس ومستهدفي 2027 و2029.',
 19:'اقترح مبادرة لمعالجة فجوة محددة، واربطها بهدف ومالك وتمويل.',
 27:'اختر تدخلًا يعالج أول عائق ظاهر للفئة، وحدد من ينفذه وكيف تقيس الاستجابة.',
 49:'اختر خدمة وحدد الحدث الذي يطلقها والبيانات والضمانات اللازمة.',
 55:'قدّر أثر انقطاع الخدمة وحدد أهداف الاستعادة بوحدة زمن واحدة.',
 64:'صف ما قد يتوقف، ومن يتأثر، وكيف سيرصد المالك الخطر ويتعامل معه.'
};
export function restoreStrategy(o:Output,p?:Project){
 if(!o.strategyWord)return;
 const excluded=new Set(o.strategyExcluded);
 const added=o.questions.filter(q=>q.table?.addedBy&&!q.id.startsWith('starter-'));
 const used=new Set([...Object.keys(p?.state.finals||{}),...Object.values(p?.state.answers||{}).flatMap(a=>Object.keys(a))]);
 const people=p?.state.members.filter(m=>m.joined&&(!o.participants||o.participants.includes(m.id)))||[];
 const order=(n:number)=>assigneeBlocks.has(n)?100+n:n;

 const questions:Question[]=[],tables:TemplateTable[]=[];
 for(const b of [...blocks].sort((a,b)=>order(a.n)-order(b.n))){
  const id='strategy-'+b.n;
  if(b.labels){
   const rows=b.labels;
   const table:TemplateTable={id,title:b.title,rowHeading:'البند',rows,columns:[{label:'مساهمتك',kind:'text',fixedValues:[]}],instructions:b.guide};
   tables.push(table);
   rows.forEach((label,i)=>questions.push({id:id+'-'+i,title:label,prompt:'ما الصياغة المقترحة لبند «'+label+'»؟',guidance:'',destination:b.title+' / '+label,table:{id,title:b.title,rowHeading:'البند',row:label,column:'مساهمتك',rowIndex:i,columnIndex:0,rowId:id+'-'+i}}));continue;
  }
  const fixed=(b.fixed||{}) as Record<string,string[]>;
  const cols=b.cols!, heading=!!fixed[0],offset=Number(heading);
  const record=!!b.extra;
  const rows=Array.from({length:b.rows!},(_,i)=>fixed[0]?.[i]||'');
  const options=(j:number)=>{
   if(b.n===10&&j===0)return Array.from({length:24},(_,i)=>'G-'+String(i+1).padStart(2,'0'));
   if(b.n===10&&j===1)return blocks.find(x=>x.n===9)!.fixed!['0']!;
   if(b.n===19&&j===5)return ['1 — التأسيس (2027)','2 — التوسع (2028)','3 — التميز (2029)'];
   if((b.n===38||b.n===44)&&j===1)return ['إزالة','تبسيط','دمج','أتمتة','إبقاء'];
   if(b.n===27&&j>=1&&j<=5)return ['1','2','3','4','5'];
   if((b.n===58&&[4,5,6].includes(j))||(b.n===64&&[2,3].includes(j)))return ['1','2','3'];
   if(b.n===49&&[2,3].includes(j))return ['0','1','2','3','4'];
   if(b.n===64&&j===5)return ['تجنب','تخفيف','نقل','قبول موثق'];
   return [];
  };
  const legacyAxis=b.n===10&&Array.from(used).some(key=>/^strategy-10-\d+-1$/.test(key));
  const derived=(j:number)=>(b.n===10&&j===1&&!legacyAxis)||(b.n===58&&j===7)||(b.n===64&&j===4)||(b.n===27&&j===6);
  const columns=cols.slice(offset).map((label,c)=>{const j=c+offset;return {label,kind:fixed[j]||derived(j)?'fixed' as const:options(j).length?'choice' as const:'text' as const,fixedValues:fixed[j]||[]};});
  const table:TemplateTable={id,title:b.title,rowHeading:heading?cols[0]:'',rows,columns,allowExtraRows:b.extra,instructions:[prompts[b.n],b.guide].filter(Boolean).join('\n')};
  tables.push(table);
  rows.forEach((row,r)=>columns.forEach((col,c)=>{
   if(col.kind==='fixed')return;
   const cell=row||'الصف '+(r+1),opts=options(c+offset);
   questions.push({id:id+'-'+r+'-'+c,title:cell+' — '+col.label,prompt:'أدخل '+col.label,guidance:'',destination:b.title+' / '+cell+' / '+col.label,required:!b.extra&&!(b.n===13&&r===3),input:opts.length?{kind:'choice',options:opts}:undefined,table:{id,title:b.title,rowHeading:table.rowHeading,row,column:col.label,rowIndex:r,columnIndex:c,rowId:id+'-'+r}});
  }));
  if(record){
   const cells=questions.filter(q=>q.table?.id===id);
   const historicRows=new Set(cells.filter(q=>used.has(q.id)).map(q=>q.table!.rowIndex));
   const starter=cells.filter(q=>q.table!.rowIndex===0&&!excluded.has(q.id));
   const retained=cells.filter(q=>historicRows.has(q.table!.rowIndex)||(!o.sourceReviewed&&q.table!.rowIndex===0));
   questions.splice(questions.length-cells.length,cells.length,...retained);
   table.rows=rows.slice(0,Math.max(!o.sourceReviewed?1:0,...[...historicRows].map(r=>r+1)));
   table.rowTemplate=starter;
   table.rowMode='repeatable';
   if(o.sourceReviewed){
    for(const q of added.filter(q=>q.table?.id===id))while(table.rows.length<=q.table!.rowIndex)table.rows.push('');
    for(const m of people){
     if(assigneeBlocks.has(b.n)&&m.id!==o.assignee)continue;
     const rowIndex=table.rows.length,rowId='starter-'+id+'-'+m.id;
     table.rows.push('');
     for(const q of starter)questions.push({...q,id:rowId+'-'+q.table!.columnIndex,title:'الصف '+(rowIndex+1)+' — '+q.table!.column,destination:b.title+' / الصف '+(rowIndex+1)+' / '+q.table!.column,table:{...q.table!,row:'',rowIndex,rowId,addedBy:m.id}});
    }
   }
  }
  for(const q of added.filter(q=>q.table?.id===id))while(table.rows.length<=q.table!.rowIndex)table.rows.push('');
 }
 o.tables=tables;o.questions=[...questions.filter(q=>!excluded.has(q.id)),...added];
}
