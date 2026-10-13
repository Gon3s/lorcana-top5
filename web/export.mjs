import {INKS} from './core.mjs';
const loadImage=url=>new Promise(resolve=>{
  if(!url){resolve(null);return;}
  const image=new Image();image.crossOrigin='anonymous';const timer=setTimeout(()=>{image.src='';resolve(null);},8000);
  image.onload=()=>{clearTimeout(timer);resolve(image);};image.onerror=()=>{clearTimeout(timer);resolve(null);};image.src=url;
});
function textWrap(ctx,text,x,y,maxWidth,maxLines=2){
  const words=String(text).split(/\s+/);let line='',lines=0;
  for(const word of words){const next=line?line+' '+word:word;if(ctx.measureText(next).width>maxWidth&&line){ctx.fillText(line,x,y);y+=23;lines++;line=word;if(lines===maxLines-1)break;}else line=next;}
  if(line){while(ctx.measureText(line).width>maxWidth&&line.length>1)line=line.slice(0,-1);ctx.fillText(line,x,y);}
}
export async function exportPng({set,title,tops,catalog}){
  const canvas=document.createElement('canvas');canvas.width=1800;canvas.height=3360;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');
  const ids=[...new Set(INKS.flatMap(i=>tops[i.id]))];
  const byId=new Map(catalog.cards.map(c=>[c.id,c]));
  const images=new Map(await Promise.all(ids.map(async id=>[id,
    await loadImage(new URL(`./export-images/${id}.jpg`,import.meta.url).href) || await loadImage(byId.get(id)?.image)])));
  ctx.fillStyle='#f6f5f0';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#17222e';ctx.fillRect(0,0,1800,190);
  ctx.fillStyle='#dfbb74';ctx.font='bold 22px sans-serif';ctx.fillText('LORCANA · MES TOP 5',60,55);
  ctx.fillStyle='#ffffff';ctx.font='bold 43px sans-serif';textWrap(ctx,title||'Mes favoris Lorcana',60,114,1600,1);
  ctx.fillStyle='#c3c8cf';ctx.font='20px sans-serif';ctx.fillText(`Set ${set} · Six encres, cinq favorites`,60,157);
  let missing=0;
  for(let row=0;row<INKS.length;row++){
    const ink=INKS[row],y=220+row*505;
    ctx.fillStyle=ink.color;ctx.beginPath();ctx.arc(75,y+18,12,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#17222e';ctx.font='bold 28px sans-serif';ctx.fillText(ink.name,105,y+28);
    for(let index=0;index<5;index++){
      const x=60+index*342,iy=y+48,id=tops[ink.id][index],card=byId.get(id),img=images.get(id);
      ctx.fillStyle='#e6e8e1';ctx.fillRect(x,iy,304,365);
      if(img){const ratio=Math.min(304/img.width,365/img.height),w=img.width*ratio,h=img.height*ratio;ctx.drawImage(img,x+(304-w)/2,iy+(365-h)/2,w,h);}
      else{ctx.fillStyle='#879091';ctx.font='28px sans-serif';ctx.fillText(id?'Visuel indisponible':'À choisir',x+30,iy+190);if(id)missing++;}
      ctx.fillStyle='#17222e';ctx.beginPath();ctx.arc(x+22,iy+22,16,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.font='bold 18px sans-serif';ctx.fillText(String(index+1),x+17,iy+28);
      ctx.fillStyle='#17222e';ctx.font='bold 19px sans-serif';textWrap(ctx,card?.name||(id?`Carte ${id}`:''),x,iy+397,304);
      ctx.fillStyle='#68737b';ctx.font='16px sans-serif';textWrap(ctx,card?.subtitle||'',x,iy+443,304,1);
    }
  }
  ctx.fillStyle='#6a737b';ctx.font='16px sans-serif';ctx.fillText('Classement personnel · Projet de fans non officiel · Disney Lorcana © Disney / Ravensburger',60,3320);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG unavailable')),'image/png'));
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`lorcana-top5-set-${set}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return missing;
}
