"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "tag-workspace-data.js"), "utf8");
const sample = [
  "Introduction", "## 第一節", "重要內容", "~~~md",
  "## 程式碼不是標題", "~~~", "### 子節", "更多內容", "## 第二節", "結論"
].join("\n");
function fingerprint(m) {
  const s = m.speaker + "\n" + m.content;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return s.length.toString(36) + "-" + (h >>> 0).toString(16).padStart(8, "0");
}
function fixture() {
  const S = {}, UI = {}, msgs = [{id:"m1",speaker:"assistant",content:sample}];
  const context = {
    S, UI, msgs, fingerprint,
    defaultState: () => {},
    applyOutline: () => null,
    buildOutline: () => ({outline_version:5}),
    outputText: () => "base summary",
    reviewItems: () => [],
    itemLabel: () => "",
    sourceLabel: () => "",
    rowsToShow: () => [],
    goTo: () => {},
    itemsOf: () => [],
    KIND_ORDER:{range:0,key:1,turn:2,hint:3},
    changed: () => {},
    makeResolver: () => ({resolve: id => msgs.findIndex(m => m.id === id)}),
    showStatus: () => {},
    pad: () => "001",
    posOf: it => it.i * 10 + (it.kind === "section" ? 1.5 : 0),
    isKeyish: () => false,
  };
  vm.createContext(context);
  vm.runInContext(source + "\nglobalThis.api = {parts:ATSections,boot:()=>defaultState(),save:()=>buildOutline(),load:d=>applyOutline(d)};", context);
  context.api.boot();
  return context;
}
test("native Markdown headings ignore fenced code", () => {
  const env = fixture(), headings = env.api.parts.parse(sample);
  assert.deepEqual(Array.from(headings, x => x.title), ["第一節","子節","第二節"]);
});
test("section-only marks round-trip in outline version 6", () => {
  const env = fixture(), section = env.api.parts.parse(sample)[1];
  env.api.parts.toggle(0,section);
  const saved = env.api.save();
  assert.equal(saved.outline_version,6);
  assert.equal(saved.section_key_points.length,1);
  assert.equal(saved.section_key_points[0].heading,"子節");
  env.api.boot();
  env.api.load(saved);
  assert.equal(env.api.parts.marked(0,env.api.parts.parse(sample)[1]),true);
});
test("stale section content is retained for review, not silently assigned", () => {
  const env = fixture(), section = env.api.parts.parse(sample)[1];
  env.api.parts.toggle(0,section);
  const saved = env.api.save();
  env.msgs[0].content = sample.replace("更多內容","已修改內容");
  env.api.boot();
  env.api.load(saved);
  assert.equal(env.S.unmatchedSections.length,1);
  assert.equal(Object.keys(env.S.sectionKeys).length,0);
});
test("legacy outlines lacking section arrays remain readable", () => {
  const env=fixture();
  assert.doesNotThrow(()=>env.api.load({outline_version:5}));
  assert.equal(env.S.unmatchedSections.length,0);
});
test("identical repeated headings restore to the original section offset", () => {
  const env=fixture();
  env.msgs[0].content="## Same\nBody\n## Same\nBody\n";
  const list=env.api.parts.parse(env.msgs[0].content);
  env.api.parts.toggle(0,list[1]);
  const saved=env.api.save();
  env.api.boot();env.api.load(saved);
  const restored=env.api.parts.parse(env.msgs[0].content);
  assert.equal(env.api.parts.marked(0,restored[0]),false);
  assert.equal(env.api.parts.marked(0,restored[1]),true);
});
test("ambiguous relocated duplicate sections remain unmatched", () => {
  const env=fixture();
  env.msgs[0].content="## Same\nBody\n## Same\nBody\n";
  env.api.parts.toggle(0,env.api.parts.parse(env.msgs[0].content)[1]);
  const saved=env.api.save();
  env.msgs[0].content="Introduction\n## Same\nBody\n## Same\nBody\n";
  env.api.boot();env.api.load(saved);
  assert.equal(env.S.unmatchedSections.length,1);
});
test("CommonMark-style empty ATX headings do not appear as markable sections", () => {
  const env=fixture();
  const headings=env.api.parts.parse("## ##\n## Normal\ntext\n### ###");
  assert.deepEqual(Array.from(headings,x=>x.title),["Normal"]);
});

