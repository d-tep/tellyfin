from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = (root / 'tizen-guide-validation/home-library-navigation.js').read_text()
html = '''<!doctype html><html class="layout-tv"><head><style>
.itemsContainer { display:flex; width:500px; overflow:hidden; }
.card { flex:0 0 200px; height:90px; }
.hide { display:none; }
</style></head><body>
<div class="skinHeader">
 <div class="headerLeft"></div><div class="headerRight"></div>
 <div class="headerTabs"><div><div class="emby-tabs-slider"><button>Home</button><button>Favourites</button></div></div></div>
</div>
<div class="homeSectionsContainer">
 <div class="itemsContainer" id="resume"><button class="card" id="one">Continue watching</button></div>
 <div class="itemsContainer hide"><button class="card">Hidden row</button></div>
 <div class="itemsContainer"></div>
 <div class="itemsContainer" id="movies">
  <button class="card" id="first">Movie one</button>
  <button class="card" id="middle">Movie two</button>
  <button class="card" id="last">Movie three</button>
  <button class="card hide">Hidden card</button>
  <button class="card" disabled>Disabled card</button>
 </div>
 <div class="itemsContainer" id="shows"><button class="card" id="show">Show</button></div>
</div>
<pre id="result">PENDING</pre>
<script>
window.requestAnimationFrame=callback=>setTimeout(()=>callback(performance.now()),0);
window.cancelAnimationFrame=clearTimeout;
location.hash='#/home';
window.ApiClient={serverId:()=> 'fixture-server',getCurrentUserId:()=> 'fixture-user',getUrl:p=>p,
 getJSON:async()=>({Items:[{Id:'shows',Name:'Shows',CollectionType:'tvshows'},{Id:'movies',Name:'Movies',CollectionType:'movies'},{Id:'tv',Name:'Live TV',CollectionType:'livetv'}]})};
window.Emby={Page:{getRouteUrl:v=>'#/library?id='+v.Id,show:()=>{}}};
</script>
'''
tests = '''
document.addEventListener('DOMContentLoaded', async function () {
try {
 const check=(v,m)=>{if(!v)throw Error(m)};
 const wait=()=>new Promise(resolve=>setTimeout(resolve,100));
 await wait();
 check(document.querySelectorAll('[data-home-library]').length===3,'Home library shortcuts load');
 const key=(name='ArrowRight',options={})=>{
  const e=new KeyboardEvent('keydown',{key:name,keyCode:39,bubbles:true,cancelable:true,...options});
  document.activeElement.dispatchEvent(e);return e;
 };
 const focus=id=>document.getElementById(id).focus();
 focus('one');check(key().defaultPrevented,'boundary handled');
 check(document.activeElement.id==='first','single-card row skips empty/hidden rows to next first card');
 focus('middle');check(!key().defaultPrevented&&document.activeElement.id==='middle','non-final card keeps native navigation');
 focus('last');check(key().defaultPrevented&&document.activeElement.id==='show','last card skips hidden/disabled cards');
 check(!key().defaultPrevented&&document.activeElement.id==='show','final row does not wrap to the top');
 focus('one');check(!key('ArrowLeft',{keyCode:37}).defaultPrevented,'left behavior unchanged');
 check(!key('ArrowRight',{ctrlKey:true}).defaultPrevented,'modified keys unchanged');
 const nested=document.createElement('button');nested.textContent='card action';document.getElementById('one').appendChild(nested);nested.focus();
 check(!key().defaultPrevented,'nested card controls not overridden');nested.remove();
 const modal=document.createElement('dialog');modal.setAttribute('open','');document.body.appendChild(modal);focus('one');
 check(!key().defaultPrevented,'open dialog prevents background row handling');modal.remove();
 location.hash='#/movies';check(!key().defaultPrevented,'only Home is affected');
 location.hash='#/home';document.documentElement.classList.remove('layout-tv');check(!key().defaultPrevented,'non-TV layout unchanged');
 document.documentElement.classList.add('layout-tv');await wait();
 const query=Document.prototype.querySelector;let headerQueries=0;
 Document.prototype.querySelector=function(selector){if(selector==='.skinHeader .emby-tabs-slider')headerQueries++;return query.call(this,selector)};
 try {
  const marker=document.createElement('span');document.getElementById('resume').appendChild(marker);await wait();marker.remove();await wait();
  check(headerQueries===0,'unrelated Home content mutations do not remeasure the header');
 } finally {Document.prototype.querySelector=query;}
 const slider=document.querySelector('.emby-tabs-slider');
 slider.innerHTML='<button>Home</button><button>Favourites</button>';await wait();await wait();
 check(slider.querySelectorAll('[data-home-library]').length===3,'rebuilding native header restores library shortcuts');
 document.getElementById('result').textContent='PASS: Home end-of-row navigation, single-card rows, hidden/empty rows, offscreen final cards, disabled cards, final-row boundary, left/modified keys, nested controls, modal isolation and non-Home/non-TV isolation.';
} catch(error) {document.getElementById('result').textContent='FAIL: '+error.stack;}
}, {once:true});
'''
out = root / 'tizen-guide-validation/home-row-fixture.html'
out.write_text(html + '<script>' + source + '</script><script>' + tests + '</script></body></html>')
print(out)
