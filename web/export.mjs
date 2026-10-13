import {exportRows} from './core.mjs';
const loadImage=url=>new Promise(resolve=>{
  if(!url){resolve(null);return;}
  const image=new Image();image.crossOrigin='anonymous';const timer=setTimeout(()=>{image.src='';resolve(null);},8000);
  image.onload=()=>{clearTimeout(timer);resolve(image);};image.onerror=()=>{clearTimeout(timer);resolve(null);};image.src=url;
});
function textWrap(ctx,text,x,y,maxWidth,maxLines=2){
  const words=String(text).split(/\s+/).filter(Boolean),lines=[];let line='';
  while(words.length){const next=line?line+' '+words[0]:words[0];
    if(line&&ctx.measureText(next).width>maxWidth){lines.push(line);line='';if(lines.length===maxLines-1){line=words.join(' ');break;}}
    else{line=next;words.shift();}
  }
  if(line)lines.push(line);
  for(let i=0;i<Math.min(lines.length,maxLines);i++){
    let value=lines[i];if(i===maxLines-1&&lines.length>maxLines)value+='…';if(ctx.measureText(value).width>maxWidth){while(value.length&&ctx.measureText(value+'…').width>maxWidth)value=value.slice(0,-1);value=value.trimEnd()+'…';}
    ctx.fillText(value,x,y+i*23);
  }
}
export async function exportPng({set,title,tops,catalog,scope='all'}){
  const rows=exportRows(scope);
  const canvas=document.createElement('canvas');canvas.width=1800;canvas.height=330+505*rows.length;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');
  const ids=[...new Set(rows.flatMap(i=>tops[i.id]))];
  const byId=new Map(catalog.cards.map(c=>[c.id,c]));
  const images=new Map(await Promise.all(ids.map(async id=>[id,
    await loadImage(new URL(`./export-images/${id}.jpg`,import.meta.url).href) || await loadImage(byId.get(id)?.image)])));
  ctx.fillStyle='#f6f5f0';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#17222e';ctx.fillRect(0,0,1800,190);
  ctx.fillStyle='#dfbb74';ctx.font='bold 22px sans-serif';ctx.fillText('LORCANA · MES TOP 5',60,55);
  ctx.fillStyle='#ffffff';ctx.font='bold 43px sans-serif';textWrap(ctx,title||'Mes favoris Lorcana',60,114,1600,1);
  ctx.fillStyle='#c3c8cf';ctx.font='20px sans-serif';ctx.fillText(`Set ${set} · ${rows.length===1?'Top 5 '+rows[0].name:'Six encres, cinq favorites'}`,60,157);
  let missing=0;
  for(let row=0;row<rows.length;row++){
    const ink=rows[row],y=220+row*505;
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
  ctx.fillStyle='#6a737b';ctx.font='16px sans-serif';ctx.fillText('Classement personnel · Projet de fans non officiel · Disney Lorcana © Disney / Ravensburger',60,canvas.height-40);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG unavailable')),'image/png'));
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`lorcana-top5-set-${set}${scope==='all'?'':'-'+scope.toLowerCase()}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return missing;
}
