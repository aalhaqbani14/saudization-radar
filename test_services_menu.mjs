import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('assets/services-menu.css','utf8');
const code=fs.readFileSync('assets/services-menu.js','utf8');
assert.ok(html.includes('id="services-toggle"')&&html.includes('id="services-panel"'));
assert.ok(html.includes('id="services-close"')&&html.includes('id="services-backdrop"'));
assert.ok(html.includes('aria-expanded="false"')&&html.includes('aria-modal="true"'));
assert.ok(html.includes('assets/services-menu.css')&&html.includes('assets/services-menu.js'));
assert.ok(css.includes('.layout{grid-template-columns:80px minmax(0,1fr)}'));
assert.ok(css.includes('@media(max-width:850px)'));
assert.ok(css.includes('.services-panel[hidden]{display:none!important}'));
assert.ok(!code.includes('fetch(')&&!code.includes('localStorage')&&!code.includes('sessionStorage'));
const nav=html.match(/<nav class="nav quick-nav"[\s\S]*?<\/nav>/)?.[0];
const panel=html.match(/<section class="services-panel"[\s\S]*?<\/section>\s*<div class="main">/)?.[0];
assert.ok(nav&&panel,'Compact sidebar and drawer must exist');
assert.equal((nav.match(/<a class="quick-link/g)||[]).length,3,'3 core quick links always visible');
assert.equal((panel.match(/class="services-section"/g)||[]).length,4,'4 service sections must remain available');
const hrefs=[
 '#overview','salic.html','operations.html','#all-professions','calculator.html',
 'guide-audit.html','completion.html','occupation-catalog.html','guide-changes.html',
 'workforce-import.html','#intel','intelligence.html','intelligence.html#report',
 '#updates','#official-sources','sources.html','review.html'
];
for(const href of hrefs){
 assert.ok((nav+panel).includes('href="'+href+'"'),'Missing original navigation destination: '+href);
 if(href.startsWith('#')&&!['#overview'].includes(href))
  assert.ok(html.includes('id="'+href.slice(1)+'"'),'Missing in-page anchor: '+href);
}
const listeners={};
function element(name){
 const attrs=new Map();
 const handlers=new Map();
 return {
  name,hidden:name==='panel'||name==='backdrop',
  isConnected:true,
  attrs,handlers,
  setAttribute(key,value){attrs.set(key,String(value))},
  removeAttribute(key){attrs.delete(key)},
  getAttribute(key){return attrs.has(key)?attrs.get(key):null},
  hasAttribute(key){return attrs.has(key)},
  addEventListener(type,fn){handlers.set(type,fn)},
  dispatch(type,event={}){const cb=handlers.get(type);assert.ok(cb,'missing '+type+' listener');cb(event)},
  classList: {
   classes:new Set(name==='home'?['selected']:[]),
   add(v){this.classes.add(v)},remove(v){this.classes.delete(v)},
   contains(v){return this.classes.has(v)},toggle(v,on){on?this.classes.add(v):this.classes.delete(v)}
  },
  focus(){doc.activeElement=this},
  querySelectorAll(selector){assert.equal(selector,'a[href]');return links}
 };
}
const toggle=element('toggle'),panelEl=element('panel'),backdrop=element('backdrop'),close=element('close'),home=element('home');
const links=hrefs.filter(x=>x!=='#overview'&&x!=='salic.html'&&x!=='operations.html').map(href=>{const item=element(href);item.setAttribute('href',href);return item});
const ids={'services-toggle':toggle,'services-panel':panelEl,'services-backdrop':backdrop,'services-close':close};
const doc={
 readyState:'complete',activeElement:toggle,body:element('body'),
 getElementById(id){return ids[id]},
 querySelector(q){assert.equal(q,'.quick-link[href="#overview"]');return home},
 addEventListener(type,fn){listeners[type]=fn}
};
panelEl.querySelectorAll=(q)=>{assert.equal(q,'a[href]');return links};
const win={location:{hash:''},addEventListener(type,fn){listeners[type]=fn}};
vm.runInNewContext(code,{document:doc,window:win,console}, {filename:'services-menu.js'});
toggle.dispatch('click');
assert.equal(panelEl.hidden,false);assert.equal(backdrop.hidden,false);
assert.equal(toggle.getAttribute('aria-expanded'),'true');
assert.ok(doc.body.classList.contains('services-open'));
assert.equal(doc.activeElement,close);
let prevented=false;
doc.activeElement=links.at(-1);
listeners.keydown({key:'Tab',shiftKey:false,preventDefault(){prevented=true}});
assert.equal(doc.activeElement,close);assert.equal(prevented,true,'Trap forward Tab focus at drawer start');
prevented=false;
listeners.keydown({key:'Tab',shiftKey:true,preventDefault(){prevented=true}});
assert.equal(doc.activeElement,links.at(-1));assert.equal(prevented,true,'Trap reverse Tab focus at drawer end');
listeners.keydown({key:'Escape',preventDefault(){}});
assert.equal(panelEl.hidden,true);assert.equal(backdrop.hidden,true);
assert.equal(toggle.getAttribute('aria-expanded'),'false');
assert.equal(doc.activeElement,toggle);
toggle.dispatch('click');backdrop.dispatch('click');
assert.equal(panelEl.hidden,true,'Clicking outside closes drawer');
toggle.dispatch('click');close.dispatch('click');
assert.equal(panelEl.hidden,true,'Close button closes drawer');
toggle.dispatch('click');links.find(x=>x.getAttribute('href')==='#updates').dispatch('click');
assert.equal(panelEl.hidden,true,'Selecting an in-page anchor closes drawer');
win.location.hash='#updates';listeners.hashchange();
assert.equal(home.classList.contains('selected'),false);
assert.equal(links.find(x=>x.getAttribute('href')==='#updates').getAttribute('aria-current'),'location');
win.location.hash='#overview';listeners.hashchange();
assert.ok(home.classList.contains('selected'));
assert.equal(links.find(x=>x.getAttribute('href')==='#updates').getAttribute('aria-current'),null);
console.log('PASS: compact services navigation retains all 17 destinations, 4 categories and keyboard/mobile drawer behavior');
