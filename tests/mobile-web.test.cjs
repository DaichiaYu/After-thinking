"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.join(__dirname,"..");
const get=name=>fs.readFileSync(path.join(root,"apps","mobile-web",name),"utf8");
const js={core:get("core.js"),github:get("github.js"),device:get("device.js"),app:get("app.js"),localFolder:get("local-folder.js"),html:get("index.html")};
function core(){
  const window={};
  vm.runInNewContext(js.core,{window,Date,TextEncoder,TextDecoder});
  return window.ATCore;
}
function messages(C) {
  return C.parseJsonl([
    {order:0,message_id:"sample-1",speaker:"author",content:"整理工作要怎麼安排？"},
    {order:1,message_id:"sample-2",speaker:"assistant",content:"## 範圍\n保留來源。\n## 標記\n分開記錄重點。"},
    {order:2,message_id:"sample-3",speaker:"author",content:"要能交叉標記主題。"},
    {order:3,message_id:"sample-4",speaker:"assistant",content:"可以，用關聯主題。"}
  ].map(x=>JSON.stringify(x)).join("\n"));
}
test("production interface has no built-in user repository, data or token",()=>{
  const files=Object.values(js).join("\n");
  assert.doesNotMatch(files,/github_pat_[A-Za-z0-9_]{20,}|ghp_[A-Za-z0-9]{20,}/);
  assert.doesNotMatch(files,/function example\(|demo-button|試用示範資料/);
  assert.match(js.html,/id="repo-input"/);
  assert.match(js.html,/id="token-input"/);
  assert.doesNotMatch(js.html,/value="[^"]+\/[^"]+"[^>]*id="repo-input"/);
});
test("all JavaScript parses without a bundler",()=>{
  for(const filename of ["core.js","github.js","device.js","local-folder.js","app.js"]) assert.doesNotThrow(()=>new Function(get(filename)));
});
test("mobile controls exist in HTML without duplicate IDs",()=>{
  const ids=[...js.html.matchAll(/id="([^"]+)"/g)].map(x=>x[1]);
  assert.equal(new Set(ids).size,ids.length);
  for(const [,id] of js.app.matchAll(/\$\("([^"]+)"\)/g))assert.ok(ids.includes(id),"Missing "+id);
});
test("source-compatible message hashes, outline v6, and reopened marks",()=>{
  const C=core(),msgs=messages(C),m=C.makeModel(msgs,null,{folder:"examples/sample/"});
  C.setPrimary(m,"sample-1","A");
  const topic=C.addTopic(m,"第二主題");
  C.setRelated(m,"sample-1",[topic]);
  C.toggleKey(m,"sample-2");
  C.toggleTurn(m,"sample-3");
  C.setNote(m,"sample-3","保留討論方向");
  C.toggleSection(m,"sample-2",C.sections(msgs[1].content)[1]);
  const saved=C.makeOutline(m);
  assert.equal(saved.outline_version,6);
  assert.equal(saved.source.fingerprint,C.sourceFingerprint(msgs));
  assert.match(saved.summary,/AI 小節重點/);
  assert.match(saved.summary,/也跟/);
  assert.equal(saved.section_key_points.length,1);
  assert.ok(saved.topics.find(t=>t.id===topic).also_messages.includes("sample-2"));
  const reopened=C.makeModel(msgs,saved,{folder:"examples/sample/"});
  assert.equal(reopened.sourceMismatch,false);
  assert.equal(reopened.primary["sample-2"],"A");
  assert.ok(reopened.related["sample-2"].includes(topic));
  assert.equal(reopened.sectionMarks["sample-2"].length,1);
  assert.equal(reopened.notes["sample-3"],"保留討論方向");
});
test("existing range, user-specific fields and AI provenance survive rewrite",()=>{
  const C=core(),msgs=messages(C),initial=C.makeOutline(C.makeModel(msgs,null,{}));
  initial.custom_metadata={source:"external"};
  initial.key_ranges=[{from_message_id:"sample-1",to_message_id:"sample-2",origin:"ai_confirmed"}];
  initial.key_points=[{message_id:"sample-1",speaker:"author",origin:"ai_unreviewed",ai_reason:"a suggestion"}];
  const model=C.makeModel(msgs,initial,{});
  assert.equal(C.pending(model).filter(x=>x.type==="key").length,1);
  C.decide(model,C.pending(model).find(x=>x.type==="key"),true);
  const saved=C.makeOutline(model);
  assert.equal(saved.custom_metadata.source,"external");
  assert.equal(saved.key_ranges[0].origin,"ai_confirmed");
  assert.equal(saved.key_points[0].origin,"ai_confirmed");
});
test("changed source or unsupported future outline version cannot be overwritten",()=>{
  const C=core(),msgs=messages(C),doc=C.makeOutline(C.makeModel(msgs,null,{}));
  const altered=msgs.map((x,i)=>i===1?{...x,content:x.content+"（已修改）"}:x);
  const stale=C.makeModel(altered,doc,{});
  assert.equal(stale.sourceMismatch,true);
  assert.throws(()=>C.makeOutline(stale));
  const future=C.makeModel(msgs,{...doc,outline_version:99},{});
  assert.equal(future.sourceMismatch,true);
});
test("plain-text numbered headings, Markdown fences and section offsets",()=>{
  const C=core(),text="一、主要問題\n本文\n二、改善方案\n本文";
  assert.equal(C.sections(text).length,2);
  assert.equal(C.sections("~~~md\n## Not a section\n~~~\n## Real\nText")[0].title,"Real");
  assert.equal(C.sections("## ##\n## Valid\nBody").length,1);
});
test("GitHub client refuses stale SHA and never stores the token itself",async()=>{
  const calls=[];
  const encoder=bytes=>Buffer.from(bytes).toString("base64");
  const records={
    "inbox/index.jsonl":{sha:"index-A",content:encoder(Buffer.from('{"folder":"inbox/sample/"}\n')),encoding:"base64",type:"file"},
    "inbox/sample/outline.json":{sha:"new-B",content:encoder(Buffer.from("{}")),encoding:"base64",type:"file"}
  };
  const fetch=async(url,options={})=>{
    calls.push({url,method:options.method||"GET",headers:options.headers||{}});
    const hit=String(url).match(/\/contents\/(.+)\?ref=/);
    if(!hit) return {ok:true,status:200,text:async()=>JSON.stringify({full_name:"example/repository"})};
    const name=decodeURIComponent(hit[1]),file=records[name];
    if(!file)return{ok:false,status:404,text:async()=>JSON.stringify({message:"Not Found"})};
    return{ok:true,status:200,text:async()=>JSON.stringify(file)};
  };
  const window={};
  const fake={window,fetch,TextEncoder,TextDecoder,btoa:s=>Buffer.from(s,"latin1").toString("base64"),
    atob:s=>Buffer.from(s,"base64").toString("latin1")};
  vm.runInNewContext(js.github,fake);
  const Git=window.ATGitHub;
  await Git.connect("example/repository","main","not-a-real-secret");
  await assert.rejects(Git.writeFile("inbox/sample/outline.json","{}", "old-A","test"),/遠端/);
  assert.ok(calls.every(x=>x.method==="GET"));
  assert.ok(calls.every(x=>!x.url.includes("not-a-real-secret")));
  Git.disconnect();assert.equal(Git.config(),null);
  assert.doesNotMatch(js.github,/localStorage|sessionStorage|indexedDB/);
});
function fakeStorage(limit=Infinity){
  const map=new Map();
  return {map,get length(){return map.size},key:i=>[...map.keys()][i]??null,getItem:k=>map.has(k)?map.get(k):null,
    setItem:(k,v)=>{if(!map.has(k)&&map.size>=limit)throw new Error("QuotaExceededError");map.set(k,String(v))},removeItem:k=>{map.delete(k)}};
}
function device(localStorage){
  const window={localStorage};
  vm.runInNewContext(js.device,{window});
  return window.ATDevice;
}
test("device remembers the token only when asked and can forget it",()=>{
  const store=fakeStorage(),D=device(store);
  assert.equal(D.loadConnection(),null);assert.equal(D.hasToken(),false);
  D.saveConnection("example/repository","main","not-a-real-secret",false);
  assert.deepEqual({...D.loadConnection()},{repo:"example/repository",branch:"main",token:null});
  assert.ok(![...store.map.values()].join("").includes("not-a-real-secret"));
  D.saveConnection("example/repository","main","not-a-real-secret",true);
  assert.equal(D.loadConnection().token,"not-a-real-secret");assert.equal(D.hasToken(),true);
  // Reconnecting without "remember" erases a previously stored token.
  D.saveConnection("example/repository","main","not-a-real-secret",false);
  assert.equal(D.hasToken(),false);
  D.saveConnection("example/repository","main","not-a-real-secret",true);
  D.forgetToken();
  assert.deepEqual({...D.loadConnection()},{repo:"example/repository",branch:"main",token:null});
  D.saveConnection("example/repository","main","not-a-real-secret",true);
  D.saveDraft("example/repository@main","inbox/sample/",{saved_at:"2026-01-01T00:00:00.000Z",outline:{mode:"multi_topic"}});
  store.map.set("unrelated","kept");
  D.forgetAll();
  assert.equal(D.loadConnection(),null);assert.equal(D.draftCount(),0);assert.equal(store.map.get("unrelated"),"kept");
});
test("device works without storage and survives corrupt or full storage",()=>{
  const none=device(undefined);
  assert.equal(none.available(),false);assert.equal(none.saveConnection("a/b","main","x",true),false);
  assert.equal(none.loadConnection(),null);assert.equal(none.loadDraft("s","id"),null);
  const store=fakeStorage(),D=device(store);
  store.map.set("at-mobile:connection","{not json");assert.equal(D.loadConnection(),null);
  store.map.set("at-mobile:draft:s|id",JSON.stringify({saved_at:"x"}));assert.equal(D.loadDraft("s","id"),null);
  const full=fakeStorage(2),F=device(full);
  assert.ok(F.saveDraft("s","old",{saved_at:"2026-01-01T00:00:00.000Z",outline:{}}));
  assert.ok(F.saveDraft("s","mid",{saved_at:"2026-01-02T00:00:00.000Z",outline:{}}));
  assert.ok(F.saveDraft("s","new",{saved_at:"2026-01-03T00:00:00.000Z",outline:{}}));
  assert.equal(F.loadDraft("s","old"),null);assert.ok(F.loadDraft("s","new"));
});
test("a draft restores unsaved marks on top of the remote outline",()=>{
  const C=core(),msgs=messages(C),D=device(fakeStorage());
  const m=C.makeModel(msgs,null,{folder:"inbox/sample/",title:"測試對話"});
  C.setMode(m,"multi_topic");const id=C.addTopic(m,"第二個主題");
  C.setPrimary(m,"sample-3",id);C.toggleKey(m,"sample-1");C.setNote(m,"sample-3","之後要回來看");
  D.saveDraft("example/repository@main","inbox/sample/",{saved_at:new Date().toISOString(),base_sha:null,mode_confirmed:true,outline:C.makeOutline(m)});
  const draft=D.loadDraft("example/repository@main","inbox/sample/");
  const again=C.makeModel(messages(C),draft.outline,{folder:"inbox/sample/",title:"測試對話"});
  assert.equal(again.sourceMismatch,false);
  assert.equal(again.primary["sample-3"],id);assert.ok(again.keys["sample-1"]);assert.equal(again.notes["sample-3"],"之後要回來看");
  assert.equal(D.loadDraft("example/repository@main","inbox/other/"),null);
  D.dropDraft("example/repository@main","inbox/sample/");assert.equal(D.draftCount(),0);
});
test("connect form supports password managers and the remember option",()=>{
  assert.match(js.html,/id="repo-input"[^>]*autocomplete="username"/);
  assert.match(js.html,/id="token-input"[^>]*autocomplete="current-password"/);
  assert.match(js.html,/id="remember-input" type="checkbox">/);
  assert.doesNotMatch(js.html,/id="remember-input"[^>]*checked/);
  assert.match(js.html,/src="\.\/device\.js"/);
});

test("mobile setup exposes mode choice and AI drafting controls",()=>{for(const id of ["prepare-page","choose-multi","choose-single","choose-skip","ai-copy-repo","ai-reload","ai-download-request","enter-workspace","reader-review","reader-mode"]) assert.match(js.html,new RegExp('id="'+id+'"'));});
test("mode selection writes the chosen outline mode and can switch back",()=>{const C=core(),msgs=messages(C),m=C.makeModel(msgs,null,{title:"測試對話"});assert.equal(m.mode,"multi_topic");C.setMode(m,"single_topic");assert.equal(C.makeOutline(m).mode,"single_topic");assert.ok(msgs.every(x=>m.primary[x.id]==="A"));C.setMode(m,"multi_topic");assert.equal(C.makeOutline(m).mode,"multi_topic");});
test("AI suggestion parser checks source and creates reviewable marks",()=>{const C=core(),msgs=messages(C),m=C.makeModel(msgs,null,{title:"測試對話"});const raw=JSON.stringify({format:"after-thinking/outline-suggestion",format_version:1,source_fingerprint:C.sourceFingerprint(msgs),message_count:4,mode:"multi_topic",topics:[{id:"A",name:"規劃",note:"",spans:[{from:"sample-1",to:"sample-2"}]},{id:"B",name:"交叉標記",note:"",spans:[{from:"sample-3",to:"sample-4"}]}],single_topic:null,turns:[{message_id:"sample-3",reason:"改談交叉標記"}],key_points:[{message_id:"sample-2",reason:"核心說明"}],key_ranges:[],uncertain:[],alternatives:[]});const rep=C.checkSuggestion(m,C.parseSuggestionText(raw));assert.equal(rep.errors.length,0);assert.equal(rep.stale,false);C.applySuggestion(m,raw,rep);assert.equal(m.mode,"multi_topic");assert.equal(m.primary["sample-3"],"B");assert.equal(C.pending(m).filter(x=>x.type==="key").length,1);assert.equal(C.pending(m).filter(x=>x.type==="turn").length,1);});

test("local folder binding verifies original data and refuses to overwrite concurrent changes",async()=>{
 const window={indexedDB:{},showDirectoryPicker:()=>{}};
 vm.runInNewContext(js.localFolder,{window});
 const LF=window.ATLocalFolder;
 let source='{"speaker":"author","content":"test"}\n';
 let saved=null;
 function file(name,folder){
  return {async getFile(){return {async text(){return folder?source:saved}}},async createWritable(){
   let pending=null;
   return {async write(value){pending=value},async close(){saved=pending},async abort(){}};
  }};
 }
 const sourceFolder={async getFileHandle(name){assert.equal(name,"conversation.jsonl");return file(name,true)}};
 const root={kind:"directory",name:"fixture",async getDirectoryHandle(name){assert.equal(name,"source");return sourceFolder},
  async getFileHandle(name,opts){assert.equal(name,"outline.json");if(saved===null&&!opts?.create)throw Object.assign(Error("missing"),{name:"NotFoundError"});return file(name,false)}};
 assert.equal(LF.supported(),true);
 assert.equal(await LF.read(root,"source/conversation.jsonl"),source);
 assert.equal(await LF.read(root,"outline.json",true),null);
 assert.equal(await LF.writeOutline(root,'{"outline_version":6}',source,null),'{"outline_version":6}');
 await assert.rejects(LF.writeOutline(root,'{"outline_version":6,"new":true}',source,null),/其他程式修改/);
 source+="changed";
 await assert.rejects(LF.writeOutline(root,'{"outline_version":6,"new":true}',source.slice(0,-7),saved),/其他程式修改/);
});

test("desktop workbench key ranges survive save, reload, and review decisions",()=>{
  const C=core(),msgs=messages(C),m=C.makeModel(msgs,null,{title:"fixture"});
  C.addKeyRange(m,msgs[0].id,msgs[2].id);
  assert.equal(m.keyRanges.length,1);
  assert.equal(m.dirty,true);
  assert.throws(()=>C.addKeyRange(m,msgs[1].id,msgs[3].id),/重疊/);
  const doc=C.makeOutline(m);
  assert.equal([...doc.key_ranges].map(x=>x.origin).join(","),"user");
  assert.equal(doc.summary.includes("關鍵段落"),true);
  const restored=C.makeModel(msgs,doc,{title:"fixture"});
  assert.equal(restored.keyRanges.length,1);
  C.removeKeyRange(restored,msgs[0].id,msgs[2].id);
  assert.equal(C.makeOutline(restored).key_ranges.length,0);
});
test("desktop review decisions update the same keyRanges used for saved outline",()=>{
 const C=core(),msgs=messages(C),m=C.makeModel(msgs,null,{title:"fixture"});
 m.keyRanges=[{from_message_id:msgs[0].id,to_message_id:msgs[1].id,origin:"ai_unreviewed"}];
 const p=C.pending(m).find(x=>x.type==="range");
 assert.ok(p);C.decide(m,p,true);
 assert.equal(C.makeOutline(m).key_ranges[0].origin,"ai_confirmed");
 m.keyRanges[0].origin="ai_unreviewed";
 C.decide(m,C.pending(m).find(x=>x.type==="range"),false);
 assert.equal(C.makeOutline(m).key_ranges.length,0);
});
test("web editor exposes desktop topic, search, inspector, and summary controls",()=>{
 for(const id of ["desktop-topic-tree","desktop-add-topic","desktop-find","desktop-find-results","desktop-inspector-body","desktop-rail"])assert.match(js.html,new RegExp('id="'+id+'"'));
 for(const view of ["message","review","summary"])assert.match(js.html,new RegExp('data-inspector-view="'+view+'"'));
 assert.match(js.app,/function renderWorkBench\(/);
 assert.match(js.app,/function renderWorkbenchReview\(/);
 assert.match(js.app,/function renderWorkbenchSummary\(/);
});

test("captured attachments remain associated with their original message",()=>{
 const C=core();
 const sample=JSON.stringify({order:0,message_id:"fixture-1",speaker:"author",content:"See attached.",attachments:[
  {kind:"image",name:"picture.png",file:"attachments/01.png"},
  {kind:"file",name:"missing.txt",missing:"not_available"}
 ]});
 const msgs=C.parseJsonl(sample);
 assert.equal(msgs[0].attachments.length,2);
 assert.equal(msgs[0].attachments[0].file,"attachments/01.png");
 assert.equal(msgs[0].attachments[1].missing,"not_available");
 const without=C.parseJsonl(JSON.stringify({order:0,message_id:"fixture-1",speaker:"author",content:"See attached."}));
 assert.equal(C.sourceFingerprint(msgs),C.sourceFingerprint(without));
});
test("GitHub attachment reads preserve binary bytes and reject unsafe paths",async()=>{
 const bytes=Buffer.from([0,255,12,70,200]);
 const calls=[];
 const fetch=async(url,options={})=>{
  calls.push(String(url));
  if(String(url).includes("/contents/inbox/index.jsonl"))return{ok:true,status:200,text:async()=>JSON.stringify({sha:"index",type:"file",encoding:"base64",content:Buffer.from('{"folder":"inbox/sample/"}\n').toString("base64")})};
  if(String(url).includes("/contents/inbox/sample/source/attachments/01.png"))return{ok:true,status:200,text:async()=>JSON.stringify({sha:"image",type:"file",size:bytes.length,encoding:"base64",content:bytes.toString("base64")})};
  return{ok:true,status:200,text:async()=>JSON.stringify({full_name:"sample/repo"})};
 };
 const window={};
 vm.runInNewContext(js.github,{window,fetch,TextEncoder,TextDecoder,
  btoa:s=>Buffer.from(s,"latin1").toString("base64"),
  atob:s=>Buffer.from(s,"base64").toString("latin1")});
 const G=window.ATGitHub;
 await G.connect("sample/repo","main","fictional-token");
 const got=await G.getAttachment("inbox/sample/source/attachments/01.png");
 assert.deepEqual([...got],[...bytes]);
 await assert.rejects(G.getAttachment("inbox/sample/source/../secret.txt"),/不安全/);
 assert.ok(calls.every(x=>!x.includes("fictional-token")));
});
test("web tagging exposes attachment details and a bounded preview dialog",()=>{
 assert.match(js.core,/attachments:Array\.isArray/);
 assert.match(js.app,/renderMessageAttachments/);
 assert.match(js.app,/attachmentMime/);
 assert.match(js.html,/id="attachment-dialog"/);
 assert.match(js.html,/img-src 'self' data: blob:/);
});
