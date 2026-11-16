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
    div.append(el("div",{class:"inspector-label",text:T("ws.main_topic_pick_one")}));
    const choices=el("div",{class:"workspace-pick-choices"});
    S.topics.forEach(v=>{
      const p=pal(v.id),b=elBtn((t===v.id?"✓ ":"")+v.id+" "+v.name,()=>{
        assign([i],v.id);UI.workspaceFocus=i;UI.workspaceOpenTopic=msgs[i].id;rerender();
      });
      b.style.background=t===v.id?p.bg:"#fff";b.style.color=p.fg;b.style.borderColor=p.stripe;
      choices.append(b);
    });
    choices.append(elBtn(T("ws.unassigned"),()=>{
      assign([i],null);UI.workspaceFocus=i;UI.workspaceOpenTopic=msgs[i].id;rerender();
    },"secondary"));
    div.append(choices,el("div",{class:"inspector-label",text:T("ws.also_related_to_these_topics_pick")}));
    const related=el("div",{class:"workspace-pick-choices"});
    S.topics.filter(x=>x.id!==t).forEach(v=>{
      const yes=alsoOf(i).includes(v.id);
      related.append(elBtn((yes?"✓ ":"＋")+v.id+" "+v.name,()=>relation(i,v.id,!yes),yes?"related-picked":"secondary"));
    });
    div.append(related);
    if(!isAnchor(i)&&ownTag(i))div.append(elBtn(T("ws.follow_the_previous_question_again"),()=>{
      delete S.tags[msgs[i].id];delete S.also[msgs[i].id];changed(true);
    },"workspace-link"));
    div.append(elBtn(T("tag.add_topic"),()=>{
      const id=addTopic();if(id){assign([i],id);UI.workspaceOpenTopic=msgs[i].id;UI.workspaceFocus=i;rerender();}
    },"workspace-link"));
    div.append(el("p",{class:"hint",text:T("ws.one_main_topic_plus_any_number")}));
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
      const star=elBtn(marked?T("ws.highlighted"):T("ws.highlight"),()=>ATSections.toggle(i,s),"section-key");
      star.setAttribute("aria-pressed",String(marked));
      line.append(star);section.append(line);
      if(open)section.append(el("div",{class:"section-content",text:s.body||T("ws.no_text_under_this_heading")}));
      root.append(section);
    });
    root.append(elBtn(T("ws.show_full_text"),()=>{
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
        text.after(elBtn(T("ws.back_to_section_overview"),()=>{
          UI.workspaceFull.delete(mid);rerender();scrollToMessage(i);
        },"section-mode"));
      }
    } else if(ai&&text&&m.content.length>AI_PREVIEW){
      // Legacy captures may contain plain paragraphs without identifiable
      // headings. Never strand these behind the 200-character preview.
      if(UI.workspaceFull.has(mid)){
        text.textContent=m.content;
        text.after(elBtn(T("ws.hide_full_text"),()=>{
          UI.workspaceFull.delete(mid);rerender();scrollToMessage(i);
        },"section-mode"));
      }else{
        text.textContent=m.content.slice(0,AI_PREVIEW)+"…";
        text.after(elBtn(T("tag.show_full_text_characters", m.content.length),()=>{
          UI.workspaceFull.add(mid);rerender();scrollToMessage(i);
        },"section-mode"));
      }
    }
    const legacyNote=body.querySelector(".note");
    if(legacyNote)legacyNote.remove();
    const actions=body.querySelector(".actions");if(!actions)return;
    const selectButtons=Array.from(actions.children).filter(x=>x.classList.contains("select-to"));
    actions.replaceChildren();
    const main=topicById(tagOf(i)),also=alsoOf(i);
    if(S.mode==="multi")actions.append(elBtn(T("ws.tag_topic", (main?" · "+main.id:""), (also.length?" ＋"+also.join(T("common.list_sep")):"")),()=>{
      UI.workspaceOpenTopic=UI.workspaceOpenTopic===mid?null:mid;focus(i);rerender();
    },"topic-action"));
    const key=!!S.keys[mid];
    actions.append(elBtn(key?T("ws.whole_message_is_key"):T("ws.whole_message_is_key_2"),()=>{
      if(key){touchAi("keys",mid,"removed",true);delete S.keys[mid];}else S.keys[mid]=true;
      UI.workspaceFocus=i;changed(true);
    },key?"is-on":""));
    if(!ai){
      const hasTurn=turnConfirmed(i);
      actions.append(elBtn(hasTurn?T("ws.turn_marked"):turnHint(i)?T("ws.possible_turn"):T("ws.turn"),()=>{
        if(hasTurn){touchAi("turns",mid,"removed",true);delete S.turnsConfirmed[mid];S.turnsDismissed[mid]=true;}
        else{S.turnsConfirmed[mid]=true;delete S.turnsDismissed[mid];}
        UI.workspaceFocus=i;changed(true);
      },hasTurn?"is-on":""));
    }
    actions.append(elBtn(S.notes[mid]?T("ws.note"):T("ws.note_2"),()=>{
      UI.workspaceOpenNote=UI.workspaceOpenNote===mid?null:mid;focus(i);rerender();
    }));
    selectButtons.forEach(b=>actions.append(b));
    if(UI.workspaceOpenTopic===mid&&S.mode==="multi")actions.after(picker(i));
    if(UI.workspaceOpenNote===mid){
      const div=el("div",{class:"workspace-note"});
      const textarea=el("textarea",{rows:2,placeholder:T("ws.why_this_message_matters_or_some")});
      textarea.value=S.notes[mid]||"";
      textarea.addEventListener("input",()=>{if(textarea.value)S.notes[mid]=textarea.value;else delete S.notes[mid];changed(false);});
      div.append(textarea,elBtn(T("tag.collapse"),()=>{UI.workspaceOpenNote=null;rerender();},"workspace-link"));
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
      const b=elBtn(T("ws.locate"),()=>{
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
    const note=el("span",{text:T("ws.ai_section_could_not_be_safely", count)});
    const button=elBtn(T("ws.check_on_the_right"),()=>{
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
    details.append(el("summary",{text:T("ws.section_highlights_to_verify", entries.length)}));
    const caption=el("p",{class:"inspector-details",text:T("ws.the_source_may_have_been_updated")});
    details.append(caption);
    entries.forEach((entry,index)=>{
      const k=unmatchedId(entry);
      const section=el("div",{class:"unmatched-entry"});
      section.append(el("strong",{text:(entry.heading||T("ws.no_heading"))}),
        el("p",{class:"inspector-details",text:T("ws.original_message", entry.message_id, (entry.reason||T("ws.not_confirmed")))}));
      const candidates=unmatchedCandidates(entry),choice=el("select",{class:"unmatched-candidate"});
      choice.append(el("option",{value:"",text:candidates.length?T("ws.choose_a_candidate_section"):T("ws.no_section_with_the_same_heading")}));
      candidates.forEach(c=>{
        const key=c.i+"|"+c.section.start;
        const kind=c.sameHash?T("ws.source_matches"):T("ws.needs_manual_check");
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
      actions.append(elBtn(T("ws.view_candidates"),()=>{
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
      actions.append(elBtn(T("ws.confirm_re_tagging"),()=>{
        const [i,start]=String(choice.value).split("|").map(Number);
        if(!choice.value||!Number.isInteger(i)||!Number.isInteger(start))return;
        const candidate=ATSections.parse(msgs[i]?.content).find(s=>s.start===start);
        if(!candidate)return;
        if(candidate.fingerprint!==entry.section_fingerprint &&
          !confirm(T("ws.this_section_s_content_fingerprint_differs")))return;
        const mid=msgs[i].id;
        if(!ATSections.marked(i,candidate)){
          (S.sectionKeys[mid] ||= []).push({heading:candidate.title,level:candidate.level,
            start:candidate.start,end:candidate.end,fingerprint:candidate.fingerprint});
        }
        S.unmatchedSections.splice(index,1);
        UI.workspaceFocus=i;
        changed(true);
        showStatus(T("ws.section_was_matched_by_manual_confirmation", candidate.title));
      },"secondary"));
      if(!candidates.length)section.append(el("p",{class:"inspector-details",text:T("ws.no_matching_candidate_right_now_you")}));
      actions.append(elBtn(T("ws.discard_old_tag"),()=>{
        if(!confirm(T("ws.discard_the_old_tag_on_this", (entry.heading||T("ws.untitled_section")))))return;
        S.unmatchedSections.splice(index,1);
        changed(true);
        showStatus(T("ws.old_section_tag_discarded"));
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
      box.append(el("p",{class:"inspector-details",text:T("ws.select_any_message_in_the_middle")}));
      box.append(el("p",{class:"inspector-details",text:T("ws.currently_whole_message_and_ai_section", Object.keys(S.keys).length, n)}));
      return;
    }
    const m=msgs[i],mid=m.id,main=tagOf(i);
    box.append(el("p",{class:"inspector-details",text:pad(i)+" · "+(m.speaker==="assistant"?T("ws.ai_reply"):T("ws.my_question"))}));
    if(S.mode==="multi"){
      const select=el("select");
      select.append(el("option",{value:"",text:T("ws.unassigned")}));
      S.topics.forEach(t=>select.append(el("option",{value:t.id,text:t.id+" · "+t.name})));
      select.value=main||"";
      select.addEventListener("change",()=>{assign([i],select.value||null);UI.workspaceFocus=i;});
      box.append(inspectorField(T("ws.main_topic"),select));
      const rel=el("div");
      S.topics.filter(t=>t.id!==main).forEach(t=>rel.append(cb(t.id+" · "+t.name,alsoOf(i).includes(t.id),on=>relation(i,t.id,on))));
      box.append(inspectorField(T("ws.other_related_topics"),rel));
    }
    box.append(el("div",{class:"inspector-separator"}));
    box.append(cb(T("ws.mark_whole_message_as_key"),!!S.keys[mid],yes=>{
      if(yes)S.keys[mid]=true;else{touchAi("keys",mid,"removed",true);delete S.keys[mid];}changed(true);
    }));
    if(m.speaker!=="assistant")box.append(cb(T("ws.mark_a_turn_in_the_discussion"),turnConfirmed(i),yes=>{
      if(yes){S.turnsConfirmed[mid]=true;delete S.turnsDismissed[mid];}
      else{delete S.turnsConfirmed[mid];S.turnsDismissed[mid]=true;}changed(true);
    }));
    if(m.speaker==="assistant"){
      const sections=ATSections.parse(m.content);
      if(sections.length){
        const list=el("div");
        sections.forEach(s=>list.append(cb(s.title,ATSections.marked(i,s),()=>ATSections.toggle(i,s))));
        box.append(inspectorField(T("ws.markdown_section_highlights"),list));
      }
    }
    const ta=el("textarea",{rows:3,placeholder:T("ws.reason_for_tagging_background")});
    ta.value=S.notes[mid]||"";
    ta.addEventListener("input",()=>{if(ta.value)S.notes[mid]=ta.value;else delete S.notes[mid];changed(false);});
    box.append(inspectorField(T("tag.note_2"),ta));
    const pending=[];
    if(aiPending("keys",mid))pending.push(["keys",T("tag.key_3"),S.aiReasons.keys[mid]]);
    if(aiPending("turns",mid))pending.push(["turns",T("tag.turn"),S.aiReasons.turns[mid]]);
    if(aiPending("tags",tagKey(i)))pending.push(["tags",T("ws.topics"),""]);
    if(pending.length){
      box.append(el("div",{class:"inspector-separator"}),el("div",{class:"inspector-label",text:T("ws.ai_suggestions_to_review")}));
      pending.forEach(([kind,label,reason])=>{
        const div=el("div",{class:"inspector-suggestion"});
        div.append(el("strong",{text:label}));
        if(reason)div.append(el("p",{class:"inspector-details",text:reason}));
        const actions=el("div",{class:"inspector-actions"});
        actions.append(elBtn(T("tag.confirm"),()=>confirmAi(kind,kind==="tags"?tagKey(i):mid),"secondary"));
        actions.append(elBtn(T("ws.reject"),()=>{
          if(kind==="keys"){touchAi("keys",mid,"removed",true);delete S.keys[mid];}
          if(kind==="turns"){touchAi("turns",mid,"removed",true);delete S.turnsConfirmed[mid];}
          if(kind==="tags"){touchAi("tags",tagKey(i),"removed",main);assign([i],null);}
          changed(true);
        },"secondary"));
        div.append(actions);box.append(div);
      });
    }
    box.append(el("p",{class:"inspector-details",text:T("ws.local_drafts_are_saved_automatically_press")}));
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