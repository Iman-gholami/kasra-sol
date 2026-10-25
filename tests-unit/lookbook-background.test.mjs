import assert from 'node:assert/strict';
import {test} from 'node:test';
import {makeBackdropMask,blendStudio,sampleBackground,BACKDROPS} from '../scripts/normalize-lookbook.mjs';

test('studio becomes cool gray while a red garment retains its exact RGB',async()=>{
 const w=120,h=160,rgb=Buffer.alloc(w*h*3);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const k=(y*w+x)*3,coat=x>=30&&x<=90&&y>26&&y<148;
  rgb.set(coat?[182,44,62]:[223,205,190],k);
 }
 assert.deepEqual(sampleBackground(rgb,w,h),[223,205,190]);
 const {alpha,coverage}=await makeBackdropMask(rgb,w,h);
 assert.ok(coverage>.5&&coverage<.9);
 const out=blendStudio(rgb,alpha,BACKDROPS.card);
 assert.deepEqual([...out.subarray(0,3)],[245,245,245]);
 const i=(100*w+60)*3;
 assert.deepEqual([...out.subarray(i,i+3)],[182,44,62]);
});
test('hero backdrop differs from the lighter card backdrop',()=>{
 assert.notDeepEqual(BACKDROPS.card,BACKDROPS.hero);
});
