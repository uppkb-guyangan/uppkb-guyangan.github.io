(()=>{
  const btn=document.getElementById('gitaAvatarBtn');
  const video=document.getElementById('gitaAvatarVideo');
  if(!btn||!video)return;

  const sources={
    idle:{webm:'./assets/gita-idle-hd-transparent.webm',legacy:'./assets/gita-idle-transparent.webm',mp4:'./assets/gita-idle.mp4'},
    thinking:{webm:'./assets/gita-thinking-hd-transparent.webm',legacy:'./assets/gita-thinking-transparent.webm',mp4:'./assets/gita-thinking.mp4'},
    talking:{webm:'./assets/gita-talking-hd-transparent.webm',legacy:'./assets/gita-talking-transparent.webm',mp4:'./assets/gita-talking.mp4'}
  };
  let current='';
  let talkingTimer=null;
  let interactionTimer=null;
  let sourceStep=0;
  let idleLoaded=false;

  function sourceFor(state,step){const s=sources[state];return step===0?s.webm:step===1?s.legacy:s.mp4}
  function loadStateSource(state,step=0){
    if(!sources[state])return;
    sourceStep=step;
    video.src=sourceFor(state,step);
    video.currentTime=0;
    video.play().catch(()=>{});
  }
  function setGitaState(state){
    if(!sources[state]||state===current)return;
    current=state;
    btn.dataset.gitaState=state;
    btn.classList.remove('gita-video-missing');
    loadStateSource(state,0)
  }
  function ensureIdle(){
    if(idleLoaded)return;
    idleLoaded=true;
    setGitaState('idle')
  }
  function brandPaletteAvatar(){
    document.querySelectorAll('.gita-mini-avatar').forEach(el=>{
      if(el.dataset.gitaBranded==='1')return;
      el.dataset.gitaBranded='1';
      el.innerHTML='<video class="gita-mini-video" autoplay muted loop playsinline preload="none"><source src="./assets/gita-idle-transparent.webm" type="video/webm"><source src="./assets/gita-idle.mp4" type="video/mp4"></video>'
    })
  }

  const palette=document.getElementById('commandPalette');
  const results=document.getElementById('commandPaletteResults');
  function assistantState(){
    if(results&&results.querySelector('.assistant-thinking'))return 'thinking';
    if(results&&results.querySelector('.assistant-answer')&&palette&&!palette.classList.contains('hidden'))return 'talking';
    return 'idle'
  }
  function startInteractionTalking(duration=2200){
    ensureIdle();
    clearTimeout(interactionTimer);
    if(assistantState()==='thinking')return;
    setGitaState('talking');
    interactionTimer=setTimeout(()=>setGitaState(assistantState()),duration)
  }
  window.setGitaState=state=>{ensureIdle();setGitaState(state)};

  // Jangan download video GITA saat login/startup. Muat setelah aplikasi idle,
  // atau segera ketika user berinteraksi dengan GITA.
  const lazyIdle=()=>ensureIdle();
  if('requestIdleCallback' in window)requestIdleCallback(lazyIdle,{timeout:5000});
  else setTimeout(lazyIdle,3500);
  btn.addEventListener('pointerdown',ensureIdle,{once:true,passive:true});

  const finePointer=window.matchMedia&&window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  if(finePointer){
    btn.addEventListener('mouseenter',()=>{ensureIdle();clearTimeout(interactionTimer);if(assistantState()!=='thinking')setGitaState('talking')});
    btn.addEventListener('mouseleave',()=>{if(!idleLoaded)return;clearTimeout(interactionTimer);setGitaState(assistantState())})
  }else{
    btn.addEventListener('pointerdown',()=>startInteractionTalking(2200),{passive:true})
  }

  if(results){
    new MutationObserver(()=>{
      if(!idleLoaded)return;
      brandPaletteAvatar();
      const state=assistantState();
      if(state==='thinking'){
        clearTimeout(talkingTimer);clearTimeout(interactionTimer);setGitaState('thinking');return
      }
      if(state==='talking'){
        clearTimeout(interactionTimer);setGitaState('talking');clearTimeout(talkingTimer);talkingTimer=setTimeout(()=>setGitaState('idle'),4500)
      }
    }).observe(results,{childList:true,subtree:true})
  }

  if(palette){
    new MutationObserver(()=>{
      if(palette.classList.contains('hidden')){
        if(!idleLoaded)return;
        clearTimeout(talkingTimer);clearTimeout(interactionTimer);setGitaState('idle')
      }else{
        ensureIdle();setTimeout(brandPaletteAvatar,0)
      }
    }).observe(palette,{attributes:true,attributeFilter:['class']})
  }

  video.addEventListener('error',()=>{
    if(current&&sourceStep<2){loadStateSource(current,sourceStep+1);return}
    btn.classList.add('gita-video-missing')
  });

  // Agent UI juga ditunda agar Firebase/login/dashboard mendapat prioritas jaringan/CPU.
  const loadAgent=()=>import('./gita-agent-ui.js?v=20261004-agent1').catch(err=>console.error('GITA Agent UI gagal dimuat:',err));
  if('requestIdleCallback' in window)requestIdleCallback(loadAgent,{timeout:6000});
  else setTimeout(loadAgent,4000);
})();