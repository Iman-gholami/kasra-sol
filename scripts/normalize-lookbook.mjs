/** Palette B: keep six sample AVIF photos intact and generate two neutral-backdrop WebP variants.
 * Color keying is spatially constrained to connected exterior studio pixels, not garment interiors.
 */
import { mkdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

export const PHOTO_NAMES = ['shomiz-cream','shomiz-rose','manto-black','manto-sage','tshirt-white','tshirt-blue'];
export const BACKDROPS = Object.freeze({ card: [247,248,249], hero: [234,236,240] });
const idx = (x,y,w) => (y*w+x)*3;
function difference(rgb,i,bg) {
  const r=rgb[i]-bg[0],g=rgb[i+1]-bg[1],b=rgb[i+2]-bg[2];
  return Math.sqrt(0.30*r*r+0.55*g*g+0.35*b*b);
}
export function sampleBackground(rgb,width,height) {
  const values=[[],[],[]],w=Math.max(3,Math.floor(width*.07)),h=Math.max(3,Math.floor(height*.06));
  for(let cornerY=0;cornerY<2;cornerY++)for(let dy=0;dy<h;dy++)
    for(let cornerX=0;cornerX<2;cornerX++)for(let dx=0;dx<w;dx++){
      const i=idx(cornerX?width-w+dx:dx,cornerY?height-h+dy:dy,width);
      for(let c=0;c<3;c++)values[c].push(rgb[i+c]);
    }
  return values.map(v=>{v.sort((a,b)=>a-b);return v[Math.floor(v.length/2)];});
}
export async function makeBackdropMask(rgb,width,height) {
  const n=width*height,reference=sampleBackground(rgb,width,height);
  const reached=new Uint8Array(n),queue=new Int32Array(n);let head=0,tail=0;
  const visit=id=>{
    if(id<0||id>=n||reached[id]||difference(rgb,id*3,reference)>42)return;
    reached[id]=1;queue[tail++]=id;
  };
  for(let x=0;x<width;x++){visit(x);visit((height-1)*width+x);}
  for(let y=0;y<height;y++){visit(y*width);visit(y*width+width-1);}
  while(head<tail){
    const i=queue[head++],x=i%width,y=Math.floor(i/width);
    if(x>0)visit(i-1);
    if(x<width-1)visit(i+1);
    if(y>0)visit(i-width);
    if(y<height-1)visit(i+width);
  }
  const mask=Buffer.allocUnsafe(n);
  for(let i=0;i<n;i++)mask[i]=reached[i]?255:0;
  const alpha=await sharp(mask,{raw:{width,height,channels:1}}).blur(1.8).raw().toBuffer();
  return {alpha,coverage:tail/n,reference};
}
export function blendStudio(rgb,alpha,target) {
  const output=Buffer.allocUnsafe(rgb.length);
  for(let i=0;i<alpha.length;i++){
    const blend=alpha[i]/255*.93;
    for(let c=0;c<3;c++){
      const k=i*3+c;output[k]=Math.round(rgb[k]*(1-blend)+target[c]*blend);
    }
  }
  return output;
}
export async function normalizeLookbook({root=process.cwd(),quiet=false}={}) {
  const source=resolve(root,'public/images/lookbook'),target=resolve(root,'public/images/lookbook-brand');
  await mkdir(target,{recursive:true});
  for(const name of PHOTO_NAMES){
    const {data,info}=await sharp(await readFile(join(source,name+'.avif')))
      .rotate().toColourspace('srgb').removeAlpha().raw().toBuffer({resolveWithObject:true});
    if(info.channels!==3)throw Error(name+': unsupported color channels '+info.channels);
    const {alpha,coverage,reference}=await makeBackdropMask(data,info.width,info.height);
    // Safety: do not recolor a source when the estimated backdrop is implausibly small or large.
    const mask=coverage<.07||coverage>.95?Buffer.alloc(info.width*info.height):alpha;
    if(!quiet)console.log('[kasra-photo]',name,'backdrop',Math.round(coverage*100)+'%',reference.join(','));
    for(const [type,color] of Object.entries(BACKDROPS)){
      const pixels=blendStudio(data,mask,color);
      const targetFile=join(target,(type==='hero'?'hero-':'')+name+'.webp');
      await sharp(pixels,{raw:{width:info.width,height:info.height,channels:3}})
        .webp({quality:88,effort:4}).toFile(targetFile);
    }
  }
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname)
  normalizeLookbook().catch(error=>{console.error(error);process.exitCode=1;});
