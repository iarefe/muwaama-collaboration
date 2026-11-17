import type {Question} from './model';
export const gapMinimum=3;
export const gapGuide='ابدأ بالعوائق الملزمة، ثم اختر الفجوات الأعلى أثرًا. لم يحدد القالب عددًا لهذا الجدول. الحد الأدنى في موائمة 3 فجوات مكتملة ومختلفة للفريق، والمقترح 6–8 بحسب الأدلة. اختر رمزًا لكل صف قبل توليف بقية حقوله.';
export const isGap=(q:Question)=>q.table?.id==='strategy-10';
export function sameFieldRow(a:Question,b:Question){
 if(!a.table||!b.table||a.table.id!==b.table.id)return false;
 if(a.table.rowId&&b.table.rowId)return a.table.rowId===b.table.rowId;
 return a.table.rowIndex===b.table.rowIndex&&a.table.addedBy===b.table.addedBy;
}
export function completedGapCodes(qs:Question[],value:(q:Question)=>string){
 const codes=new Set<string>();
 for(const q of qs.filter(q=>isGap(q)&&q.table!.columnIndex===0)){
  const code=value(q)?.trim();
  if(/^G-(0[1-9]|1[0-9]|2[0-4])$/.test(code)&&qs.filter(x=>sameFieldRow(q,x)).every(x=>value(x)?.trim()))codes.add(code);
 }
 return [...codes];
}
