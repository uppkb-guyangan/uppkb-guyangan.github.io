import { readFileSync, lstatSync } from 'node:fs';
import { resolve, relative } from 'node:path';
export const BASE = 'feature/gita-developer-mode-v1';
export const REPO = 'uppkb-guyangan/uppkb-guyangan.github.io';
export const filesByScope = {
  aplikasi:['gita-agent-ui.js','gita-maintenance-intent.mjs','sw.js','pwa.js','court-enhancement.js','analytics-drilldown.js','gsmart-report-excel.mjs','app-v2.js'],
  gita:['gita-agent-ui.js','gita-maintenance-intent.mjs','gita-developer-ui.mjs'],
  pwa:['sw.js','pwa.js','gsmart-web-push.js'],
  blanko:['app-v2.js'],persidangan:['court-enhancement.js','app-v2.js'],
  analitik:['analytics-drilldown.js','gsmart-report-excel.mjs'],
  simulasi:['scripts/fixtures/gita-simulation.mjs']
};
export function taskInput(input) {
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(input.request_id||'') ||
     !['audit','fix'].includes(input.action)||!Object.hasOwn(filesByScope,input.scope))throw new Error('INVALID_TASK');
  return {request_id:input.request_id,action:input.action,scope:input.scope};
}
export function sourceFile(root,path) {
  const full=resolve(root,path);
  if(relative(resolve(root),full).startsWith('..')||lstatSync(full).isSymbolicLink()||!lstatSync(full).isFile())throw new Error('UNSAFE_FILE');
  return readFileSync(full,'utf8');
}
export function redactSource(text) {
  return text.replace(/^const demo=.*$/gm,'/* synthetic demo fixture omitted */').replace(/AIza[A-Za-z0-9_-]{30,}/g,'[REDACTED_WEB_KEY]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[REDACTED_JWT]')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,'[REDACTED_EMAIL]');
}
export function validateProposal(root,input,proposal) {
  const task=taskInput(input);
  if(!proposal||!Array.isArray(proposal.edits)||proposal.edits.length>3||!Array.isArray(proposal.findings)||proposal.findings.length>10)throw new Error('INVALID_PROPOSAL');
  if(task.action==='audit'&&proposal.edits.length)throw new Error('AUDIT_CANNOT_EDIT');
  if(proposal.findings.some(f=>typeof f!=='string'||f.length>1000))throw new Error('INVALID_FINDING');
  const updates=new Map();let changed=0;
  for(const edit of proposal.edits){
    if(!filesByScope[task.scope].includes(edit.path)||typeof edit.before!=='string'||!edit.before||typeof edit.after!=='string'||edit.before===edit.after)throw new Error('UNSAFE_EDIT');
    changed+=edit.before.length+edit.after.length;
    if(changed>16000||/-----BEGIN .*PRIVATE KEY|gh[pousr]_[A-Za-z0-9_]{20,}|sb_secret_|AIza[A-Za-z0-9_-]{30,}/.test(edit.after))throw new Error('UNSAFE_EDIT');
    const source=updates.get(edit.path)??sourceFile(root,edit.path);
    if(source.split(edit.before).length!==2)throw new Error('EDIT_MUST_MATCH_EXACTLY_ONCE');
    // An edit cannot introduce external hosts. Sensitive changes still require human review.
    const oldHosts=new Set([...source.matchAll(/https?:\/\/[^\s'"`<>]+/g)].map(m=>m[0]));
    if([...edit.after.matchAll(/https?:\/\/[^\s'"`<>]+/g)].some(m=>!oldHosts.has(m[0])))throw new Error('NEW_EXTERNAL_URL');
    updates.set(edit.path,source.replace(edit.before,()=>edit.after));
  }
  return updates;
}
export function sourceSnapshot(root,task) {
  let remaining=100000;
  return filesByScope[task.scope].map(path=>{
    const source=redactSource(sourceFile(root,path));
    let content=source;
    if(source.length>60000){
      // Explicit excerpts: never pretend a partial module is a complete audit.
      const term=task.scope==='persidangan'?/court|sidang/ig:task.scope==='blanko'?/blanko/ig:/function /ig;
      const ranges=[];for(const match of source.matchAll(term)){
        const start=Math.max(0,match.index-1000),end=Math.min(source.length,match.index+2000);
        if(ranges.length&&start<=ranges.at(-1)[1])ranges.at(-1)[1]=end;else ranges.push([start,end]);
      }
      content=ranges.map(([a,b])=>`\n/* excerpt at ${a} */\n`+source.slice(a,b)).join('').slice(0,60000);
    }
    content=content.slice(0,remaining);remaining-=content.length;
    return {path,partial:content.length!==source.length,content};
  });
}
