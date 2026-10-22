from pathlib import Path
root=Path(__file__).resolve().parents[1]
js=(root/'manual-guide.js').read_text()
css=(root/'manual-guide.css').read_text()
setup=r'''
// Drive queued UI frames deterministically under headless virtual time.
window.requestAnimationFrame=callback=>setTimeout(()=>callback(performance.now()),0);
window.saved=[];window.fixtureUser='user1';window.fixtureAllowed=true;window.fixtureFailure=false;window.fixtureMatching=false;window.holdDefaults=null;
['user1','user2','user3','remote-test'].forEach(user=>localStorage.removeItem('manual-guide-filters:v1:fixture-server:'+user));
localStorage.removeItem('manual-guide-filters:v1:fixture-other-server:user1');
window.fixtureServer='fixture-server';
window.ApiClient={serverId:()=>fixtureServer,getCurrentUserId:()=>fixtureUser,
getUrl:path=>path,
getJSON:async ()=>[{ChannelId:'nba',Groups:['NBA']},{ChannelId:'normal',Groups:['US | Sports']}],
getCurrentUser:async ()=>({Policy:{EnableLiveTvManagement:fixtureAllowed,EnableLiveTvAccess:true}}),
getLiveTvChannels:async ()=>({Items:[{Id:'nba',Name:'NBA 01: Magic vs Hawks (Magic In-Arena) @ 21 Oct 07:00 PM ET'},{Id:'normal',Name:'ESPN 2',UserData:{IsFavorite:true}}]}),
getLiveTvPrograms:async ()=>({Items:fixtureMatching?[{Id:'existing'}]:[]}),
getNewLiveTvTimerDefaults:()=>window.holdDefaults||Promise.resolve({ServiceName:'Emby',Priority:5}),
createLiveTvTimer:async timer=>{if(fixtureFailure)throw Error('fixture');saved.push(timer)}};
'''
tests=r'''
(async function(){try{
 const wait=()=>new Promise(r=>setTimeout(r,80));
 const assert=(condition,message)=>{if(!condition)throw Error(message)};
 await wait();await wait();

 const search=document.querySelector('.manual-guide-search');
 const category=document.querySelector('.manual-guide-category');
 const filter=document.querySelector('.manual-guide-filter');
 const change=(e,value,event='change')=>{e.value=value;e.dispatchEvent(new Event(event,{bubbles:true}))};
 change(search,'  MAGIC   hawks ','input');await new Promise(r=>setTimeout(r,180));
 assert(!document.querySelector('[data-channelid="nba"]').classList.contains('manual-guide-filter-hidden'),'case-insensitive multi-term guide search');
 assert(document.querySelector('[data-channelid="normal"]').classList.contains('manual-guide-filter-hidden')&&document.querySelector('[data-id="normal"]').classList.contains('manual-guide-filter-hidden'),'hide row and channel header together');
 change(search,'Real programme','input');await new Promise(r=>setTimeout(r,180));
 assert(!document.querySelector('[data-channelid="normal"]').classList.contains('manual-guide-filter-hidden'),'search programme titles');
 change(category,'NBA');await wait();assert(document.querySelector('.manual-guide-filter-count').textContent==='No matching channels','combined search and category empty state');
 document.querySelector('.manual-guide-clear').click();await wait();
 change(filter,'missing');await wait();assert(document.querySelector('[data-channelid="normal"]').classList.contains('manual-guide-filter-hidden'),'missing guide filter');
 change(filter,'available');await wait();assert(document.querySelector('[data-channelid="nba"]').classList.contains('manual-guide-filter-hidden'),'with guide filter');
 change(filter,'favourites');await wait();assert(!document.querySelector('[data-channelid="normal"]').classList.contains('manual-guide-filter-hidden'),'favourites filter');
 document.querySelector('.manual-guide-clear').click();await wait();
 assert(!document.querySelector('[data-channelid="nba"]').classList.contains('manual-guide-filter-hidden')&&!document.querySelector('[data-channelid="normal"]').classList.contains('manual-guide-filter-hidden'),'clear restores guide rows');
 change(search,'Magic','input');change(category,'NBA');change(filter,'missing');await new Promise(r=>setTimeout(r,180));
 const stored=()=>JSON.parse(localStorage.getItem('manual-guide-filters:v1:fixture-server:user1'));
 assert(stored().search==='Magic'&&stored().category==='NBA'&&stored().status==='missing','all guide filters saved immediately');
 for(const name of ['hashchange','popstate']){window.dispatchEvent(new Event(name));await wait();assert(search.value==='Magic'&&category.value==='NBA'&&filter.value==='missing',name+' retains guide filters');}
 document.querySelector('.tvguide').dispatchEvent(new Event('viewbeforehide',{bubbles:true}));
 document.querySelector('.tvguide').dispatchEvent(new Event('viewbeforeshow',{bubbles:true}));await wait();
 assert(search.value==='Magic'&&document.querySelector('[data-channelid="normal"]').classList.contains('manual-guide-filter-hidden'),'page exit and return retain filters and matching rows');
 fixtureUser='user2';window.dispatchEvent(new Event('hashchange'));await wait();await wait();
 assert(document.querySelector('.manual-guide-search').value==='','new account has separate filters');
 fixtureUser='user1';window.dispatchEvent(new Event('hashchange'));await wait();await wait();
 assert(document.querySelector('.manual-guide-search').value==='Magic'&&document.querySelector('.manual-guide-category').value==='NBA'&&document.querySelector('.manual-guide-filter').value==='missing','returning account restores its persisted filters');
 fixtureServer='fixture-other-server';window.dispatchEvent(new Event('hashchange'));await wait();await wait();
 assert(document.querySelector('.manual-guide-search').value===''&&document.querySelector('.manual-guide-category').value==='','another server has separate filters for the same user');
 fixtureServer='fixture-server';window.dispatchEvent(new Event('hashchange'));await wait();await wait();
 assert(document.querySelector('.manual-guide-search').value==='Magic','returning server restores its filters');
 localStorage.setItem('manual-guide-filters:v1:fixture-server:user2',JSON.stringify({search:'',category:'Unavailable category',status:'all'}));
 fixtureUser='user2';window.dispatchEvent(new Event('hashchange'));await wait();await wait();
 assert(document.querySelector('.manual-guide-category').value==='Unavailable category'&&document.querySelector('.manual-guide-filter-count').textContent==='No matching channels','unavailable saved category is retained instead of silently widening results');
 localStorage.setItem('manual-guide-filters:v1:fixture-server:user3','invalid JSON');
 fixtureUser='user3';window.dispatchEvent(new Event('hashchange'));await wait();await wait();
 assert(document.querySelector('.manual-guide-filter-count').textContent.includes('Could not restore saved filters'),'corrupt saved filters show an explicit warning');
 document.querySelector('.manual-guide-clear').click();await wait();
 assert(!document.querySelector('.manual-guide-filter-count').textContent.includes('Could not restore'),'Clear repairs invalid stored filters');
 fixtureUser='user1';window.dispatchEvent(new Event('hashchange'));await wait();await wait();
 document.querySelector('.manual-guide-clear').click();await wait();
 assert(stored().search===''&&stored().category===''&&stored().status==='all','Clear filters persists reset');
 const setItem=Storage.prototype.setItem;
 Storage.prototype.setItem=function(){throw new Error('synthetic storage failure')};
 const activeSearch=document.querySelector('.manual-guide-search');
 change(activeSearch,'Magic','input');await new Promise(r=>setTimeout(r,180));
 assert(document.querySelector('.manual-guide-filter-count').textContent.includes('Filters cannot be saved'),'storage failure is visible while filtering still works');
 Storage.prototype.setItem=setItem;
 document.querySelector('.manual-guide-clear').click();await wait();
 assert(!document.querySelector('.manual-guide-filter-count').textContent.includes('cannot be saved'),'successful save clears storage warning');
 const row=document.querySelector('[data-channelid="nba"]');
 assert(row.querySelector('.manual-guide-label').textContent==='Magic vs Hawks (Magic In-Arena) @ 21 Oct 07:00 PM ET — No guide data','clean fallback label');
 assert(document.querySelector('[data-id="nba"]').title.startsWith('Magic vs Hawks'),'clean header title');
 assert(!document.querySelector('[data-channelid="normal"] .manual-guide-fallback'),'real programmes untouched');
 assert(!row.querySelector('.programCell'),'fallback is not a timed programme');
 row.querySelector('button').click();await wait();
 let form=document.querySelector('.manual-guide-dialog');
 assert(form.elements.channel.value==='nba','channel preselection');
 assert(form.elements.title.value.startsWith('Magic vs Hawks'),'recording title cleaned');
 change(form.elements.search,'hawks','input');assert(form.elements.channel.options.length===1&&form.elements.channel.value==='nba','manual channel search');
 const enter=new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});form.elements.search.dispatchEvent(enter);assert(enter.defaultPrevented&&saved.length===0,'search Enter never schedules a recording');
 for(const name of ['title','duration','start']){
  const enter=new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});
  form.elements[name].dispatchEvent(enter);
  assert(enter.defaultPrevented&&saved.length===0,name+' Enter must not implicitly save a recording');
 }
 change(form.elements.category,'US | Sports');assert(form.elements.save.disabled&&form.elements.channel.value==='','no matches cannot retain or record hidden channel');
 change(form.elements.category,'NBA');assert(form.elements.channel.value==='nba'&&!form.elements.save.disabled,'category and search combine');
 change(form.elements.filter,'favourites');assert(form.elements.save.disabled,'manual favourites filter');
 change(form.elements.filter,'all');change(form.elements.search,'','input');change(form.elements.category,'');
 assert(form.elements.channel.options.length===2,'clearing form filters restores choices');

 form.elements.cancel.click();assert(saved.length===0,'cancel must not record');
 row.querySelector('button').click();await wait();form=document.querySelector('.manual-guide-dialog');
 form.elements.duration.value='60';
 form.requestSubmit();form.requestSubmit();await wait();
 assert(saved.length===1,'one save for repeated submit');
 assert(saved[0].ChannelId==='nba'&&!saved[0].ProgramId,'manual timer without programme');
 assert(new Date(saved[0].EndDate)-new Date(saved[0].StartDate)===3600000,'duration respected');
 assert(!document.querySelector('.manual-guide-overlay'),'success closes form');
 document.querySelector('.manual-guide-toolbar .manual-guide-record').click();await wait();form=document.querySelector('.manual-guide-dialog');
 form.elements.channel.value='normal';form.elements.channel.dispatchEvent(new Event('change'));
 form.elements.now.checked=false;form.elements.now.dispatchEvent(new Event('change'));
 form.elements.start.value='2020-01-01T12:00';form.requestSubmit();await wait();
 assert(saved.length===1&&form.querySelector('[role="alert"]').textContent.includes('future'),'past time rejected');
 form.elements.start.value='2030-01-02T12:34';form.elements.duration.value='90';form.requestSubmit();await wait();
 assert(saved.length===2&&saved[1].ChannelId==='normal','scheduled channel');
 assert(saved[1].StartDate===new Date('2030-01-02T12:34').toISOString(),'local timezone converted');
 assert(new Date(saved[1].EndDate)-new Date(saved[1].StartDate)===5400000,'scheduled duration');
 document.querySelector('.manual-guide-toolbar .manual-guide-record').click();await wait();form=document.querySelector('.manual-guide-dialog');
 fixtureFailure=true;form.requestSubmit();await wait();
 assert(saved.length===2&&document.querySelector('.manual-guide-dialog')&&!form.elements.save.disabled,'failure retains retryable form');
 fixtureFailure=false;
 fixtureMatching=true;form.requestSubmit();await wait();
 assert(saved.length===2&&form.querySelector('[role="alert"]').textContent.includes('guide programme'),'prevent server replacing the manual recording window');
 fixtureMatching=false;form.elements.cancel.click();
 const real=document.querySelector('[data-channelid="normal"] .programCell');real.remove();await wait();
 assert(document.querySelector('[data-channelid="normal"] .manual-guide-fallback'),'fallback on newly empty row');
 const program=document.createElement('button');program.className='programCell';document.querySelector('[data-channelid="normal"]').appendChild(program);await wait();
 assert(!document.querySelector('[data-channelid="normal"] .manual-guide-fallback'),'fallback removed when programme arrives');
 document.querySelector('.manual-guide-toolbar .manual-guide-record').click();await wait();form=document.querySelector('.manual-guide-dialog');
 let resolveDefaults;holdDefaults=new Promise(r=>{resolveDefaults=r});form.requestSubmit();await wait();
 fixtureUser='user2';window.dispatchEvent(new Event('hashchange'));resolveDefaults({ServiceName:'Emby'});await wait();
 assert(saved.length===2,'account switch must cancel pending save');holdDefaults=null;
 fixtureAllowed=false;fixtureUser='user3';window.dispatchEvent(new Event('hashchange'));await wait();await wait();
 assert(document.querySelector('.manual-guide-toolbar .manual-guide-record').hidden&&row.querySelector('button').hidden,'recording permission enforced');
 assert(document.querySelectorAll('.manual-guide-toolbar').length===1&&row.querySelectorAll('.manual-guide-fallback').length===1,'no duplicate controls');
 const queryAll=Element.prototype.querySelectorAll;
 let headerScans=0,rowScans=0;
 Element.prototype.querySelectorAll=function(selector){
  if(selector==='.guide-channelHeaderCell')headerScans++;
  if(selector==='.programGrid .channelPrograms')rowScans++;
  return queryAll.call(this,selector);
 };
 try {
  const marker=document.createElement('span'),grid=document.querySelector('.programGrid');
  grid.appendChild(marker);await wait();
  assert(rowScans>0&&headerScans===rowScans,'one shared header lookup per guide render, not one scan per channel');
  marker.remove();await wait();
  const guide=document.querySelector('.tvguide'),page=document.createElement('div');
  page.className='page hide';guide.before(page);page.appendChild(guide);await wait();
  headerScans=0;rowScans=0;
  grid.appendChild(marker);await wait();
  assert(headerScans===0&&rowScans===0,'hidden cached guide does no channel or header scans');
  page.classList.remove('hide');guide.dispatchEvent(new Event('viewbeforeshow',{bubbles:true}));await wait();
  assert(headerScans>0&&rowScans>0&&row.querySelector('.manual-guide-fallback'),'returning guide renders fresh data');
  marker.remove();page.before(guide);page.remove();await wait();
 } finally {Element.prototype.querySelectorAll=queryAll;}
 document.getElementById('result').textContent='PASS: combined guide channel/programme search, category/data/favourites filters, aligned row headers, empty states, manual channel filtering and safe Enter; clean fallback labels; existing programmes unchanged; manual timer and timezone conversion; cancellation; double-submit protection; invalid time; API failure; async EPG refresh; account changes; permissions; no duplicate controls.';
}catch(e){document.getElementById('result').textContent='FAIL: '+e.stack}})();
'''
html='''<!doctype html><html class="layout-desktop"><head><style>'''+css+'''</style></head><body><div class="tvguide"><div class="tvGuideHeader"></div><div class="channelsContainer"><button class="guide-channelHeaderCell" data-id="nba" title="1 NBA 01: Magic vs Hawks (Magic In-Arena) @ 21 Oct 07:00 PM ET"><span class="guideChannelName">NBA 01: Magic vs Hawks (Magic In-Arena) @ 21 Oct 07:00 PM ET</span></button><button class="guide-channelHeaderCell" data-id="normal" title="2 ESPN 2"></button></div><div class="programGrid"><div class="channelPrograms" data-channelid="nba"></div><div class="channelPrograms" data-channelid="normal"><button class="programCell">Real programme</button></div></div></div><pre id="result">PENDING</pre>'''
p=root/'tests/fixture.html';p.write_text(html+'<script>'+setup+'</script><script>'+js+'</script><script>'+tests+'</script></body></html>');print(p)
