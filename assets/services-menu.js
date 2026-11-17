/* Minimal, keyboard-accessible service drawer. No new data requests or storage. */
(function(){
  'use strict';
  const start=()=>{
    const toggle=document.getElementById('services-toggle');
    const panel=document.getElementById('services-panel');
    const backdrop=document.getElementById('services-backdrop');
    const closeButton=document.getElementById('services-close');
    if(!toggle||!panel||!backdrop||!closeButton)return;
    const panelLinks=Array.from(panel.querySelectorAll('a[href]'));
    let lastFocused=null;
    function isOpen(){return !panel.hidden}
    function open(){
      if(isOpen())return;
      lastFocused=document.activeElement;
      panel.hidden=false;
      backdrop.hidden=false;
      toggle.setAttribute('aria-expanded','true');
      document.body.classList.add('services-open');
      closeButton.focus();
    }
    function close(restoreFocus=true){
      if(!isOpen())return;
      panel.hidden=true;
      backdrop.hidden=true;
      toggle.setAttribute('aria-expanded','false');
      document.body.classList.remove('services-open');
      if(restoreFocus){
        const candidate=lastFocused&&lastFocused.isConnected?lastFocused:toggle;
        candidate.focus();
      }
    }
    toggle.addEventListener('click',()=>isOpen()?close():open());
    closeButton.addEventListener('click',()=>close());
    backdrop.addEventListener('click',()=>close());
    panelLinks.forEach(link=>link.addEventListener('click',()=>close(false)));
    document.addEventListener('keydown',event=>{
      if(!isOpen())return;
      if(event.key==='Escape'){
        event.preventDefault();close();return;
      }
      if(event.key!=='Tab')return;
      const focusable=[closeButton,...panelLinks].filter(x=>!x.hasAttribute('disabled'));
      const first=focusable[0],last=focusable[focusable.length-1];
      if(!focusable.includes(document.activeElement)){
        event.preventDefault();first.focus();
      }else if(event.shiftKey&&document.activeElement===first){
        event.preventDefault();last.focus();
      }else if(!event.shiftKey&&document.activeElement===last){
        event.preventDefault();first.focus();
      }
    });
    const syncCurrent=()=>{
      const hash=window.location.hash;
      const selected=hash&&hash!=='#overview'?hash:'#overview';
      const quickHome=document.querySelector('.quick-link[href="#overview"]');
      if(quickHome)quickHome.classList.toggle('selected',selected==='#overview');
      panelLinks.forEach(link=>{
        if(link.getAttribute('href')===selected){
          link.setAttribute('aria-current','location');
        }else link.removeAttribute('aria-current');
      });
    };
    window.addEventListener('hashchange',syncCurrent);
    syncCurrent();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
