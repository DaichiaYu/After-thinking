// After-thinking: section-level source anchored tags (outline v6).
// Loaded after tag.js and tag-review.js; previous outline versions remain readable.
const ATSections = (() => {
  const oldDefault = defaultState, oldApply = applyOutline, oldBuild = buildOutline;
  const oldOutput = outputText, oldReviewItems = reviewItems, oldLabel = itemLabel;
  const oldSource = sourceLabel, oldRows = rowsToShow, oldGoTo = goTo;
  const oldItems = itemsOf;
  // Original Markdown headings have highest priority. Some older DOM/innerText
  // captures have no '#' markers; a conservative numbered-heading fallback
  // can still expose a section outline without changing source content.
  function parse(content) {
    const text=String(content||""),native=[],numbered=[];
    const lines=text.split("\n");
    let offset=0,fence=null;
    for(let i=0;i<lines.length;i++){
      const line=lines[i],trim=line.trim();
      const fenceMark=trim.match(/^(`{3,}|~{3,})/);
      if(fenceMark) {
        if(!fence)fence={ch:fenceMark[1][0],size:fenceMark[1].length};
        else if(fence.ch===fenceMark[1][0]&&fenceMark[1].length>=fence.size)fence=null;
      } else if(!fence){
        const h=line.match(/^ {0,3}(#{1,6})[ \t]+(.+?)\s*$/);
        if(h){
          const title=h[2].replace(/(?:^|[ \t]+)#+[ \t]*$/,"").trim();
          if(title)native.push({title,level:h[1].length,start:offset,bodyStart:offset+line.length+1,source:"markdown"});
        } else {
          // A numbered outline requires at least two distinct, short entries
          // in the same numbering family; single numbered list items do not count.
          const zh=line.match(/^ {0,3}([一二三四五六七八九十]{1,3})[、．.][ \t]*(.{2,60})\s*$/);
          const ar=line.match(/^ {0,3}(\d{1,2})[.、．)][ \t]+(.{2,60})\s*$/);
          const paren=line.match(/^ {0,3}[（(]([一二三四五六七八九十\d]{1,3})[）)][ \t]*(.{2,60})\s*$/);
          const m=zh||ar||paren;
          if(m){
            const family=zh?"zh":ar?"numeric":"paren";
            const title=(m[1]+(zh?"、":ar?".":"）")+" "+m[2]).trim();
            // Avoid treating complete question/sentence paragraphs as headings.
            if(!/[。！？.!?]$/.test(m[2].trim()))
              numbered.push({title,level:0,start:offset,bodyStart:offset+line.length+1,
                source:"numbered",family,ordinal:m[1]});
          }
        }
      }
      offset+=line.length+1;
    }
    let selected=native;
    if(!selected.length && numbered.length>=2){
      const groups={};
      numbered.forEach(m=>(groups[m.family]||=[]).push(m));
      const valid=Object.values(groups)
        .filter(a=>a.length>=2&&new Set(a.map(x=>x.ordinal)).size>=2)
        .filter(a=>a.some((x,i)=>i<a.length-1 && text.slice(x.bodyStart,a[i+1].start).trim()));
      valid.sort((a,b)=>b.length-a.length);
      selected=valid[0]||[];
    }
    return selected.map((s,i)=>{
      const end=selected[i+1]?selected[i+1].start:text.length;
      return {...s,end,body:text.slice(s.bodyStart,end).trim(),
        fingerprint:fingerprint({speaker:"section",content:text.slice(s.start,end)})};
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
  // Conservative fallback: never trust renumbered message_id alone. A unique
  // unchanged section at the same ordinal requires a stable neighbouring message
  // (or an otherwise single-message conversation) before auto-restoring.
  // Stable diagnostic codes survive changes to the UI language. Keep a
  // Traditional-Chinese legacy reason for readers of older outline files.
  const diagnostic = (key) => ({reason_code:key, reason:ATI18n.stored(()=>T(key))});
  function candidateFor(entry, doc, resolve) {
    const i=resolve(entry.message_id);
    if(i>=0 && msgs[i]?.speaker==="assistant") return {i,reason:null};
    const j=msgs.findIndex(m=>m.id===entry.message_id && m.speaker==="assistant");
    if(j<0) return {i:-1,...diagnostic("ws.no_original_message_could_be_confirmed")};
    const old=doc.source?.message_fingerprints;
    const k=Array.isArray(old)?old.findIndex(x=>Array.isArray(x)&&x[0]===entry.message_id):-1;
    const sameLength=Array.isArray(old)&&old.length===msgs.length;
    const sameIndex=k>=0 && k===j;
    const stableNeighbours=[];
    for(const n of [j-1,j+1]){
      if(n<0||n>=msgs.length||!Array.isArray(old?.[n]))continue;
      if(old[n][1]===fingerprint(msgs[n]))stableNeighbours.push(n);
    }
    const sectionMatches=msgs.flatMap((m,pos)=>m.speaker==="assistant"
      ? parse(m.content).filter(s=>s.fingerprint===entry.section_fingerprint&&s.title===entry.heading&&s.level===entry.level).map(s=>({pos,s}))
      : []);
    const sectionUnique=sectionMatches.length===1 && sectionMatches[0].pos===j;
    const stableContext=stableNeighbours.length>0 || (msgs.length===1&&old?.length===1);
    if(sameLength && sameIndex && stableContext && sectionUnique)return {i:j,reason:null};
    if(sectionMatches.some(x=>x.pos===j))return {i:-1,...diagnostic("ws.the_section_content_still_exists_but")};
    if(sameLength && sameIndex && stableContext){
      const headingStillExists=parse(msgs[j].content).some(s=>s.title===entry.heading&&s.level===entry.level);
      return {i:-1,...diagnostic(headingStillExists?"ws.the_surrounding_messages_match_but_the":"ws.the_surrounding_messages_match_but_the_2")};
    }
    return {i:-1,...diagnostic("ws.the_original_message_is_unclear_or")};
  }
  function sectionIdentity(e) {
    return String(e.message_id)+"|"+String(e.section_fingerprint)+"|"+String(e.heading_start)+"|"+String(e.heading);
  }
  applyOutline=function(doc){
    const result=oldApply(doc);
    S.sectionKeys={};S.unmatchedSections=[];
    if(!doc)return result;
    const resolver=makeResolver(doc).resolve;
    // Retry previously unresolved items on every open; do not merely carry them forward.
    const incoming=[...(Array.isArray(doc.section_key_points)?doc.section_key_points:[]),
      ...(Array.isArray(doc.unmatched_section_key_points)?doc.unmatched_section_key_points:[])];
    const seen=new Set();
    for(const entry of incoming){
      if(!entry||!entry.message_id||!entry.section_fingerprint)continue;
      const key=sectionIdentity(entry);
      if(seen.has(key))continue;seen.add(key);
      const match=candidateFor(entry,doc,resolver);
      const i=match.i;
      if(i<0){
        S.unmatchedSections.push({...entry,...diagnostic(match.reason_code||"ws.could_not_be_safely_matched_to")});
        continue;
      }
      const candidates=parse(msgs[i].content).filter(x=>x.fingerprint===entry.section_fingerprint&&x.title===entry.heading&&x.level===entry.level);
      const oldMessageFp=entry.message_fingerprint||((doc.source?.message_fingerprints||[]).find(x=>Array.isArray(x)&&x[0]===entry.message_id)||[])[1];
      const unchanged=oldMessageFp && oldMessageFp===fingerprint(msgs[i]);
      const s=candidates.length===1?candidates[0]:(unchanged?candidates.find(x=>x.start===entry.heading_start):null);
      if(!s){S.unmatchedSections.push({...entry,...diagnostic("ws.the_section_text_changed_or_there")});continue;}
      const id=msgs[i].id;
      (S.sectionKeys[id]||=[]).push({heading:s.title,level:s.level,start:s.start,end:s.end,fingerprint:s.fingerprint});
    }
    // The inspector shows a persistent warning; a transient status could be overwritten
    // by reportResolve() in startConversation().
    return result;
  };
  buildOutline=function(){
    const doc=oldBuild();doc.outline_version=6;
    doc.section_key_points=msgs.flatMap(m=>(S.sectionKeys[m.id]||[]).map(s=>({
      message_id:m.id,message_fingerprint:fingerprint(m),heading:s.heading,level:s.level,
      heading_start:s.start,section_end:s.end,section_fingerprint:s.fingerprint,origin:"user"
    })));
    doc.unmatched_section_key_points=S.unmatchedSections.slice();
    doc.summary=ATI18n.stored(outputText);return doc;
  };
  outputText=function(){
    const extra=msgs.flatMap((m,i)=>marks(i).map(s=>pad(i)+"「"+s.heading+"」"));
    // Localized for the visible preview; buildOutline stores the fixed-language version.
    return oldOutput()+(extra.length?T("ws.ai_section_highlights", extra.join(T("common.list_sep"))):"")+
      (S.unmatchedSections.length?T("ws.section_highlights_to_verify_2", S.unmatchedSections.length):"");
  };
  KIND_ORDER.section=1.5;
  reviewItems=function(){
    const a=oldReviewItems();
    msgs.forEach((m,i)=>{if(marks(i).length)a.push({i,kind:"section",count:marks(i).length,pending:false,origin:"user"});});
    return a.sort((x,y)=>posOf(x)-posOf(y));
  };
  itemsOf=function(kind){return kind==="key"?reviewItems().filter(x=>["key","range","section"].includes(x.kind)):oldItems(kind);};
  itemLabel=function(it){return it.kind==="section"?T("ws.ai_section_highlights_2", it.count):oldLabel(it);};
  sourceLabel=function(it){return it.kind==="section"?T("ws.markdown_sections_you_tagged"):oldSource(it);};
  rowsToShow=function(){
    if(S.mode==="multi"||UI.filter==="all")return oldRows();
    const filter=UI.filter;UI.filter="all";const rows=oldRows();UI.filter=filter;
    let prev=-1;const out=[];
    rows.forEach(r=>{
      if(r.kind!=="msg")return;
      const i=r.i,yes=isKeyish(i)||marks(i).length>0;
      if(!yes||(filter==="user"&&msgs[i].speaker==="assistant")||(filter==="ai"&&msgs[i].speaker!=="assistant"))return;
      if(prev>=0&&i>prev+1)out.push({kind:"skip",label:T("tag.in_between_not_shown", (i-prev-1))});
      out.push(r);prev=i;
    });
    return out.length?out:[{kind:"empty",text:T("ws.no_key_content_yet")}];
  };
  goTo=function(it){UI.workspaceFocus=it.i;oldGoTo(it);if(typeof renderWorkspaceInspector==="function")renderWorkspaceInspector();};
  return {parse,marks,marked,toggle};
})();