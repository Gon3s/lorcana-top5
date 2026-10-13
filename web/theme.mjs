const $=id=>document.getElementById(id);
function applyTheme(theme){
  const dark=theme!=='light';
  document.documentElement.dataset.theme=dark?'dark':'light';
  if($('theme-symbol'))$('theme-symbol').textContent=dark?'☀':'☾';
  if($('theme-label'))$('theme-label').textContent=dark?'Mode clair':'Mode sombre';
  $('theme-toggle')?.setAttribute('aria-label',dark?'Activer le mode clair':'Activer le mode sombre');
  const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=dark?'#101720':'#f6f5f0';
}
let savedTheme='dark';try{savedTheme=localStorage.getItem('lorcana-top5-theme')||'dark';}catch{}
applyTheme(savedTheme);
if($('theme-toggle'))$('theme-toggle').onclick=()=>{
  const next=document.documentElement.dataset.theme==='dark'?'light':'dark';
  applyTheme(next);try{localStorage.setItem('lorcana-top5-theme',next);}catch{}
};
