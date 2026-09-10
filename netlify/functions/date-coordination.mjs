// Match the API entrypoint: retain package resolution beside the backend's own dependencies.
export default async function(request,context){const mod=await import(new URL('../../filmmaand-server/handler.mjs',import.meta.url).href);return mod.coordinationScheduled(context);}
export const config={schedule:'* * * * *'};
