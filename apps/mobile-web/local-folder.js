/* AT directory binding: explicit user gesture and browser-managed permissions only.
   Source files never leave the device unless the user separately connects GitHub. */
(function(root){
 "use strict";
 const DB="at-editor-directory-v1",STORE="handles",KEY="selected-conversation";
 function db(){
  return new Promise((resolve,reject)=>{
   if(!root.indexedDB)return reject(new Error("這個瀏覽器無法記住本機資料夾。"));
   const req=root.indexedDB.open(DB,1);
   req.onupgradeneeded=()=>req.result.createObjectStore(STORE);
   req.onsuccess=()=>resolve(req.result);
   req.onerror=()=>reject(req.error||new Error("本機資料夾紀錄無法開啟"));
  });
 }
 async function transaction(type,operation){
  const database=await db();
  try{return await new Promise((resolve,reject)=>{
   const tx=database.transaction(STORE,type);
   const req=operation(tx.objectStore(STORE));
   req.onsuccess=()=>resolve(req.result||null);
   req.onerror=()=>reject(req.error||new Error("無法保存資料夾授權"));
  })}finally{database.close()}
 }
 const getStored=()=>transaction("readonly",store=>store.get(KEY)).catch(()=>null);
 const remember=handle=>transaction("readwrite",store=>store.put(handle,KEY));
 const forget=()=>transaction("readwrite",store=>store.delete(KEY));
 const supported=()=>typeof root.showDirectoryPicker==="function" && !!root.indexedDB;
 async function read(handle,path,optional=false){
  try{
   const segments=String(path).split("/").filter(Boolean);if(!segments.length||segments.some(x=>x==="."||x===".."))throw Error("無效的檔案路徑");
   let folder=handle;
   for(const segment of segments.slice(0,-1))folder=await folder.getDirectoryHandle(segment);
   const file=await folder.getFileHandle(segments.at(-1));
   return await (await file.getFile()).text();
  }catch(err){if(optional&&err.name==="NotFoundError")return null;throw err}
 }
 async function verify(handle){
  if(!handle||handle.kind!=="directory")throw Error("請選擇資料夾。");
  const source=await read(handle,"source/conversation.jsonl");
  if(!source.trim())throw Error("選取資料夾中的 source/conversation.jsonl 是空的");
  return source;
 }
 async function pick(){
  if(!supported())throw Error("請使用桌面 Chrome 或 Edge 的安全網址開啟此功能。");
  const handle=await root.showDirectoryPicker({id:"at-conversation-folder",mode:"readwrite"});
  await verify(handle);await remember(handle);return handle;
 }
 async function restore(){
  const handle=await getStored();if(!handle)return null;
  const state=await handle.queryPermission({mode:"readwrite"});
  if(state!=="granted"){
   const granted=await handle.requestPermission({mode:"readwrite"});
   if(granted!=="granted")throw Error("此資料夾的讀寫授權尚未開啟。");
  }
  await verify(handle);return handle;
 }
 async function readAttachment(handle,path){
  if(!/^attachments\/[A-Za-z0-9._-]+$/.test(path)||path.includes(".."))throw Error("附件路徑不安全");
  const folder=await handle.getDirectoryHandle("source");
  const att=await folder.getDirectoryHandle("attachments");
  const name=path.split("/")[1];
  const file=await (await att.getFileHandle(name)).getFile();
  if(file.size>25*1024*1024)throw Error("附件超過 25MB 預覽上限");
  return new Uint8Array(await file.arrayBuffer());
 }
 async function writeOutline(handle,text,expectedSource,expectedOutline){
  const currentSource=await read(handle,"source/conversation.jsonl");
  const currentOutline=await read(handle,"outline.json",true);
  if(currentSource!==expectedSource||currentOutline!==expectedOutline)
   throw Error("本機原文或標記已經由其他程式修改，這次沒有覆寫。請重新載入資料夾。");
  const file=await handle.getFileHandle("outline.json",{create:true});
  const writer=await file.createWritable();
  try{await writer.write(text);await writer.close()}catch(err){try{await writer.abort()}catch(e){}throw err}
  return await read(handle,"outline.json");
 }
 root.ATLocalFolder={supported,pick,restore,getStored,forget,read,readAttachment,writeOutline};
})(typeof window!=="undefined"?window:globalThis);