// Use the *real* makeResolver from tag.js instead of a permissive message_id stub.
function realResolverFixture() {
  const tag=fs.readFileSync(path.join(__dirname,"..","tag.js"),"utf8");
  const start=tag.indexOf("function makeResolver(o) {");
  const end=tag.indexOf("\nfunction applyOutline(o)",start);
  assert.ok(start>=0&&end>start,"actual makeResolver must be found in tag.js");
  const actualResolver=tag.slice(start,end);
  const S={},UI={};
  const msgs=[
    {id:"msg-user",speaker:"author",content:"Discuss the two sections",pid:null},
    {id:"msg-ai",speaker:"assistant",content:"## Alpha\nunique-alpha\n## Beta\nunique-beta\n",pid:null}
  ];
  const context={
    S,UI,msgs,fingerprint,
    defaultState:()=>{},
    applyOutline:()=>null,
    buildOutline:()=>({
      outline_version:5,
      source:{message_fingerprints:msgs.map(m=>[m.id,fingerprint(m)]),message_count:msgs.length}
    }),
    outputText:()=>"",
    reviewItems:()=>[],
    itemLabel:()=>"",sourceLabel:()=>"",rowsToShow:()=>[],
    goTo:()=>{},itemsOf:()=>[],KIND_ORDER:{range:0,key:1,turn:2,hint:3},
    changed:()=>{},showStatus:()=>{},pad:i=>String(i+1).padStart(3,"0"),
    posOf:it=>it.i*10+(it.kind==="section"?1.5:0),isKeyish:()=>false
  };
  vm.createContext(context);
  vm.runInContext(actualResolver+"\n"+source+
    "\nglobalThis.api={parts:ATSections,boot:()=>defaultState(),save:()=>buildOutline(),load:d=>applyOutline(d),resolver:d=>makeResolver(d)};",context);
  context.api.boot();return context;
}
test("real resolver: unchanged unique Beta restores when Alpha changes without platform ID",()=>{
  const env=realResolverFixture(),beta=env.api.parts.parse(env.msgs[1].content)[1];
  env.api.parts.toggle(1,beta);
  const doc=env.api.save();
  env.msgs[1].content=env.msgs[1].content.replace("unique-alpha","CHANGED-alpha");
  assert.equal(env.api.resolver(doc).resolve("msg-ai"),-1);
  env.api.boot();env.api.load(doc);
  assert.equal(env.api.parts.marked(1,env.api.parts.parse(env.msgs[1].content)[1]),true);
  assert.equal(env.S.unmatchedSections.length,0);
});
test("real resolver: changed Beta stays unmatched with accurate reason",()=>{
  const env=realResolverFixture(),beta=env.api.parts.parse(env.msgs[1].content)[1];
  env.api.parts.toggle(1,beta);
  const doc=env.api.save();
  env.msgs[1].content=env.msgs[1].content.replace("unique-beta","CHANGED-beta");
  assert.equal(env.api.resolver(doc).resolve("msg-ai"),-1);
  env.api.boot();env.api.load(doc);
  assert.equal(env.S.unmatchedSections.length,1);
  assert.match(env.S.unmatchedSections[0].reason,/小節/);
});
test("previously unmatched marks are re-evaluated and recovered on reopening",()=>{
  const env=realResolverFixture(),beta=env.api.parts.parse(env.msgs[1].content)[1];
  env.api.parts.toggle(1,beta);
  const original=env.api.save();
  env.msgs[1].content=env.msgs[1].content.replace("unique-beta","CHANGED-beta");
  env.api.boot();env.api.load(original);
  const withUnmatched=env.api.save();
  assert.equal(withUnmatched.unmatched_section_key_points.length,1);
  env.msgs[1].content="## Alpha\nunique-alpha\n## Beta\nunique-beta\n";
  env.api.boot();env.api.load(withUnmatched);
  assert.equal(env.S.unmatchedSections.length,0);
  assert.equal(env.api.parts.marked(1,env.api.parts.parse(env.msgs[1].content)[1]),true);
});
test("no stable neighbor prevents fallback to unverified renumbered content",()=>{
  const env=realResolverFixture(),beta=env.api.parts.parse(env.msgs[1].content)[1];
  env.api.parts.toggle(1,beta);
  const doc=env.api.save();
  env.msgs[0].content="DIFFERENT USER QUESTION";
  env.msgs[1].content=env.msgs[1].content.replace("unique-alpha","CHANGED-alpha");
  env.api.boot();env.api.load(doc);
  assert.equal(env.S.unmatchedSections.length,1);
  assert.equal(Object.keys(env.S.sectionKeys).length,0);
});
