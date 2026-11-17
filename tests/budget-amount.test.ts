import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fitBudgetAmounts,budgetCaps} from '../lib/budget-amount.ts';
test('budget fitting preserves relative amounts and respects every ceiling after rounding',()=>{
 assert.deepEqual(fitBudgetAmounts([4,4],6),[3,3]);
 assert.deepEqual(fitBudgetAmounts([1.75,0.5],6),[1.75,0.5]);
 assert.deepEqual(fitBudgetAmounts([7],6-0.75),[5.25]);
 assert.deepEqual(fitBudgetAmounts([1,1,1],0.02),[0.01,0.01,0]);
 assert.deepEqual(fitBudgetAmounts([1,2],0),[0,0]);
 for(const cap of budgetCaps){
  const fitted=fitBudgetAmounts([4,3,2,1,5,0,2],cap);
  assert.ok(Math.abs(fitted.reduce((a,b)=>a+b,0)-cap)<1e-8);
  assert.equal(fitted[5],0);assert.ok(fitted.every(x=>x>=0&&Number.isFinite(x)));
 }
});
