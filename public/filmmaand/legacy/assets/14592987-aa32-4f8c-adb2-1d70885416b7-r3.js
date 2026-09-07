/* Filmmaand optical materials. No dependencies. Each mount returns an idempotent cleanup.
   Mystery sources MUST be abstract/public-safe: optical obscurity is not secrecy. */
(() => {
  'use strict';
  const mounted = new WeakMap();
  const vertex = `attribute vec2 p; varying vec2 uv; void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}`;
  const fragment = `precision mediump float;
  varying vec2 uv; uniform sampler2D image; uniform vec2 size, crop, hand;
  uniform float clock, frost; uniform vec4 drops[12];
  vec2 cover(vec2 v){return (v-.5)*crop+.5;}
  vec3 photo(vec2 v){return texture2D(image,clamp(cover(v),.001,.999)).rgb;}
  float grain(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
  void main(){
    vec2 v=vec2(uv.x,1.-uv.y); vec2 aspect=vec2(size.x/size.y,1.);
    if(frost<.5){
      vec2 bend=vec2(0.); float light=0.;
      for(int i=0;i<12;i++){
        float age=clock-drops[i].z;
        if(age>=0. && age<3.8 && drops[i].w>0.){
          vec2 delta=(v-drops[i].xy)*aspect; float d=length(delta);
          float front=d-age*.24; float envelope=exp(-front*front/ .0035)*exp(-age*1.15);
          float wave=sin(front*115.)*envelope*drops[i].w;
          bend+=delta/max(d,.001)*wave*.017/aspect;
          light+=cos(front*115.)*envelope*.022*drops[i].w;
        }
      }
      vec3 c=photo(v+bend); c.r=photo(v+bend*1.035).r;c.b=photo(v+bend*.965).b;
      gl_FragColor=vec4(c+light,1.);
    }else{
      float flute=sin((v.x+hand.x*.027)*size.x/15.5*6.28318);
      float shoulder=cos((v.x+hand.x*.027)*size.x/15.5*6.28318);
      vec2 lens=v+vec2(flute*.017,flute*.003)+ (hand-.5)*.13;
      lens+=vec2(sin(v.y*9.+hand.x*3.),cos(v.x*8.+hand.y*4.))*.012;
      vec3 c=photo(lens)*.18;
      for(int i=0;i<12;i++){
        float a=float(i)*2.39996;
        vec2 blur=vec2(cos(a),sin(a))*sqrt((float(i)+.5)/12.)*.042;
        c+=photo(lens+blur)*(.82/12.);
      }
      c=mix(c,vec3(.94,.935,.915),.30);
      c+=shoulder*.035 + pow(max(shoulder,0.),18.)*.07;
      c+=(grain(gl_FragCoord.xy)-.5)*.032;
      float sheen=exp(-pow((v.x-v.y*.28-.2-hand.x*.12)*4.,2.));
      c=mix(c,vec3(1.),sheen*.12);
      gl_FragColor=vec4(c,1.);
    }
  }`;
  function abstractArt(){
    const c=document.createElement('canvas');c.width=960;c.height=640;
    const x=c.getContext('2d');x.fillStyle='#d7cec2';x.fillRect(0,0,960,640);
    const glows=[[190,300,430,'#203e44'],[690,260,330,'#b9582f'],[470,580,350,'#ca9b51'],[810,630,350,'#273d48']];
    for(const [a,b,r,color] of glows){const g=x.createRadialGradient(a,b,0,a,b,r);g.addColorStop(0,color);g.addColorStop(.5,color);g.addColorStop(1,'transparent');x.fillStyle=g;x.fillRect(0,0,960,640);}
    x.fillStyle='#202c32';x.beginPath();x.ellipse(420,340,72,250,-.35,0,Math.PI*2);x.fill();
    x.fillStyle='#e8b86e';x.fillRect(660,0,21,530);return c.toDataURL();
  }
  function mount(host,options={},frost=false){
    if(!(host instanceof HTMLElement))throw new TypeError('A host element is required');
    mounted.get(host)?.();
    const root=document.createElement('div');root.className='fm-material '+(frost?'fm-frost':'fm-liquid');
    const img=new Image();img.alt=options.alt || (frost?'Abstracte kleurstudie achter geribbeld glas':'Interactief filmbeeld');img.className='fm-material-image';
    const canvas=document.createElement('canvas');canvas.className='fm-material-canvas';canvas.setAttribute('aria-hidden','true');
    const control=document.createElement('button');control.type='button';control.className='fm-material-control';
    control.textContent=frost?'↔  Verschuif het glas':'Raak het water aan';
    control.setAttribute('aria-label',frost?'Verschuif het glas. Sleep, of gebruik de pijltoetsen.':'Maak een rimpeling in het filmbeeld');
    root.append(img,canvas,control);host.append(root);if(frost&&options.controls===false){root.tabIndex=0;root.setAttribute('role','img');root.setAttribute('aria-label',options.alt||'Matglas. Beweeg erover of gebruik de pijltoetsen.');}
    let gl,program,buffer,texture,raf=0,dead=false,ready=false,visible=true,index=0,lastDrop=-1,drag=null,dragStart=null,suppressClick=false;
    let hand=[.5,.5],target=[.5,.5];const drops=new Float32Array(48);const shaders=[];
    const mq=matchMedia('(prefers-reduced-motion: reduce)');const listeners=[];
    function on(el,type,fn,opts){el.addEventListener(type,fn,opts);listeners.push(()=>el.removeEventListener(type,fn,opts));}
    function fallback(){ready=false;root.classList.remove('fm-ready');root.classList.add('fm-fallback');canvas.hidden=true;control.hidden=options.controls===false||!frost;}
    function wake(){if(!dead&&ready&&visible&&!document.hidden&&!raf)raf=requestAnimationFrame(draw);}
    function resize(){if(!gl||dead)return;root.classList.remove('fm-ready');const r=root.getBoundingClientRect();const d=Math.min(devicePixelRatio||1,1.75);canvas.width=Math.max(1,Math.round(r.width*d));canvas.height=Math.max(1,Math.round(r.height*d));wake();}
    function drop(x,y,strength=1){if(mq.matches||!ready)return;const now=performance.now()/1000;if(strength<=1&&now-lastDrop<.065)return;lastDrop=now;drops.set([x,y,now,strength],(index++%12)*4);wake();}
    function point(e){const r=root.getBoundingClientRect();return [Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))];}
    function shift(x,y){target=[Math.max(0,Math.min(1,x)),Math.max(0,Math.min(1,y))];root.style.setProperty('--fm-shift',((target[0]-.5)*24)+'px');wake();}
    function draw(now){
      raf=0;if(dead||!ready||!visible||document.hidden)return;
      const t=now/1000;let moving=false;
      for(let j=0;j<2;j++){hand[j]+= (target[j]-hand[j])*(mq.matches?1:.12);if(Math.abs(target[j]-hand[j])>.0002)moving=true;}
      gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(program);
      const ratio=canvas.width/canvas.height, ir=img.naturalWidth/img.naturalHeight;
      gl.uniform2f(gl.getUniformLocation(program,'size'),canvas.width/(Math.min(devicePixelRatio||1,1.75)),canvas.height/(Math.min(devicePixelRatio||1,1.75)));
      gl.uniform2f(gl.getUniformLocation(program,'crop'),ratio>ir?1:ratio/ir,ratio>ir?ir/ratio:1);
      gl.uniform2fv(gl.getUniformLocation(program,'hand'),hand);gl.uniform1f(gl.getUniformLocation(program,'clock'),t);
      gl.uniform1f(gl.getUniformLocation(program,'frost'),frost?1:0);gl.uniform4fv(gl.getUniformLocation(program,'drops[0]'),drops);
      gl.drawArrays(gl.TRIANGLES,0,6);root.classList.add('fm-ready');
      if((frost&&moving)||(!frost&&t-lastDrop<3.9&&!mq.matches))wake();
    }
    function init(){
      if(dead)return;
      try{
        gl=canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:false});if(!gl)throw Error('WebGL unavailable');
        program=gl.createProgram();
        for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
          const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
          if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));gl.attachShader(program,shader);
        }
        gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
        buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
        const p=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);
        texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
        ready=true;resize();
      }catch(error){fallback();root.dataset.materialFallback=error.name||'Unavailable';}
    }
    on(root,'pointermove',e=>{const p=point(e);if(frost){if(e.pointerType==='mouse'||drag!==null)shift(...p);}else if(e.pointerType==='mouse')drop(...p,.65);},{passive:true});
    on(root,'pointerdown',e=>{if(!frost)drop(...point(e));else if(options.controls===false){drag=e.pointerId;root.setPointerCapture(e.pointerId);shift(...point(e));}},{passive:true});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])on(root,type,()=>{if(options.controls===false)drag=null;});
    on(root,'keydown',e=>{if(frost&&options.controls===false&&e.target===root&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();shift(target[0]+(e.key==='ArrowLeft'?-.12:e.key==='ArrowRight'?.12:0),target[1]+(e.key==='ArrowUp'?-.12:e.key==='ArrowDown'?.12:0));}});
    on(control,'pointerdown',e=>{if(frost){drag=e.pointerId;dragStart=[e.clientX,e.clientY];suppressClick=false;control.setPointerCapture(e.pointerId);shift(...point(e));}});
    on(control,'pointermove',e=>{if(frost&&drag===e.pointerId){if(Math.hypot(e.clientX-dragStart[0],e.clientY-dragStart[1])>4)suppressClick=true;shift(...point(e));}});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])on(control,event,()=>{drag=null;});
    on(control,'click',()=>{if(suppressClick){suppressClick=false;return;}if(frost)shift(target[0]>.5?.25:.75,.5);else drop(.5,.5,1.5);});
    on(control,'keydown',e=>{if(frost&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();shift(target[0]+(e.key==='ArrowLeft'?-.12:e.key==='ArrowRight'?.12:0),target[1]+(e.key==='ArrowUp'?-.12:e.key==='ArrowDown'?.12:0));}});
    on(canvas,'webglcontextlost',e=>{e.preventDefault();fallback();});
    on(mq,'change',()=>{drops.fill(0);lastDrop=-1;control.hidden=options.controls===false||(!frost&&(mq.matches||!ready));wake();});
    on(document,'visibilitychange',wake);
    const ro=new ResizeObserver(resize);ro.observe(root);
    const io=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;wake();});io.observe(root);
    img.onload=init;img.onerror=()=>{fallback();if(img.crossOrigin){img.onload=null;img.onerror=()=>root.classList.add('fm-image-error');img.removeAttribute('crossorigin');img.src=options.src;}else root.classList.add('fm-image-error');};
    if(options.src){img.crossOrigin='anonymous';img.src=options.src;}else img.src=abstractArt();
    control.hidden=options.controls===false||(mq.matches&&!frost);
    function cleanup(){if(dead)return;dead=true;cancelAnimationFrame(raf);ro.disconnect();io.disconnect();listeners.forEach(fn=>fn());img.onload=img.onerror=null;
      if(gl){if(texture)gl.deleteTexture(texture);if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);shaders.forEach(s=>gl.deleteShader(s));gl.getExtension('WEBGL_lose_context')?.loseContext();}
      root.remove();if(mounted.get(host)===cleanup)mounted.delete(host);
    }
    mounted.set(host,cleanup);return cleanup;
  }
  window.mountLiquidArtwork=(host,options)=>mount(host,options,false);
  window.mountFrostedScreening=(host,options)=>mount(host,options,true);
})();
