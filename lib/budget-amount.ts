// Synthetic example caps in millions; configure for your project.
export const budgetCaps=[6,6,6,6,6,6];
export function budgetAmount(raw:string){
 const s=raw.trim().replace(/[\u061c\u200e\u200f]/g,'').replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace('٫','.');
 const m=s.match(/^(\d+(?:\.\d+)?|\.\d+)\s*(?:مليون(?:\s+ريال(?:\s+سعودي)?)?|م\s*\.\s*ر\.?)?$/);
 return m?Number(m[1]):NaN;
}

// Apportion in hundredths of a million, preserving relative proposal weights.
export function fitBudgetAmounts(amounts:number[],available:number):number[]{
 if(amounts.some(x=>!Number.isFinite(x)||x<0)||!Number.isFinite(available)||available<0)throw new Error('Invalid budget amounts');
 const total=amounts.reduce((sum,x)=>sum+x,0);
 if(total<=available+1e-8)return amounts;
 const units=Math.max(0,Math.floor(available*100+1e-8));
 const largest=Math.max(...amounts),weights=amounts.map(x=>x/largest),weightTotal=weights.reduce((a,b)=>a+b,0);
 const shares=weights.map(x=>x/weightTotal*units),allocated=shares.map(Math.floor);
 let remainder=units-allocated.reduce((a,b)=>a+b,0);
 const order=shares.map((x,i)=>({i,fraction:x-allocated[i]})).sort((a,b)=>b.fraction-a.fraction||a.i-b.i);
 for(const {i} of order){if(remainder<=0)break;allocated[i]++;remainder--;}
 return allocated.map(x=>x/100);
}
