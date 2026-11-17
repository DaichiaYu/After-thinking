/* Production mobile editor. All conversation data is loaded only at runtime. */
(() => {
"use strict";
const C=window.ATCore,G=window.ATGitHub,D=window.ATDevice,$=id=>document.getElementById(id);
const node=(tag,cls,value)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=String(value);return e;};
const btn=(value,fn,cls)=>{const b=node("button",cls,value);b.type="button";b.addEventListener("click",fn);return b;};
const plain=x=>String(x||"").replace(/\s+/g," ").trim();
const fmt=s=>{const d=new Date(s||"");return Number.isNaN(d.getTime())?"":d.toLocaleDateString("zh-TW");};
const S={page:"connect",previousPage:"connect",repo:false,local:false,rows:[],
 labels:{format:"after-thinking/conversation-labels",format_version:1,labels:[],conversations:{}},labelsSha:null,
 model:null,row:null,outlineSha:null,sourceSha:null,folder:"",
 search:"",filter:"all",sort:"conversation",previews:{},allQuestions:{},expanded:new Set(),
 count:20,cursor:null,kind:"all",review:"all",sheetAction:null,busy:false,readerY:0,prepareExpanded:false,modeConfirmed:false,
 aiRaw:null,aiReport:null,aiFrom:null,guideText:null,
 usingSaved:false,draft:null,draftVersion:0,draftTimer:null,localHandle:null,localSource:null,localOutline:null};
function notify(message,error=false){const e=$("notice");e.textContent=message||"";e.hidden=!message;e.classList.toggle("error",error);}
function change(){
 $("bottom-nav").hidden=true;$("sync-state").textContent=S.model?.dirty?"尚未儲存":S.local?"本機":S.repo?"已連線":"未連線";$("quick-save").hidden=!S.model||!S.model.dirty||S.page==="reader";
 const pending=S.model?C.pending(S.model).length:0;$("nav-pending").hidden=!pending;$("nav-pending").textContent=pending;$("review-count").textContent=pending+" 項待確認";
 if($("reader-dirty")){$("reader-dirty").textContent=S.model?(S.model.dirty?"● 尚未儲存":"● 已儲存"):"";$("reader-dirty").classList.toggle("dirty",!!S.model?.dirty)}if($("reader-save"))$("reader-save").disabled=!S.model||!S.model.dirty||S.busy;if($("count-pending"))$("count-pending").textContent=pending||"";
 queueDraft();
}
// ── 這台裝置：記住的連線與未儲存草稿（device.js，只存在這個瀏覽器）──
function syncConnectForm(){
 const c=D.loadConnection(),has=!!c?.token,can=D.available();
 if(c?.repo&&!$("repo-input").value)$("repo-input").value=c.repo;
 if(c?.branch)$("branch-input").value=c.branch;
 $("token-input").required=!has;
 $("token-input").placeholder=has?"已記住 Token，留空就使用它":"僅限你指定的資料倉庫";
 $("remember-input").checked=has;$("remember-input").disabled=!can;
 $("remember-state").textContent=!can?"這個瀏覽器不允許儲存（例如無痕模式），無法記住。"
  :has?"這台裝置已記住 Token。取消勾選再連接，就會把它刪掉。"
  :"下次打開不用再輸入。Token 會存在這個瀏覽器裡，共用的手機或電腦請不要勾。";
}
function draftRef(){
 const m=model();if(!m)return null;
 if(S.localHandle)return["local-folder",S.localHandle.name+"|"+C.sourceFingerprint(m.msgs)];
 if(S.local)return["local",C.sourceFingerprint(m.msgs)];
 const c=G.config();return c&&S.folder?[c.repo+"@"+c.branch,S.folder]:null;
}
function writeDraft(){
 clearTimeout(S.draftTimer);S.draftTimer=null;
 const m=model(),ref=draftRef();
 // 還沒決定要不要用舊草稿時不覆蓋它
 if(!m||!ref||!m.dirty||m.sourceMismatch||S.draft||S.draftVersion===m.editVersion)return;
 try{
  const version=m.editVersion;
  if(D.saveDraft(ref[0],ref[1],{saved_at:new Date().toISOString(),base_sha:S.outlineSha||null,mode_confirmed:S.modeConfirmed,outline:C.makeOutline(m)}))S.draftVersion=version;
 }catch(e){/* 存不了草稿不影響標記 */}
}
function queueDraft(){
 const m=model();if(!m||!m.dirty||S.draft||S.draftTimer||S.draftVersion===m.editVersion)return;
 S.draftTimer=setTimeout(writeDraft,600);
}
function findDraft(){
 const ref=draftRef();S.draft=null;S.draftVersion=0;clearTimeout(S.draftTimer);S.draftTimer=null;
 if(ref)S.draft=D.loadDraft(ref[0],ref[1]);
}
function renderDraftBanner(){
 const d=S.draft;$("draft-banner").hidden=!d;if(!d)return;
 const when=new Date(d.saved_at||d.outline.updated_at||"");
 const moved=!S.local&&(d.base_sha||null)!==(S.outlineSha||null);
 $("draft-text").textContent="這台裝置有一份"+(Number.isNaN(when.getTime())?"":" "+when.toLocaleString("zh-TW")+" ")+"還沒儲存的標記草稿。"
  +(moved?"注意：在那之後，GitHub 上的標記又被更新過（可能是另一台裝置）。接著用草稿並儲存，會以草稿為準。":"");
}
function useDraft(){
 const d=S.draft,m=model();if(!d||!m)return;
 try{
  const next=C.makeModel(m.msgs,d.outline,{folder:m.folder,title:m.title,revision:m.revision});
  if(next.sourceMismatch)throw Error("草稿對應的原文和現在的不同，無法套用。可以丟掉草稿重新標記。");
  next.dirty=true;next.editVersion=1;S.model=next;S.draft=null;S.draftVersion=1;
  S.modeConfirmed=d.mode_confirmed!==false&&!!d.outline.mode;
  show(S.modeConfirmed?"reader":"prepare");notify("已接著用草稿，記得儲存。");
 }catch(err){notify(err.message,true)}
}
function dropDraft(){
 const ref=draftRef();if(ref)D.dropDraft(ref[0],ref[1]);
 S.draft=null;renderPrepare();notify("已丟掉草稿。");
}
function show(page){
 const leaving=S.page;if(leaving==="reader"&&page!=="reader")S.readerY=window.scrollY;if(page==="settings"&&leaving!=="settings")S.previousPage=leaving;S.page=page;document.body.dataset.page=page;
 $("connect-page").hidden=page!=="connect";$("workspace").hidden=page==="connect";$("bottom-nav").hidden=true;document.body.classList.toggle("in-workspace",page!=="connect");
 for(const p of ["library","prepare","reader","topics","review","settings"])$(p+"-page").hidden=p!==page;change();if(page==="library")renderLibrary();if(page==="prepare")renderPrepare();if(page==="reader"){renderReader();requestAnimationFrame(()=>window.scrollTo(0,S.readerY||0))}if(page==="topics")renderTopics();if(page==="review")renderReview();if(page==="settings")renderSettings();if(page!=="reader")window.scrollTo(0,0);
}
function parseIndex(raw){
 const rows=new Map();
 for(const line of String(raw).split(/\r?\n/).filter(Boolean)){
  let r;try{r=JSON.parse(line)}catch(e){continue}
  if(typeof r?.folder!=="string")continue;
  try{C.normalizeFolder(r.folder);rows.set(r.folder,r)}catch(e){}
 }
 return [...rows.values()];
}
async function getIndex(){
 const index=await G.getFile("inbox/index.jsonl");
 S.rows=parseIndex(index.text);
 const label=await G.getFile("inbox/labels.json",{optional:true});
 try{S.labels=label?JSON.parse(label.text):{labels:[],conversations:{}}}catch(e){S.labels={labels:[],conversations:{}}}
 S.labelsSha=label?.sha||null;S.repo=true;S.local=false;
 $("repo-info").textContent=G.config().repo+" · "+G.config().branch+" · "+S.rows.length+" 段對話";$("library-location-actions").hidden=false;
}
async function connect(e){
 if(e)e.preventDefault();if(S.model?.dirty&&!confirm("仍有未儲存修改，確定要切換？"))return;
 // 沒輸入 Token 時，使用這台裝置記住的那一個
 const saved=D.loadConnection(),typed=$("token-input").value.trim(),token=typed||saved?.token||"",remember=$("remember-input").checked&&D.available();
 S.usingSaved=!typed&&!!saved?.token;
 notify(S.usingSaved?"正在用這台裝置記住的 Token 連線…":"正在讀取 GitHub 對話索引…");
 const submit=$("connect-button");submit.disabled=true;
 try{
  const cfg=await G.connect($("repo-input").value,$("branch-input").value,token);
  D.saveConnection(cfg.repo,cfg.branch,token,remember);S.usingSaved=remember;S.localHandle=null;S.localSource=null;S.localOutline=null;
  $("token-input").value="";S.model=null;S.row=null;S.rows=[];S.draft=null;
  await getIndex();show("library");notify("");
 }catch(err){
  // 記住的 Token 失效（401）時，onUnauthorized 已把它從這台裝置刪掉
  const expired=err.status===401&&!typed&&!!saved?.token;
  $("token-input").value="";G.disconnect();S.usingSaved=false;
  notify(expired?"這台裝置記住的 Token 已失效，已經把它刪掉。請輸入新的 Token。":err.message,true);
 }
 finally{submit.disabled=false;syncConnectForm()}
}
async function openLocalFolder(restore=false){
 const LF=window.ATLocalFolder;if(!LF?.supported())return notify("這個瀏覽器不支援資料夾直接存取；請改用本機 JSONL 檔案。",true);
 if(S.model?.dirty&&!confirm("有未儲存修改，確定要切換資料夾？"))return;
 try{
  const handle=restore?await LF.restore():await LF.pick();if(!handle)return;
  const source=await LF.read(handle,"source/conversation.jsonl"),outlineRaw=await LF.read(handle,"outline.json",true);
  let doc=null;if(outlineRaw!==null){try{doc=JSON.parse(outlineRaw)}catch(err){throw Error("這個資料夾的 outline.json 無法讀取，為避免覆寫已停止載入。")}}
  const msgs=C.parseJsonl(source);if(!msgs.length)throw Error("資料夾中沒有可用的對話訊息。");
  S.local=true;S.repo=false;S.localHandle=handle;S.localSource=source;S.localOutline=outlineRaw;
  S.model=C.makeModel(msgs,doc,{folder:"",title:handle.name,revision:doc?.source?.source_revision||1});
  S.row=null;S.folder="";S.sourceSha=null;S.outlineSha=null;S.count=20;S.expanded.clear();S.cursor=null;S.modeConfirmed=!!doc?.mode;
  S.aiRaw=null;S.aiReport=null;S.aiFrom=null;S.prepareExpanded=false;findDraft();
  show(S.draft?"prepare":S.modeConfirmed?"reader":"prepare");notify("已連接本機資料夾："+handle.name+"。儲存時會直接更新 outline.json。");
 }catch(err){if(err.name!=="AbortError")notify("無法開啟資料夾："+err.message,true)}
}
async function loadLocal(e){
 const files=[...e.target.files];e.target.value="";
 const conv=files.find(f=>/\.jsonl$/i.test(f.name));
 if(!conv)return notify("請選擇 conversation.jsonl；可再加 outline.json。",true);
 try{
  const msgs=C.parseJsonl(await conv.text());
  const outlineFile=files.find(f=>/outline\.json$/i.test(f.name));
  const doc=outlineFile?JSON.parse(await outlineFile.text()):null;
  if(S.model?.dirty&&!confirm("尚未儲存的修改會被取代，確定？"))return;
  G.disconnect();S.repo=false;S.local=true;S.rows=[];
  S.localHandle=null;S.localSource=null;S.localOutline=null;
  S.model=C.makeModel(msgs,doc,{folder:"",title:conv.name,revision:doc?.source?.source_revision||1});
  S.row=null;S.folder="";S.sourceSha=null;S.outlineSha=null;S.count=20;S.expanded.clear();S.cursor=null;S.modeConfirmed=!!doc?.mode;
  S.aiRaw=null;S.aiReport=null;S.aiFrom=null;S.prepareExpanded=false;findDraft();show(S.draft?"prepare":S.modeConfirmed?"reader":"prepare");notify("本機模式：儲存時會下載 outline.json，不會寫入 GitHub。");
 }catch(err){notify("無法載入本機檔案："+err.message,true)}
}
const status=r=>S.labels?.conversations?.[r.folder]||{};
function sortedRows(){
 const dates={conversation:r=>r.started_at||r.captured_at||"",capture:r=>r.captured_at||"",tagged:r=>r.outline_updated_at||"",labels:r=>(status(r).labels||[]).join(",")};
 return S.rows.filter(r=>{
  if(S.filter==="untagged"&&r.outline_updated_at)return false;
  if(["todo","done","skip"].includes(S.filter)&&(status(r).status||"todo")!==S.filter)return false;
  const q=S.search.toLocaleLowerCase().trim();
  return !q||[r.title,r.folder,status(r).note,...(r.preview_questions||[]).map(z=>z.text)].join(" ").toLocaleLowerCase().includes(q);
 }).sort((a,b)=>String(dates[S.sort](b)).localeCompare(String(dates[S.sort](a))));
}
function question(q){
 const line=node("div","question-line");
 line.append(node("span","question-num",String((Number(q.i)||0)+1).padStart(3,"0")),node("span","question-text",q.text||"（只有附件）"));
 return line;
}
function renderLibrary(){
 const root=$("library-list");root.replaceChildren();
 if(S.local){root.append(node("p","empty-state","本機模式請從底部「閱讀」進入。"));return}
 const rows=sortedRows();
 if(!rows.length){root.append(node("p","empty-state",S.rows.length?"沒有符合的對話":"倉庫中尚無對話"));return}
 let group="";
 for(const r of rows){
  const month=(r.started_at||r.captured_at||"").slice(0,7)||"未標日期";
  if(month!==group){root.append(node("h2","library-group",month));group=month}
  const item=node("article","conversation");
  item.append(node("h3","conversation-title",r.title||r.folder));
  item.append(node("div","conversation-meta",[r.platform,fmt(r.started_at||r.captured_at),r.messages?r.messages+" 則":""].filter(Boolean).join(" · ")));
  const chips=node("div","label-row"),st=status(r);
  if(r.outline_updated_at)chips.append(node("span","mini-label done","已標記"));
  if(st.status==="done")chips.append(node("span","mini-label processed","已整理"));
  if(st.status==="skip")chips.append(node("span","mini-label skip","不用整理"));
  for(const id of st.labels||[]){const found=S.labels.labels?.find(x=>x.id===id);if(found)chips.append(node("span","mini-label",found.name))}
  item.append(chips);
  if(r.preview_questions?.length)item.append(question(r.preview_questions[0]));
  else item.append(node("p","small muted","舊紀錄暫無提問預覽"));
  const open=S.previews[r.folder]||"closed",actions=node("div","conversation-actions");
  actions.append(btn(open==="closed"?"預覽提問 ▾":"收起提問 ▴",()=>{S.previews[r.folder]=open==="closed"?"preview":"closed";renderLibrary()},"inline-action"));
  actions.append(btn("進入標記 →",()=>openConversation(r),"enter-action"));item.append(actions);
  if(open!=="closed"){
   const preview=node("div","question-preview");
   let questions=Array.isArray(S.allQuestions[r.folder])?S.allQuestions[r.folder]:r.preview_questions||[];
   if(open!=="all"&&questions.length>7)questions=[...questions.slice(0,5),...questions.slice(-2)];
   for(const q of questions)preview.append(question(q));
   const count=r.author_messages||0;
   if(open==="all")preview.append(btn("只看開頭和結尾",()=>{S.previews[r.folder]="preview";renderLibrary()},"inline-action"));
   else if(count>questions.length||!questions.length) {
    preview.append(node("p","question-more","中間還有 "+Math.max(0,count-questions.length)+" 則提問"));
    preview.append(btn("看全部提問",async()=>{
     S.previews[r.folder]="all";
     if(!Array.isArray(S.allQuestions[r.folder])) {
      try{
       const file=await G.getFile(C.normalizeFolder(r.folder)+"source/conversation.jsonl");
       S.allQuestions[r.folder]=C.parseJsonl(file.text).map((m,i)=>({m,i})).filter(x=>x.m.speaker==="author").map(x=>({i:x.i,text:x.m.content}));
      }catch(err){S.previews[r.folder]="preview";notify("讀取提問失敗："+err.message,true)}
     }
     renderLibrary();
    },"inline-action"));
   }
   item.append(preview);
  }
  root.append(item);
 }
}
async function openConversation(row){
 if(S.model?.dirty&&!confirm("上一段對話還有未儲存的修改。確定要離開？"))return;notify("讀取原文與標記中…");
 try{const folder=C.normalizeFolder(row.folder),source=await G.getFile(folder+"source/conversation.jsonl"),outline=await G.getFile(folder+"outline.json",{optional:true});let doc=null;if(outline){try{doc=JSON.parse(outline.text)}catch(err){throw Error("標記 JSON 損壞，為避免覆蓋，已停止載入")}}
  const msgs=C.parseJsonl(source.text);S.model=C.makeModel(msgs,doc,{folder,title:row.title||folder,revision:doc?.source?.source_revision||row.source_revision||1});S.row=row;S.folder=folder;S.outlineSha=outline?.sha||null;S.sourceSha=source.sha;S.count=20;S.cursor=null;S.kind="all";S.expanded.clear();S.readerY=0;S.prepareExpanded=false;S.modeConfirmed=!!doc?.mode;S.aiRaw=null;S.aiReport=null;S.aiFrom=null;
  try{const ai=await G.getFile(folder+"outline.ai.json",{optional:true});if(ai)takeAi(ai.text,"repo",true)}catch(e){}findDraft();show(S.draft?"prepare":S.modeConfirmed?"reader":"prepare");notify(S.model.sourceMismatch?"原文指紋不一致：此對話禁止直接寫回，請先核對。":"",S.model.sourceMismatch);
 }catch(err){notify("無法開啟對話："+err.message,true)}
}

function repositoryFolderUrl(folder){const cfg=G.config();if(!cfg)return "";const root="https://github.com/"+cfg.repo+"/tree/"+encodeURIComponent(cfg.branch);return root+(folder?"/"+folder.split("/").filter(Boolean).map(encodeURIComponent).join("/"):"");}
function copyLocation(kind,link=false){const cfg=G.config();if(!cfg||!S.repo)return notify("目前沒有連接 GitHub。",true);const folder=kind==="library"?"":S.folder;const loc=cfg.repo+" (branch: "+cfg.branch+")"+(folder?"\n"+folder:"");return copyText(link?repositoryFolderUrl(folder):loc,link?"已複製 GitHub 連結。":"已複製倉庫路徑。");}
function copyText(text,message){if(navigator.clipboard?.writeText)return navigator.clipboard.writeText(text).then(()=>notify(message||"已複製。"));const area=document.createElement("textarea");area.value=text;area.style.position="fixed";area.style.opacity="0";document.body.append(area);area.select();try{document.execCommand("copy");notify(message||"已複製。")}finally{area.remove()}return Promise.resolve()}
function downloadText(name,text,type="text/markdown;charset=utf-8"){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000)}
function stripRepoOnly(text,keepRepo){return keepRepo?String(text).replace(/<!-- \/?repo-only -->\n?/g,""):String(text).replace(/<!-- repo-only -->[\s\S]*?<!-- \/repo-only -->\n*/g,"")}
async function outlineGuide(){if(S.guideText)return S.guideText;const res=await fetch("./outline-ai-guide.md",{cache:"no-store"});if(!res.ok)throw Error("讀不到 AI 標記規則");S.guideText=await res.text();return S.guideText}
async function ensureAiGuide(){if(!S.repo)return false;const raw=stripRepoOnly(await outlineGuide(),true),mark="<!-- managed-by: after-thinking-capture outline_ai_guide_version=1 -->",wanted=mark+"\n"+raw,current=await G.getFile("guides/outline-ai.md",{optional:true});if(current){if(!current.text.startsWith("<!-- managed-by: after-thinking-capture outline_ai_guide_version="))return false;const m=current.text.match(/outline_ai_guide_version=(\d+)/);if(m&&Number(m[1])>=1)return true}await G.writeFile("guides/outline-ai.md",wanted,current?.sha||null,"After-thinking mobile: add guides/outline-ai.md");return true}
function repoAiPrompt(){const m=model(),cfg=G.config(),mine=m.msgs.filter(x=>x.speaker!=="assistant").length;return["請幫我先標記一段 AI 對話，結果寫成一個 JSON 檔案放進 GitHub 倉庫。","","倉庫："+cfg.repo+"（分支 "+cfg.branch+"）","資料夾："+S.folder,"原文："+S.folder+"source/conversation.jsonl（一行一則訊息，照 order 排序）","要做的事：照倉庫裡的 guides/outline-ai.md 做。這段共 "+m.msgs.length+" 則（我的 "+mine+" 則），source_fingerprint 照抄："+C.sourceFingerprint(m.msgs)].join("\n")}
async function copyRepoAiPrompt(){if(!S.repo)return notify("這個方式需要先連接 GitHub。",true);$("ai-copy-repo").disabled=true;$("ai-repo-state").textContent="正在確認 AI 標記規則…";try{const managed=await ensureAiGuide();await copyText(repoAiPrompt(),"已複製給 AI 的 GitHub 指令。");$("ai-repo-state").textContent=managed?"規則已確認，可以把指令貼給 AI。":"倉庫已有自訂 guides/outline-ai.md，沒有覆蓋它；指令仍會指向該檔案。"}catch(err){notify("準備 AI 指令失敗："+err.message,true);$("ai-repo-state").textContent=err.message}finally{$("ai-copy-repo").disabled=false}}
async function aiRequestText(){const m=model(),mine=m.msgs.filter(x=>x.speaker!=="assistant").length,lines=["這個檔案前半是說明，後半是完整的對話原文。看完後請只輸出一個 outline.ai.json：","請把 JSON 放在程式碼區塊裡，或直接給我一個名為 outline.ai.json 的檔案。","","這段對話共 "+m.msgs.length+" 則，其中我的訊息 "+mine+" 則（speaker 是 author 的是我，assistant 是 AI）。","source_fingerprint 照抄："+C.sourceFingerprint(m.msgs)+"　message_count 照抄："+m.msgs.length,"",stripRepoOnly(await outlineGuide(),false),"","## 對話原文","","標題："+(m.title||""),"每則開頭是 message_id、顯示編號和說話的人；回覆時一律用 message_id。",""];m.msgs.forEach((msg,i)=>{lines.push("### "+msg.id+"｜"+String(i+1).padStart(3,"0")+"｜"+(msg.speaker==="author"?"我（author）":msg.speaker==="assistant"?"AI（assistant）":"外部（external）"),"",msg.content||"（只有附件）","")});return lines.join("\n")}
async function downloadAiRequest(){try{downloadText("after-thinking-ai-request.md",await aiRequestText());notify("已下載給 AI 的預標記請求檔。")}catch(err){notify(err.message,true)}}
function takeAi(raw,from,quiet=false){S.aiRaw=raw;S.aiFrom=from;try{S.aiReport=C.checkSuggestion(model(),C.parseSuggestionText(raw))}catch(err){S.aiReport={errors:[err.message],warnings:[],unknown:[],missing:[],stale:false,plan:null}}if(!quiet)renderPrepare()}
async function reloadAi(){if(!S.repo)return notify("這個方式需要 GitHub。",true);$("ai-reload").disabled=true;try{const file=await G.getFile(S.folder+"outline.ai.json",{optional:true});if(!file){notify("倉庫裡還沒有 outline.ai.json。",true);return}takeAi(file.text,"repo");notify("已讀取最新的 AI 建議。")}catch(err){notify("讀不到 AI 建議："+err.message,true)}finally{$("ai-reload").disabled=false}}
function applyAi(){if(!S.aiReport?.plan)return;if(S.aiReport.stale&&!confirm("AI 建議對應的原文版本可能不同。仍要套用並逐項核對嗎？"))return;const m=model(),hasExisting=!!m.base||Object.keys(m.keys).length||Object.keys(m.turns).length||Object.keys(m.notes).length||Object.keys(m.primary).length>0;if(hasExisting&&!confirm("套用 AI 建議會取代目前的主題、關鍵與轉向；備註和 AI 小節重點會保留。確定套用？"))return;try{C.applySuggestion(m,S.aiRaw,S.aiReport);S.modeConfirmed=true;renderPrepare();change();notify("已套用 AI 建議；進入工作台後可以逐項確認或修改。")}catch(err){notify(err.message,true)}}
function renderAiSummary(){const box=$("ai-suggestion-summary"),rep=S.aiReport;$("ai-panel-state").textContent=rep?.plan?(rep.stale?"原文可能不同":"已有建議"):"";if(!rep){box.hidden=true;box.replaceChildren();return}box.hidden=false;box.replaceChildren();const errors=rep.errors||[],plan=rep.plan;if(errors.length){box.append(node("strong","error-text","AI 建議讀取失敗"),node("p","small",errors.join("；")));return}box.append(node("strong","",plan.mode==="multi_topic"?"AI 判斷：聊了好幾件事":"AI 判斷：一直在聊同一件事"),node("p","small muted",(plan.mode==="multi_topic"?"主題 "+plan.topics.length+" 個 · ":"")+"關鍵 "+plan.keys.length+" · 轉向 "+plan.turns.length+" · 關鍵段落 "+plan.ranges.length+(rep.missing.length?" · 漏分 "+rep.missing.length:"")+(rep.stale?" · 原文版本可能不同":"")));if(rep.warnings?.length)box.append(node("p","small warning-text",rep.warnings.join("；")));box.append(btn(rep.stale?"仍然套用並核對":"套用 AI 建議",applyAi,"primary full"))}
function renderPrepare(){const m=model();if(!m)return;$("prepare-title").textContent=m.title;$("prepare-meta").textContent=[S.row?.platform,fmt(S.row?.started_at||S.row?.captured_at),m.msgs.length+" 則訊息"].filter(Boolean).join(" · ");$("prepare-status").textContent=m.base?"已有標記":"未標記";const questions=m.msgs.map((x,i)=>({x,i})).filter(z=>z.x.speaker!=="assistant").map(z=>({i:z.i,text:z.x.content})),list=$("prepare-preview-list");list.replaceChildren();const shown=S.prepareExpanded?questions:(questions.length<=4?questions:[...questions.slice(0,3),questions[questions.length-1]]);shown.forEach(q=>list.append(question(q)));if(!S.prepareExpanded&&questions.length>4)list.append(node("p","question-more","⋯ 共 "+questions.length+" 則提問（顯示前 3 則與最後 1 則）"));$("prepare-preview-toggle").textContent=S.prepareExpanded?"收起":"看全部";for(const [id,mode] of [["choose-multi","multi_topic"],["choose-single","single_topic"]])$(id).classList.toggle("selected",S.modeConfirmed&&m.mode===mode);$("choose-skip").classList.toggle("selected",status(S.row||{}).status==="skip");renderDraftBanner();$("enter-workspace").disabled=!S.modeConfirmed||m.sourceMismatch||!!S.draft;$("ai-repo-way").hidden=!S.repo;renderAiSummary();change()}
function chooseMode(mode){try{C.setMode(model(),mode);S.modeConfirmed=true;renderPrepare();change()}catch(err){notify(err.message,true)}}
function skipSheet(){if(!S.repo||!S.row)return notify("本機模式不能寫入「不用整理」狀態。",true);const wrap=node("div"),reasons=[["chat","閒聊"],["duplicate","重複了"],["no_info","沒什麼資訊"],["other","其他"]];wrap.append(node("p","sheet-label","為什麼不用整理？"));const radios=[];for(const [value,labelText] of reasons){const label=node("label","sheet-radio"),input=document.createElement("input");input.type="radio";input.name="skip-reason";input.value=value;input.checked=value==="chat";radios.push(input);label.append(input,node("span","",labelText));wrap.append(label)}const note=document.createElement("textarea");note.rows=3;note.placeholder="補充說明（可以不寫）";wrap.append(node("p","sheet-label","補充"),note);sheet("這篇不用整理",wrap,async()=>{const reason=radios.find(x=>x.checked)?.value||"chat";$("sheet-apply").disabled=true;try{const latest=await G.getFile("inbox/labels.json",{optional:true}),data=latest?JSON.parse(latest.text):{format:"after-thinking/conversation-labels",format_version:1,labels:[],conversations:{}};if(!data.labels)data.labels=[];if(!data.conversations)data.conversations={};const prev=data.conversations[S.row.folder]||{},next={...prev,status:"skip",skip_reason:reason,skip_note:note.value.trim(),updated_at:new Date().toISOString()};if(!next.skip_note)delete next.skip_note;data.conversations[S.row.folder]=next;const saved=await G.writeFile("inbox/labels.json",JSON.stringify(data,null,2)+"\n",latest?.sha||null,"After-thinking mobile: mark conversation as skip");S.labels=data;S.labelsSha=saved.sha;closeSheet();show("library");notify("已標成不用整理。")}catch(err){notify("儲存不用整理狀態失敗："+err.message,true);$("sheet-apply").disabled=false}},"標成不用整理")}

