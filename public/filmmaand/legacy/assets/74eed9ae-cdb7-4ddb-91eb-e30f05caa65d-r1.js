/* Filmmaand photographic studies. Plain WebGL + DOM, no dependencies. */
(() => {
'use strict';
const mounts=new WeakMap();
const vs=`attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}`;
const fs=`precision mediump float;
varying vec2 uv;uniform sampler2D first,second;uniform vec2 cropA,cropB,size;uniform float angle,progress,mode,alternate;
vec3 sampleA(vec2 p){return texture2D(first,clamp((p-.5)*cropA+.5,.001,.999)).rgb;}
vec3 sampleB(vec2 p){p=alternate>.5?p:(p-.5)*.78+.5+vec2(.075,0.);return texture2D(second,clamp((p-.5)*cropB+.5,.001,.999)).rgb;}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
void main(){vec2 p=vec2(uv.x,1.-uv.y);vec3 col;
if(mode<.5){
 float ridge=sin(p.x*size.x/3.4*6.28318);
 float viewing=(angle-.5)*2.;
 // Across a broad print, each rib sees a slightly different incident angle.
 float field=viewing*1.15+(p.x-.5)*.30+sin(p.y*3.4)*.026;
 float blend=smoothstep(-.18,.18,field+ridge*.055);
 vec2 lens=p+vec2(ridge*.0018+viewing*.005,0.);
 col=mix(sampleA(lens),sampleB(lens),blend);
 col*=.965+ridge*.026;
 float spec=pow(max(cos(p.x*size.x/3.4*6.28318-.8),0.),12.);
 col+=spec*.036;
 float sweep=exp(-pow((p.x-.5-viewing*.8+p.y*.19)*9.,2.));
 col=mix(col,vec3(.96,.97,1.),sweep*.11);
}else{
 vec3 source=sampleA(p);float silver=dot(source,vec3(.299,.587,.114));
 vec3 developed=mix(vec3(silver)*vec3(.91,.94,.92),source,.16);
 float islands=noise(p*4.7)*.52+noise(p*13.3)*.29+noise(p*39.)*.12+noise(p*109.)*.07;
 float wetFront=islands*.48 + p.y*.12 + silver*.22;
 float emergence=smoothstep(wetFront,wetFront+.20,progress*1.15-.08);
 float density=smoothstep(.04,.95,progress);
 vec3 paper=vec3(.91,.887,.818);
 col=mix(paper,mix(paper,developed,.3+.7*density),emergence);
 col+=(hash(gl_FragCoord.xy)-.5)*.014;
 // A broad liquid reflection, moved by tray tilt; no rings or idle oscillation.
 float sheen=exp(-pow((p.x+p.y*.37-.48-(angle-.5)*.5)*4.5,2.));
 col=mix(col,vec3(.96,.95,.89),sheen*.055);
}
gl_FragColor=vec4(col,1.);}`;
function mount(host,options={},dark=false){
 if(!(host instanceof HTMLElement))throw new TypeError('A host element is required');mounts.get(host)?.();
 const root=document.createElement('div');root.className='ps-study '+(dark?'ps-darkroom':'ps-lenticular');
 const scene=document.createElement('div');scene.className='ps-scene';
 const paper=document.createElement('div');paper.className='ps-paper';
 const a=new Image(),b=new Image();a.className='ps-image ps-image-a';b.className='ps-image ps-image-b';a.alt=options.alt||'Fotografische beeldstudie';b.alt='';b.setAttribute('aria-hidden','true');if(!options.alternateSrc)b.style.transform='scale(1.28) translateX(-7.5%)';
 const canvas=document.createElement('canvas');canvas.className='ps-canvas';canvas.setAttribute('aria-hidden','true');paper.append(a,b,canvas);scene.append(paper);
 const bar=document.createElement('div');bar.className='ps-controls';const label=document.createElement('span');label.className='ps-status';label.setAttribute('role','status');
 const control=document.createElement(dark?'button':'input');
 if(dark){control.type='button';control.textContent='Ontwikkel de foto';label.textContent='Onbelicht papier';}
 else{control.type='range';control.min='0';control.max='100';control.value='15';control.step='1';control.setAttribute('aria-label','Kijkhoek van de lenticulaire print');label.textContent='Beeld I';}
 bar.append(control,label);root.append(scene,bar);host.append(root);
 let gl,program,buffer,raf=0,dead=false,ready=false,visible=true,loaded=0,angle=.15,target=.15,progress=0,developing=false,lastTime=0;
 const textures=[],shaders=[],listeners=[];const mq=matchMedia('(prefers-reduced-motion: reduce)');
 function on(el,name,fn,opts){el.addEventListener(name,fn,opts);listeners.push(()=>el.removeEventListener(name,fn,opts));}
 function wake(){if(!dead&&visible&&!document.hidden&&!raf){lastTime=performance.now();raf=requestAnimationFrame(frame);}}
 function setAngle(value){target=Math.max(0,Math.min(1,value));if(!dark){control.value=String(Math.round(target*100));label.textContent=target<.38?'Beeld I':target>.62?'Beeld II':'Tussen twee beelden';}wake();}
 function fallback(){ready=false;root.classList.remove('ps-ready');root.classList.add('ps-fallback');canvas.hidden=true;wake();}
 function resize(){root.classList.remove('ps-ready');const r=paper.getBoundingClientRect();const d=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.max(1,Math.round(r.width*d));canvas.height=Math.max(1,Math.round(r.height*d));wake();}
 function status(){if(progress>=1){developing=false;label.textContent='Ontwikkeld';control.textContent='Nieuwe afdruk';}else if(developing){label.textContent='De foto ontwikkelt…';control.textContent='Begin opnieuw';}else{label.textContent='Onbelicht papier';control.textContent='Ontwikkel de foto';}}
 function frame(now){raf=0;if(dead||!visible||document.hidden)return;const dt=Math.min((now-lastTime)/1000,.06);lastTime=now;
  angle+=(target-angle)*(mq.matches?1:.13);if(developing)progress=mq.matches?1:Math.min(1,progress+dt/9);
  if(dark&&progress>=1&&developing)status();
  root.style.setProperty('--ps-angle',String(angle));root.style.setProperty('--ps-progress',String(progress));
  root.style.setProperty('--ps-tilt',((angle-.5)*2.4)+'deg');
  if(dark){a.style.clipPath=`polygon(0 0,100% 0,100% ${Math.min(100,progress*150)}%,74% ${Math.min(100,progress*130)}%,43% ${Math.min(100,progress*160)}%,0 ${Math.min(100,progress*145)}%)`;a.style.filter=`grayscale(1) sepia(.18) contrast(${.5+progress*.5})`;}
  else b.style.opacity=String(Math.max(0,Math.min(1,(angle-.35)/.3)));
  if(ready){gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(program);const r=canvas.width/canvas.height;
   for(const [name,img] of [['cropA',a],['cropB',b]]){const ir=img.naturalWidth/img.naturalHeight;gl.uniform2f(gl.getUniformLocation(program,name),r>ir?1:r/ir,r>ir?ir/r:1);}
   gl.uniform2f(gl.getUniformLocation(program,'size'),paper.clientWidth,paper.clientHeight);gl.uniform1f(gl.getUniformLocation(program,'angle'),angle);gl.uniform1f(gl.getUniformLocation(program,'progress'),progress);gl.uniform1f(gl.getUniformLocation(program,'mode'),dark?1:0);gl.uniform1f(gl.getUniformLocation(program,'alternate'),options.alternateSrc?1:0);
   gl.drawArrays(gl.TRIANGLES,0,6);root.classList.add('ps-ready');
  }
  if(developing||Math.abs(target-angle)>.0002)raf=requestAnimationFrame(frame);
 }
 function init(){if(dead||++loaded<2)return;
  try{gl=canvas.getContext('webgl',{alpha:false,antialias:false});if(!gl)throw Error('WebGL unavailable');program=gl.createProgram();
   for(const [type,source] of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){const s=gl.createShader(type);shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(program,s);}
   gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
   buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const p=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);
   [a,b].forEach((img,i)=>{const t=gl.createTexture();textures.push(t);gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);gl.uniform1i(gl.getUniformLocation(program,i?'second':'first'),i);});
   ready=true;resize();
  }catch(error){root.dataset.fallbackReason=error.name;fallback();}
 }
 on(scene,'pointermove',e=>{if(e.pointerType==='mouse'||e.buttons){const r=scene.getBoundingClientRect();setAngle((e.clientX-r.left)/r.width);}},{passive:true});
 on(scene,'pointerdown',e=>{const r=scene.getBoundingClientRect();setAngle((e.clientX-r.left)/r.width);},{passive:true});
 if(dark)on(control,'click',()=>{if(developing||progress>=1){progress=0;developing=false;}else{developing=true;progress=0;}status();wake();});
 else on(control,'input',()=>setAngle(Number(control.value)/100));
 on(mq,'change',()=>{if(mq.matches&&developing){progress=1;status();}wake();});on(document,'visibilitychange',wake);
 on(canvas,'webglcontextlost',e=>{e.preventDefault();fallback();});
 const ro=new ResizeObserver(resize);ro.observe(paper);const io=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;wake();});io.observe(root);
 [a,b].forEach((img,i)=>{img.crossOrigin='anonymous';img.onload=init;img.onerror=()=>{fallback();img.onload=null;img.onerror=()=>{root.classList.add('ps-image-error');label.textContent='Beeld niet beschikbaar';control.disabled=true;};img.removeAttribute('crossorigin');img.src=i?(options.alternateSrc||options.src):options.src;};if(options.src)img.src=i?(options.alternateSrc||options.src):options.src;});
 if(!options.src){fallback();root.classList.add('ps-image-error');label.textContent='Beeld niet beschikbaar';control.disabled=true;}
 function cleanup(){if(dead)return;dead=true;cancelAnimationFrame(raf);ro.disconnect();io.disconnect();listeners.forEach(f=>f());a.onload=a.onerror=b.onload=b.onerror=null;if(gl){textures.forEach(t=>gl.deleteTexture(t));shaders.forEach(s=>gl.deleteShader(s));if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();}root.remove();if(mounts.get(host)===cleanup)mounts.delete(host);}
 mounts.set(host,cleanup);return cleanup;
}
window.mountLenticularPrint=(host,options)=>mount(host,options,false);
window.mountDarkroomTray=(host,options)=>mount(host,options,true);
})();
