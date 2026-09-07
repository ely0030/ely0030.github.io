import sharp from 'sharp';
import {createHash} from 'node:crypto';
const invalid=()=>Object.assign(Error('Kies een geldige JPG-, PNG- of WebP-afbeelding.'),{status:400,code:'image'});
export function createImages(blobs,state){return {
 async put(actor,data){
  if(typeof data!=='string'||data.length>740000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(data))throw invalid();
  const input=Buffer.from(data.split(',')[1],'base64');if(input.length>550000)throw invalid();
  let bytes;try{const source=sharp(input,{limitInputPixels:20000000,animated:false});const meta=await source.metadata();if(!['jpeg','png','webp'].includes(meta.format))throw invalid();bytes=await source.rotate().resize({width:1200,height:1200,fit:'inside',withoutEnlargement:true}).webp({quality:84}).toBuffer();if(bytes.length>1000000)throw invalid()}catch{throw invalid()}
  const id=createHash('sha256').update(bytes).digest('hex');
  // Immutable content may be written twice after CAS retry. Ownership is committed with the plan document.
  await blobs.set(id,bytes,{onlyIfNew:true});
  (state.images.owners[actor]||={})[id]=true;
  return {id,url:'/filmmaand/api/images/'+id+'.webp'};
 },
 async owned(actor,id){if(!/^[a-f0-9]{64}$/.test(id||'')||!state.images.owners[actor]?.[id])return false;return Boolean(await blobs.getMetadata(id))},
 async get(id){if(!/^[a-f0-9]{64}$/.test(id||''))return null;const value=await blobs.get(id,{type:'arrayBuffer'});return value?Buffer.from(value):null}
}}
