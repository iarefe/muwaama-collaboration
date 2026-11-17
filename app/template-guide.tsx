'use client';
import {ReadableText} from './form-guidance';
import type {Output,Question} from '../lib/model';
import {fieldGuide,tableGuide,templateFileUrl} from '../lib/template-guide';

export function TemplateSource({projectId,o}:{projectId:string,o:Output}){
 if(!o.sourceFileId)return null;
 return <details className="template-origin"><summary>القالب الأصلي وطريقة بناء النموذج</summary><strong>{o.sourceFileName||'قالب المخرج'}</strong><ReadableText text={o.readiness?'طريقة البناء: تعرّف النظام على هذه النسخة واستخدم خريطة حقول وقواعد حساب مُعدّة ومراجعة مسبقًا. لم يُجرِ تحليلًا جديدًا بالذكاء الاصطناعي لهذا الملف. المحفوظ هو البنية والقواعد، وليس إجابات المشاركين.':o.sourceReviewed?'طريقة البناء: استُخدمت خريطة خانات مُعدّة ومراجعة مسبقًا لهذه النسخة؛ الأمثلة ليست إجابات.':'خريطة خانات مستخرجة من الملف للمراجعة. الإرشادات في النموذج تساعد على التعبئة؛ راجع موضع كل خانة في المصدر.'}/><a className="text-btn" href={templateFileUrl(projectId,o.sourceFileId)} target="_blank" rel="noreferrer">فتح القالب الأصلي</a><small>يفتح PDF في تبويب مستقل، وتُحمّل الصيغ الأخرى لفتحها بتطبيقها.</small></details>;
}
export function TableLocation({o,q}:{o:Output,q:Question}){const note=tableGuide(o,q);return note?<p className="field-mapping-note">{note}</p>:null}
export function FieldLocation({projectId,o,q}:{projectId:string,o:Output,q:Question}){const g=fieldGuide(o,q);return <details className="field-location"><summary>مصدر الحقل وموضعه في القالب</summary><p><strong>المصدر:</strong> {g.source}</p>{g.note&&<p className="field-mapping-note">{g.note}</p>}<p><strong>للمكلّف — موضع اللصق:</strong> {g.destination}</p>{g.reused.length>0&&<p><strong>يُستخدم أيضًا في:</strong> {g.reused.join('؛ ')}. ينفذ النظام الربط دون إعادة إدخال.</p>}{o.sourceFileId&&<a href={templateFileUrl(projectId,o.sourceFileId,g.page)} target="_blank" rel="noreferrer">{g.page?'فتح صفحة '+g.page+' من القالب':'فتح القالب الأصلي'}</a>}</details>}
