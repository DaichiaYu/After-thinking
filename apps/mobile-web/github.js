/* GitHub Contents REST client — no credentials, repository names or private data embedded.
   Token is held only in this JS closure and erased on disconnect. */
(function (root) {
  "use strict";
  let credentials=null;
  const api="https://api.github.com";
  const utf8=new TextEncoder(), decoder=new TextDecoder("utf-8",{fatal:true});
  function safeRepo(s) {
    const repo=String(s||"").trim();
    if(!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo) || repo.split("/").some(x=>x==="."||x===".."))throw new Error("資料倉庫請輸入 owner/repository");
    return repo;
  }
  function safeBranch(s) {
    const branch=String(s||"").trim();
    if(!branch||branch.startsWith("/")||branch.endsWith("/")||branch.includes("..")
      ||/[\s~^:?*[\]\\]/.test(branch))throw new Error("分支名稱無效");
    return branch;
  }
  function safePath(s) {
    const path=String(s||"");
    if(!path||path.startsWith("/")||path.includes("\\")||path.split("/").some(x=>!x||x==="."||x===".."))throw new Error("檔案路徑無效");
    return path.split("/").map(encodeURIComponent).join("/");
  }
  function config(){return credentials&&{repo:credentials.repo,branch:credentials.branch};}
  async function request(url,options={}) {
    if(!credentials?.token)throw new Error("GitHub 尚未連接");
    const res=await fetch(url,{...options,cache:"no-store",headers:{
      "Accept":"application/vnd.github+json","Authorization":"Bearer "+credentials.token,
      "X-GitHub-Api-Version":"2022-11-28",...(options.headers||{})
    }});
    const raw=await res.text();
    let body=null;try{body=raw?JSON.parse(raw):null}catch(e){body={message:raw.slice(0,150)}}
    if(!res.ok){
      const err=new Error((body?.message||"GitHub API error")+"（HTTP "+res.status+"）");
      err.status=res.status;
      if(res.status===401)err.message="Token 已失效或不正確（401）";
      if(res.status===403)err.message="沒有權限或已達 GitHub API 限制（403）";
      if(res.status===404)err.message="找不到倉庫、分支或檔案，或 Token 沒有權限讀取（404）";
      if(res.status===409||res.status===422)err.message="資料版本已變動，可能有另一個裝置更新（"+res.status+"）";
      throw err;
    }
    return body;
  }
  function encode(text) {
    const bytes=utf8.encode(text);
    let b="";
    for(let i=0;i<bytes.length;i+=16384)b+=String.fromCharCode(...bytes.subarray(i,i+16384));
    return btoa(b);
  }
  function decode(base64) {
    const binary=atob(String(base64||"").replace(/\s+/g,""));
    const bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    return decoder.decode(bytes);
  }
  async function connect(repo,branch,token) {
    const name=safeRepo(repo),ref=safeBranch(branch);
    if(!token||!String(token).trim())throw new Error("請輸入 GitHub Token");
    credentials={repo:name,branch:ref,token:String(token).trim()};
    try {
      await request(api+"/repos/"+name);
      await getFile("inbox/index.jsonl");
      return config();
    }catch(e){credentials=null;throw e;}
  }
  function disconnect(){credentials=null;}
  async function getFile(path,{optional=false}={}) {
    const c=config();if(!c)throw new Error("尚未連接 GitHub");
    const endpoint=api+"/repos/"+c.repo+"/contents/"+safePath(path)+"?ref="+encodeURIComponent(c.branch);
    let info;try{info=await request(endpoint)}catch(e){if(optional&&e.status===404)return null;throw e;}
    if(!info || Array.isArray(info) || info.type!=="file")throw new Error(path+" 不是 GitHub 檔案");
    if(info.encoding==="base64"&&info.content)return {text:decode(info.content),sha:info.sha,path};
    if(info.sha){
      const blob=await request(api+"/repos/"+c.repo+"/git/blobs/"+encodeURIComponent(info.sha));
      if(blob.encoding==="base64")return {text:decode(blob.content),sha:info.sha,path};
    }
    throw new Error("無法讀取 "+path+"；GitHub 未回傳可解碼的檔案內容");
  }
  async function writeFile(path,text,expectedSha,message) {
    const c=config();if(!c)throw new Error("尚未連接 GitHub");
    // Check the entire prior version before saving. A browser tab must not
    // overwrite a newer outline committed by another client.
    const latest=await getFile(path,{optional:true});
    if((latest?.sha||null)!==(expectedSha||null))throw new Error("遠端的 "+path+" 已更新。請重新載入對話核對，這次不會覆蓋它。");
    const payload={message,content:encode(text),branch:c.branch};
    if(expectedSha)payload.sha=expectedSha;
    const response=await request(api+"/repos/"+c.repo+"/contents/"+safePath(path),{
      method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)
    });
    return {sha:response.content?.sha||null,commit:response.commit?.sha||null};
  }
  async function refreshIndex(folder,updated,mode) {
    // An outline is authoritative. Index status is secondary; reread current
    // index to avoid discarding rows added by a separate capture.
    const file=await getFile("inbox/index.jsonl");
    const rows=file.text.split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
    let changed=false;
    for(const row of rows) if(row.folder===folder) {
      row.outline_updated_at=updated;row.outline_mode=mode;changed=true;
    }
    if(!changed)return {updated:false};
    const text=rows.map(x=>JSON.stringify(x)).join("\n")+"\n";
    await writeFile("inbox/index.jsonl",text,file.sha,"After-thinking mobile: refresh outline index");
    return {updated:true};
  }
  root.ATGitHub={connect,disconnect,config,getFile,writeFile,refreshIndex,safeRepo,safePath,encode,decode};
})(typeof window!=="undefined"?window:globalThis);