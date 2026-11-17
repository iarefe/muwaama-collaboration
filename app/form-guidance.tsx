'use client';
import type {Output,Question,TemplateTable} from '../lib/model';
import {columnPrompts,extraCellHelp,inputHint} from '../lib/form-presentation';
import {fieldGuide,tableGuide,templateFileUrl} from '../lib/template-guide';

export function ReadableText({text}:{text:string}){
 const lines=text.split(/\n+|(?<=[؛؟!])\s+|\.\s+(?=[\u0600-\u06ff])/u).map(s=>s.trim()).filter(Boolean);
 return lines.length>1?<ul className="readable-lines">{lines.map((line,i)=><li key={i}>{line}</li>)}</ul>:<p className="readable-paragraph">{text}</p>;
}
export function TableHelp({projectId,o,questions,table}:{projectId:string,o:Output,questions:Question[],table?:TemplateTable}){
 const normalize=(s:string)=>s.replace(/\bR\d+\.\d+\b/g,'المعيار المقابل').replace(/\bG-\d+\b/g,'الفجوة').replace(/صف \d+/g,'الصف المقابل');
 const first=questions[0];if(!first)return null;
 const groups=[...new Set(questions.map(q=>q.table?.columnIndex))].map(index=>questions.filter(q=>q.table?.columnIndex===index));
 const tableText=[...new Set([table?.instructions,...questions.map(q=>q.guidance).filter(s=>s&&questions.every(q=>q.guidance===s))].filter(Boolean))].join('\n');
 const mapping=tableGuide(o,first),page=fieldGuide(o,first).page;
 return <details className="table-help"><summary>إرشادات التعبئة ومصادر الأعمدة</summary><div className="table-help-body">{tableText&&<section><h4>قواعد هذا الجدول</h4><ReadableText text={tableText}/></section>}{mapping&&<section><h4>مطابقة الجدول مع القالب</h4><ReadableText text={mapping}/></section>}{groups.map(qs=>{
  const prompts=columnPrompts(qs),q=qs[0],commonGuidance=qs.every(x=>x.guidance===q.guidance)&&q.guidance&&q.guidance!==tableText&&q.guidance!==table?.instructions?q.guidance:'';
  const sources=[...new Map(qs.map(x=>{const g=fieldGuide(o,x);const source=normalize(g.source);return [source+'|'+normalize(g.destination)+'|'+g.note+'|'+g.page,{...g,source,destination:normalize(g.destination),label:x.table?.row||x.title}]})).values()];
  return <section className="column-help-block" key={q.table?.columnIndex}><h4>{q.table?.column||q.title}</h4>{prompts.length===1?<ReadableText text={prompts[0]}/>:<p className="muted">لكل بند إرشاده المختصر أسفل خانة الإجابة.</p>}{commonGuidance&&<ReadableText text={commonGuidance}/>}<details className="column-source"><summary>مصدر هذا العمود في القالب</summary><ul className="readable-lines">{sources.map((g,i)=><li key={i}><strong>{g.source===g.destination?'المصدر وموضع اللصق: ':'المصدر: '}</strong>{g.source}{g.note&&!mapping&&<ReadableText text={g.note}/>}{g.source!==g.destination&&<p><strong>موضع اللصق:</strong> {g.destination}</p>}{o.sourceFileId&&<a href={templateFileUrl(projectId,o.sourceFileId,g.page||page)} target="_blank" rel="noreferrer">{g.page?'فتح صفحة '+g.page:'فتح القالب الأصلي'}</a>}</li>)}</ul></details></section>;
 })}</div></details>;
}
export function CellInstruction({q,questions,table}:{q:Question,questions:Question[],table?:TemplateTable}){
 const peers=questions.filter(x=>x.table?.columnIndex===q.table?.columnIndex),specific=columnPrompts(peers).length>1;
 const extra=extraCellHelp(q,questions,table);
 return <>{specific&&<p className="cell-prompt">{inputHint(q)}</p>}{extra.length>0&&<details className="cell-help"><summary>إرشاد خاص بهذا الحقل</summary>{extra.map((s,i)=><ReadableText key={i} text={s}/>)}</details>}</>;
}