function model(){return S.model}
function currentTopic(id){return model().topics.find(t=>t.id===id)?.name||id}
function renderReader(keep=false){
 const m=model();if(!m)return;
 const y=keep?window.scrollY:0;
 $("reader-title").textContent=m.title;$("reader-location-actions").hidden=!S.repo||!S.folder;
 $("reader-info").textContent=m.msgs.length+" 則訊息 · "+(m.mode==="single_topic"?"單一主題":m.topics.length+" 個主題");
 $("reader-mode").textContent=m.mode==="single_topic"?"一直聊同一件事":"聊了好幾件事";
 $("source-warning").hidden=!m.sourceMismatch&&!m.unmatched.length;
 $("source-warning").textContent=m.sourceMismatch?"原文和既有標記的指紋不同；請先在桌面版核對。":"有 "+m.unmatched.length+" 個小節標記無法安全對應，已保留待核對。";
 const root=$("message-list");root.replaceChildren();
 $("count-all").textContent=m.msgs.length;$("count-pending").textContent=C.pending(m).length||"";$("count-key").textContent=navTargetsFor("key").length||"";$("count-turn").textContent=navTargetsFor("turn").length||"";document.querySelectorAll("[data-kind]").forEach(b=>b.classList.toggle("active",b.dataset.kind===S.kind));
 m.msgs.slice(0,S.count).forEach((msg,i)=>root.append(messageRow(msg,i)));
 $("load-more").hidden=S.count>=m.msgs.length;
 $("load-more").textContent="繼續載入後 "+Math.min(20,m.msgs.length-S.count)+" 則";
 navStatus();renderDesktopRail();change();
 if(keep)window.scrollTo(0,y);
}
function renderDesktopRail(){
 const rail=$("desktop-rail"),m=model();if(!rail)return;
 rail.replaceChildren();if(!m)return;
 rail.append(node("h2","","快速索引"),node("p","small muted","按主題或標記跳到對話位置"));
 const added=new Set();
 const add=(label,i)=>{
  if(i<0||added.has(label+"|"+i))return;added.add(label+"|"+i);
  rail.append(btn(label,()=>{
   S.count=Math.max(S.count,i+3);S.cursor=i;renderReader();
   requestAnimationFrame(()=>$("msg-"+i)?.scrollIntoView({block:"center"}));
  },"rail-item"));
 };
 for(const topic of m.topics){
  const i=m.msgs.findIndex(x=>m.primary[x.id]===topic.id);
  if(i>=0)add(topic.id+" · "+topic.name,i);
 }
 const important=navTargetsFor("key"),turns=navTargetsFor("turn");
 if(important.length)rail.append(node("h3","","關鍵"));
 important.slice(0,12).forEach(i=>add(String(i+1).padStart(3,"0")+" · "+plain(m.msgs[i]?.content).slice(0,35),i));
 if(turns.length)rail.append(node("h3","","轉向"));
 turns.slice(0,12).forEach(i=>add(String(i+1).padStart(3,"0")+" · "+plain(m.msgs[i]?.content).slice(0,35),i));
 if(!rail.querySelector(".rail-item"))rail.append(node("p","small muted","尚無標記，從中間的對話開始即可。"));
}
function messageRow(msg,i){
 const m=model(),entry=node("article","message "+(msg.speaker==="assistant"?"ai":"user"));
 entry.id="msg-"+i;const header=node("div","message-meta");
 header.append(node("strong","",String(i+1).padStart(3,"0")+" · "+(msg.speaker==="assistant"?"AI":msg.speaker==="author"?"我":"外部")));
 const marks=node("div");
 if(m.primary[msg.id])marks.append(node("span","topic-tag",currentTopic(m.primary[msg.id])));
 if(m.related[msg.id]?.length)marks.append(node("span","small muted"," ＋"+m.related[msg.id].length));
 header.append(marks);entry.append(header);
 const block=node("div","message-body"),sects=msg.speaker==="assistant"?C.sections(msg.content):[],full=S.expanded.has(msg.id);
 if(sects.length&&!full){
  const intro=msg.content.slice(0,sects[0].start).trim();if(intro)block.append(node("p","section-intro",intro));
  for(const sec of sects){
   const p=node("div","section"),bar=node("div","section-header"),k=msg.id+"|"+sec.start;
   const expanded=S.expanded.has(k);
   bar.append(btn((expanded?"▾ ":"▸ ")+sec.title,()=>{if(expanded)S.expanded.delete(k);else S.expanded.add(k);renderReader(true)},"section-toggle"));
   const selected=(m.sectionMarks[msg.id]||[]).some(x=>x.section_fingerprint===sec.fp&&x.heading_start===sec.start);
   bar.append(btn(selected?"★ 重點":"☆ 重點",()=>{C.toggleSection(m,msg.id,sec);renderReader(true)},"section-star"+(selected?" is-on":"")));
   p.append(bar);if(expanded)p.append(node("div","section-body",sec.body||"（這節沒有內文）"));
   block.append(p);
  }
  block.append(btn("展開整則全文",()=>{S.expanded.add(msg.id);renderReader(true)},"full-toggle"));
 }else{
  const max=msg.speaker==="assistant"?300:1100,trimmed=msg.content.length>max;
  block.textContent=full||!trimmed?msg.content:msg.content.slice(0,max)+"…";
  if(sects.length&&full)block.append(btn("切回章節概覽",()=>{S.expanded.delete(msg.id);renderReader(true)},"full-toggle"));
  else if(trimmed)block.append(btn(full?"收起全文":"展開全文",()=>{if(full)S.expanded.delete(msg.id);else S.expanded.add(msg.id);renderReader(true)},"full-toggle"));
 }
 entry.append(block);
 if(m.notes[msg.id])entry.append(node("div","message-notes",m.notes[msg.id]));
 const actions=node("div","message-actions");
 actions.append(btn("◇ 主題",()=>messageInspector(msg,"topic"),m.primary[msg.id]?"selected":""));
 actions.append(btn(m.keys[msg.id]?"★ 關鍵":"☆ 關鍵",()=>messageInspector(msg,"mark"),m.keys[msg.id]?"selected":""));
 if(msg.speaker!=="assistant")actions.append(btn(m.turns[msg.id]?"↗ 轉向 ✓":"↗ 轉向",()=>messageInspector(msg,"mark"),m.turns[msg.id]?"selected":""));
 actions.append(btn(m.notes[msg.id]?"▤ 備註 ✓":"▤ 備註",()=>messageInspector(msg,"note"),m.notes[msg.id]?"selected":""));
 entry.append(actions);return entry;
}
function navTargetsFor(kind){
 const m=model();if(!m)return[];if(kind==="all")return m.msgs.map((_,i)=>i);const ids=new Set();if(kind==="pending")for(const x of C.pending(m))ids.add(x.id);if(kind==="key"){for(const id of Object.keys(m.keys))ids.add(id);for(const [id,items]of Object.entries(m.sectionMarks))if(items.length)ids.add(id);for(const x of m.base?.key_ranges||[])ids.add(x.from_message_id)}if(kind==="turn")for(const id of Object.keys(m.turns))ids.add(id);return m.msgs.map((v,i)=>ids.has(v.id)?i:-1).filter(i=>i>=0);
}
function navTargets(){return navTargetsFor(S.kind)}
function navStatus(){
 const p=navTargets(),i=p.indexOf(S.cursor);
 $("position").textContent=p.length?(i<0?"共 "+p.length+" 項":i+1+" / "+p.length):"0 項";
 $("prev-item").disabled=$("next-item").disabled=!p.length;
}
function jump(dir){
 const targets=navTargets();if(!targets.length)return;
 let k=targets.indexOf(S.cursor);if(k<0)k=dir>0?-1:0;k=(k+dir+targets.length)%targets.length;
 const i=targets[k];S.cursor=i;if(i>=S.count){S.count=i+3;renderReader()}
 const element=$("msg-"+i);if(element){element.scrollIntoView({behavior:"smooth",block:"center"});element.classList.add("highlight");setTimeout(()=>element.classList.remove("highlight"),1200)}
 navStatus();
}
function sheet(title,content,fn,label="套用標記"){
 $("sheet-title").textContent=title;$("sheet-content").replaceChildren(content);
 $("sheet-apply").textContent=label;S.sheetAction=fn;$("sheet-overlay").hidden=false;document.body.style.overflow="hidden";
}
function closeSheet(){S.sheetAction=null;$("sheet-overlay").hidden=true;document.body.style.overflow=""}
function messageInspector(msg,active="topic"){
 const m=model(),i=m.msgs.findIndex(x=>x.id===msg.id),wrap=node("div","message-inspector");wrap.append(node("p","inspector-snippet",plain(msg.content).slice(0,120)+(plain(msg.content).length>120?"…":"")));const tabs=node("div","sheet-tabs"),panes={},tabSpec=[["topic","主題"],["mark","標記"],["note","備註"]],switchTab=name=>{for(const [key] of tabSpec){tabs.querySelector('[data-sheet-tab="'+key+'"]').classList.toggle("active",key===name);panes[key].hidden=key!==name}};for(const [key,label] of tabSpec){const b=btn(label,()=>switchTab(key));b.dataset.sheetTab=key;tabs.append(b)}wrap.append(tabs);
 const topicPane=panes.topic=node("div","sheet-pane");topicPane.append(node("p","sheet-label","主要主題（選 1 個）"));const radios=[],checks=[],main=m.primary[msg.id]||"";for(const t of [{id:"",name:"未分類"},...m.topics]){const label=node("label","sheet-radio"),input=document.createElement("input");input.type="radio";input.name="main-topic";input.value=t.id;input.checked=t.id===main;radios.push(input);label.append(input,node("span","",t.id?t.id+" · "+t.name:t.name));topicPane.append(label)}if(m.mode==="multi_topic"){topicPane.append(node("p","sheet-label","相關主題（可多選）"));for(const t of m.topics){const label=node("label","sheet-check"),input=document.createElement("input");input.type="checkbox";input.value=t.id;input.checked=(m.related[msg.id]||[]).includes(t.id);checks.push(input);label.append(input,node("span","",t.id+" · "+t.name));topicPane.append(label)}}else topicPane.append(node("p","sheet-help","單一主題模式下，整段對話都屬於同一個主題。"));
 const markPane=panes.mark=node("div","sheet-pane"),keyLabel=node("label","sheet-check"),keyInput=document.createElement("input");keyInput.type="checkbox";keyInput.checked=!!m.keys[msg.id];keyLabel.append(keyInput,node("span","",msg.speaker==="assistant"?"這則 AI 回覆是關鍵":"這則訊息是關鍵"));markPane.append(keyLabel);let turnInput=null;if(msg.speaker!=="assistant"){const turnLabel=node("label","sheet-check");turnInput=document.createElement("input");turnInput.type="checkbox";turnInput.checked=!!m.turns[msg.id];turnLabel.append(turnInput,node("span","","這裡是討論轉向"));markPane.append(turnLabel)}const notePane=panes.note=node("div","sheet-pane"),area=document.createElement("textarea");area.rows=6;area.value=m.notes[msg.id]||"";area.placeholder="為何重要？還有哪些補充脈絡？";notePane.append(area);wrap.append(topicPane,markPane,notePane);switchTab(active);
 sheet("第 "+String(i+1).padStart(3,"0")+" 則 · "+(msg.speaker==="assistant"?"AI":msg.speaker==="author"?"我":"外部"),wrap,()=>{const nextMain=radios.find(x=>x.checked)?.value||null;if((m.primary[msg.id]||null)!==nextMain)C.setPrimary(m,msg.id,nextMain);if(m.mode==="multi_topic"){const next=checks.filter(x=>x.checked).map(x=>x.value),cur=m.related[msg.id]||[];if(next.slice().sort().join("|")!==cur.slice().sort().join("|"))C.setRelated(m,msg.id,next)}if(!!m.keys[msg.id]!==keyInput.checked)C.toggleKey(m,msg.id);if(turnInput&&!!m.turns[msg.id]!==turnInput.checked)C.toggleTurn(m,msg.id);if((m.notes[msg.id]||"")!==area.value)C.setNote(m,msg.id,area.value);closeSheet();renderReader(true)});
}
function topicSheet(msg){messageInspector(msg,"topic")}function noteSheet(msg){messageInspector(msg,"note")}
function topicsSheet(){const m=model(),wrap=node("div","topics-sheet");if(!m.topics.length)wrap.append(node("p","empty-state","還沒有主題"));for(const topic of m.topics){const row=node("div","sheet-topic-row"),text=node("div"),primary=m.msgs.filter(x=>m.primary[x.id]===topic.id).length,related=m.msgs.filter(x=>(m.related[x.id]||[]).includes(topic.id)).length;text.append(node("strong","",topic.id+" · "+topic.name),node("p","small muted",primary+" 則主要內容"+(related?" · "+related+" 則相關":"")));row.append(text,btn("定位",()=>{const n=m.msgs.findIndex(x=>m.primary[x.id]===topic.id||(m.related[x.id]||[]).includes(topic.id));closeSheet();if(n>=0){S.count=Math.max(S.count,n+2);S.cursor=n;show("reader");setTimeout(()=>$("msg-"+n)?.scrollIntoView({block:"center"}),0)}},"inline-action"));wrap.append(row)}wrap.append(btn("＋ 新增主題",()=>{closeSheet();editTopic(null)},"secondary full"));sheet("主題總覽",wrap,closeSheet,"完成")}
function reviewSheet(){const m=model(),items=C.pending(m),wrap=node("div","review-sheet");if(!items.length)wrap.append(node("p","empty-state","目前沒有待確認的 AI 建議。"));const names={key:"整則關鍵",turn:"討論轉向",range:"關鍵段落",topic:"主題分配"};for(const it of items){const i=m.msgs.findIndex(x=>x.id===it.id),row=node("article","review-item compact-review");row.append(node("strong","",names[it.type]||it.type),node("p","small muted","第 "+(i+1)+" 則 · "+(it.detail||plain(m.msgs[i]?.content).slice(0,90))));const actions=node("div","review-actions");actions.append(btn("查看",()=>{closeSheet();S.count=Math.max(S.count,i+3);S.cursor=i;show("reader");setTimeout(()=>$("msg-"+i)?.scrollIntoView({block:"center"}),0)}));actions.append(btn("確認",()=>{C.decide(m,it,true);reviewSheet();change()},"accept"));actions.append(btn("否決",()=>{C.decide(m,it,false);reviewSheet();change()},"reject"));row.append(actions);wrap.append(row)}sheet("AI 建議審查 · "+items.length+" 項",wrap,closeSheet,"完成")}

