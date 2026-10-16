import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { BASE, REPO, taskInput, validateProposal, sourceFile } from './policy.mjs';
export async function publishDraft({root,data,baseSha,token,fetcher=fetch}) {
  const task=taskInput(data.task);
  if(!/^[a-f0-9]{40}$/.test(baseSha)||!token)throw new Error('PUBLISH_CONFIG');
  const updates=validateProposal(root,task,data.proposal);
  if(!updates.size)return {state:'no_changes'};
  if(task.action!=='fix')throw new Error('FIX_ONLY');
  const branch='gita/dev/'+task.request_id;
  async function api(path,body){
    const r=await fetcher(`https://api.github.com/repos/${REPO}/${path}`,{
      method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},
      ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
    if(!r.ok)throw new Error('DRAFT_PUBLISH_FAILED');
    return r.json();
  }
  // A new ref only. Never update an existing ref, merge, or invoke deployment.
  let targetBase=BASE;
  if(task.scope==='simulasi'){
    const original=await api('git/commits/'+baseSha);
    const brokenTree=await api('git/trees',{base_tree:original.tree.sha,tree:[{path:'scripts/fixtures/gita-simulation.mjs',mode:'100644',type:'blob',content:sourceFile(root,'scripts/fixtures/gita-simulation.mjs')}]});
    const broken=await api('git/commits',{message:'GITA synthetic regression (disconnected fixture)',tree:brokenTree.sha,parents:[baseSha]});
    targetBase='gita/simulation/'+task.request_id;
    await api('git/refs',{ref:'refs/heads/'+targetBase,sha:broken.sha});
    baseSha=broken.sha;
  }
  const base=await api('git/commits/'+baseSha);
  const tree=await api('git/trees',{base_tree:base.tree.sha,tree:[...updates].map(([path,content])=>({path,mode:'100644',type:'blob',content}))});
  const commit=await api('git/commits',{message:`GITA: ${task.scope} fix (${task.request_id})`,tree:tree.sha,parents:[baseSha]});
  await api('git/refs',{ref:'refs/heads/'+branch,sha:commit.sha});
  const pr=await api('pulls',{title:`GITA: perbaikan ${task.scope}`,head:branch,base:targetBase,draft:true,
    body:`Perbaikan atas permintaan ${task.request_id}.\n\nRuang lingkup: ${task.scope}. Pengujian otomatis berhasil sebelum publikasi.\n\nWajib review manusia. Tidak ada merge atau deployment otomatis. Temuan AI tersedia di artefak workflow; jangan anggap keluaran AI sebagai bukti kebenaran.`});
  return {state:'draft_created',pr_url:pr.html_url};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const data=JSON.parse(readFileSync('/tmp/gita-proposal.json','utf8'));
    const expected=taskInput({request_id:process.env.GITA_REQUEST_ID,action:process.env.GITA_ACTION,scope:process.env.GITA_SCOPE});
    if(JSON.stringify(data.task)!==JSON.stringify(expected))throw new Error('TASK_MISMATCH');
    const result=await publishDraft({root:process.cwd(),data,baseSha:process.env.GITA_BASE_SHA,token:process.env.GITHUB_TOKEN});
    console.log(JSON.stringify(result));
  }catch{console.error('GITA draft publication failed. No merge or deployment performed.');process.exitCode=1;}
}
