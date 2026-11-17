import type {Output,Question} from './model';

export type FieldGuide={page?:number,source:string,destination:string,note:string,reused:string[]};
export function templateFileUrl(projectId:string,fileId:string,page?:number){
 return '/api/files?project='+encodeURIComponent(projectId)+'&id='+encodeURIComponent(fileId)+'&view=1'+(page?'#page='+page:'');
}
export function fieldGuide(o:Output,q:Question):FieldGuide{
 const base={source:q.destination||'لم يُحدد موضع المصدر؛ راجع القالب.',destination:q.destination||'لم يُحدد موضع اللصق؛ راجع القالب.',note:'',reused:[] as string[]};
 if(!o.readiness||!q.fieldKey)return base;
 const k=q.fieldKey,r=k.match(/^R(\d)\.(\d)\.(\w+)$/),a=k.match(/^A(\d)\.(\w+)\.value$/);
 if(r){const axis=Number(r[1]),code='R'+r[1]+'.'+r[2],key=r[3],page=Math.floor((axis-1)/2)+2;
  if(['impact','priority','initiative'].includes(key)){const label={impact:'الأثر',priority:'الأولوية',initiative:'المبادرة المقترحة'}[key];const loc='صفحة 6 / القسم 8.2 الفجوات ذات الأولوية / صف الفجوة المرتبطة بالمعيار '+code+' / '+label;return {page:6,source:loc,destination:loc,note:'نقل النظام إدخال هذا العمود إلى تفاصيل فجوة المعيار لربطها بوصفها. ليس جدولًا إضافيًا في القالب. يُدخل عند وجود فجوة فقط.',reused:['سجل الفجوات 8.2']};}
  const label=({evidence:'الدليل من الحالة',grade:'الدرجة',reason:'مبرر الدرجة',mandatory:'الإلزام والمرجع',reference:'الإلزام والمرجع',gap:'الفجوة'} as Record<string,string>)[key]||q.table?.column||q.title;
  const loc='صفحة '+page+' / جدول المحور '+axis+' / صف '+code+' / '+label;
  return {page,source:loc,destination:loc,note:['mandatory','reference'].includes(key)?'فُصل عمود «الإلزام والمرجع» إلى اختيار ومرجع للتأكد من اكتماله. يجمعهما دليل النقل في خلية واحدة.':'',reused:key==='grade'?['درجة المحور ومستواه','المؤشر العام والملخص','جدولا 1.1 و8.1']:key==='gap'?['سجل الفجوات 8.2']:[]};
 }
 if(a){const axis=Number(a[1]),key=a[2],page=Math.floor((axis-1)/2)+2;
  if(['quickImpact','quickOwner','quickCost'].includes(key)){const label={quickImpact:'الأثر',quickOwner:'المالك',quickCost:'الكلفة'}[key];const loc='صفحة 6 / القسم 8.4 المكاسب السريعة / صف مكسب المحور '+axis+' / '+label;return {page:6,source:loc,destination:loc,note:'هذا الحقل موجود في 8.4، ونقل النظام إدخاله إلى خلاصة المحور بجوار المكسب لتعبئته مرة واحدة. لا تلصقه ضمن خلاصة المحور.',reused:['جدول المكاسب السريعة 8.4']};}
  const priority=/^priority[123]$/.test(key),label=priority?'أولويات المعالجة (3)':key==='quick'?'مكسب سريع (≤ 90 يومًا)':'العوائق الملزمة',loc='صفحة '+page+' / خلاصة المحور '+axis+' / '+label;
  return {page,source:loc,destination:loc,note:priority?'فُصلت الأولويات الثلاث إلى ثلاثة حقول. يجمعها دليل النقل في إجابة واحدة لخانة «أولويات المعالجة (3)».':'',reused:key==='quick'?['صفحة 6 / 8.4 / عمود الإجراء','الملخص التنفيذي']:key==='blockers'?['ملخص المحاور 1.1','لوحة الجاهزية 8.1']:[]};
 }
 const kind=k.split('.')[0],page=kind==='compliance'?5:kind==='gate'?6:7;
 return {...base,page,note:q.table?.addedBy?'كل صف مضاف سجل مستقل؛ انقله إلى صف مستقل في الجدول نفسه.':''};
}

export function tableGuide(o:Output,q:Question){
 if(!o.readiness||!q.fieldKey)return '';
 if(q.fieldKey.startsWith('assumption.'))return 'أصل الحقول: صفحة 7 / ملحق 1 سجل الافتراضات. العمود الأول # ترقيم تسلسلي آلي، وليس سؤالًا. أدخل نص الافتراض ثم المبرر أو المصدر والأثر إن لم يتحقق؛ يظهر رقم الصف في دليل النقل.';
 if(/^A\d\./.test(q.fieldKey))return 'مطابقة القالب: العوائق والأولويات والمكسب من خلاصة هذا المحور. فُصلت «أولويات المعالجة (3)» إلى ثلاثة حقول. الأثر والمالك والكلفة أصلها جدول 8.4 في صفحة 6؛ جُمعت هنا مع المكسب لتُدخل مرة واحدة ثم تُسحب إلى موضعها الأصلي.';
 if(/^R\d\.\d\.(impact|priority|initiative)$/.test(q.fieldKey))return 'أصل هذه الحقول: جدول 8.2 في صفحة 6. رُبطت هنا بفجوة المعيار؛ الرمز والمحور ووصف الفجوة يسحبها النظام من التقييم. عبّئ التفاصيل عند وجود فجوة فقط.';
 return '';
}

export function pasteValue(o:Output,q:Question,values:Record<string,string>){
 const value=values[q.id]||'',k=q.fieldKey||'';
 if(!o.readiness)return value;
 if(/^R[1-6]\.[1-4]\.grade$/.test(k)&&value&&Number.isFinite(Number(value)))return Number(value).toFixed(2);
 const get=(key:string)=>values[o.questions.find(x=>x.fieldKey===key)?.id||'']||'';
 const priority=k.match(/^A(\d)\.priority[123]\.value$/);
 if(priority)return [1,2,3].map(i=>{const v=get('A'+priority[1]+'.priority'+i+'.value');return v?i+'. '+v:''}).filter(Boolean).join('\n');
 const obligation=k.match(/^(R\d\.\d)\.(mandatory|reference)$/);
 if(obligation)return [get(obligation[1]+'.mandatory'),get(obligation[1]+'.reference')].filter(Boolean).join(' — ');
 const gap=k.match(/^R(\d)\.(\d)\.gap$/);
 if(gap&&value)return 'G-'+String((Number(gap[1])-1)*4+Number(gap[2])).padStart(2,'0')+' — '+value;
 return value;
}
