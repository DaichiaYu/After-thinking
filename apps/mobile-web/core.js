/* AT mobile: source-compatible, browser-only outline model.
 * Public library code: no user content, account identifiers or credentials.
 * Works with the desktop extension's outline.json v1-v6 format. */
(function (root) {
  "use strict";
  const clone = x => JSON.parse(JSON.stringify(x));
  const ids = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const own = (x,k) => Object.prototype.hasOwnProperty.call(x,k);
  function fingerprint(m) {
    const str = m.speaker + "\n" + m.content;
    let h = 0x811c9dc5;
    for (let i=0;i<str.length;i++) { h ^= str.charCodeAt(i); h=Math.imul(h,0x01000193); }
    return str.length.toString(36)+"-"+(h>>>0).toString(16).padStart(8,"0");
  }
  function parseJsonl(text) {
    return String(text||"").split(/\r?\n/).filter(x=>x.trim()).map((line,i)=>{
      let r;
      try { r=JSON.parse(line); } catch(e) { throw new Error("conversation.jsonl 第 "+(i+1)+" 行 JSON 無效"); }
      return {...r,_ordinal:i};
    }).sort((a,b)=>(a.order??a._ordinal)-(b.order??b._ordinal)).map((r,i)=>({
      id:String(r.message_id||"line-"+(i+1)),
      speaker:r.speaker==="author"||r.speaker==="assistant"?r.speaker:"external",
      content:typeof r.content==="string"?r.content:"",
      pid:r.platform_message_id||null,
      ts:r.timestamp||null,
      attachments:Array.isArray(r.attachments)?r.attachments.filter(x=>x&&typeof x==="object").map(x=>({kind:typeof x.kind==="string"?x.kind:"file",name:typeof x.name==="string"?x.name:null,file:typeof x.file==="string"?x.file:null,missing:typeof x.missing==="string"?x.missing:null,content_note:x.content_note==="extracted_text"?"extracted_text":null})):[]
    }));
  }
  function sourceFingerprint(msgs) {
    return fingerprint({speaker:"all",content:msgs.map(fingerprint).join("|")});
  }
  function sections(content) {
    const text=String(content||""), native=[], numbered=[], lines=text.split("\n");
    let pos=0,fence=null;
    for (let i=0;i<lines.length;i++) {
      const line=lines[i],trim=line.trim();
      const f=trim.match(/^([\x60]{3,}|~{3,})/);
      if(f) {
        if(!fence)fence={kind:f[1][0],length:f[1].length};
        else if(fence.kind===f[1][0]&&f[1].length>=fence.length)fence=null;
      } else if(!fence) {
        const h=line.match(/^ {0,3}(#{1,6})[ \t]+(.+?)\s*$/);
        if(h) {
          const title=h[2].replace(/(?:^|[ \t]+)#+[ \t]*$/,"").trim();
          if(title) native.push({title,level:h[1].length,start:pos,bodyStart:pos+line.length+1,kind:"markdown"});
        } else {
          const zh=line.match(/^ {0,3}([一二三四五六七八九十]{1,3})[、．.][ \t]*(.{2,60})\s*$/);
          const ar=line.match(/^ {0,3}(\d{1,2})[.、．)][ \t]+(.{2,60})\s*$/);
          const p=line.match(/^ {0,3}[（(]([一二三四五六七八九十\d]{1,3})[）)][ \t]*(.{2,60})\s*$/);
          const m=zh||ar||p;
          if(m && !/[。！？.!?]$/.test(m[2].trim())) {
            const family=zh?"zh":ar?"numeric":"paren";
            numbered.push({title:m[1]+(zh?"、":ar?".":"）")+" "+m[2],level:0,start:pos,
              bodyStart:pos+line.length+1,kind:"numbered",family,ordinal:m[1]});
          }
        }
      }
      pos+=line.length+1;
    }
    let pick=native;
    if (!pick.length && numbered.length>=2) {
      const group={};for(const entry of numbered)(group[entry.family] ||= []).push(entry);
      pick=Object.values(group).filter(a=>a.length>=2 && new Set(a.map(x=>x.ordinal)).size>=2 &&
        a.some((x,i)=>i<a.length-1 && text.slice(x.bodyStart,a[i+1].start).trim()))
        .sort((a,b)=>b.length-a.length)[0]||[];
    }
    return pick.map((s,i)=>{
      const end=pick[i+1]?pick[i+1].start:text.length;
      return {...s,end,body:text.slice(s.bodyStart,end).trim(),
        fp:fingerprint({speaker:"section",content:text.slice(s.start,end)})};
    });
  }
  function normalizeFolder(s) {
    const folder=String(s||"");
    if(!folder || folder.startsWith("/") || folder.includes("\\") || folder.split("/").includes("..")
      || folder.split("/").includes(".")) throw new Error("對話路徑無效");
    return folder.endsWith("/")?folder:folder+"/";
  }
  function makeModel(msgs,base,meta) {
    if(!Array.isArray(msgs)||!msgs.length) throw new Error("對話內容為空");
    const model={
      msgs,base:base&&typeof base==="object"?clone(base):null,
      folder:meta?.folder||"",revision:meta?.revision||1,
      title:meta?.title||"未命名對話",dirty:false,editVersion:0,
      topics:[],primary:{},related:{},keys:{},turns:{},notes:{},sectionMarks:{},keyRanges:[],
      unmatched:[],manualAi:new Set(),aiRejected:[],aiSeen:[],sourceMismatch:false
    };
    const doc=model.base;
    model.mode=doc?.mode==="single_topic"?"single_topic":"multi_topic";
    model.keyRanges=Array.isArray(doc?.key_ranges)?clone(doc.key_ranges):[];
    model.sourceMismatch=!!(doc && ((doc.outline_version&&doc.outline_version>6) ||
      (doc.source?.fingerprint&&doc.source.fingerprint!==sourceFingerprint(msgs)) ||
      (Number.isInteger(doc.source?.message_count)&&doc.source.message_count!==msgs.length) ||
      (doc.source?.first_message_id&&doc.source.first_message_id!==msgs[0].id) ||
      (doc.source?.last_message_id&&doc.source.last_message_id!==msgs[msgs.length-1].id)));
    model.topics=Array.isArray(doc?.topics)&&doc.topics.length
      ? clone(doc.topics).map(t=>({id:t.id,name:t.name,note:t.note||"",name_origin:t.name_origin||"user"}))
      : [{id:"A",name:"主題 A",note:"",name_origin:"user"}];
    if(doc?.mode==="single_topic" && !doc.topics?.length) {
      model.topics=[{id:"A",name:doc.single_topic?.name||"主要討論",note:doc.single_topic?.note||"",name_origin:"user"}];
    }
    const valid=new Set(model.topics.map(t=>t.id));
    for(const t of doc?.topics||[]) {
      for(const id of t.messages||[]) if(valid.has(t.id))model.primary[id]=t.id;
      for(const id of t.also_messages||[]) if(valid.has(t.id))(model.related[id] ||= []).push(t.id);
    }
    if (doc?.mode==="single_topic") { const singleId=model.topics[0]?.id||"A"; for(const msg of msgs)model.primary[msg.id]=singleId; }
    const questions=msgs.map((m,i)=>m.speaker!=="assistant"?i:-1);
    let anchor=-1;
    for(let i=0;i<msgs.length;i++){
      if(questions[i]>=0)anchor=i;
      if(msgs[i].speaker==="assistant"&&anchor>=0&&(
        model.primary[msgs[i].id]!==model.primary[msgs[anchor].id] ||
        (model.related[msgs[i].id]||[]).slice().sort().join("|")!==
        (model.related[msgs[anchor].id]||[]).slice().sort().join("|")))
        model.manualAi.add(msgs[i].id);
    }
    for(const k of doc?.key_points||[]) if(k?.message_id)model.keys[k.message_id]=clone(k);
    for(const t of doc?.turns||[])if(t?.message_id)model.turns[t.message_id]=clone(t);
    for(const n of doc?.notes||[])if(n?.message_id)model.notes[n.message_id]=n.text||"";
    model.aiRejected=clone(doc?.ai_suggestion?.rejected||[]);
    model.aiSeen=clone(doc?.ai_suggestion?.seen_messages||[]);
    model.unmatched=clone(doc?.unmatched_section_key_points||[]);
    for(const k of doc?.section_key_points||[]) {
      const m=msgs.find(x=>x.id===k.message_id);
      if(!m||m.speaker!=="assistant"){model.unmatched.push({...k,reason:"原訊息不存在"});continue;}
      const found=sections(m.content).find(s=>s.fp===k.section_fingerprint&&s.title===k.heading&&s.start===k.heading_start);
      if(!found){model.unmatched.push({...k,reason:"小節內容已變動，請在桌面版核對"});continue;}
      (model.sectionMarks[k.message_id] ||= []).push(clone(k));
    }
    return model;
  }
  function keyOf(m,id){return !!m.keys[id];}
  function turnOf(m,id){return !!m.turns[id];}
  function markEdited(m){m.dirty=true;m.editVersion=(m.editVersion||0)+1;}
  function setPrimary(m,messageId,topicId,recordAiRejection=true) {
    if(topicId && !m.topics.some(t=>t.id===topicId))throw new Error("未知的主題");
    const i=m.msgs.findIndex(x=>x.id===messageId);
    if(i<0)throw new Error("找不到訊息");
    const msg=m.msgs[i],old=m.primary[messageId]||null;
    if(topicId)m.primary[messageId]=topicId;else delete m.primary[messageId];
    m.related[messageId]=(m.related[messageId]||[]).filter(x=>x!==topicId);
    if(msg.speaker!=="assistant"){
      for(let j=i+1;j<m.msgs.length&&m.msgs[j].speaker==="assistant";j++){
        const child=m.msgs[j].id;
        if(!m.manualAi.has(child)&&(m.primary[child]||null)===old) {
          if(topicId)m.primary[child]=topicId;else delete m.primary[child];
          m.related[child]=(m.related[child]||[]).filter(x=>x!==topicId);
        }
      }
    }else m.manualAi.add(messageId);
    if (m.base) {
      const baseOrigin=(m.base.topics||[]).find(t=>(t.ai_unreviewed_messages||[]).includes(messageId));
      if(recordAiRejection && baseOrigin && old!==topicId)m.aiRejected.push({kind:"tags",ref:messageId,action:"modified",
        ai_value:old,new_value:topicId,at:new Date().toISOString()});
    }
    markEdited(m);
  }
  function setRelated(m,messageId,ids) {
    const main=m.primary[messageId]||null,valid=new Set(m.topics.map(t=>t.id));
    const old=(m.related[messageId]||[]).slice();
    const next=[...new Set(ids)].filter(x=>valid.has(x)&&x!==main);
    m.related[messageId]=next;
    const i=m.msgs.findIndex(x=>x.id===messageId);
    if(i>=0&&m.msgs[i].speaker!=="assistant"){
      for(let j=i+1;j<m.msgs.length&&m.msgs[j].speaker==="assistant";j++){
        const child=m.msgs[j].id;
        const existing=m.related[child]||[];
        const inherited=existing.length===old.length&&existing.every(x=>old.includes(x));
        if(!m.manualAi.has(child)&&inherited)m.related[child]=next.slice();
      }
    }else if(i>=0)m.manualAi.add(messageId);
    markEdited(m);
  }
  function toggleKey(m,id){
    if(m.keys[id]) {
      if(m.keys[id].origin==="ai_unreviewed")m.aiRejected.push({kind:"keys",ref:id,action:"removed",ai_value:true,at:new Date().toISOString()});
      delete m.keys[id];
    }else m.keys[id]={message_id:id,speaker:m.msgs.find(x=>x.id===id)?.speaker||"author",origin:"user"};
    markEdited(m);
  }
  function toggleTurn(m,id){
    if(m.turns[id]) {
      if(m.turns[id].origin==="ai_unreviewed")m.aiRejected.push({kind:"turns",ref:id,action:"removed",ai_value:true,at:new Date().toISOString()});
      delete m.turns[id];
    }else m.turns[id]={message_id:id,hinted_by:[],origin:"user"};
    markEdited(m);
  }
  function setNote(m,id,value) {
    if(value.trim())m.notes[id]=value;else delete m.notes[id];
    markEdited(m);
  }
  function toggleSection(m,messageId,s) {
    const list=(m.sectionMarks[messageId] ||= []), idx=list.findIndex(x=>x.section_fingerprint===s.fp&&x.heading_start===s.start);
    if(idx>=0)list.splice(idx,1);
    else {
      const msg=m.msgs.find(x=>x.id===messageId);
      list.push({message_id:messageId,message_fingerprint:fingerprint(msg),heading:s.title,level:s.level,
        heading_start:s.start,section_end:s.end,section_fingerprint:s.fp,origin:"user"});
    }
    markEdited(m);
  }
  function pending(m) {
    const out=[];
    for(const v of Object.values(m.keys))if(v.origin==="ai_unreviewed")out.push({type:"key",id:v.message_id,detail:v.ai_reason||"",value:v});
    for(const v of Object.values(m.turns))if(v.origin==="ai_unreviewed")out.push({type:"turn",id:v.message_id,detail:v.ai_reason||"",value:v});
    for(const v of m.keyRanges)if(v.origin==="ai_unreviewed")out.push({type:"range",id:v.from_message_id,detail:v.ai_reason||"",value:v});
    const aiMarked=new Set();
    for(const t of m.base?.topics||[])for(const id of t.ai_unreviewed_messages||[])if(m.primary[id]===t.id&&!aiMarked.has(id)){
      aiMarked.add(id);out.push({type:"topic",id,detail:t.name||"",value:t.id});
    }
    return out.sort((a,b)=>m.msgs.findIndex(x=>x.id===a.id)-m.msgs.findIndex(x=>x.id===b.id));
  }
  function decide(m,item,accept) {
    const now=new Date().toISOString();
    if(item.type==="key"&&m.keys[item.id]) {
      if(accept)m.keys[item.id].origin="ai_confirmed";
      else {delete m.keys[item.id];m.aiRejected.push({kind:"keys",ref:item.id,action:"removed",ai_value:true,at:now});}
    }else if(item.type==="turn"&&m.turns[item.id]){
      if(accept)m.turns[item.id].origin="ai_confirmed";
      else {delete m.turns[item.id];m.aiRejected.push({kind:"turns",ref:item.id,action:"removed",ai_value:true,at:now});}
    }else if(item.type==="topic"){
      if(accept) {
        const t=(m.base?.topics||[]).find(t=>t.id===item.value);
        if(t){t.ai_unreviewed_messages=(t.ai_unreviewed_messages||[]).filter(x=>x!==item.id);(t.ai_confirmed_messages ||= []).push(item.id);}
      }else {setPrimary(m,item.id,null,false);m.aiRejected.push({kind:"tags",ref:item.id,action:"removed",ai_value:item.value,at:now});}
    }else if(item.type==="range"){
      const r=m.keyRanges.find(x=>x.from_message_id===item.id);
      if(r){if(accept)r.origin="ai_confirmed";else {
        m.keyRanges=m.keyRanges.filter(x=>x!==r);
        m.aiRejected.push({kind:"ranges",ref:item.id,action:"removed",ai_value:r.messages||[],at:now});
      }}
    }
    markEdited(m);
  }
  function addTopic(m,name) {
    const id=ids.find(x=>!m.topics.some(t=>t.id===x));if(!id)throw new Error("主題已達到 A–Z 上限");
    m.topics.push({id,name:name.trim()||"新主題 "+id,note:"",name_origin:"user"});markEdited(m);return id;
  }

  function addKeyRange(m,fromId,toId){
    const start=m.msgs.findIndex(x=>x.id===fromId),end=m.msgs.findIndex(x=>x.id===toId);
    if(start<0||end<0)throw Error("找不到選取的訊息");
    const a=Math.min(start,end),b=Math.max(start,end);
    const overlap=m.keyRanges.some(r=>{
      const x=m.msgs.findIndex(z=>z.id===r.from_message_id),y=m.msgs.findIndex(z=>z.id===r.to_message_id);
      return x>=0&&y>=0&&a<=y&&b>=x;
    });
    if(overlap)throw Error("選取範圍與既有關鍵段落重疊，請先移除原有段落");
    m.keyRanges.push({from_message_id:m.msgs[a].id,to_message_id:m.msgs[b].id,origin:"user"});
    m.keyRanges.sort((x,y)=>m.msgs.findIndex(z=>z.id===x.from_message_id)-m.msgs.findIndex(z=>z.id===y.from_message_id));
    markEdited(m);
  }
  function removeKeyRange(m,fromId,toId){
    const old=m.keyRanges.length;
    m.keyRanges=m.keyRanges.filter(r=>!(r.from_message_id===fromId&&r.to_message_id===toId));
    if(m.keyRanges.length!==old)markEdited(m);
  }
  function setMode(m,mode) {
    if(mode!=="multi_topic"&&mode!=="single_topic")throw new Error("未知的整理方式");
    if(m.mode===mode){markEdited(m);return}
    if(mode==="single_topic"){
      if(m.mode==="multi_topic")m._multiSnapshot={topics:clone(m.topics),primary:clone(m.primary),related:clone(m.related)};
      const baseSingle=m.base?.single_topic||{},first=m.topics[0]||{id:"A",name:"",note:"",name_origin:"user"},name=(baseSingle.name||first.name||m.title||"主要討論").trim();
      m.topics=[{id:"A",name:name==="主題 A"?(m.title||"主要討論"):name,note:baseSingle.note||first.note||"",name_origin:first.name_origin||"user"}];m.primary={};m.related={};for(const msg of m.msgs)m.primary[msg.id]="A";
    }else if(m._multiSnapshot){m.topics=clone(m._multiSnapshot.topics);m.primary=clone(m._multiSnapshot.primary);m.related=clone(m._multiSnapshot.related)}
    else if(!m.topics.length)m.topics=[{id:"A",name:"主題 A",note:"",name_origin:"user"}];
    m.mode=mode;markEdited(m);
  }
  function parseSuggestionText(text) {
    const raw=String(text||""),fenced=raw.match(/```(?:json)?\s*([\s\S]*?)```/i);let body=fenced?fenced[1]:raw;
    const a=body.indexOf("{"),b=body.lastIndexOf("}");if(a<0||b<a)throw new Error("找不到 JSON 內容");body=body.slice(a,b+1);try{return JSON.parse(body)}catch(e){throw new Error("JSON 格式不正確："+e.message)}
  }
  function checkSuggestion(m,d) {
    const rep={errors:[],warnings:[],unknown:[],missing:[],stale:false,plan:null};
    if(!d||typeof d!=="object"||Array.isArray(d)){rep.errors.push("內容不是 JSON 物件");return rep}
    if(d.format&&d.format!=="after-thinking/outline-suggestion")rep.warnings.push("format 欄位不是 after-thinking/outline-suggestion");
    const mode=d.mode==="multi_topic"?"multi_topic":d.mode==="single_topic"?"single_topic":null;if(!mode){rep.errors.push("mode 要是 multi_topic 或 single_topic");return rep}
    if(d.source_fingerprint&&d.source_fingerprint!==sourceFingerprint(m.msgs))rep.stale=true;if(d.message_count!==undefined&&Number(d.message_count)!==m.msgs.length)rep.stale=true;
    const ref=x=>{if(typeof x==="number"&&x>=1&&x<=m.msgs.length)return x-1;if(typeof x!=="string")return -1;const s=x.trim(),byId=m.msgs.findIndex(z=>z.id===s);if(byId>=0)return byId;if(/^\d{1,6}$/.test(s)){const n=Number(s);return n>=1&&n<=m.msgs.length?n-1:-1}return -1};
    const readTopics=list=>{const topics=[],used=new Set(),at=new Array(m.msgs.length).fill(null);for(const raw of Array.isArray(list)?list:[]){if(!raw||typeof raw!=="object")continue;let id=typeof raw.id==="string"&&/^[A-Z]$/.test(raw.id.trim())&&!used.has(raw.id.trim())?raw.id.trim():ids.find(x=>!used.has(x));if(!id)continue;used.add(id);const spans=[],sourceSpans=Array.isArray(raw.spans)?raw.spans:(raw.from!==undefined?[{from:raw.from,to:raw.to}]:[]);for(const sp of sourceSpans){if(!sp)continue;let a=ref(sp.from),b=ref(sp.to===undefined?sp.from:sp.to);if(a<0||b<0){rep.unknown.push(String(sp.from??sp.to));continue}if(a>b)[a,b]=[b,a];spans.push([a,b])}for(const mid of Array.isArray(raw.messages)?raw.messages:[]){const i=ref(mid);if(i>=0)spans.push([i,i]);else rep.unknown.push(String(mid))}if(!spans.length){rep.warnings.push("主題「"+(raw.name||id)+"」沒有可用範圍");continue}const t={id,name:String(raw.name||"主題 "+id).trim(),note:String(raw.note||"").trim(),spans};topics.push(t);for(const [a,b] of spans)for(let i=a;i<=b;i++)at[i]=id}return{topics,at}};
    const main=readTopics(d.topics);if(mode==="multi_topic"){if(!main.topics.length)rep.errors.push("multi_topic 但沒有任何可用主題");rep.missing=m.msgs.map((x,i)=>x.speaker!=="assistant"&&!main.at[i]?i:-1).filter(i=>i>=0)}
    const previousAnchor=i=>{for(let j=i;j>=0;j--)if(m.msgs[j].speaker!=="assistant")return j;return -1},turns=[];for(const t of Array.isArray(d.turns)?d.turns:[]){let i=ref(t?.message_id);if(i<0){rep.unknown.push(String(t?.message_id||""));continue}if(m.msgs[i].speaker==="assistant")i=previousAnchor(i);if(i>=0&&!turns.some(x=>x.i===i))turns.push({i,reason:String(t?.reason||"")})}
    const keys=[];for(const k of Array.isArray(d.key_points)?d.key_points:[]){const i=ref(k?.message_id);if(i<0){rep.unknown.push(String(k?.message_id||""));continue}if(!keys.some(x=>x.i===i))keys.push({i,reason:String(k?.reason||"")})}
    const ranges=[];for(const r of Array.isArray(d.key_ranges)?d.key_ranges:[]){let a=ref(r?.from),b=ref(r?.to===undefined?r?.from:r?.to);if(a<0||b<0){rep.unknown.push(String(r?.from??r?.to??""));continue}if(a>b)[a,b]=[b,a];ranges.push({a,b,reason:String(r?.reason||"")})}
    const single=d.single_topic&&typeof d.single_topic==="object"?{name:String(d.single_topic.name||""),note:String(d.single_topic.note||"")}:null;
    const uncertain=(Array.isArray(d.uncertain)?d.uncertain:[]).map(u=>({i:ref(u?.message_id),question:String(u?.question||u?.reason||"")})).filter(u=>u.question);
    const alternatives=(Array.isArray(d.alternatives)?d.alternatives:[]).map((a,k)=>{const alt=readTopics(a?.topics);return alt.topics.length?{label:String(a?.label||"另一種分法 "+(k+1)),...alt}:null}).filter(Boolean);
    rep.unknown=[...new Set(rep.unknown.filter(Boolean))];rep.plan={mode,topics:main.topics,at:main.at,turns,keys,ranges,single,uncertain,alternatives,generated_at:d.generated_at||null,generated_by:d.generated_by||null};return rep;
  }
  function applySuggestion(m,raw,rep) {
    if(!rep?.plan||(rep.errors||[]).length)throw new Error((rep?.errors||["AI 建議無法套用"]).join("；"));const p=rep.plan,base=m.base?clone(m.base):{};m.base=base;m.mode=p.mode;m.related={};m.primary={};
    if(p.mode==="multi_topic"){m.topics=p.topics.map(t=>({id:t.id,name:t.name,note:t.note,name_origin:"ai"}));m.msgs.forEach((msg,i)=>{if(p.at[i])m.primary[msg.id]=p.at[i]});base.topics=m.topics.map(t=>({id:t.id,name:t.name,note:t.note,name_origin:"ai",messages:m.msgs.filter((x,i)=>p.at[i]===t.id).map(x=>x.id),also_messages:[],ai_unreviewed_messages:m.msgs.filter((x,i)=>p.at[i]===t.id).map(x=>x.id),ai_confirmed_messages:[]}));base.single_topic=base.single_topic||{name:"",note:""}}
    else{const single=p.single||{},name=(single.name||m.title||"主要討論").trim();m.topics=[{id:"A",name,note:single.note||"",name_origin:"ai"}];for(const msg of m.msgs)m.primary[msg.id]="A";base.topics=[];base.single_topic={name,note:single.note||""}}
    m.keys={};for(const k of p.keys){const msg=m.msgs[k.i];m.keys[msg.id]={message_id:msg.id,speaker:msg.speaker,origin:"ai_unreviewed",ai_reason:k.reason}}m.turns={};for(const t of p.turns){const msg=m.msgs[t.i];m.turns[msg.id]={message_id:msg.id,hinted_by:[],origin:"ai_unreviewed",ai_reason:t.reason}}
    m.keyRanges=p.ranges.map(r=>({from_message_id:m.msgs[r.a].id,to_message_id:m.msgs[r.b].id,origin:"ai_unreviewed",ai_reason:r.reason}));base.key_ranges=clone(m.keyRanges);base.ai_suggestion={file:"outline.ai.json",content_fingerprint:fingerprint({speaker:"ai-file",content:String(raw||"")}),generated_at:p.generated_at,generated_by:p.generated_by,source_matched:!rep.stale,applied_at:new Date().toISOString(),applied_how:"replace"};m.aiRejected=[];m.aiSeen=[];markEdited(m);
  }
  function summaryText(m,doc) {
    const all=m.msgs.map((_,i)=>i);
    const format=i=>String(i+1).padStart(Math.max(3,String(m.msgs.length).length),"0");
    const formatRanges=indices=>{
      if(!indices.length)return "";
      const out=[];let start=indices[0],last=indices[0];
      for(const i of indices.slice(1).concat([-1])) {
        if(i===last+1){last=i;continue;}
        out.push(start===last?format(start):format(start)+"–"+format(last));
        start=i;last=i;
      }
      return out.join("、");
    };
    const lines=[];
    if(doc.mode==="multi_topic"){
      for(const t of doc.topics){
        const ix=all.filter(i=>m.primary[m.msgs[i].id]===t.id);
        if(ix.length)lines.push(t.id+" "+t.name+(t.note?"（"+t.note+"）":"")+"："+formatRanges(ix));
      }
      const untagged=all.filter(i=>!m.primary[m.msgs[i].id]);
      if(untagged.length)lines.push("還沒標："+formatRanges(untagged));
      for(const t of doc.topics){
        const ix=all.filter(i=>(m.related[m.msgs[i].id]||[]).includes(t.id));
        if(ix.length)lines.push("也跟 "+t.id+" "+t.name+" 有關（主要在別的主題）："+formatRanges(ix));
      }
    }else{
      lines.push("主題："+(doc.single_topic?.name||"（未命名）")+
        (doc.single_topic?.note?"（"+doc.single_topic.note+"）":"")+"："+formatRanges(all));
    }
    for(const range of doc.key_ranges||[]){
      const a=all.find(i=>m.msgs[i].id===range.from_message_id);
      const b=all.find(i=>m.msgs[i].id===range.to_message_id);
      if(a===undefined||b===undefined||a>b)continue;
      const span=m.msgs.slice(a,b+1);
      lines.push("關鍵段落："+(a===b?format(a):format(a)+"–"+format(b))+
        "（你說的 "+span.filter(x=>x.speaker!=="assistant").length+" 則、AI 說的 "+
        span.filter(x=>x.speaker==="assistant").length+" 則）");
    }
    for(const speaker of ["author","assistant"]){
      const ix=all.filter(i=>!!m.keys[m.msgs[i].id]&&
        (m.msgs[i].speaker==="assistant") === (speaker==="assistant"));
      if(ix.length||doc.mode==="single_topic")lines.push((speaker==="assistant"?"AI 說的關鍵：":"你說的關鍵：")+
        (ix.length?ix.map(format).join("、"):"無"));
    }
    const turns=all.filter(i=>!!m.turns[m.msgs[i].id]);
    if(turns.length)lines.push("轉向（你確認的）："+turns.map(format).join("、"));
    if((doc.turn_hints||[]).length) {
      const ix=all.filter(i=>(doc.turn_hints||[]).some(x=>x.message_id===m.msgs[i].id));
      if(ix.length)lines.push("可能轉向（程式提示，你還沒確認）："+ix.map(format).join("、"));
    }
    const notes=all.filter(i=>!!m.notes[m.msgs[i].id]);
    if(notes.length)lines.push("備註：\n"+notes.map(i=>"  "+format(i)+" "+m.notes[m.msgs[i].id]).join("\n"));
    const sectionMarks=all.flatMap(i=>(m.sectionMarks[m.msgs[i].id]||[]).map(x=>format(i)+"「"+x.heading+"」"));
    if(sectionMarks.length)lines.push("AI 小節重點："+sectionMarks.join("、"));
    if(m.unmatched.length)lines.push("待核對的小節標記："+m.unmatched.length+" 項");
    const pending=Object.values(m.keys).filter(x=>x.origin==="ai_unreviewed").length+
      Object.values(m.turns).filter(x=>x.origin==="ai_unreviewed").length+
      (doc.key_ranges||[]).filter(x=>x.origin==="ai_unreviewed").length;
    if(pending)lines.push("AI 建議仍待審查："+pending+" 項（未確認）");
    return lines.join("\n");
  }
  function makeOutline(m) {
    if(m.sourceMismatch)throw new Error("原始對話與載入的標記指紋不符，請先在桌面版核對，不可直接覆蓋");
    const doc=m.base?clone(m.base):{};
    const existing=Object.fromEntries((doc.topics||[]).map(t=>[t.id,t]));
    const all=m.msgs.map(x=>x.id);
    const now=new Date().toISOString();
    doc.outline_version=6;
    doc.created_with="after-thinking-mobile-web 0.2.0";
    doc.updated_at=now;
    doc.source={...(doc.source||{}),folder:m.folder||doc.source?.folder||"",
      conversation_path:"source/conversation.jsonl",source_revision:m.revision,
      message_count:m.msgs.length,first_message_id:all[0],last_message_id:all[all.length-1],
      fingerprint:sourceFingerprint(m.msgs),
      message_fingerprints:m.msgs.map(x=>x.pid?[x.id,fingerprint(x),x.pid]:[x.id,fingerprint(x)])};
    doc.mode=m.mode;
    doc.numbering="顯示編號 = 依 order 排序後的位置（001 是第一則）；這個檔案裡一律用 message_id";
    doc.topics=m.topics.map(t=>{
      const old=existing[t.id]||{};
      const messages=all.filter(id=>m.primary[id]===t.id);
      const priorUnreviewed=new Set(old.ai_unreviewed_messages||[]);
      const priorConfirmed=new Set(old.ai_confirmed_messages||[]);
      return {...old,id:t.id,name:t.name,note:t.note,name_origin:t.name_origin,
        messages,also_messages:all.filter(id=>(m.related[id]||[]).includes(t.id)),
        ai_unreviewed_messages:messages.filter(id=>priorUnreviewed.has(id)),
        ai_confirmed_messages:messages.filter(id=>priorConfirmed.has(id)),
        unseen_ai_messages:messages.filter(id=>priorUnreviewed.has(id)&&!m.aiSeen.includes(id))};
    });
    doc.untagged=all.filter(id=>!m.primary[id]);
    doc.key_ranges=clone(m.keyRanges);
    if(doc.mode==="single_topic")doc.single_topic={name:m.topics[0]?.name||"",note:m.topics[0]?.note||""};
    else doc.single_topic=doc.single_topic||{name:"",note:""};
    doc.key_points=all.filter(id=>!!m.keys[id]).map(id=>clone(m.keys[id]));
    doc.turns=all.filter(id=>!!m.turns[id]).map(id=>clone(m.turns[id]));
    doc.notes=all.filter(id=>own(m.notes,id)).map(id=>({message_id:id,text:m.notes[id]}));
    doc.section_key_points=all.flatMap(id=>m.sectionMarks[id]||[]);
    doc.unmatched_section_key_points=clone(m.unmatched);
    doc.ai_suggestion=doc.ai_suggestion?{...doc.ai_suggestion,rejected:clone(m.aiRejected),seen_messages:clone(m.aiSeen)}
      :(m.aiRejected.length?{rejected:clone(m.aiRejected),seen_messages:clone(m.aiSeen)}:null);
    doc.summary=summaryText(m,doc);
    return doc;
  }
  root.ATCore={fingerprint,parseJsonl,sourceFingerprint,sections,normalizeFolder,makeModel,
    setPrimary,setRelated,toggleKey,toggleTurn,setNote,toggleSection,pending,decide,addTopic,setMode,
    parseSuggestionText,checkSuggestion,applySuggestion,makeOutline,keyOf,turnOf,addKeyRange,removeKeyRange};
})(typeof window!=="undefined"?window:globalThis);