function editTopic(topic){
 const wrap=node("div"),name=document.createElement("input"),note=document.createElement("textarea");
 name.type="text";name.value=topic?.name||"";note.rows=4;note.value=topic?.note||"";
 wrap.append(node("p","sheet-label","主題名稱"),name,node("p","sheet-label","補充說明"),note);
 sheet(topic?"編輯主題":"新增主題",wrap,()=>{
  if(topic){topic.name=name.value.trim()||topic.name;topic.note=note.value;topic.name_origin="user";model().dirty=true;model().editVersion=(model().editVersion||0)+1}
  else{const id=C.addTopic(model(),name.value);model().topics.find(x=>x.id===id).note=note.value}
  closeSheet();renderTopics();change();
 },"儲存主題");
}
function renderTopics(){
 const m=model();if(!m)return;
 const counts=id=>m.msgs.filter(x=>m.primary[x.id]===id).length;
 $("topic-overview").replaceChildren(node("div","summary-bar",m.msgs.length+" 則 · "+m.topics.length+" 個主題 · "+m.msgs.filter(x=>!m.primary[x.id]).length+" 則未分類"));
 const root=$("topic-list");root.replaceChildren();
 const colors=["#5277b5","#b88b51","#4a947c","#9569ac","#a85f84","#6e844f"];
 m.topics.forEach((topic,i)=>{
  const row=node("article","topic-row"),stripe=node("div","topic-mark");stripe.style.background=colors[i%colors.length];
  const detail=node("div","topic-detail");
  detail.append(node("h2","",topic.id+" · "+topic.name),
   node("p","",counts(topic.id)+" 則主要內容 · "+m.msgs.filter(x=>m.related[x.id]?.includes(topic.id)).length+" 則相關內容"));
  if(topic.note)detail.append(node("p","",topic.note));
  const actions=node("div","topic-actions");
  actions.append(btn("定位訊息",()=>{
   const n=m.msgs.findIndex(x=>m.primary[x.id]===topic.id||m.related[x.id]?.includes(topic.id));
   if(n>=0){S.count=Math.max(S.count,n+3);S.cursor=n;show("reader");$("msg-"+n)?.scrollIntoView({block:"center"})}
  }));
  actions.append(btn("編輯",()=>editTopic(topic)));
  detail.append(actions);row.append(stripe,detail);root.append(row);
 });
}
function renderReview(){
 const m=model();if(!m)return;const root=$("review-list");root.replaceChildren();
 if(m.unmatched.length)root.append(node("p","warning","有 "+m.unmatched.length+" 個小節重點無法安全對應，請在桌面版核對，資料已保留。"));
 const all=C.pending(m),items=all.filter(x=>S.review==="all"||(S.review==="topic"?x.type==="topic":S.review==="key"?["key","range"].includes(x.type):x.type==="turn"));
 if(!items.length)root.append(node("p","empty-state","目前沒有待確認的 AI 建議。"));
 const names={key:"整則關鍵",turn:"討論轉向",range:"關鍵段落",topic:"主題分配"};
 for(const it of items){
  const i=m.msgs.findIndex(x=>x.id===it.id),row=node("article","review-item"),header=node("div","review-head");
  header.append(node("strong","",names[it.type]||it.type),node("span","","第 "+(i+1)+" 則 · AI 建議"));
  row.append(header,node("p","review-content",it.detail||plain(m.msgs[i]?.content).slice(0,150)));
  const actions=node("div","review-actions");
  actions.append(btn("查看原文",()=>{if(i<0)return;S.count=Math.max(S.count,i+3);S.cursor=i;show("reader");$("msg-"+i)?.scrollIntoView({block:"center"})}));
  actions.append(btn("確認",()=>{C.decide(m,it,true);renderReview();change()},"accept"));
  actions.append(btn("否決",()=>{C.decide(m,it,false);renderReview();change()},"reject"));
  row.append(actions);root.append(row);
 }
}
function renderSettings(){
 const m=model();
 $("connection-detail").textContent=S.localHandle?"本機資料夾："+S.localHandle.name:S.local?"本機檔案":G.config()?G.config().repo+" / "+G.config().branch:"未連線";
 const drafts=D.draftCount();
 $("device-detail").textContent=(D.hasToken()?"已記住 Token，下次打開會自動連線。":"沒有記住 Token，關閉或重新整理後要重新輸入。")+(drafts?" 有 "+drafts+" 份未儲存草稿。":"");
 $("save-detail").textContent=!m?"尚未選擇對話":m.dirty?"有尚未儲存的修改":"沒有待儲存修改";
 $("save-button").textContent=S.localHandle?"直接存回資料夾":S.local?"下載 outline.json":"儲存到 GitHub";
 $("save-button").disabled=$("download-button").disabled=!m||m.sourceMismatch||S.busy;
}
function download(){
 if(!model())return;
 try{
  const content=JSON.stringify(C.makeOutline(model()),null,2)+"\n";
  const url=URL.createObjectURL(new Blob([content],{type:"application/json;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download="outline.json";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
  if(S.local){const ref=draftRef();if(ref)D.dropDraft(ref[0],ref[1]);S.draftVersion=model().editVersion||0}
  notify("已下載 outline.json。");
 }catch(err){notify(err.message,true)}
}
async function saveLocalFolder(){
 const m=model(),LF=window.ATLocalFolder;if(!m||!S.localHandle||!LF)return;
 if(m.sourceMismatch)return notify("原文指紋不一致，禁止覆寫本機標記。",true);
 if(S.busy)return;S.busy=true;change();
 try{
  const version=m.editVersion||0,doc=C.makeOutline(m),text=JSON.stringify(doc,null,2)+"\n";
  const actual=await LF.writeOutline(S.localHandle,text,S.localSource,S.localOutline);
  S.localOutline=actual;m.base=doc;m.dirty=(m.editVersion||0)!==version;
  if(m.dirty){S.draftVersion=-1;queueDraft()}else{const ref=draftRef();if(ref)D.dropDraft(ref[0],ref[1]);S.draftVersion=m.editVersion||0}
  notify(m.dirty?"已存入資料夾，但儲存期間還有新的修改，請再儲存一次。":"已直接儲存到本機資料夾 outline.json。");
 }catch(err){notify("本機儲存失敗："+err.message,true)}finally{S.busy=false;change();if(S.page==="settings")renderSettings()}
}
async function save(){
 const m=model();if(!m)return;if(S.localHandle)return saveLocalFolder();if(S.local)return download();
 if(!S.repo)return notify("尚未連接 GitHub",true);
 if(m.sourceMismatch)return notify("原文指紋不一致，禁止覆蓋遠端資料。",true);
 const buttonSave=$("save-button");buttonSave.disabled=true;$("quick-save").disabled=true;
 notify("正在確認遠端原文和標記版本…");
 try{
  const current=await G.getFile(S.folder+"source/conversation.jsonl");
  if(current.sha!==S.sourceSha)throw Error("原文已被其他裝置更新。請重新開啟對話，這次沒有寫入。");
  const savingVersion=m.editVersion||0;
  const doc=C.makeOutline(m),result=await G.writeFile(S.folder+"outline.json",JSON.stringify(doc,null,2)+"\n",S.outlineSha,"After-thinking mobile: outline "+S.folder);
  S.outlineSha=result.sha;m.base=doc;
  m.dirty=(m.editVersion||0)!==savingVersion;
  // 存好了就不需要草稿；儲存途中又改的，用新的版本重寫草稿
  if(m.dirty){S.draftVersion=-1;queueDraft()}else{const ref=draftRef();if(ref)D.dropDraft(ref[0],ref[1]);S.draftVersion=m.editVersion||0}
  if(S.row){S.row.outline_updated_at=doc.updated_at;S.row.outline_mode=doc.mode}
  notify(m.dirty?"已儲存按下儲存時的版本；儲存過程中新增的修改尚未儲存，請再儲存一次。":"outline.json 已寫回 GitHub。");
  try{await G.refreshIndex(S.folder,doc.updated_at,doc.mode)}
  catch(err){notify("outline.json 已存好，但 index.jsonl 更新失敗："+err.message,true)}
  change();
 }catch(err){notify("儲存失敗："+err.message,true)}
 finally{buttonSave.disabled=false;$("quick-save").disabled=false;if(S.page==="settings")renderSettings()}
}
function leave(){
 writeDraft();
 G.disconnect();S.repo=false;S.local=false;S.localHandle=null;S.localSource=null;S.localOutline=null;S.model=null;S.row=null;S.rows=[];S.expanded.clear();S.previews={};S.allQuestions={};S.aiRaw=null;S.aiReport=null;S.aiFrom=null;S.readerY=0;S.modeConfirmed=false;S.usingSaved=false;S.draft=null;
 $("token-input").value="";notify("");
}
// 切換倉庫：回到連線頁，這台裝置記住的設定和草稿都留著
function changeRepo(){
 if(model()?.dirty&&!confirm("還有未儲存的修改（已留草稿在這台裝置）。確定要切換？"))return;
 leave();show("connect");syncConnectForm();
}
// 中斷連線並忘記這台裝置：刪掉記住的倉庫、Token 和所有草稿
async function disconnect(){
 writeDraft();const drafts=D.draftCount();
 if(!confirm("會刪掉這台裝置記住的倉庫和 Token"+(drafts?"，以及 "+drafts+" 份未儲存的標記草稿":"")+"。GitHub 上的資料不受影響。確定？"))return;
 if(model())model().dirty=false;
 leave();D.forgetAll();try{await window.ATLocalFolder?.forget()}catch(err){notify("已清除一般設定，但無法忘記資料夾："+err.message,true)}$("repo-input").value="";$("branch-input").value="main";show("connect");syncConnectForm();
}
function initialize(){
 const folderControl=window.ATLocalFolder;
 $("folder-option").hidden=!folderControl?.supported();
 if(folderControl?.supported()){
  $("choose-local-folder").addEventListener("click",()=>openLocalFolder());
  $("reopen-local-folder").addEventListener("click",()=>openLocalFolder(true));
  folderControl.getStored().then(h=>{$("reopen-local-folder").hidden=!h}).catch(()=>{});
 }
 $("connect-form").addEventListener("submit",connect);$("local-files").addEventListener("change",loadLocal);$("menu-button").addEventListener("click",()=>{if(S.model)show("settings");else{const detail=document.querySelector(".explain");if(detail)detail.open=true}});
 for(const [id,kind,link] of [["library-copy-path","library",false],["library-copy-link","library",true],["reader-copy-path","reader",false],["reader-copy-link","reader",true]])$(id).addEventListener("click",()=>copyLocation(kind,link));$("quick-save").addEventListener("click",save);$("save-button").addEventListener("click",save);$("reader-save").addEventListener("click",save);$("download-button").addEventListener("click",download);$("disconnect").addEventListener("click",disconnect);$("change-repo").addEventListener("click",changeRepo);$("draft-use").addEventListener("click",useDraft);$("draft-drop").addEventListener("click",dropDraft);$("reader-back").addEventListener("click",()=>show("library"));$("prepare-back").addEventListener("click",()=>show("library"));$("settings-back").addEventListener("click",()=>show(S.previousPage==="settings"?"library":S.previousPage));
 $("reader-mode").addEventListener("click",()=>show("prepare"));$("reader-more").addEventListener("click",()=>show("settings"));$("open-topics").addEventListener("click",topicsSheet);$("reader-review").addEventListener("click",reviewSheet);$("new-topic").addEventListener("click",()=>editTopic(null));$("prepare-preview-toggle").addEventListener("click",()=>{S.prepareExpanded=!S.prepareExpanded;renderPrepare()});$("choose-multi").addEventListener("click",()=>chooseMode("multi_topic"));$("choose-single").addEventListener("click",()=>chooseMode("single_topic"));$("choose-skip").addEventListener("click",skipSheet);$("enter-workspace").addEventListener("click",()=>{if(!S.modeConfirmed)return notify("請先選擇整理方式。",true);S.readerY=0;show("reader")});
 $("ai-copy-repo").addEventListener("click",copyRepoAiPrompt);$("ai-reload").addEventListener("click",reloadAi);$("ai-download-request").addEventListener("click",downloadAiRequest);$("ai-copy-file-prompt").addEventListener("click",()=>copyText("請照附檔開頭的說明，幫我標記附檔裡的對話，最後只輸出 outline.ai.json。","已複製給 AI 的一句話。"));$("ai-file").addEventListener("change",async e=>{const f=e.target.files?.[0];e.target.value="";if(!f)return;takeAi(await f.text(),"file")});$("ai-paste-go").addEventListener("click",()=>takeAi($("ai-paste").value,"paste"));
 $("search").addEventListener("input",e=>{S.search=e.target.value;renderLibrary()});$("sort").addEventListener("change",e=>{S.sort=e.target.value;renderLibrary()});for(const b of document.querySelectorAll("[data-filter]"))b.addEventListener("click",()=>{S.filter=b.dataset.filter;document.querySelectorAll("[data-filter]").forEach(x=>x.classList.toggle("active",x===b));renderLibrary()});for(const b of document.querySelectorAll("[data-review]"))b.addEventListener("click",()=>{S.review=b.dataset.review;document.querySelectorAll("[data-review]").forEach(x=>x.classList.toggle("active",x===b));renderReview()});for(const b of document.querySelectorAll("[data-kind]"))b.addEventListener("click",()=>{S.kind=b.dataset.kind;S.cursor=null;document.querySelectorAll("[data-kind]").forEach(x=>x.classList.toggle("active",x===b));navStatus();if(S.kind!=="all")jump(1)});
 $("load-more").addEventListener("click",()=>{S.count=Math.min(model().msgs.length,S.count+20);renderReader(true)});$("prev-item").addEventListener("click",()=>jump(-1));$("next-item").addEventListener("click",()=>jump(1));$("sheet-close").addEventListener("click",closeSheet);$("sheet-overlay").addEventListener("click",e=>{if(e.target===$("sheet-overlay"))closeSheet()});$("sheet-apply").addEventListener("click",()=>{if(S.sheetAction)S.sheetAction()});document.addEventListener("keydown",e=>{if(e.key==="Escape"&&S.sheetAction)closeSheet();if(S.page==="reader"&&!S.sheetAction&&!["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName)){if(e.key.toLowerCase()==="j"){e.preventDefault();jump(1)}else if(e.key.toLowerCase()==="k"){e.preventDefault();jump(-1)}}});window.addEventListener("beforeunload",e=>{if(model()?.dirty){e.preventDefault();e.returnValue=""}});
 // 手機切到別的 App 時分頁可能被系統回收：離開畫面前立刻把草稿寫好
 document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")writeDraft()});window.addEventListener("pagehide",writeDraft);
 // 記住的 Token 被 GitHub 拒絕（過期或撤銷）：從這台裝置刪掉，草稿還在
 G.onUnauthorized=()=>{if(S.usingSaved){D.forgetToken();S.usingSaved=false}};
 show("connect");syncConnectForm();
 if(D.hasToken())connect();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initialize);else initialize();
})();