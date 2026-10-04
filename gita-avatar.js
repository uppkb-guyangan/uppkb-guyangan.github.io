(()=>{
  const btn=document.getElementById('gitaAvatarBtn');
  const video=document.getElementById('gitaAvatarVideo');
  if(!btn||!video)return;

  const sources={
    idle:{webm:'./assets/gita-idle-transparent.webm',mp4:'./assets/gita-idle.mp4'},
    thinking:{webm:'./assets/gita-thinking-transparent.webm',mp4:'./assets/gita-thinking.mp4'},
    talking:{webm:'./assets/gita-talking-transparent.webm',mp4:'./assets/gita-talking.mp4'}
  };
  let current='';
  let talkingTimer=null;
  let usingFallback=false;

  function loadStateSource(state,useFallback=false){
    const source=sources[state];
    if(!source)return;
    usingFallback=useFallback;
    video.src=useFallback?source.mp4:source.webm;
    video.currentTime=0;
    video.play().catch(()=>{});
  }

  function setGitaState(state){
    if(!sources[state]||state===current)return;
    current=state;
    btn.dataset.gitaState=state;
    btn.classList.remove('gita-video-missing');
    loadStateSource(state,false);
  }

  window.setGitaState=setGitaState;
  setGitaState('idle');

  const palette=document.getElementById('commandPalette');
  const results=document.getElementById('commandPaletteResults');
  if(results){
    new MutationObserver(()=>{
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

  if(palette){
    new MutationObserver(()=>{
      if(palette.classList.contains('hidden')){
        clearTimeout(talkingTimer);
        setGitaState('idle');
      }
    }).observe(palette,{attributes:true,attributeFilter:['class']});
  }

  video.addEventListener('error',()=>{
    if(!usingFallback&&current&&sources[current]){
      loadStateSource(current,true);
      return;
    }
    btn.classList.add('gita-video-missing');
  });
})();