import {mkdir,readFile,writeFile,stat,rename} from 'node:fs/promises';
import {join} from 'node:path';import {createHash,randomUUID} from 'node:crypto';import {spawn} from 'node:child_process';import {fileURLToPath} from 'node:url';
const error=()=>Object.assign(Error('Kies een geldige JPG-, PNG- of WebP-afbeelding.'),{status:400,code:'image'});
export function createImageStore(directory){let active=0;return {
 async put(actor,data){if(typeof data!=='string'||data.length>740000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(data))throw error();const input=Buffer.from(data.split(',')[1],'base64');if(input.length>550000)throw error();if(active>=2)throw Object.assign(error(),{status:503});active++;
 let bytes;try{bytes=await new Promise((resolve,reject)=>{const p=spawn('python3',[fileURLToPath(new URL('./normalize-image.py',import.meta.url))],{stdio:['pipe','pipe','ignore']});let chunks=[],size=0;const timer=setTimeout(()=>p.kill(),10000);p.on('error',()=>{clearTimeout(timer);reject(error())});p.stdout.on('data',b=>{size+=b.length;if(size>1000000)p.kill();else chunks.push(b)});p.on('close',code=>{clearTimeout(timer);code===0&&size?resolve(Buffer.concat(chunks)):reject(error())});p.stdin.on('error',()=>{});p.stdin.end(input)});}finally{active--}
 const id=createHash('sha256').update(bytes).digest('hex');await mkdir(join(directory,'owners',actor),{recursive:true});const temporary=join(directory,id+'.'+randomUUID()+'.tmp');await writeFile(temporary,bytes);await rename(temporary,join(directory,id+'.webp'));await writeFile(join(directory,'owners',actor,id),'');return {id,url:'/planning-api/images/'+id+'.webp'};
 },
 async owned(actor,id){if(!/^[a-f0-9]{64}$/.test(id||''))return false;try{await stat(join(directory,'owners',actor,id));await stat(join(directory,id+'.webp'));return true}catch{return false}},
 async get(id){if(!/^[a-f0-9]{64}$/.test(id))return null;try{return await readFile(join(directory,id+'.webp'))}catch{return null}}
};}
