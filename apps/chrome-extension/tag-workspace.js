// After-thinking desktop tagging workspace: inline actions + contextual inspector.
// Keep original repository integration, AI draft, range selection and review controls.
const ATWorkspace = (() => {
  const oldRenderList=renderList,oldRenderTopics=renderTopics;
  const elBtn=(label,fn,cls="")=>{
    const b=el("button",{type:"button",class:cls,text:label});
    b.addEventListener("click",e=>{e.stopPropagation();fn();});return b;
  };
  function rerender(){renderList();}
  function focus(i){
    UI.workspaceFocus=i;
    document.querySelectorAll("#list .msg[data-mid]").forEach(n=>n.classList.toggle("focused",n.dataset.mid===msgs[i].id));
    renderWorkspaceInspector();
  }
  function scrollToMessage(i) {
    const node=document.querySelector('.msg[data-mid="'+CSS.escape(msgs[i].id)+'"]');
    if(node)node.scrollIntoView({block:"center",behavior:"smooth"});
  }
  function relation(i,topic,on){
    // A specific AI reply can relate to a different topic without affecting its previous user question.
    if(!isAnchor(i)&&!ownTag(i))S.tags[msgs[i].id]=tagOf(i)||"";
    const k=tagKey(i);
    const values=(S.also[k]||[]).filter(x=>x!==topic);
    if(on)values.push(topic);
    if(values.length)S.also[k]=values;else delete S.also[k];
    UI.workspaceFocus=i;changed(true);
  }
  function picker(i){
    const t=tagOf(i),div=el("div",{class:"picker workspace-topic-picker"});
    div.append(el("div",{class:"inspector-label",text:"主要主題（單選）"}));
    const choices=el("div",{class:"workspace-pick-choices"});
    S.topics.forEach(v=>{
      const p=pal(v.id),b=elBtn((t===v.id?"✓ ":"")+v.id+" "+v.name,()=>{
        assign([i],v.id);UI.workspaceFocus=i;UI.workspaceOpenTopic=msgs[i].id;rerender();
      });
      b.style.background=t===v.id?p.bg:"#fff";b.style.color=p.fg;b.style.borderColor=p.stripe;
      choices.append(b);
    });
    choices.append(elBtn("未分類",()=>{
      assign([i],null);UI.workspaceFocus=i;UI.workspaceOpenTopic=msgs[i].id;rerender();
    },"secondary"));
    div.append(choices,el("div",{class:"inspector-label",text:"也與這些主題有關（複選）"}));
    const related=el("div",{class:"workspace-pick-choices"});
    S.topics.filter(x=>x.id!==t).forEach(v=>{
      const yes=alsoOf(i).includes(v.id);
      related.append(elBtn((yes?"✓ ":"＋")+v.id+" "+v.name,()=>relation(i,v.id,!yes),yes?"related-picked":"secondary"));
    });
    div.append(related);
    if(!isAnchor(i)&&ownTag(i))div.append(elBtn("改回跟隨上一則提問",()=>{
      delete S.tags[msgs[i].id];delete S.also[msgs[i].id];changed(true);
    },"workspace-link"));
    div.append(elBtn("＋ 新增主題",()=>{
      const id=addTopic();if(id){assign([i],id);UI.workspaceOpenTopic=msgs[i].id;UI.workspaceFocus=i;rerender();}
    },"workspace-link"));
    div.append(el("p",{class:"hint",text:"一個主要主題，可附加多個相關主題。原文不會重複複製。"}));
    return div;
  }
  function sectionOutline(i,content){
    const sections=ATSections.parse(content),mid=msgs[i].id;
    if(!sections.length)return null;
    const root=el("div",{class:"ai-sections"}),head=content.slice(0,sections[0].start).trim();
    if(head)root.append(el("div",{class:"section-intro",text:head}));
    const expanded=(UI.workspaceExpanded[mid]||=new Set());
    sections.forEach(s=>{
      const open=expanded.has(s.start),marked=ATSections.marked(i,s);
      const section=el("div",{class:"ai-section"+(marked?" is-key":"")});
      const line=el("div",{class:"section-line"});
      line.append(elBtn((open?"▾ ":"▸ ")+s.title,()=>{
        if(open)expanded.delete(s.start);else expanded.add(s.start);
        rerender();scrollToMessage(i);
      },"section-toggle"));
      const star=elBtn(marked?"★ 已標重點":"☆ 標重點",()=>ATSections.toggle(i,s),"section-key");
      star.setAttribute("aria-pressed",String(marked));
      line.append(star);section.append(line);
      if(open)section.append(el("div",{class:"section-content",text:s.body||"（這個標題下沒有內文）"}));
      root.append(section);
    });
    root.append(elBtn("展開全文",()=>{
      UI.workspaceFull.add(mid);rerender();scrollToMessage(i);
    },"section-mode"));
    return root;
  }
  function enrich(row) {
    const i=msgs.findIndex(m=>m.id===row.dataset.mid);
    if(i<0)return;
    const m=msgs[i],mid=m.id,ai=m.speaker==="assistant",body=row.querySelector(".body");
    if(!body)return;
    row.classList.toggle("focused",UI.workspaceFocus===i);
    row.addEventListener("click",e=>{
      if(e.target.closest("button,select,input,textarea,label,a"))return;
      focus(i);
    });
    const text=body.querySelector(".text");
    const sections=ai?ATSections.parse(m.content):[];
    if(sections.length&&text){
      if(!UI.workspaceFull.has(mid)){
        text.hidden=true;
        text.before(sectionOutline(i,m.content));
      }else{
        text.hidden=false;text.textContent=m.content;
        text.after(elBtn("切回章節概覽",()=>{
          UI.workspaceFull.delete(mid);rerender();scrollToMessage(i);
        },"section-mode"));
      }
    }
    const legacyNote=body.querySelector(".note");
    if(legacyNote)legacyNote.remove();
    const actions=body.querySelector(".actions");if(!actions)return;
    const selectButtons=Array.from(actions.children).filter(x=>x.classList.contains("select-to"));
    actions.replaceChildren();
    const main=topicById(tagOf(i)),also=alsoOf(i);
    if(S.mode==="multi")actions.append(elBtn("標記主題"+(main?" · "+main.id:"")+(also.length?" ＋"+also.join("、"):""),()=>{
      UI.workspaceOpenTopic=UI.workspaceOpenTopic===mid?null:mid;focus(i);rerender();
    },"topic-action"));
    const key=!!S.keys[mid];
    actions.append(elBtn(key?"★ 整則關鍵":"☆ 整則關鍵",()=>{
      if(key){touchAi("keys",mid,"removed",true);delete S.keys[mid];}else S.keys[mid]=true;
      UI.workspaceFocus=i;changed(true);
    },key?"is-on":""));
    if(!ai){
      const hasTurn=turnConfirmed(i);
      actions.append(elBtn(hasTurn?"↗ 已標轉向":turnHint(i)?"↗ 可能轉向":"↗ 轉向",()=>{
        if(hasTurn){touchAi("turns",mid,"removed",true);delete S.turnsConfirmed[mid];S.turnsDismissed[mid]=true;}
        else{S.turnsConfirmed[mid]=true;delete S.turnsDismissed[mid];}
        UI.workspaceFocus=i;changed(true);
      },hasTurn?"is-on":""));
    }
    actions.append(elBtn(S.notes[mid]?"備註 ✓":"＋ 備註",()=>{
      UI.workspaceOpenNote=UI.workspaceOpenNote===mid?null:mid;focus(i);rerender();
    }));
    selectButtons.forEach(b=>actions.append(b));
    if(UI.workspaceOpenTopic===mid&&S.mode==="multi")actions.after(picker(i));
    if(UI.workspaceOpenNote===mid){
      const div=el("div",{class:"workspace-note"});
      const textarea=el("textarea",{rows:2,placeholder:"寫下這則訊息重要的原因或補充背景"});
      textarea.value=S.notes[mid]||"";
      textarea.addEventListener("input",()=>{if(textarea.value)S.notes[mid]=textarea.value;else delete S.notes[mid];changed(false);});
      div.append(textarea,elBtn("收起",()=>{UI.workspaceOpenNote=null;rerender();},"workspace-link"));
      actions.after(div);
    }
  }
  renderList=function(){
    oldRenderList();
    document.querySelectorAll("#list .msg[data-mid]").forEach(enrich);
    renderWorkspaceInspector();
  };
  renderTopics=function(){
    oldRenderTopics();
    const items=Array.from($("topics").querySelectorAll(".topic"));
    S.topics.forEach((t,n)=>{
      const item=items[n];if(!item)return;
      const b=elBtn("定位",()=>{
        UI.view="topic";render();
        const target=Array.from(document.querySelectorAll(".group-head")).find(x=>x.querySelector('input[data-topic-name="'+CSS.escape(t.id)+'"]'));
        if(target)target.scrollIntoView({block:"start",behavior:"smooth"});
      },"workspace-link");
      item.append(b);
    });
  };
  function inspectorField(label,child){
    return el("div",{class:"inspector-field"},el("div",{class:"inspector-label",text:label}),child);
  }
  function cb(label,checked,action){
    const input=el("input",{type:"checkbox"});
    input.checked=checked;input.addEventListener("change",()=>action(input.checked));
    return el("label",{class:"inspector-check"},input,el("span",{text:label}));
  }

  // Persistent, actionable review for section markers that could not be matched.
  // This is separate from the transient status line, which reportResolve can replace.
  function unmatchedId(entry) {
    return [entry.message_id,entry.section_fingerprint,entry.heading_start,entry.heading].join("|");
  }
  function unmatchedCandidates(entry) {
    const out=[];
    msgs.forEach((m,i)=>{
      if(m.speaker!=="assistant")return;
      ATSections.parse(m.content).forEach(section=>{
        const sameHash=section.fingerprint===entry.section_fingerprint;
        const sameTitle=section.title===entry.heading;
        if(!sameHash&&!sameTitle)return;
        out.push({i,section,sameHash,sameTitle});
      });
    });
    return out.sort((a,b)=>Number(b.sameHash)-Number(a.sameHash)
      ||Number(b.sameTitle)-Number(a.sameTitle)
      ||Math.abs(a.i-msgs.findIndex(m=>m.id===entry.message_id))
       -Math.abs(b.i-msgs.findIndex(m=>m.id===entry.message_id)));
  }
  function ensureInspectorVisible(){
    const cols=$("workspace-columns");
    if(cols?.classList.contains("no-right")){
      cols.classList.remove("no-right");
      $("toggle-right")?.setAttribute("aria-expanded","true");
    }
  }
  function renderUnmatchedBanner(){
    const banner=$("unmatched-banner");
    if(!banner)return;
    const count=(S.unmatchedSections||[]).length;
    banner.hidden=count===0;
    banner.replaceChildren();
    if(!count)return;
    const note=el("span",{text:"有 "+count+" 個 AI 小節重點無法安全對應原文，需檢查後才能確定標記是否正確。"});
    const button=elBtn("在右側檢查",()=>{
      ensureInspectorVisible();
      UI.workspaceShowUnmatched=true;
      renderWorkspaceInspector();
      const panel=$("unmatched-review");
      if(panel){panel.open=true;panel.scrollIntoView({block:"nearest",behavior:"smooth"});}
    },"secondary small");
    banner.append(note,button);
  }
  function reviewUnmatched(box){
    const entries=S.unmatchedSections||[];
    if(!entries.length)return;
    const details=el("details",{id:"unmatched-review",class:"unmatched-review"});
    details.open=UI.workspaceShowUnmatched!==false;
    details.addEventListener("toggle",()=>{UI.workspaceShowUnmatched=details.open;});
    details.append(el("summary",{text:"待核對的小節重點 · "+entries.length+" 項"}));
    const caption=el("p",{class:"inspector-details",text:"原文可能已更新。下方只提供候選小節，必須由你確認才會重新標記；若無合適候選，可保留待日後處理。"});
    details.append(caption);
    entries.forEach((entry,index)=>{
      const k=unmatchedId(entry);
      const section=el("div",{class:"unmatched-entry"});
      section.append(el("strong",{text:(entry.heading||"（無標題）")}),
        el("p",{class:"inspector-details",text:"原訊息 "+entry.message_id+" · "+(entry.reason||"尚未確認")}));
      const candidates=unmatchedCandidates(entry),choice=el("select",{class:"unmatched-candidate"});
      choice.append(el("option",{value:"",text:candidates.length?"選擇候選小節":"沒有可辨識的同名／同內容小節"}));
      candidates.forEach(c=>{
        const key=c.i+"|"+c.section.start;
        const kind=c.sameHash?"原文一致":"需人工核對";
        const snippet=c.section.body.replace(/\s+/g," ").slice(0,32);
        choice.append(el("option",{value:key,text:pad(c.i)+" · "+c.section.title+" · "+kind+(snippet?" · "+snippet:"")}));
      });
      const previous=UI.workspaceUnmatchedChoices?.[k];
      if(previous&&candidates.some(c=>c.i+"|"+c.section.start===previous))choice.value=previous;
      choice.addEventListener("change",()=>{
        (UI.workspaceUnmatchedChoices ||= {})[k]=choice.value;
      });
      section.append(choice);
      const actions=el("div",{class:"inspector-actions"});
      actions.append(elBtn("查看候選",()=>{
        const [i,start]=String(choice.value).split("|").map(Number);
        if(!choice.value||!Number.isInteger(i)||!Number.isInteger(start))return;
        const section=ATSections.parse(msgs[i]?.content).find(s=>s.start===start);
        if(!section)return;
        UI.workspaceFocus=i;
        (UI.workspaceExpanded[msgs[i].id] ||= new Set()).add(section.start);
        UI.workspaceFull.delete(msgs[i].id);
        rerender();
        scrollToMessage(i);
      },"secondary"));
      actions.append(elBtn("確認重新標記",()=>{
        const [i,start]=String(choice.value).split("|").map(Number);
        if(!choice.value||!Number.isInteger(i)||!Number.isInteger(start))return;
        const candidate=ATSections.parse(msgs[i]?.content).find(s=>s.start===start);
        if(!candidate)return;
        if(candidate.fingerprint!==entry.section_fingerprint &&
          !confirm("這個小節的內容指紋與原標記不同。要把它當作原先標記的重點嗎？"))return;
        const mid=msgs[i].id;
        if(!ATSections.marked(i,candidate)){
          (S.sectionKeys[mid] ||= []).push({heading:candidate.title,level:candidate.level,
            start:candidate.start,end:candidate.end,fingerprint:candidate.fingerprint});
        }
        S.unmatchedSections.splice(index,1);
        UI.workspaceFocus=i;
        changed(true);
        showStatus("已人工確認小節「"+candidate.title+"」的對應。");
      },"secondary"));
      if(!candidates.length)section.append(el("p",{class:"inspector-details",text:"目前沒有符合的候選；可先保留，等待原文恢復或重新擷取。"}));
      actions.append(elBtn("捨棄舊標記",()=>{
        if(!confirm("確定要捨棄「"+(entry.heading||"未命名小節")+"」的舊標記？這項操作會寫入下一次儲存的草稿。"))return;
        S.unmatchedSections.splice(index,1);
        changed(true);
        showStatus("已捨棄舊的小節標記。");
      },"workspace-link"));
      section.append(actions);
      details.append(section);
    });
    box.append(details,el("div",{class:"inspector-separator"}));
  }
  function renderWorkspaceInspector(){
    const box=$("inspector-body");if(!box||!S.mode)return;
    box.replaceChildren();
    renderUnmatchedBanner();
    reviewUnmatched(box);
    const i=UI.workspaceFocus;
    if(i===null||i===undefined||!msgs[i]){
      const n=Object.values(S.sectionKeys).reduce((a,x)=>a+x.length,0);
      box.append(el("p",{class:"inspector-details",text:"選取中央任一訊息，這裡會顯示標記和 AI 建議的詳細內容。"}));
      box.append(el("p",{class:"inspector-details",text:"目前有 "+Object.keys(S.keys).length+" 則整則關鍵、"+n+" 個 AI 小節重點。"}));
      return;
    }
    const m=msgs[i],mid=m.id,main=tagOf(i);
    box.append(el("p",{class:"inspector-details",text:pad(i)+" · "+(m.speaker==="assistant"?"AI 回覆":"我的提問")}));
    if(S.mode==="multi"){
      const select=el("select");
      select.append(el("option",{value:"",text:"未分類"}));
      S.topics.forEach(t=>select.append(el("option",{value:t.id,text:t.id+" · "+t.name})));
      select.value=main||"";
      select.addEventListener("change",()=>{assign([i],select.value||null);UI.workspaceFocus=i;});
      box.append(inspectorField("主要主題",select));
      const rel=el("div");
      S.topics.filter(t=>t.id!==main).forEach(t=>rel.append(cb(t.id+" · "+t.name,alsoOf(i).includes(t.id),on=>relation(i,t.id,on))));
      box.append(inspectorField("其他相關主題",rel));
    }
    box.append(el("div",{class:"inspector-separator"}));
    box.append(cb("整則標為關鍵",!!S.keys[mid],yes=>{
      if(yes)S.keys[mid]=true;else{touchAi("keys",mid,"removed",true);delete S.keys[mid];}changed(true);
    }));
    if(m.speaker!=="assistant")box.append(cb("標記討論轉向",turnConfirmed(i),yes=>{
      if(yes){S.turnsConfirmed[mid]=true;delete S.turnsDismissed[mid];}
      else{delete S.turnsConfirmed[mid];S.turnsDismissed[mid]=true;}changed(true);
    }));
    if(m.speaker==="assistant"){
      const sections=ATSections.parse(m.content);
      if(sections.length){
        const list=el("div");
        sections.forEach(s=>list.append(cb(s.title,ATSections.marked(i,s),()=>ATSections.toggle(i,s))));
        box.append(inspectorField("Markdown 小節重點",list));
      }
    }
    const ta=el("textarea",{rows:3,placeholder:"標記原因、補充背景…"});
    ta.value=S.notes[mid]||"";
    ta.addEventListener("input",()=>{if(ta.value)S.notes[mid]=ta.value;else delete S.notes[mid];changed(false);});
    box.append(inspectorField("備註",ta));
    const pending=[];
    if(aiPending("keys",mid))pending.push(["keys","關鍵",S.aiReasons.keys[mid]]);
    if(aiPending("turns",mid))pending.push(["turns","轉向",S.aiReasons.turns[mid]]);
    if(aiPending("tags",tagKey(i)))pending.push(["tags","主題分類",""]);
    if(pending.length){
      box.append(el("div",{class:"inspector-separator"}),el("div",{class:"inspector-label",text:"待確認的 AI 建議"}));
      pending.forEach(([kind,label,reason])=>{
        const div=el("div",{class:"inspector-suggestion"});
        div.append(el("strong",{text:label}));
        if(reason)div.append(el("p",{class:"inspector-details",text:reason}));
        const actions=el("div",{class:"inspector-actions"});
        actions.append(elBtn("確認",()=>confirmAi(kind,kind==="tags"?tagKey(i):mid),"secondary"));
        actions.append(elBtn("否決",()=>{
          if(kind==="keys"){touchAi("keys",mid,"removed",true);delete S.keys[mid];}
          if(kind==="turns"){touchAi("turns",mid,"removed",true);delete S.turnsConfirmed[mid];}
          if(kind==="tags"){touchAi("tags",tagKey(i),"removed",main);assign([i],null);}
          changed(true);
        },"secondary"));
        div.append(actions);box.append(div);
      });
    }
    box.append(el("p",{class:"inspector-details",text:"本機草稿會自動保存；按上方「儲存」才會寫入 GitHub。"}));
  }
  window.renderWorkspaceInspector=renderWorkspaceInspector;
  function mount(){
    const cols=$("workspace-columns"),left=$("toggle-left"),right=$("toggle-right");
    if(!cols||!left||!right)return;
    left.addEventListener("click",()=>{cols.classList.toggle("no-left");left.setAttribute("aria-expanded",String(!cols.classList.contains("no-left")));});
    right.addEventListener("click",()=>{cols.classList.toggle("no-right");right.setAttribute("aria-expanded",String(!cols.classList.contains("no-right")));});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount);else mount();
  return {renderWorkspaceInspector};
})();