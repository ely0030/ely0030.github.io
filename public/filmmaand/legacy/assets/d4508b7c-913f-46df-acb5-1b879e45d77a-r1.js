/* September jelly — self-contained WebGL material study. No external dependencies. */
(function () {
'use strict';
const vertex = `attribute vec2 position;varying vec2 uv;void main(){uv=position;gl_Position=vec4(position,0.,1.);}`;
const fragment = `precision highp float;
varying vec2 uv;uniform vec2 resolution;uniform vec3 spring;uniform vec2 grab;uniform float clock;
float capsule(vec3 p,vec3 a,vec3 b,float r){vec3 q=p-a,v=b-a;return length(q-v*clamp(dot(q,v)/dot(v,v),0.,1.))-r;}
float blend(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
vec3 deform(vec3 p){
 p.x-=spring.x*(.28+.72*smoothstep(-1.1,1.2,p.y));p.y-=spring.y*.55;
 float influence=exp(-1.4*dot(p.xy-grab,p.xy-grab));
 p.xy-=spring.xy*influence*.55;
 p.x/=1.+spring.z*.12;p.y*=1.+spring.z*.12;
 p.z+=spring.z*.2*sin(p.y*2.4+p.x*1.4);
 float angle=.10+spring.x*.11; p.xz=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*p.xz;
 p.z+=.045*sin(p.y*3.2+p.x*2.+clock*1.1)*spring.z;
 p.z+=.05*sin(p.x*3.1+p.y*2.6)+.024*sin(p.y*4.1-p.x*1.8);
 return p;
}
float field(vec3 p){p=deform(p);
 vec3 q=p-vec3(-.83,0.,0.);float zero=length(vec2((length(vec2(q.x,q.y*.70))-.58)*.94,q.z))-.285;
 q=p-vec3(.82,.43,0.);float nine=length(vec2(length(q.xy)-.49,q.z))-.29;
 float stem=capsule(p,vec3(1.29,.41,0.),vec3(.97,-.73,.01),.29);
 float foot=capsule(p,vec3(.97,-.73,.01),vec3(.55,-.94,.03),.29);
 return min(zero,blend(nine,blend(stem,foot,.28),.19));
}
vec3 normal(vec3 p){vec2 e=vec2(.0015,0.);return normalize(vec3(field(p+e.xyy)-field(p-e.xyy),field(p+e.yxy)-field(p-e.yxy),field(p+e.yyx)-field(p-e.yyx)));}
vec3 studio(vec3 d){
 vec3 c=mix(vec3(.10,.09,.09),vec3(.88,.91,.95),smoothstep(-.25,.9,d.y));
 float panel=smoothstep(.87,.90,dot(d,normalize(vec3(-.65,1.3,1.5))));
 float strip=smoothstep(.972,.985,dot(d,normalize(vec3(1.5,.45,1.6))));
 float longstrip=exp(-pow((d.x+.48)*29.,2.))*smoothstep(-.25,.3,d.y)*(1.-smoothstep(.45,.95,d.y));
 c+=vec3(2.5)*panel+vec3(3.2)*strip+vec3(1.8)*longstrip;
 c*=1.-.90*exp(-pow((d.x-.22)*7.,2.))*smoothstep(-.05,.3,d.y)*(1.-smoothstep(.55,.85,d.y));
 return c;
}
float shadow(vec3 p,vec3 light){float r=1.,t=.035;for(int i=0;i<28;i++){float h=field(p+light*t);r=min(r,3.5*h/t);t+=clamp(h,.025,.18);if(t>3.)break;}return clamp(r,.0,1.);}
void main(){
 vec2 screen=uv;screen.x*=resolution.x/resolution.y;
 float scale=resolution.x/resolution.y<1.15?1.13/(resolution.x/resolution.y):1.12;
 vec3 ro=vec3(0.,2.65,7.9),target=vec3(0.,-.07,0.);vec3 forward=normalize(target-ro),right=normalize(cross(forward,vec3(0.,1.,0.))),up=cross(right,forward);
 vec3 rd=normalize(forward*4.+right*screen.x*scale+up*screen.y*scale);
 vec3 light=normalize(vec3(-3.,5.,4.));float floorT=(-1.30-ro.y)/rd.y;
 vec3 bg=vec3(.976,.970,.953);vec3 col=bg;
 if(floorT>0.){vec3 fp=ro+rd*floorT;float s=shadow(fp,light);float contact=exp(-pow(fp.x/1.75,2.)-pow(fp.z/.70,2.))*.20;col*=1.-.23*(1.-s)-contact;
 float caustic=exp(-pow((fp.x-.18)/1.65,2.)-pow((fp.z+.18)/.48,2.));col+=vec3(.07,-.025,-.025)*caustic;
 }
 float t=0.;bool hit=false;for(int i=0;i<88;i++){float h=field(ro+rd*t);if(h<.0018){hit=true;break;}t+=h*.78;if(t>13.)break;}
 if(hit){vec3 p=ro+rd*t,n=normal(p),refl=reflect(rd,n),inside=refract(rd,n,1./1.39);
 float depth=.04;vec3 exitP=p+inside*depth;for(int j=0;j<36;j++){float h=field(exitP);if(h>0.)break;float stepD=clamp(abs(h)*.78,.008,.13);depth+=stepD;exitP=p+inside*depth;}
 vec3 backN=normal(exitP);vec3 outRay=refract(inside,-backN,1.39);if(length(outRay)<.1)outRay=reflect(inside,-backN);
 vec3 transmission=exp(-vec3(.025,3.5,3.0)*depth*1.45);
 vec3 through=mix(bg,studio(outRay),.25)*transmission;
 float internal=pow(1.-abs(dot(backN,inside)),2.);through=mix(through,vec3(.19,.002,.012),internal*.60);
 float fresnel=.035+.965*pow(1.-max(dot(n,-rd),0.),4.);
 float fold=pow(max(dot(reflect(inside,backN),normalize(vec3(.3,-.4,1.))),0.),5.);
 through*=1.-fold*.92;
 vec3 internalRay=reflect(inside,backN);
 float darkFold=exp(-pow((internalRay.y+internalRay.x*.52-.13)*3.8,2.));
 through*=1.-darkFold*.79;
 float litFold=exp(-pow((internalRay.y-internalRay.x*.55+.34)*8.,2.));
 through+=vec3(.43,.004,.025)*litFold*(1.-fresnel);
 through+=vec3(.24,.005,.018)*pow(max(0.,1.-abs(dot(n,-rd))),2.);
 col=mix(through,studio(refl),fresnel*.92);
 col+=vec3(.34,.002,.009)*pow(max(dot(n,light),0.),1.5)*.28;
 vec3 halfV=normalize(light-rd);col+=vec3(1.,.91,.86)*pow(max(dot(n,halfV),0.),155.)*.9;
 col+=studio(refl)*.10;
 col=col/(vec3(1.)+col*.30);
 }
 col=pow(max(col,vec3(0.)),vec3(.94));gl_FragColor=vec4(col,1.);
}`;
window.mountSeptemberJelly=function(host){
 if(!host||!host.appendChild)throw new TypeError('A host element is required');
 if(host.__septemberJelly)host.__septemberJelly();
 const root=document.createElement('div');root.className='september-jelly';
 root.innerHTML='<div class="jelly-fallback" aria-hidden="true">09</div><canvas class="jelly-canvas" aria-label="Interactieve rode gelei-sculptuur van het getal 09. Sleep om te vervormen, of druk op Enter." role="img" tabindex="0"></canvas><span class="jelly-hint">Pak vast. Laat los.</span>';
 host.appendChild(root);const canvas=root.querySelector('canvas');let gl,program,buffer,raf=0,disposed=false,visible=false,ready=false,active=null,last=0,elapsed=0,settle=0;
 const media=matchMedia('(prefers-reduced-motion: reduce)'),pos=[0,0,0],vel=[0,0,0],goal=[0,0,0],grab=[0,0],start=[0,0];let uniforms={};
 function fallback(){ready=false;root.classList.remove('jelly-ready');canvas.hidden=true;root.querySelector('.jelly-hint').hidden=true;}
 function compile(type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const err=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw Error(err);}return shader;}
 function init(){if(ready||disposed)return;try{
 gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power'});if(!gl)throw Error('WebGL unavailable');
 const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
 buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const attr=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);
 ['resolution','spring','grab','clock'].forEach(k=>uniforms[k]=gl.getUniformLocation(program,k));ready=true;canvas.hidden=false;root.classList.add('jelly-ready');resize();
 }catch(error){fallback();console.warn('September jelly fallback:',error.message);}}
 function resize(){if(!ready)return;const rect=root.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,1.5),factor=Math.min(1,1400/(rect.width*ratio));canvas.width=Math.max(1,Math.round(rect.width*ratio*factor));canvas.height=Math.max(1,Math.round(rect.height*ratio*factor));gl.viewport(0,0,canvas.width,canvas.height);wake();}
 function draw(now){raf=0;if(disposed||!ready||!visible||document.hidden)return;let dt=Math.min((now-last)/1000||.016,.033);last=now;elapsed+=dt;
 let energy=0;for(let i=0;i<3;i++){if(media.matches){pos[i]=goal[i];vel[i]=0;}else{vel[i]+=(goal[i]-pos[i])*115*dt;vel[i]*=Math.exp(-6.8*dt);pos[i]+=vel[i]*dt;}energy+=Math.abs(vel[i])+Math.abs(goal[i]-pos[i]);}
 gl.uniform2f(uniforms.resolution,canvas.width,canvas.height);gl.uniform3fv(uniforms.spring,pos);gl.uniform2fv(uniforms.grab,grab);gl.uniform1f(uniforms.clock,elapsed);gl.drawArrays(gl.TRIANGLES,0,6);
 root.dataset.jellyState=active!==null?'dragging':energy>.003?'settling':'rest';
 if(energy>.003||active!==null){settle=0;raf=requestAnimationFrame(draw);}else if(settle++<2)raf=requestAnimationFrame(draw);
 }
 function wake(){settle=0;if(!raf&&ready&&visible&&!document.hidden){last=performance.now();raf=requestAnimationFrame(draw);}}
 function down(e){if(active!==null||!ready||e.button>0)return;active=e.pointerId;start[0]=e.clientX;start[1]=e.clientY;const r=canvas.getBoundingClientRect();grab[0]=(e.clientX-r.left-r.width/2)/r.width*4.8;grab[1]=-(e.clientY-r.top-r.height/2)/r.height*3;goal[2]=-.65;canvas.setPointerCapture(e.pointerId);root.classList.add('jelly-held');wake();}
 function move(e){if(e.pointerId!==active)return;const r=canvas.getBoundingClientRect();goal[0]=Math.max(-1.2,Math.min(1.2,(e.clientX-start[0])/r.width*4));goal[1]=Math.max(-.75,Math.min(.75,-(e.clientY-start[1])/r.height*2.5));goal[2]=Math.min(.9,Math.hypot(goal[0],goal[1])*.7)-.35;wake();}
 function release(e){if(active===null||(e&&e.pointerId!==undefined&&e.pointerId!==active))return;active=null;goal.fill(0);root.classList.remove('jelly-held');wake();}
 function key(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!media.matches){vel[2]=6;vel[0]=1.8;}wake();}}
 const events=[[canvas,'pointerdown',down],[canvas,'pointermove',move],[canvas,'pointerup',release],[canvas,'pointercancel',release],[canvas,'lostpointercapture',release],[canvas,'keydown',key],[window,'blur',release],[document,'visibilitychange',wake],[canvas,'webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(raf);raf=0;fallback();}],[canvas,'webglcontextrestored',()=>{init();wake();}]];
 events.forEach(([el,name,fn])=>el.addEventListener(name,fn));media.addEventListener('change',wake);
 const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(root);
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible){init();wake();}else{release();cancelAnimationFrame(raf);raf=0;}},{rootMargin:'100px'});observer.observe(root);
 function cleanup(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);observer.disconnect();resizeObserver.disconnect();events.forEach(([el,name,fn])=>el.removeEventListener(name,fn));media.removeEventListener('change',wake);if(gl){if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);}root.remove();if(host.__septemberJelly===cleanup)delete host.__septemberJelly;}
 host.__septemberJelly=cleanup;return cleanup;
};
})();
