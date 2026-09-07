/* Festival objects — foil paper and weighted velvet. Dependency-free, DOM-scoped. */
(function(){
'use strict';
let sequence=0;const NS='http://www.w3.org/2000/svg';
function element(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
function svg(tag,attrs){const el=document.createElementNS(NS,tag);Object.entries(attrs||{}).forEach(([k,v])=>el.setAttribute(k,v));return el;}
function lifecycle(host,kind,render){
 if(!host||!host.appendChild)throw new TypeError('A host element is required');
 const key='__festival'+kind;if(host[key])host[key]();const root=element('div','festival-object '+kind);host.append(root);
 const media=matchMedia('(prefers-reduced-motion: reduce)');let visible=false,disposed=false,raf=0,last=0;const events=[];
 function tick(t){raf=0;if(disposed||!visible||document.hidden)return;const dt=Math.min(.032,(t-last)/1000||.016);last=t;if(render(dt,media.matches))raf=requestAnimationFrame(tick);}
 function wake(){if(!disposed&&visible&&!document.hidden&&!raf){last=performance.now();raf=requestAnimationFrame(tick);}}
 function on(el,name,fn,opts){el.addEventListener(name,fn,opts);events.push(()=>el.removeEventListener(name,fn,opts));}
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;root.dataset.visible=String(visible);if(visible)wake();else{cancelAnimationFrame(raf);raf=0;}},{rootMargin:'60px'});observer.observe(root);
 const resize=new ResizeObserver(wake);resize.observe(root);on(document,'visibilitychange',wake);on(media,'change',wake);
 function cleanup(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);observer.disconnect();resize.disconnect();events.forEach(fn=>fn());root.remove();if(host[key]===cleanup)delete host[key];}
 host[key]=cleanup;return {root,wake,on,cleanup,media};
}
window.mountFoilPass=function(host,options={}){
 let x=0,y=0,tx=0,ty=0,vx=0,vy=0,pressed=false,active=null,card;
 const life=lifecycle(host,'foil-object',(dt,reduced)=>{
 if(reduced){x=tx;y=ty;vx=vy=0;}else{vx+=(tx-x)*85*dt;vy+=(ty-y)*85*dt;vx*=Math.exp(-9*dt);vy*=Math.exp(-9*dt);x+=vx*dt;y+=vy*dt;}
 const available=card.parentElement;const fitted=Math.min(530,available.clientWidth,available.clientHeight*1.62);card.style.width=Math.max(1,fitted)+'px';
 card.style.setProperty('--rx',(-y*11).toFixed(3)+'deg');card.style.setProperty('--ry',(x*14).toFixed(3)+'deg');card.style.setProperty('--rz',(x*y*-1.7).toFixed(3)+'deg');
 card.style.setProperty('--shine',(50+x*38+y*15).toFixed(2)+'%');card.style.setProperty('--sheen-angle',(118+x*14).toFixed(2)+'deg');card.style.setProperty('--lift',pressed?'11px':'0px');card.style.setProperty('--bend',(x*1.7).toFixed(2)+'deg');
 const moving=Math.abs(tx-x)+Math.abs(ty-y)+Math.abs(vx)+Math.abs(vy)>.003;life.root.dataset.motion=moving?'settling':'rest';return moving;
 });
 const {root,on,wake}=life;root.setAttribute('aria-label','Foliedruk op een festivalpas');const scene=element('div','foil-scene');
 card=element('div','foil-pass');card.tabIndex=0;card.setAttribute('role','group');card.setAttribute('aria-label','Demo festivalpas. Beweeg de aanwijzer of gebruik de pijltjestoetsen om het zilver te kantelen. Escape herstelt.');
 const face=element('div','foil-face');
 const top=element('div','foil-top');top.append(element('span','',options.festival||'ALEC FILMMAAND'),element('span','foil-demo','DEMO'));
 const crest=element('div','foil-crest');crest.setAttribute('aria-hidden','true');crest.innerHTML='<span class="foil-laurel">❧</span><span class="foil-monogram foil-metal">A</span><span class="foil-laurel foil-laurel-right">❧</span>';
 const title=element('div','foil-title foil-metal',options.title||'September');const sub=element('div','foil-subtitle','PASS / 2026');
 const divider=element('div','foil-rule');const details=element('div','foil-details');const detailLeft=element('div');detailLeft.append(element('span','foil-micro','UITGENODIGD VOOR'),element('strong','',options.holder||'Een maand cinema.'));const serial=element('div','foil-serial');serial.append(element('span','foil-micro','SPECIMEN'),element('strong','',options.serial||'009 / 026'));details.append(detailLeft,serial);
 const bottom=element('div','foil-bottom');bottom.append(element('span','','MATERIAALSTUDIE'),element('span','','GEEN TOEGANGSBEWIJS'));
 face.append(top,crest,title,sub,divider,details,bottom,element('div','foil-glint'));
 card.append(face);scene.append(card);const caption=element('div','object-caption');caption.append(element('span','','01 / ZILVER OP PAPIER'),element('span','','Kantel het licht.'));root.append(scene,caption);
 function position(e){const r=scene.getBoundingClientRect();tx=Math.max(-1,Math.min(1,(e.clientX-r.left-r.width/2)/(r.width*.38)));ty=Math.max(-1,Math.min(1,(e.clientY-r.top-r.height/2)/(r.height*.38)));wake();}
 on(card,'pointerdown',e=>{if(active!==null||e.button>0)return;active=e.pointerId;pressed=true;card.setPointerCapture(active);position(e);});
 on(scene,'pointermove',e=>{if(e.pointerType==='mouse'||active===e.pointerId)position(e);});
 function release(e){if(active!==null&&e&&e.pointerId!==undefined&&e.pointerId!==active)return;active=null;pressed=false;tx=0;ty=0;wake();}
 on(card,'pointerup',release);on(card,'pointercancel',release);on(card,'lostpointercapture',release);on(scene,'pointerleave',()=>{if(active===null)release();});on(window,'blur',release);
 on(card,'keydown',e=>{const keys={ArrowLeft:[-.25,0],ArrowRight:[.25,0],ArrowUp:[0,-.25],ArrowDown:[0,.25]};if(keys[e.key]){e.preventDefault();tx=Math.max(-1,Math.min(1,tx+keys[e.key][0]));ty=Math.max(-1,Math.min(1,ty+keys[e.key][1]));wake();}else if(e.key==='Escape'){release();}});
 return life.cleanup;
};
window.mountVelvetCurtain=function(host,options={}){
 let opening=0,target=0,velocity=0,active=null,startX=0,startValue=0,cloth,handle,paths=[],width=1000,height=620;
 const life=lifecycle(host,'velvet-object',(dt,reduced)=>{
 if(reduced){opening=target;velocity=0;}else{velocity+=(target-opening)*100*dt;velocity*=Math.exp(-10*dt);opening+=velocity*dt;}
 opening=Math.max(0,Math.min(1,opening));const edge=width*(1-.86*opening);const motion=reduced?0:Math.max(-22,Math.min(22,velocity*9));
 paths.forEach((path,i)=>{const count=paths.length;const boundary=j=>edge*(j/count+Math.sin(j*1.7)*.0018);const x0=boundary(i),x1=boundary(i+1)+1;const bulge=Math.sin(i*1.71)*(2+opening*6);const lower=height-8-Math.sin((i+.5)/count*Math.PI)*8*(1-opening);const slope=(i/count)*motion;
 path.setAttribute('d',`M ${x0} 0 L ${x1} 0 C ${x1+bulge} ${height*.25},${x1+slope} ${height*.62},${x1+Math.sin(i)*opening*3} ${lower} Q ${(x0+x1)/2} ${lower+11},${x0} ${lower} C ${x0+slope} ${height*.62},${x0+bulge} ${height*.25},${x0} 0 Z`);
 });
 handle.style.left=(edge/width*100)+'%';handle.setAttribute('aria-valuenow',String(Math.round(opening*100)));handle.setAttribute('aria-valuetext',Math.round(opening*100)+' procent geopend');
 root.style.setProperty('--opening',opening.toFixed(4));root.dataset.motion=active!==null?'dragging':Math.abs(target-opening)+Math.abs(velocity)>.002?'settling':'rest';return Math.abs(target-opening)+Math.abs(velocity)>.002;
 });
 const {root,on,wake}=life;const stage=element('div','velvet-stage');const image=element('img','velvet-artwork');image.alt=options.alt||'Filmbeeld achter het fluwelen gordijn';if(options.src)image.src=options.src;else image.hidden=true;image.draggable=false;image.loading='lazy';
 const empty=element('div','velvet-image-fallback');empty.append(element('span','','ALEC FILMMAAND'),element('strong','','Het doek gaat open.'),element('span','','SEPTEMBER / 2026'));on(image,'error',()=>{image.hidden=true;});
 const artShade=element('div','velvet-art-shade');cloth=svg('svg',{class:'velvet-cloth',viewBox:`0 0 ${width} ${height}`,preserveAspectRatio:'none','aria-hidden':'true'});const id='velvet-'+(++sequence);const defs=svg('defs');
 const fold=svg('linearGradient',{id:id+'-fold',x1:'0%',y1:'0%',x2:'100%',y2:'0%'});[['0%','#19070b'],['12%','#360b17'],['31%','#681b30'],['47%','#84273e'],['61%','#6b1b30'],['79%','#370b19'],['100%','#15070b']].forEach(([offset,color])=>fold.append(svg('stop',{offset,'stop-color':color})));defs.append(fold);
 const light=svg('linearGradient',{id:id+'-light',x1:'0%',y1:'0%',x2:'15%',y2:'100%'});[['0%','#ffe0cb','.10'],['32%','#8f3446','0'],['100%','#060105','.5']].forEach(([offset,color,opacity])=>light.append(svg('stop',{offset,'stop-color':color,'stop-opacity':opacity})));defs.append(light);
 cloth.append(defs);
 const folds=svg('g');for(let i=0;i<22;i++){const p=svg('path',{fill:`url(#${id}-fold)`});paths.push(p);folds.append(p);}cloth.append(folds);
 // Overlay copies share geometry to keep grazing light inside the drawn cloth.
 const lighting=svg('g',{fill:`url(#${id}-light)`});cloth.append(lighting);paths.forEach(path=>{const overlay=svg('use',{href:'#'+id+'-p'+lighting.childNodes.length});path.id=id+'-p'+lighting.childNodes.length;lighting.append(overlay);});
 const grain=element('div','velvet-grain');
 handle=element('div','velvet-handle');handle.tabIndex=0;handle.setAttribute('role','slider');handle.setAttribute('aria-label','Open het fluwelen gordijn');handle.setAttribute('aria-valuemin','0');handle.setAttribute('aria-valuemax','100');handle.setAttribute('aria-valuenow','0');handle.setAttribute('aria-orientation','horizontal');handle.innerHTML='<span class="velvet-pull-line"></span><span class="velvet-pull">↔</span>';
 const hint=element('span','velvet-stage-hint','Sleep de rand naar links');stage.append(empty,image,artShade,cloth,grain,handle,hint);
 const caption=element('div','object-caption');const button=element('button','velvet-toggle','Open het doek');button.type='button';on(button,'click',()=>{target=target>.5?0:1;button.textContent=target>.5?'Sluit het doek':'Open het doek';wake();});caption.append(element('span','','02 / FLUWEEL & LICHT'),button);root.append(stage,caption);
 function move(e){if(e.pointerId!==active)return;const r=stage.getBoundingClientRect();target=Math.max(0,Math.min(1,startValue-(e.clientX-startX)/(r.width*.86)));button.textContent=target>.5?'Sluit het doek':'Open het doek';wake();}
 on(handle,'pointerdown',e=>{if(active!==null||e.button>0)return;active=e.pointerId;startX=e.clientX;startValue=opening;handle.setPointerCapture(active);root.classList.add('velvet-held');});on(handle,'pointermove',move);
 function release(e){if(e&&e.pointerId!==undefined&&e.pointerId!==active)return;active=null;root.classList.remove('velvet-held');wake();}
 on(handle,'pointerup',release);on(handle,'pointercancel',release);on(handle,'lostpointercapture',release);on(window,'blur',release);
 on(handle,'keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End','Escape'].includes(e.key)){e.preventDefault();target=e.key==='Home'||e.key==='Escape'?0:e.key==='End'?1:Math.max(0,Math.min(1,target+(e.key==='ArrowLeft'?.1:-.1)));button.textContent=target>.5?'Sluit het doek':'Open het doek';wake();}});
 return life.cleanup;
};
})();
