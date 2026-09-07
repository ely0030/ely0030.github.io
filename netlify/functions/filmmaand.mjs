export default async function(request,context){const mod=await import(new URL('../../filmmaand-server/handler.mjs',import.meta.url).href);return mod.default(request,context)}
export const config={path:['/filmmaand','/filmmaand/','/filmmaand/api/*','/filmmaand/films/','/filmmaand/films/index.html','/filmmaand/stemmen/','/filmmaand/stemmen/index.html'],preferStatic:false};
