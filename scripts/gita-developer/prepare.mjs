import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { taskInput, validateProposal } from './policy.mjs';
const input=taskInput({request_id:process.env.GITA_REQUEST_ID,action:process.env.GITA_ACTION,scope:process.env.GITA_SCOPE});
if(input.scope==='simulasi'&&process.argv[2]==='inject'){
  writeFileSync('scripts/fixtures/gita-simulation.mjs',"export function simulationStatus(value) { return String(value ?? ''); }\n");
  const result=spawnSync(process.execPath,['--test','scripts/gita-simulation.test.mjs'],{stdio:'ignore'});
  if(result.status!==1)throw new Error('SIMULATION_MUST_FAIL_BEFORE_FIX');
  console.log('Synthetic bug reproduced: expected regression test failure.');
}else if(process.argv[2]==='apply'){
  const data=JSON.parse(readFileSync('/tmp/gita-proposal.json','utf8'));
  if(JSON.stringify(data.task)!==JSON.stringify(input))throw new Error('TASK_MISMATCH');
  const updates=validateProposal(process.cwd(),input,data.proposal);
  for(const [path,content] of updates)writeFileSync(path,content);
  console.log(`Validated ${updates.size} candidate file(s).`);
}
