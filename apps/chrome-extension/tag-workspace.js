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
  function renderWorkspaceInspector(){
    const box=$("inspector-body");if(!box||!S.mode)return;
    box.replaceChildren();
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