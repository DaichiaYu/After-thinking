// After-thinking: section-level source anchored tags (outline v6).
// Loaded after tag.js and tag-review.js; previous outline versions remain readable.
const ATSections = (() => {
  const oldDefault = defaultState, oldApply = applyOutline, oldBuild = buildOutline;
  const oldOutput = outputText, oldReviewItems = reviewItems, oldLabel = itemLabel;
  const oldSource = sourceLabel, oldRows = rowsToShow, oldGoTo = goTo;
  function parse(content) {
    const marks = []; let offset=0, fence=null;
    const lines=String(content||"").split("\n");
    for (const line of lines) {
      const t=line.trim(), f=t.match(/^(\x60{3,}|~{3,})/);
      if (f) {
        if (!fence) fence={ch:f[1][0],n:f[1].length};
        else if (f[1][0]===fence.ch && f[1].length>=fence.n) fence=null;
      } else if (!fence) {
        const h=line.match(/^ {0,3}(#{1,6})[ \t]+(.+?)\s*$/);
        if (h) {
          const title=h[2].replace(/\s+#+\s*$/,"").trim();
          if (title) marks.push({title,level:h[1].length,start:offset,bodyStart:offset+line.length+1});
        }
      }
      offset+=line.length+1;
    }
    return marks.map((s,i)=>{
      const end=marks[i+1]?marks[i+1].start:content.length;
      return {...s,end,body:content.slice(s.bodyStart,end).trim(),
        fingerprint:fingerprint({speaker:"section",content:content.slice(s.start,end)})};
    });
  }
  function marks(i) { return S.sectionKeys[msgs[i].id] || []; }
  function marked(i,s) { return marks(i).some(x=>x.start===s.start&&x.fingerprint===s.fingerprint); }
  function toggle(i,s) {
    const id=msgs[i].id, a=marks(i).slice();
    const j=a.findIndex(x=>x.start===s.start&&x.fingerprint===s.fingerprint);
    if(j>=0)a.splice(j,1);
    else a.push({heading:s.title,start:s.start,end:s.end,level:s.level,fingerprint:s.fingerprint});
    if(a.length)S.sectionKeys[id]=a;else delete S.sectionKeys[id];
    UI.workspaceFocus=i; changed(true);
  }
  defaultState=function(){
    oldDefault();
    S.sectionKeys={};S.unmatchedSections=[];
    UI.workspaceFocus=null;UI.workspaceOpenTopic=null;UI.workspaceOpenNote=null;
    UI.workspaceFull=new Set();UI.workspaceExpanded={};
  };
  applyOutline=function(doc){
    const result=oldApply(doc);
    S.sectionKeys={};S.unmatchedSections=(doc&&Array.isArray(doc.unmatched_section_key_points))?doc.unmatched_section_key_points.slice():[];
    if(!doc || !Array.isArray(doc.section_key_points))return result;
    const resolver=makeResolver(doc).resolve;
    for(const entry of doc.section_key_points){
      const i=resolver(entry.message_id);
      if(i<0||msgs[i].speaker!=="assistant"){
        S.unmatchedSections.push({...entry,reason:"原訊息找不到"});continue;
      }
      const s=parse(msgs[i].content).find(x=>x.fingerprint===entry.section_fingerprint&&x.title===entry.heading&&x.level===entry.level);
      if(!s){S.unmatchedSections.push({...entry,reason:"小節原文已變動"});continue;}
      (S.sectionKeys[msgs[i].id]||=[]).push({heading:s.title,level:s.level,start:s.start,end:s.end,fingerprint:s.fingerprint});
    }
    if(S.unmatchedSections.length)showStatus("有 "+S.unmatchedSections.length+" 個小節重點無法安全對應原文，已保留待核對記錄。",true,true);
    return result;
  };
  buildOutline=function(){
    const doc=oldBuild();doc.outline_version=6;
    doc.section_key_points=msgs.flatMap(m=>(S.sectionKeys[m.id]||[]).map(s=>({
      message_id:m.id,heading:s.heading,level:s.level,
      heading_start:s.start,section_end:s.end,section_fingerprint:s.fingerprint,origin:"user"
    })));
    doc.unmatched_section_key_points=S.unmatchedSections.slice();
    doc.summary=outputText();return doc;
  };
  outputText=function(){
    const extra=msgs.flatMap((m,i)=>marks(i).map(s=>pad(i)+"「"+s.heading+"」"));
    return oldOutput()+(extra.length?"\nAI 小節重點："+extra.join("、"):"")+
      (S.unmatchedSections.length?"\n待核對的小節重點："+S.unmatchedSections.length+" 項":"");
  };
  KIND_ORDER.section=1.5;
  reviewItems=function(){
    const a=oldReviewItems();
    msgs.forEach((m,i)=>{if(marks(i).length)a.push({i,kind:"section",count:marks(i).length,pending:false,origin:"user"});});
    return a.sort((x,y)=>posOf(x)-posOf(y));
  };
  itemLabel=function(it){return it.kind==="section"?"★ AI 小節重點（"+it.count+" 節）":oldLabel(it);};
  sourceLabel=function(it){return it.kind==="section"?"你標的 Markdown 小節":oldSource(it);};
  rowsToShow=function(){
    if(S.mode==="multi"||UI.filter==="all")return oldRows();
    const filter=UI.filter;UI.filter="all";const rows=oldRows();UI.filter=filter;
    let prev=-1;const out=[];
    rows.forEach(r=>{
      if(r.kind!=="msg")return;
      const i=r.i,yes=isKeyish(i)||marks(i).length>0;
      if(!yes||(filter==="user"&&msgs[i].speaker==="assistant")||(filter==="ai"&&msgs[i].speaker!=="assistant"))return;
      if(prev>=0&&i>prev+1)out.push({kind:"skip",label:"中間 "+(i-prev-1)+" 則沒顯示"});
      out.push(r);prev=i;
    });
    return out.length?out:[{kind:"empty",text:"還沒有關鍵內容"}];
  };
  goTo=function(it){UI.workspaceFocus=it.i;oldGoTo(it);if(typeof renderWorkspaceInspector==="function")renderWorkspaceInspector();};
  return {parse,marks,marked,toggle};
})();