'use client';
import {budgetAmount,budgetCaps} from '../lib/budget-amount';
import type {Question} from '../lib/model';

export function StrategyBudget({questions,value}:{questions:Question[],value:(q:Question)=>string}){
 if(questions[0]?.table?.id!=='strategy-23')return null;
 const caps=budgetCaps;
 const amounts=caps.map((_,i)=>questions.filter(q=>q.table?.columnIndex===i).map(value).filter(v=>v?.trim()).map(budgetAmount));
 return <section className="note"><div><strong>الميزانية المحسوبة من المبالغ المدخلة · مليون ريال</strong>
 {[0,1].map(s=><p key={s}>السيناريو {s?'ب':'أ'} — {caps.slice(s*3,s*3+3).map((cap,i)=>{
 const a=amounts[s*3+i],total=a.reduce((sum,v)=>sum+v,0);
 return (2027+i)+' ('+(a.length&&Number.isFinite(total)?Number(total.toFixed(2)):'—')+' من '+cap+')';
 }).join('، ')}. إجمالي المدخل حتى الآن {amounts.slice(s*3,s*3+3).some(a=>a.length)?Number(amounts.slice(s*3,s*3+3).flat().filter(Number.isFinite).reduce((a,b)=>a+b,0).toFixed(2)):'—'} / {s?11.5:15}</p>)}</div></section>;
}
