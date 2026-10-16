export const REPOSITORY = 'uppkb-guyangan/uppkb-guyangan.github.io';
export const DEVELOPMENT_REF = 'feature/gita-developer-mode-v1';
export const WORKFLOW = 'gita-developer.yml';
export const SCOPES = ['aplikasi','gita','pwa','blanko','persidangan','analitik','simulasi'];
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function validateCommand(body) {
  if (!body || Object.keys(body).some(k => !['operation','action','scope','request_id','confirmed'].includes(k)) ||
      !UUID.test(body.request_id || '')) return null;
  if (body.operation === 'status') return {operation:'status',request_id:body.request_id};
  if (body.operation !== 'start' || body.confirmed !== true || !['audit','fix'].includes(body.action) || !SCOPES.includes(body.scope)) return null;
  return {operation:'start', request_id:body.request_id, action:body.action, scope:body.scope};
}
