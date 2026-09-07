import {getStore} from '@netlify/blobs';
// SDK11 treats some failed writes as modified:true. Never acknowledge a non-successful transport response.
export const checkedFetch=async(...args)=>{const r=await fetch(...args),method=String(args[1]?.method||args[0]?.method||'GET').toUpperCase(),missing=r.status===404&&['GET','HEAD','DELETE'].includes(method);if(!r.ok&&!missing&&r.status!==412)throw Object.assign(Error('Durable storage request failed'),{status:503,code:'storage_unavailable'});return r};
export function stateStore(options={}){return getStore({name:'filmmaand-state-v1',consistency:'strong',fetch:checkedFetch,...options})}
export function imageStore(options={}){return getStore({name:'filmmaand-images-v1',consistency:'strong',fetch:checkedFetch,...options})}
