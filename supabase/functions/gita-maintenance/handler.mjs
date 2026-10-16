import { HttpError } from '../_shared/gita-auth.mjs';
import { validateCommand } from './policy.mjs';
export function createMaintenanceHandler({authorize, allowedUids, origin, enabled, ledger, github}) {
  return async req => {
    const headers = {'Content-Type':'application/json', 'Cache-Control':'no-store', 'Vary':'Origin',
      'Access-Control-Allow-Origin':origin, 'Access-Control-Allow-Headers':'authorization, apikey, content-type',
      'Access-Control-Allow-Methods':'POST, OPTIONS', 'X-Content-Type-Options':'nosniff'};
    const reply = (data,status=200) => new Response(JSON.stringify(data),{status,headers});
    if (req.headers.get('origin') && req.headers.get('origin') !== origin) return reply({error:'FORBIDDEN_ORIGIN'},403);
    if (req.method === 'OPTIONS') return new Response(null,{status:204,headers});
    if (req.method !== 'POST') return reply({error:'METHOD_NOT_ALLOWED'},405);
    try {
      const actor = await authorize(req,{developer:true,allowedUids});
      if (!enabled) throw new HttpError(503,'DEVELOPER_MODE_NOT_CONFIGURED');
      const text = await req.text();
      if (text.length > 2048) throw new HttpError(413,'REQUEST_TOO_LARGE');
      let body; try { body = JSON.parse(text); } catch { throw new HttpError(400,'INVALID_COMMAND'); }
      const command = validateCommand(body);
      if (!command) throw new HttpError(400,'INVALID_COMMAND');
      if (command.operation === 'status') {
        const job = await ledger.get(actor.uid,command.request_id);
        if (!job) throw new HttpError(404,'JOB_NOT_FOUND');
        if (job.state === 'dispatch_failed') return reply({success:true,request_id:job.request_id,state:'dispatch_failed'});
        const result = await github.status(job);
        return reply({success:true,request_id:job.request_id,...result});
      }
      const job = await ledger.claim(actor.uid,command);
      if (!job.fresh) return reply({success:true,request_id:command.request_id,state:job.state || 'queued'},202);
      try { await github.dispatch(command); }
      catch {
        // A network timeout may have accepted the dispatch. Never retry implicitly.
        await ledger.failed(actor.uid,command.request_id);
        throw new HttpError(502,'DISPATCH_UNCERTAIN_CHECK_GITHUB');
      }
      return reply({success:true,request_id:command.request_id,state:'queued'},202);
    } catch (e) {
      const known = e instanceof HttpError;
      return reply({success:false,error:known ? e.message : 'SERVICE_UNAVAILABLE'},known ? e.status : 503);
    }
  };
}
