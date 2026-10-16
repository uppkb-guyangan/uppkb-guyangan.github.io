import { createFirebaseAuthorizer } from '../_shared/gita-auth.mjs';
import { createMaintenanceHandler } from './handler.mjs';
import { createServices } from './services.mjs';
const env = (name: string) => Deno.env.get(name) || '';
const services = createServices({supabaseUrl:env('SUPABASE_URL'),serviceKey:env('SUPABASE_SERVICE_ROLE_KEY'),githubToken:env('GITA_GITHUB_DISPATCH_TOKEN')});
Deno.serve(createMaintenanceHandler({
  authorize:createFirebaseAuthorizer({projectId:env('GITA_FIREBASE_PROJECT_ID'),apiKey:env('GITA_FIREBASE_WEB_API_KEY')}),
  allowedUids:env('GITA_DEVELOPER_UIDS').split(',').map(x=>x.trim()).filter(Boolean),
  origin:env('GITA_ALLOWED_ORIGIN') || 'https://uppkb-guyangan.github.io',
  enabled:env('GITA_DEVELOPER_ENABLED')==='true' && !!env('GITA_GITHUB_DISPATCH_TOKEN'),
  ...services
}));
