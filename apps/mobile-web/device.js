/* Per-device storage for the mobile editor: remembered connection and unsaved drafts.
   Everything stays in this browser's localStorage. Nothing here is sent anywhere.
   The token is stored only when the user ticks "remember this device". */
(function (root) {
  "use strict";
  const PREFIX="at-mobile:";
  const CONNECTION=PREFIX+"connection";
  const DRAFT=PREFIX+"draft:";
  const MAX_DRAFTS=20;
  function store() {
    try { return root.localStorage||null; } catch (e) { return null; }
  }
  function read(key) {
    const s=store();if(!s)return null;
    try { const raw=s.getItem(key);return raw?JSON.parse(raw):null; } catch (e) { return null; }
  }
  function write(key,value) {
    const s=store();if(!s)return false;
    try { s.setItem(key,JSON.stringify(value));return true; } catch (e) { return false; }
  }
  function remove(key) {
    const s=store();if(!s)return;
    try { s.removeItem(key); } catch (e) {}
  }
  function keys(prefix) {
    const s=store(),out=[];if(!s)return out;
    try { for(let i=0;i<s.length;i++){const k=s.key(i);if(k&&k.startsWith(prefix))out.push(k);} } catch (e) {}
    return out;
  }
  function available(){
    const s=store();if(!s)return false;
    try { s.setItem(PREFIX+"probe","1");s.removeItem(PREFIX+"probe");return true; } catch (e) { return false; }
  }

  // ── Connection ──
  // Repository and branch are always remembered (they are not secrets).
  // The token is kept only when `remember` is true; otherwise any stored token is erased.
  function saveConnection(repo,branch,token,remember) {
    const value={repo:String(repo||""),branch:String(branch||"")};
    if(remember&&token)value.token=String(token);
    return write(CONNECTION,value);
  }
  function loadConnection() {
    const v=read(CONNECTION);
    if(!v||typeof v!=="object")return null;
    return {repo:typeof v.repo==="string"?v.repo:"",branch:typeof v.branch==="string"?v.branch:"",
      token:typeof v.token==="string"&&v.token?v.token:null};
  }
  function forgetToken() {
    const v=loadConnection();
    if(v)write(CONNECTION,{repo:v.repo,branch:v.branch});
  }
  function hasToken(){return !!loadConnection()?.token;}

  // ── Drafts ──
  // One draft per conversation: the outline document as it would be saved,
  // plus the remote outline SHA it was based on, so a newer remote version can be detected.
  function draftKey(scope,id){return DRAFT+String(scope||"local")+"|"+String(id||"");}
  function saveDraft(scope,id,draft) {
    const key=draftKey(scope,id);
    if(write(key,draft))return true;
    // Storage full: drop the oldest drafts and try once more.
    const all=keys(DRAFT).filter(k=>k!==key).map(k=>({k,at:read(k)?.saved_at||""})).sort((a,b)=>a.at.localeCompare(b.at));
    for(const item of all.slice(0,Math.max(1,all.length-MAX_DRAFTS+1)))remove(item.k);
    return write(key,draft);
  }
  function loadDraft(scope,id) {
    const d=read(draftKey(scope,id));
    return d&&typeof d==="object"&&d.outline&&typeof d.outline==="object"?d:null;
  }
  function dropDraft(scope,id){remove(draftKey(scope,id));}
  function draftCount(){return keys(DRAFT).length;}

  // Erase everything this app stored on the device.
  function forgetAll(){for(const k of keys(PREFIX))remove(k);}

  root.ATDevice={available,saveConnection,loadConnection,forgetToken,hasToken,
    saveDraft,loadDraft,dropDraft,draftCount,forgetAll};
})(typeof window!=="undefined"?window:globalThis);
