import {coordinationScheduled} from '../../filmmaand-server/handler.mjs';
export default async function(request,context){return coordinationScheduled(context);}
// Netlify invokes scheduled functions on published deploys, independently of visitors.
export const config={schedule:'* * * * *'};
