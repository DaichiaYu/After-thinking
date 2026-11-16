"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.join(__dirname,"..");
const get=name=>fs.readFileSync(path.join(root,"apps","mobile-web",name),"utf8");
const js={core:get("core.js"),github:get("github.js"),app:get("app.js"),html:get("index.html")};
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
  for(const filename of ["core.js","github.js","app.js"]) assert.doesNotThrow(()=>new Function(get(filename)));
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
test("GitHub client refuses stale SHA and keeps auth only in memory",async()=>{
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
});

test("mobile setup exposes mode choice and AI drafting controls",()=>{for(const id of ["prepare-page","choose-multi","choose-single","choose-skip","ai-copy-repo","ai-reload","ai-download-request","enter-workspace","reader-review","reader-mode"]) assert.match(js.html,new RegExp('id="'+id+'"'));});
test("mode selection writes the chosen outline mode and can switch back",()=>{const C=core(),msgs=messages(C),m=C.makeModel(msgs,null,{title:"測試對話"});assert.equal(m.mode,"multi_topic");C.setMode(m,"single_topic");assert.equal(C.makeOutline(m).mode,"single_topic");assert.ok(msgs.every(x=>m.primary[x.id]==="A"));C.setMode(m,"multi_topic");assert.equal(C.makeOutline(m).mode,"multi_topic");});
test("AI suggestion parser checks source and creates reviewable marks",()=>{const C=core(),msgs=messages(C),m=C.makeModel(msgs,null,{title:"測試對話"});const raw=JSON.stringify({format:"after-thinking/outline-suggestion",format_version:1,source_fingerprint:C.sourceFingerprint(msgs),message_count:4,mode:"multi_topic",topics:[{id:"A",name:"規劃",note:"",spans:[{from:"sample-1",to:"sample-2"}]},{id:"B",name:"交叉標記",note:"",spans:[{from:"sample-3",to:"sample-4"}]}],single_topic:null,turns:[{message_id:"sample-3",reason:"改談交叉標記"}],key_points:[{message_id:"sample-2",reason:"核心說明"}],key_ranges:[],uncertain:[],alternatives:[]});const rep=C.checkSuggestion(m,C.parseSuggestionText(raw));assert.equal(rep.errors.length,0);assert.equal(rep.stale,false);C.applySuggestion(m,raw,rep);assert.equal(m.mode,"multi_topic");assert.equal(m.primary["sample-3"],"B");assert.equal(C.pending(m).filter(x=>x.type==="key").length,1);assert.equal(C.pending(m).filter(x=>x.type==="turn").length,1);});
