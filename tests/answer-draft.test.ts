import {test} from 'node:test';
import assert from 'node:assert/strict';
import {answerPatch,restoreAnswerDraft} from '../lib/answer-draft.ts';
test('only changed answers are sent, including intentional clearing and multiline summaries',()=>{
 const patch=answerPatch({criterion:' محفوظ ',summary:'أولًا\nثانيًا',quick:''},{criterion:'محفوظ',summary:'',quick:'قيمة سابقة'});
 assert.deepEqual(patch,{answers:{summary:'أولًا\nثانيًا',quick:''},baseAnswers:{summary:'',quick:'قيمة سابقة'}});
});
test('reload restores unsaved text and original conflict baseline, retaining newer untouched server fields',()=>{
 const raw=JSON.stringify(answerPatch({criterion:'محفوظ',summary:'خلاصة لم تُحفظ'},{criterion:'محفوظ',summary:''}));
 assert.deepEqual(restoreAnswerDraft(raw,{criterion:'تحديث محفوظ',summary:'تعديل نافذة أخرى'}),{values:{criterion:'تحديث محفوظ',summary:'خلاصة لم تُحفظ'},base:{criterion:'تحديث محفوظ',summary:''}});
 assert.equal(restoreAnswerDraft(raw,{criterion:'تحديث محفوظ',summary:'خلاصة لم تُحفظ'}),null);
});
test('draft recovery ignores malformed backups and fields removed from the current output',()=>{
 assert.equal(restoreAnswerDraft('{broken',{q:''}),null);assert.equal(restoreAnswerDraft(JSON.stringify({answers:{removed:'قديم'},baseAnswers:{removed:''}}),{q:''}),null);
 assert.equal(restoreAnswerDraft(JSON.stringify({answers:{q:5},baseAnswers:{q:''}}),{q:''}),null);
});
