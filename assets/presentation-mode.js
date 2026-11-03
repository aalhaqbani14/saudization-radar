
(()=>{'use strict';
const b=document.getElementById('presentation-toggle');if(!b)return;
function set(on){document.body.classList.toggle('presentation-mode',on);b.textContent=on?'إنهاء وضع العرض':'وضع العرض';b.setAttribute('aria-pressed',String(on));}
b.addEventListener('click',()=>set(!document.body.classList.contains('presentation-mode')));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('presentation-mode'))set(false)});
})();
