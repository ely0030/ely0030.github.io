import assert from 'node:assert/strict';
import { stepFlock } from '../public/scripts/weather-boids.js';

const pair = [{ x:100,y:100,vx:20,vy:0 }, { x:102,y:100,vx:20,vy:0 }];
for (let n=0;n<30;n++) stepFlock(pair,1000,800,1/24);
assert.ok(Math.hypot(pair[0].x-pair[1].x,pair[0].y-pair[1].y)>2, 'near agents separate');
const isolated = [{x:100,y:100,vx:20,vy:0}];
stepFlock(isolated,1000,800,1);
assert.deepEqual(isolated,[{x:120,y:100,vx:20,vy:0}], 'no hidden attractor for an isolated agent');

const flock = Array.from({length:90},(_,i)=>({x:500+(i%10)*3,y:300+Math.floor(i/10)*3,vx:Math.cos(i)*25,vy:Math.sin(i)*25}));
for (let n=0;n<500;n++) stepFlock(flock,1000,800,1/24);
for (const b of flock) {
  assert.ok(Number.isFinite(b.x+b.y+b.vx+b.vy));
  assert.ok(b.x>=0&&b.x<1000&&b.y>=0&&b.y<800);
  assert.ok(Math.hypot(b.vx,b.vy)<=40.00001);
}
const overlap=[{x:0,y:0,vx:0,vy:0},{x:0,y:0,vx:0,vy:0}];
stepFlock(overlap,390,844,1/24);
assert.ok(overlap.every(b=>Number.isFinite(b.x+b.y)), 'coincident agents do not divide by zero');

const original=[{x:200,y:200,vx:20,vy:4},{x:235,y:235,vx:17,vy:12}];
const translated=original.map(b=>({...b,x:b.x+150,y:b.y+100}));
stepFlock(original,1000,800,1/24); stepFlock(translated,1000,800,1/24);
original.forEach((b,i)=>{
  assert.ok(Math.abs(b.vx-translated[i].vx)<1e-9);
  assert.ok(Math.abs(b.vy-translated[i].vy)<1e-9);
});
console.log('PASS: separation; no attractor; dense-flock stability, bounds and speed; exact overlap; translation invariance.');
