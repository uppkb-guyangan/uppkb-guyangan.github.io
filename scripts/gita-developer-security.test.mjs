import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createFirebaseAuthorizer } from '../supabase/functions/_shared/gita-auth.mjs';
import { createMaintenanceHandler } from '../supabase/functions/gita-maintenance/handler.mjs';
import { createServices } from '../supabase/functions/gita-maintenance/services.mjs';
import { validateCommand } from '../supabase/functions/gita-maintenance/policy.mjs';
import { validateProposal, BASE } from './gita-developer/policy.mjs';
import { runAgent } from './gita-developer/agent.mjs';
import { publishDraft } from './gita-developer/publish.mjs';
const id='12345678-1234-4234-8234-123456789abc';
const task={request_id:id,action:'fix',scope:'simulasi'};
const origin='https://uppkb-guyangan.github.io';
const now=Date.now(),seconds=Math.floor(now/1000);
const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'test-key'};
const b64=x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url');
async function signed(overrides={},header={}){
  const head=b64({alg:'RS256',kid:'test-key',...header});
  const body=b64({aud:'test-project',iss:'https://securetoken.google.com/test-project',sub:'test-admin',iat:seconds-5,exp:seconds+300,auth_time:seconds-10,...overrides});
  const signature=Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(head+'.'+body))).toString('base64url');
  return head+'.'+body+'.'+signature;
}
const token=await signed();
const json=(body,status=200)=>new Response(JSON.stringify(body),{status});
function identity({role='ADMIN',active=true,disabled=false,validSince=0,profileStatus=200}={}){
  const calls=[];
  const authorize=createFirebaseAuthorizer({projectId:'test-project',apiKey:'public-web-key',now:()=>now,fetcher:async(url,options)=>{
    calls.push({url,options});
    if(url.includes('/jwk/'))return json({keys:[jwk]});
    if(url.includes('accounts:lookup'))return json({users:[{localId:'test-admin',disabled,validSince}]});
    if(url.includes('firestore'))return json({fields:{role:{stringValue:role},aktif:{booleanValue:active}}},profileStatus);
    throw new Error('UNEXPECTED_NETWORK');
  }});
  return {authorize,calls};
}
const request=(body,t=token)=>new Request('https://staging.invalid/gita-maintenance',{method:'POST',headers:{origin,authorization:'Bearer '+t,'content-type':'application/json'},body:JSON.stringify(body)});
test('real RSA-signed Firebase token, live role and owner allowlist are required',async()=>{
  const {authorize}=identity();
  assert.equal((await authorize(request({}),{developer:true,allowedUids:['test-admin']})).role,'ADMIN');
  await assert.rejects(authorize(request({}),{developer:true,allowedUids:[]}),e=>e.status===403);
  for(const opts of [{role:'USER'},{active:false},{role:'ADMIN',disabled:true},{validSince:seconds}]){
    await assert.rejects(identity(opts).authorize(request({}),{developer:true,allowedUids:['test-admin']}));
  }
  assert.equal((await identity({role:'WASATPEL'}).authorize(request({}),{developer:true,allowedUids:['test-admin']})).role,'WASATPEL');
});
test('rejects tampering, public keys, expired tokens, wrong issuer/audience and future timestamps before profile lookup',async()=>{
  const bad=[token.slice(0,-12)+'AAAAAAAAAAAA','sb_publishable_public',await signed({exp:seconds}),await signed({aud:'other'}),await signed({iss:'https://attacker.invalid'}),await signed({iat:seconds+1}),await signed({auth_time:seconds+1}),await signed({}, {alg:'none'})];
  for(const t of bad){
    const {authorize,calls}=identity();
    await assert.rejects(authorize(request({},t)),e=>e.status===401);
    assert.equal(calls.filter(x=>x.url.includes('firestore')).length,0);
  }
});
test('only active users can use data assistant identity; developer permission is separate',async()=>{
  assert.equal((await identity({role:'USER'}).authorize(request({}))).role,'USER');
  await assert.rejects(identity({active:false}).authorize(request({})),e=>e.status===403);
  await assert.rejects(identity({profileStatus:403}).authorize(request({})),e=>e.status===403);
});
test('strict command schema excludes free text, operational data and client roles',()=>{
  const body={...task,operation:'start',confirmed:true};
  assert.ok(validateCommand(body));
  for(const extra of [{role:'ADMIN'},{question:'secret case'},{token:'x'},{scope:'../../main'},{confirmed:false},{request_id:'bad'}])assert.equal(validateCommand({...body,...extra}),null);
});
test('handler authenticates before dispatch; denies origin, missing confirmation and disabled mode',async()=>{
  let dispatches=0;
  const base={authorize:identity().authorize,allowedUids:['test-admin'],origin,enabled:true,ledger:{claim:async()=>({fresh:true})},github:{dispatch:async()=>dispatches++}};
  const handler=createMaintenanceHandler(base);
  assert.equal((await handler(request({...task,operation:'start',confirmed:false}))).status,400);
  const evil=new Request('https://staging.invalid',{method:'POST',headers:{origin:'https://evil.invalid'},body:'{}'});
  assert.equal((await handler(evil)).status,403);
  assert.equal((await handler(request({...task,operation:'start',confirmed:true},'fake'))).status,401);
  assert.equal((await createMaintenanceHandler({...base,enabled:false})(request({...task,operation:'start',confirmed:true}))).status,503);
  assert.equal(dispatches,0);
});
test('all simulated boundaries: identity -> dispatch -> AI proposal -> failing/passing test -> draft PR -> status',async()=>{
  const root=mkdtempSync(join(tmpdir(),'gita-e2e-'));
  try{
    mkdirSync(join(root,'scripts/fixtures'),{recursive:true});
    const fixture='scripts/fixtures/gita-simulation.mjs';
    const broken="export function simulationStatus(value) { return String(value ?? ''); }\n";
    writeFileSync(join(root,fixture),broken);
    writeFileSync(join(root,'scripts/gita-simulation.test.mjs'),readFileSync(new URL('./gita-simulation.test.mjs',import.meta.url)));
    const run=()=>spawnSync(process.execPath,['--test','scripts/gita-simulation.test.mjs'],{cwd:root,encoding:'utf8',env:{PATH:process.env.PATH}});
    assert.equal(run().status,1,'synthetic bug must fail first');
    let dispatches=0,job,dispatched,prBody;const calls=[];
    const ghFetch=async(url,opts={})=>{
      const body=opts.body?JSON.parse(opts.body):null;calls.push({url,body});
      if(url.endsWith('/dispatches')){dispatches++;dispatched=body;return new Response(null,{status:204});}
      if(url.includes('/runs?'))return json({workflow_runs:[{display_title:'GITA '+id,status:'completed',conclusion:'success',html_url:'https://github.com/uppkb-guyangan/uppkb-guyangan.github.io/actions/runs/1'}]});
      if(url.includes('/pulls?'))return json([{draft:true,html_url:'https://github.com/uppkb-guyangan/uppkb-guyangan.github.io/pull/999'}]);
      if(url.includes('/git/commits/')&&opts.method==='GET')return json({tree:{sha:'c'.repeat(40)}});
      if(url.endsWith('/git/trees'))return json({sha:'d'.repeat(40)});
      if(url.endsWith('/git/commits'))return json({sha:'e'.repeat(40)});
      if(url.endsWith('/git/refs'))return json({ref:body.ref});
      if(url.endsWith('/pulls')){prBody=body;return json({html_url:'https://github.com/uppkb-guyangan/uppkb-guyangan.github.io/pull/999'});}
      throw new Error('UNEXPECTED_NETWORK '+url);
    };
    const services=createServices({githubToken:'fake-token',fetcher:ghFetch});
    const ledger={claim:async(uid,c)=>{if(job)return {fresh:false,state:'queued'};job={...c,actor_uid:uid};return {fresh:true};},get:async(uid,key)=>uid===job.actor_uid&&key===id?job:null,failed:async()=>{}};
    const handler=createMaintenanceHandler({authorize:identity().authorize,allowedUids:['test-admin'],origin,enabled:true,ledger,github:services.github});
    const body={...task,operation:'start',confirmed:true};
    assert.equal((await handler(request(body))).status,202);
    assert.equal((await handler(request(body))).status,202);assert.equal(dispatches,1,'retry cannot double-dispatch');
    assert.equal(dispatched.ref,BASE);assert.equal(Object.hasOwn(dispatched.inputs,'question'),false);
    const result=await runAgent({root,input:task,apiKey:'fake-ai-key',model:'gemini-test',fetcher:async(url,opts)=>{
      assert.ok(url.startsWith('https://generativelanguage.googleapis.com/'));
      assert.equal(JSON.stringify(JSON.parse(opts.body)).includes('fake-token'),false);
      return json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({findings:['Synthetic normalization regression'],edits:[{path:fixture,before:"String(value ?? '')",after:"String(value ?? '').trim().toUpperCase()"}]})}]}}]});
    }});
    const updates=validateProposal(root,task,result.proposal);
    for(const [path,content]of updates)writeFileSync(join(root,path),content);
    assert.equal(run().status,0,'same regression passes after AI proposal');
    // Trusted publisher starts from the broken, disconnected simulation baseline.
    writeFileSync(join(root,fixture),broken);
    assert.equal((await publishDraft({root,data:result,baseSha:'b'.repeat(40),token:'fake-write-token',fetcher:ghFetch})).state,'draft_created');
    assert.equal(prBody.draft,true);assert.equal(prBody.base,'gita/simulation/'+id);assert.equal(prBody.head,'gita/dev/'+id);
    assert.ok(calls.filter(c=>c.url.endsWith('/git/refs')).every(c=>c.body.ref.startsWith('refs/heads/gita/')));
    assert.ok(calls.every(c=>!c.url.includes('/merges')&&!c.url.includes('/deployments')));
    const status=await(await handler(request({operation:'status',request_id:id}))).json();
    assert.equal(status.state,'completed');assert.ok(status.pr_url.endsWith('/999'));
    assert.equal((await handler(request({operation:'status',request_id:'12345678-1234-4234-8234-123456789abd'}))).status,404);
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('proposal guard forbids workflow/config/test/backend edits, path traversal, audit writes, duplicates and new hosts',()=>{
  const root=new URL('..',import.meta.url).pathname;
  for(const path of ['.github/workflows/gita-developer.yml','config.js','scripts/gita-simulation.test.mjs','supabase/functions/gita-maintenance/index.ts','../config.js']){
    assert.throws(()=>validateProposal(root,task,{findings:[],edits:[{path,before:'x',after:'y'}]}));
  }
  assert.throws(()=>validateProposal(root,{...task,action:'audit'},{findings:[],edits:[{path:'scripts/fixtures/gita-simulation.mjs',before:'String',after:'Fake'}]}));
  assert.throws(()=>validateProposal(root,task,{findings:[],edits:[{path:'scripts/fixtures/gita-simulation.mjs',before:'String',after:'https://exfil.invalid'}]}));
});
test('legacy GITA backend uses verified Firebase identity and user RLS without service role',()=>{
  const source=readFileSync(new URL('../supabase/functions/gita-agent/index.ts',import.meta.url),'utf8');
  assert.ok(source.indexOf('await authorizeGita(req)')<source.indexOf('const body =',source.indexOf('Deno.serve')));
  assert.match(source,/Authorization: "Bearer " \+ actor.token/);
  assert.doesNotMatch(source,/SUPABASE_SERVICE_ROLE_KEY|Access-Control-Allow-Origin": "\*"/);
  const ui=readFileSync(new URL('../gita-agent-ui.js',import.meta.url),'utf8');
  assert.match(ui,/Bearer \$\{session.token\}/);assert.doesNotMatch(ui,/Bearer \$\{key\}/);
});
