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
  let sourceStep=0;

  function sourceFor(state,step){
    const s=sources[state];
    return step===0?s.webm:step===1?s.legacy:s.mp4;
  }

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
    loadStateSource(state,0);
  }

  function brandPaletteAvatar(){
    document.querySelectorAll('.gita-mini-avatar').forEach(el=>{
      if(el.dataset.gitaBranded==='1')return;
      el.dataset.gitaBranded='1';
      el.innerHTML='<video class="gita-mini-video" autoplay muted loop playsinline preload="metadata"><source src="./assets/gita-idle-hd-transparent.webm" type="video/webm"><source src="./assets/gita-idle.mp4" type="video/mp4"></video>';
    });
  }

  window.setGitaState=setGitaState;
  setGitaState('idle');

  const palette=document.getElementById('commandPalette');
  const results=document.getElementById('commandPaletteResults');
  if(results){
    new MutationObserver(()=>{
      brandPaletteAvatar();
      if(results.querySelector('.assistant-thinking')){
        clearTimeout(talkingTimer);
        setGitaState('thinking');
        return;
      }
      if(results.querySelector('.assistant-answer')){
        setGitaState('talking');
        clearTimeout(talkingTimer);
        talkingTimer=setTimeout(()=>setGitaState('idle'),4500);
      }
    }).observe(results,{childList:true,subtree:true});
  }
  brandPaletteAvatar();

  if(palette){
    new MutationObserver(()=>{
      if(palette.classList.contains('hidden')){
        clearTimeout(talkingTimer);
        setGitaState('idle');
      }else{
        setTimeout(brandPaletteAvatar,0);
      }
    }).observe(palette,{attributes:true,attributeFilter:['class']});
  }

  video.addEventListener('error',()=>{
    if(current&&sourceStep<2){
      loadStateSource(current,sourceStep+1);
      return;
    }
    btn.classList.add('gita-video-missing');
  });
})();