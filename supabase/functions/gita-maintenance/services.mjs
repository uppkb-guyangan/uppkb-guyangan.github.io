import { HttpError } from '../_shared/gita-auth.mjs';
import { REPOSITORY, DEVELOPMENT_REF, WORKFLOW } from './policy.mjs';
export function createServices({supabaseUrl,serviceKey,githubToken,fetcher=fetch}) {
  async function db(path,options={}) {
    const r=await fetcher(supabaseUrl+'/rest/v1/'+path,{...options,
      headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(10000)});
    if(!r.ok){
      const error=await r.json().catch(()=>({}));
      if(error.message==='RATE_LIMITED')throw new HttpError(429,'RATE_LIMITED');
      if(error.message==='REQUEST_CONFLICT')throw new HttpError(409,'REQUEST_CONFLICT');
      throw new HttpError(503,'LEDGER_UNAVAILABLE');
    }
    return r.status===204?null:r.json();
  }
  async function gh(path,options={}) {
    const r=await fetcher('https://api.github.com/repos/'+REPOSITORY+'/'+path,{...options,
      headers:{Authorization:'Bearer '+githubToken,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},signal:AbortSignal.timeout(15000)});
    if(!r.ok)throw new HttpError(502,'GITHUB_UNAVAILABLE');
    return r.status===204?null:r.json();
  }
  return {
    ledger:{
      claim:(uid,c)=>db('rpc/gita_claim_developer_job',{method:'POST',body:JSON.stringify({p_uid:uid,p_id:c.request_id,p_action:c.action,p_scope:c.scope})}),
      get:async(uid,id)=>(await db('gita_developer_jobs?'+new URLSearchParams({select:'request_id,action,scope,state,created_at',actor_uid:'eq.'+uid,request_id:'eq.'+id,limit:'1'})))?.[0],
      failed:(uid,id)=>db('gita_developer_jobs?'+new URLSearchParams({actor_uid:'eq.'+uid,request_id:'eq.'+id}),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({state:'dispatch_uncertain'})})
    },
    github:{
      dispatch:c=>gh('actions/workflows/'+WORKFLOW+'/dispatches',{method:'POST',body:JSON.stringify({ref:DEVELOPMENT_REF,inputs:{request_id:c.request_id,action:c.action,scope:c.scope}})}),
      status:async job=>{
        const runs=await gh('actions/workflows/'+WORKFLOW+'/runs?'+new URLSearchParams({branch:DEVELOPMENT_REF,event:'workflow_dispatch',per_page:'100'}));
        const run=runs.workflow_runs?.find(r=>r.display_title===`GITA ${job.request_id}`);
        if(!run)return {state:job.state==='dispatch_uncertain'?'dispatch_uncertain':'queued'};
        const result={state:run.status==='completed'?(run.conclusion==='success'?'completed':'failed'):run.status,run_url:run.html_url};
        if(run.conclusion==='success'&&job.action==='fix'){
          const prs=await gh('pulls?'+new URLSearchParams({state:'open',head:'uppkb-guyangan:gita/dev/'+job.request_id,base:job.scope==='simulasi'?'gita/simulation/'+job.request_id:DEVELOPMENT_REF}));
          const pr=prs.find(p=>p.draft===true);
          if(pr)result.pr_url=pr.html_url;
        }
        return result;
      }
    }
  };
}
