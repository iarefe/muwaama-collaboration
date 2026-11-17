import type {Question,TemplateTable} from './model';

export function inputHint(q:Question){
 const key=q.fieldKey||'';
 const summary=key.match(/^A\d\.(\w+)\.value$/)?.[1];
 const hints:Record<string,string>={blockers:'اذكر العائق الذي يمنع التقدم، أو وضّح عدم وجوده.',priority1:'ما الإجراء الأهم لمعالجة هذا المحور؟',priority2:'ما الإجراء التالي في الأولوية؟',priority3:'ما الإجراء الثالث؟',quick:'حدد إجراءً يمكن البدء به خلال 90 يومًا.',quickImpact:'ما التحسن المتوقع من هذا الإجراء؟',quickOwner:'حدد الجهة أو الشخص المسؤول عن التنفيذ.',quickCost:'اذكر الكلفة التقديرية أو الموارد المطلوبة.'};
 if(summary&&hints[summary])return hints[summary];
 return q.prompt;
}
const unique=(xs:(string|undefined)[])=>[...new Set(xs.map(x=>x?.trim()||'').filter(Boolean))];
export function columnPrompts(qs:Question[]){return unique(qs.map(inputHint));}
export function extraCellHelp(q:Question,qs:Question[],table?:TemplateTable){
 const peers=qs.filter(x=>x.table?.columnIndex===q.table?.columnIndex);
 return unique([q.guidance,q.requirement]).filter(s=>s!==table?.instructions?.trim()&&!qs.every(x=>x.guidance?.trim()===s)&&!peers.every(x=>x.guidance?.trim()===s));
}
export function columnSize(table:TemplateTable|undefined,qs:Question[],index:number){
 const c=table?.columns[index],cells=qs.filter(q=>q.table?.columnIndex===index),label=c?.label||cells[0]?.table?.column||'';
 if(cells.some(q=>q.fieldKey?.endsWith('.grade'))||/^الدرجة(?:\s|$)/.test(label))return 82;
 if(cells[0]?.input?.kind==='choice'||c?.kind==='choice')return /الإلزام|الأولوية/.test(label)?112:148;
 if(/^(الرمز|م|#|رقم)$/.test(label.trim()))return 76;
 if(c?.kind==='fixed')return Math.max(...c.fixedValues.map(x=>x.length),0)<32?150:218;
 if(/المالك|الموعد|الكلفة|القسم/.test(label))return 150;
 return 220;
}
export function rowHeadingSize(table:TemplateTable|undefined,qs:Question[]){
 const labels=table?.rows||qs.map(q=>q.table?.row||'');
 return labels.every(s=>!s||s.length<14)?76:220;
}
