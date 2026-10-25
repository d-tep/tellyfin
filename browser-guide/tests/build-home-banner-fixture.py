from pathlib import Path

root = Path(__file__).resolve().parents[1]
html = '''<!doctype html><html class="layout-desktop"><meta charset="utf-8">
<style>body{margin:0;background:#101215;color:white;font:18px Arial}.page{padding-top:65px}.hide{display:none}</style>
<style>''' + (root / 'home-banner.css').read_text() + '''</style>
<body><div class="page"><div class="homeSectionsContainer"><h2>Continue Watching</h2>
<button class="card itemAction" data-id="one">Sample movie</button><button class="card itemAction" data-id="two">Sample episode</button></div></div>
<pre id="result">PENDING</pre><script>
location.hash='#/home';
window.requestAnimationFrame=callback=>setTimeout(callback,0);
const realTimeout=window.setTimeout,realClearTimeout=window.clearTimeout;
window.rotationTimers=new Map();let timerId=100000;
window.setTimeout=(callback,delay)=>{if(delay===10000){const id=++timerId;rotationTimers.set(id,callback);return id}return realTimeout(callback,delay)};
window.clearTimeout=id=>{rotationTimers.delete(id);realClearTimeout(id)};
window.tickRotation=()=>{const callbacks=[...rotationTimers.values()];rotationTimers.clear();callbacks.forEach(callback=>callback())};
window.fixtureUser='one';window.fixtureMode='resume';window.requests=[];window.commands=[];
window.items=[
{Id:'one',Name:'The Long Way Home',Overview:'A small crew follows a mysterious signal across a distant ocean, discovering that the journey home is only the beginning.',Type:'Movie',ProductionYear:2025,RunTimeTicks:72000000000,UserData:{PlaybackPositionTicks:18000000000}},
{Id:'two',Name:'A New Beginning',SeriesName:'Beyond the Horizon',Overview:'The expedition reaches a new world, but an unexpected discovery changes everything.',Type:'Episode',ParentIndexNumber:2,IndexNumber:3,RunTimeTicks:27000000000,UserData:{PlaybackPositionTicks:6000000000}}
];
window.ApiClient={serverId:()=> 'fixture-server',getCurrentUserId:()=>fixtureUser,getUrl:(path,query)=>({path,query}),getImageUrl:()=> '',
 getJSON:async request=>{requests.push(request);if(fixtureMode==='error')throw Error('synthetic request error');if(fixtureMode==='empty')return {Items:[]};if(fixtureMode==='nextup'&&request.path.includes('Resume'))return {Items:[]};return {Items:items}}};
document.addEventListener('command',event=>{commands.push({id:event.target.dataset.id,command:event.detail.command});event.preventDefault()});
</script><script>''' + (root / 'home-banner.js').read_text() + '''</script><script>
(async()=>{const wait=()=>new Promise(r=>setTimeout(r,90)),check=(v,m)=>{if(!v)throw Error(m)};
try{
 await wait();
 const text=s=>document.querySelector(s).textContent;
 const dot=index=>document.querySelectorAll('.home-banner-dot')[index];
 check(text('.home-banner-title')==='The Long Way Home','initial Continue Watching item');
 check(document.querySelector('progress').value===25&&text('.home-banner-remaining')==='90 min remaining','progress and remaining time');
 check(document.querySelector('.home-banner-details').getAttribute('href').includes('id=one'),'details targets exact item');
 check(document.querySelectorAll('.home-banner-dot').length===items.length,'one dot per title');
 check(requests[0].query.Limit===5,'Resume request limits latest items to five');
 check(dot(0).getAttribute('aria-pressed')==='true'&&dot(1).getAttribute('aria-label').includes('Beyond the Horizon'),'accessible dot labels and active state');
 check(!document.querySelector('.home-banner-pause,.home-banner-previous,.home-banner-next'),'old controls removed');
 dot(1).click();
 check(text('.home-banner-title')==='Beyond the Horizon'&&text('.home-banner-meta').includes('E3'),'episode series and metadata');
 document.querySelector('.home-banner-play').click();check(commands.length===1&&commands[0].id==='two'&&commands[0].command==='resume','Resume uses exact native Home card');
 dot(0).click();check(text('.home-banner-title')==='The Long Way Home','dot selects exact title');
 check(rotationTimers.size===1,'one 10-second rotation timer');
 tickRotation();check(text('.home-banner-title')==='Beyond the Horizon','auto advance after 10 seconds');
 check(dot(1).getAttribute('aria-pressed')==='true'&&dot(0).getAttribute('aria-pressed')==='false','auto rotation updates dots');
 tickRotation();check(text('.home-banner-title')==='The Long Way Home','auto rotation wraps');
 const play=document.querySelector('.home-banner-play');play.focus();tickRotation();
 check(text('.home-banner-title')==='The Long Way Home','focus pauses rotation');play.blur();
 document.querySelector('.home-banner').dispatchEvent(new Event('mouseenter'));tickRotation();
 check(text('.home-banner-title')==='The Long Way Home','hover pauses rotation');
 document.querySelector('.home-banner').dispatchEvent(new Event('mouseleave'));
 tickRotation();check(text('.home-banner-title')==='Beyond the Horizon','rotation resumes after hover');tickRotation();
 Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));
 check(rotationTimers.size===0,'hidden tab stops timer');
 Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));await wait();
 check(rotationTimers.size===1,'visible tab restarts timer');
 document.querySelector('[data-id=one]').remove();document.querySelector('.home-banner-play').click();
 check(text('.home-banner-status').includes('Open Details')&&commands.length===1,'missing card gives explicit fallback without wrong playback');
 const navigate=async route=>{location.hash=route;await wait()};
 await navigate('#/movies');check(!document.querySelector('.home-banner')&&rotationTimers.size===0,'removed away from Home and timer cleaned up');
 fixtureMode='nextup';await navigate('#/home');check(text('.home-banner-kicker')==='Next Up','Next Up fallback');
 check(document.querySelectorAll('.home-banner').length===1,'no duplicate banner');
 fixtureUser='two';document.dispatchEvent(new Event('viewshow'));await wait();check(document.querySelectorAll('.home-banner').length===1,'account change replaces banner');
 await navigate('#/movies');fixtureMode='empty';await navigate('#/home');check(document.querySelector('.home-banner').hidden,'empty account hides banner');
 await navigate('#/movies');fixtureMode='error';await navigate('#/home');check(text('.home-banner-status').includes('Could not load'),'request error visible');
 await navigate('#/movies');document.documentElement.className='layout-tv';fixtureMode='resume';await navigate('#/home');
 check(!!document.querySelector('.home-banner'),'TV banner enabled');tickRotation();
 check(text('.home-banner-title')==='Beyond the Horizon','TV auto rotation');
 document.querySelector('.home-banner-play').focus();tickRotation();check(text('.home-banner-title')==='Beyond the Horizon','TV selection stable while focused');
 const key=k=>document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true}));
 key('ArrowRight');check(document.activeElement.matches('.home-banner-details'),'TV Right reaches Details');
 key('ArrowDown');check(document.activeElement===dot(1),'TV Down reaches current dot');
 key('ArrowLeft');check(document.activeElement===dot(0),'TV Left reaches first dot');
 check(text('.home-banner-title')==='The Long Way Home'&&dot(0).getAttribute('aria-pressed')==='true','Left changes slide immediately without click');
 dot(0).click();check(dot(0).getAttribute('aria-pressed')==='true'&&document.activeElement===dot(0),'dot selection preserves focus');
 key('ArrowRight');check(document.activeElement===dot(1),'TV Right reaches second dot');
 check(text('.home-banner-title')==='Beyond the Horizon'&&dot(1).getAttribute('aria-pressed')==='true','Right changes slide immediately without click');
 check(getComputedStyle(dot(1)).outlineStyle==='none','no oversized dot focus outline');
 check(getComputedStyle(dot(1)).backgroundColor==='rgba(0, 0, 0, 0)'&&!dot(1).classList.contains('emby-button'),'focused hit target has no theme-filled circle');
 check(getComputedStyle(document.querySelector('.home-banner-content')).backgroundColor==='rgba(0, 0, 0, 0)','information box removed');
 key('ArrowUp');check(document.activeElement.matches('.home-banner-play'),'TV Up returns to actions');
 key('ArrowDown');key('ArrowDown');check(document.activeElement.matches('.card'),'TV Down enters native Home rows');
 document.querySelector('.home-banner-play').blur();
 document.documentElement.className='layout-desktop';fixtureMode='resume';await navigate('#/movies');await navigate('#/home');
 const home=document.querySelector('.homeSectionsContainer');home.classList.remove('homeSectionsContainer');document.dispatchEvent(new Event('viewshow'));await wait();
 check(!document.querySelector('.home-banner'),'not mounted before asynchronous Home sections exist');
 home.classList.add('homeSectionsContainer');home.appendChild(document.createElement('span'));await wait();
 check(!!document.querySelector('.home-banner'),'mounts when asynchronous Home content becomes available');
 await navigate('#/movies');const originalItems=items;
 items=Array.from({length:8},(_,index)=>({...originalItems[index%2],Id:'latest-'+index,Name:'Latest '+index,SeriesName:''}));
 await navigate('#/home');check(document.querySelectorAll('.home-banner-dot').length===5,'oversized responses capped at five');
 check(document.querySelectorAll('.home-banner-dot')[4].getAttribute('aria-label').includes('Latest 4'),'server most-recent order preserved');
 const markers=[...document.querySelectorAll('.home-banner-dot-mark')].map(el=>el.getBoundingClientRect());
 check(markers[0].width===20&&markers[0].height===4&&markers[1].width===6&&markers[1].height===6,'active line and smaller inactive dots');
 await navigate('#/movies');items=items.slice(0,1);await navigate('#/home');
 check(document.querySelectorAll('.home-banner-dot').length===1&&!document.querySelector('.home-banner-controls').hidden&&rotationTimers.size===0,'single title has visible current dot and no rotation');
 document.getElementById('result').textContent='PASS: accessible dot navigation/active state, old controls removed, 10-second rotation/wrap, focus/hover/visibility safeguards, timer cleanup, browser/TV D-pad, metadata/progress, native resume dispatch, details, missing cards, Next Up, empty/error states, account replacement and asynchronous Home mounting.';
}catch(e){document.getElementById('result').textContent='FAIL: '+e.stack}
})();
</script></body></html>'''
out = root / 'tests/home-banner-fixture.html'
out.write_text(html)
print(out)
