import './scene.css'

/** Visual values are normalized from zero to one by the simulation. */
export interface VisualState {
  season: 'winter' | 'spring' | 'winter-return'
  warmth: number
  activity: number
  construction: boolean
  renovated: boolean
  caption: string
}

let sceneId = 0
const windows = [
  [430, 313, 17, 36], [482, 313, 16, 33], [548, 307, 12, 32], [608, 302, 10, 31],
  [430, 390, 18, 36], [482, 393, 18, 35], [548, 386, 13, 34], [608, 373, 10, 32],
  [431, 464, 17, 35], [483, 467, 18, 34], [548, 459, 13, 34], [608, 444, 10, 31],
  [431, 535, 17, 34], [483, 536, 17, 34], [548, 529, 13, 35], [608, 514, 10, 31],
  [483, 254, 17, 28], [433, 251, 14, 26], [552, 249, 13, 29], [609, 241, 12, 27],
]
const factoryWindows = [[1043,278,19,50], [1089,285,17,51], [1136,294,15,46], [1360,521,14,60], [1381,528,13,64], [1460,564,17,54]]
const clamp = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0))
const lerp = (a:number,b:number,t:number) => a+(b-a)*t

export function sceneMarkup(): string {
  const id = `winter-world-${++sceneId}`
  const panes = (list:number[][],kind:string) => list.map(([x,y,w,h],i)=>`<g class="winter-window winter-window--${kind}" style="--window-delay:${i%5*70}ms"><rect class="winter-window-shade" x="${x}" y="${y}" width="${w}" height="${h}"/><rect class="winter-window-light" x="${x}" y="${y}" width="${w}" height="${h}"/><path class="winter-window-frame" d="M${x+w/2},${y}v${h}M${x},${y+h*.53}h${w}"/></g>`).join('')
  return `<div class="winter-stage" data-scene-stage data-season="winter" data-warmth="0.5" data-activity="0.5" role="img" aria-label="Un quartier français vivant, entre logements, ateliers et canal, au fil des saisons.">
    <picture class="winter-stage-picture"><source media="(max-width: 700px)" srcset="/mandats/art/winter-quarter-small.webp"><img class="winter-stage-image" src="/mandats/art/winter-quarter.webp" alt="" width="1536" height="1024" decoding="async" fetchpriority="high" draggable="false"></picture>
    <div class="winter-season-tint" aria-hidden="true"></div>
    <svg class="winter-scene-layers" viewBox="0 0 1536 1024" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <filter id="${id}-glow" x="-150%" y="-100%" width="400%" height="300%"><feGaussianBlur stdDeviation="3.2"/></filter>
        <filter id="${id}-steam" x="-75%" y="-75%" width="250%" height="250%"><feGaussianBlur stdDeviation="5"/></filter>
        <linearGradient id="${id}-water" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ffc778" stop-opacity=".35"/><stop offset="1" stop-color="#ffddad" stop-opacity="0"/></linearGradient>
        <clipPath id="${id}-canal"><path d="M390 947 Q568 919 634 821 Q706 745 894 780 L1037 814 1147 793 1536 943 1536 1024 348 1024Z"/></clipPath>
        <clipPath id="${id}-home"><path d="M347 306 648 285 650 579 348 610Z"/></clipPath>
        <g id="${id}-person">
          <ellipse cy="1" rx="4.4" ry="1.5" fill="#0d1520" opacity=".35"/>
          <path class="winter-leg winter-leg-a" d="M-1-8-1.9 0" stroke="#202632" stroke-width="1.9" stroke-linecap="round"/>
          <path class="winter-leg winter-leg-b" d="M1-8 2.1 0" stroke="#202632" stroke-width="1.9" stroke-linecap="round"/>
          <path d="M-3.1-16.5Q0-19 3.1-16.5L3.6-7.2Q0-5.5-3.6-7.2Z" fill="currentColor"/>
          <path class="winter-arm" d="M-2.6-15.5-4.5-8" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>
          <path d="M2.8-15.5 4-9.2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <circle cy="-20.1" r="2.4" fill="#bc9983"/><path d="M-2.5-20.8Q-2.7-24 0-23.6Q2.8-23.4 2.5-20.8Z" fill="#303845"/>
          <path d="M-2.6-17.6 2.5-17.6" stroke="#b49b79" stroke-width="1"/>
        </g>
      </defs>
      <g class="winter-water" clip-path="url(#${id}-canal)">${Array.from({length:18},(_,i)=>`<path data-ripple="${i}" d="M${470+(i%5)*175},${807+i*12}q${12+i%4*7} -2 ${27+i%3*12} 0t${20+i%4*9} 0" fill="none" stroke="${i%3?'#f9c071':'#6d92a8'}" stroke-width="${i%3?1.3:2.1}" opacity=".3"/>`).join('')}</g>
      <g class="winter-home-windows">${panes(windows,'home')}</g>
      <g class="winter-factory-windows">${panes(factoryWindows,'factory')}</g>
      <g class="winter-renovation-detail" clip-path="url(#${id}-home)">
        <path d="M349 305 648 284 649 579 347 610Z" fill="#efd7ab" opacity=".085"/>
        <path d="M354 304 647 284M349 371 647 346M349 446 648 419M349 518 648 491" stroke="#e9d5b4" stroke-width="2" opacity=".48"/>
        <path d="M386 309 386 601M521 299 521 590M578 294 578 586" stroke="#dfcfaf" stroke-width="2.4" opacity=".3"/>
      </g>
      <g class="winter-renovation-detail"><path d="M349 290 416 216 529 178 642 268 648 287 490 309Z" fill="#244a59" opacity=".095"/><path d="M356 291 491 303 644 282" stroke="#b7d2d4" stroke-width="2.1" opacity=".66"/><path d="M375 268 408 228 438 219 407 266Z" fill="#233947" stroke="#9aaeb4" stroke-width="1" opacity=".8"/><path d="M389 269 423 224M380 252 422 246" stroke="#7e9eaa" stroke-width=".8" opacity=".65"/></g>
      <g class="winter-scaffold" clip-path="url(#${id}-home)">
        <path d="M350 308 521 301 521 603 350 615Z" fill="#778c87" opacity=".15"/>
        ${[354,391,432,474,516].map(x=>`<path d="M${x} 305V612" stroke="#a6a4a0" stroke-width="2"/>`).join('')}
        ${[331,385,441,498,558,603].map(y=>`<path d="M348 ${y} 524 ${y-7}" stroke="#b9b4a6" stroke-width="2.2"/><path d="M350 ${y+3} 522 ${y-4}" stroke="#4b5156" stroke-width="2.8"/>`).join('')}
        <path d="m354 385 37-53m0 109 41-58m0 113 42-57m0 115 42-56M354 498l37 57M391 441l41 52M432 385l42 51" stroke="#a6a4a0" stroke-width="1.2" opacity=".8"/>
        <path d="M353 562 519 555 519 580 353 588Z" fill="#687c75" opacity=".52"/>
      </g>
      <g class="winter-steam" filter="url(#${id}-steam)">${Array.from({length:12},(_,i)=>`<ellipse data-steam="${i}" cx="0" cy="0" rx="${13+i%3*4}" ry="${7+i%3*3}" fill="#afbac5" opacity="0"/>`).join('')}</g>
      <g class="winter-loading"><path d="M1173 548 1205 552 1204 562 1172 558Z" fill="#4d3d31"/><path d="M1175 538 1187 539 1187 551 1175 550ZM1190 540 1202 541 1202 553 1190 552Z" fill="#a38054" stroke="#5d4b38" stroke-width=".7"/><path d="M1181 539v11m15-9v11" stroke="#c3a879" stroke-width="1"/></g>
      <g data-van class="winter-van">
        <ellipse cx="0" cy="4" rx="21" ry="6" fill="#0b1721" opacity=".34"/>
        <path d="m-14-23 19-3 13 8-18 4Z" fill="#bcb9a9"/>
        <path d="m-14-23 14 9v20l-15-9Z" fill="#858984"/>
        <path d="m0-14 18-4v20L0 6Z" fill="#d0ccba"/>
        <path d="m2-12 14-3v7L2-5Z" fill="#283e48" stroke="#e2d4b7" stroke-width=".65"/>
        <path d="m-11-20 9 6v8l-9-5Z" fill="#233641"/>
        <path d="M9-3v7M1 1l16-3" stroke="#868d85" stroke-width=".7"/>
        <ellipse cx="-10" cy="1" rx="2.7" ry="4.2" fill="#17222c"/><ellipse cx="14" cy="3" rx="2.5" ry="3.6" fill="#17222c"/>
        <path d="m1 3 3-.5m10-2 3-.5" stroke="#ff8761" stroke-width="1.8"/><path d="M5 3.3 10 2.2" stroke="#ddd5bd" stroke-width="1.3"/>
      </g>
      <g class="winter-pedestrians">${Array.from({length:13},(_,i)=>`<g data-person="${i}" class="winter-pedestrian${i>5?' winter-worker':''}" style="color:${['#253640','#584944','#3d4d47','#656054','#354351','#705044'][i%6]}"><use href="#${id}-person"/>${i>5?'<path d="M-2.7-21.1Q-2.7-24.2 0-24.2Q2.7-24.2 2.7-21.1Z" fill="#c5a261"/><path d="m-2-16 1.1 6m2-6-1.1 6" stroke="#b59b5d" stroke-width=".8"/>':i%3===0?'<path d="M4-9h3v5H4Z" fill="#846e52"/>':''}</g>`).join('')}</g>
      <g class="winter-construction-person"><g transform="translate(415 436) scale(.8)"><use href="#${id}-person" style="color:#725f43"/><path d="M-2.8-21Q-3-24.5 0-24.5Q3-24.5 2.8-21Z" fill="#d1af63"/></g></g>
      <g class="winter-snow">${Array.from({length:40},(_,i)=>`<circle data-flake="${i}" r="${.7+(i%4)*.35}" fill="#ecf4f7" opacity="${.22+i%4*.09}"/>`).join('')}</g>
      <g class="winter-spring-detail" fill="#8da16c" opacity=".33"><ellipse cx="398" cy="538" rx="10" ry="29"/><ellipse cx="605" cy="526" rx="6" ry="17"/><ellipse cx="547" cy="557" rx="5" ry="14"/><ellipse cx="988" cy="497" rx="10" ry="20"/></g>
    </svg>
    <div class="winter-stage-atmosphere" aria-hidden="true"></div>
  </div>`
}

export function mountScene(host: HTMLElement) {
  const stage = host.matches('[data-scene-stage]') ? host : host.querySelector<HTMLElement>('[data-scene-stage]')
  if (!stage) throw new Error('Winter scene must be rendered before mounting.')
  const people = Array.from(stage.querySelectorAll<SVGGElement>('[data-person]'))
  const steam = Array.from(stage.querySelectorAll<SVGEllipseElement>('[data-steam]'))
  const flakes = Array.from(stage.querySelectorAll<SVGCircleElement>('[data-flake]'))
  const ripples = Array.from(stage.querySelectorAll<SVGPathElement>('[data-ripple]'))
  const van = stage.querySelector<SVGGElement>('[data-van]')!
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let state: VisualState = {season:'winter',warmth:.5,activity:.5,construction:false,renovated:false,caption:''}
  let paused = false, visible = true, disposed = false, frame = 0, last = 0, elapsed = 0
  const routes = [
    [340,648,615,604,762,480], [785,464,847,361,869,302], [305,699,537,648,692,551],
    [997,516,975,440,953,371], [1429,686,1185,600,1020,535], [748,492,796,434,828,373],
    [1080,561,1141,565,1192,575], [1303,620,1195,579,1121,566], [1099,561,1040,538,1006,507],
    [1180,582,1265,604,1340,635], [1001,498,1027,536,1080,560], [1176,559,1190,566,1211,571],
    [370,624,422,606,459,594],
  ]
  function paint(t:number) {
    people.forEach((person,i)=>{
      const worker=i>5
      const p=(t*(worker ? .009+state.activity*.012:.011)+(i*.173))%1
      const route=routes[i], u=i%2?1-p:p, v=1-u
      const x=v*v*route[0]+2*v*u*route[2]+u*u*route[4]
      const y=v*v*route[1]+2*v*u*route[3]+u*u*route[5]
      const size=lerp(.34,1.27,clamp((y-280)/450))
      const stride=Math.sin(t*(worker?7:5.7)+i*1.7)
      person.setAttribute('transform',`translate(${x.toFixed(2)} ${(y-Math.abs(stride)*.36*size).toFixed(2)}) scale(${(size*(i%2?-1:1)).toFixed(3)} ${size.toFixed(3)})`)
      person.style.setProperty('--stride', `${stride*15}deg`)
      person.style.opacity=worker ? String(clamp((state.activity-(i-6)*.11)*5)) : '1'
    })
    const vp=(t*(.006+state.activity*.01)+.34)%1
    const vy=lerp(681,295,vp), vx=820+141*vp-34*vp*vp
    const vs=lerp(1.13,.27,vp)
    van.setAttribute('transform',`translate(${vx.toFixed(2)} ${vy.toFixed(2)}) scale(${vs.toFixed(3)})`)
    van.style.opacity=String(clamp(state.activity*3)*Math.min(1,vp*15,(1-vp)*15))
    steam.forEach((puff,i)=>{
      const age=(t*(.065+state.activity*.06)+i*.223)%1
      const chimney=i%3
      const [x,y]=[[1267,14],[1381,57],[1175,346]][chimney]
      puff.setAttribute('transform',`translate(${(x-age*95+Math.sin(age*4+i)*9).toFixed(1)} ${(y-age*(chimney===2?90:132)).toFixed(1)}) scale(${(.35+age*2.5).toFixed(2)})`)
      puff.style.opacity=String(Math.sin(age*Math.PI)*(.05+state.activity*.28))
    })
    flakes.forEach((flake,i)=>{
      const depth=.45+i%4*.23
      const x=(i*433.7+t*(9+i%3*3)+Math.sin(t*.22+i)*12)%1580-20
      const y=(i*197.3+t*(17+depth*16))%1080-24
      flake.setAttribute('cx',x.toFixed(1)); flake.setAttribute('cy',y.toFixed(1))
    })
    ripples.forEach((ripple,i)=>{
      ripple.setAttribute('transform',`translate(${(Math.sin(t*.55+i)*9).toFixed(1)} ${(Math.sin(t*.35+i)*1.5).toFixed(1)})`)
      ripple.style.opacity=String(.08+(Math.sin(t*.8+i)*.5+.5)*.22)
    })
  }
  function isRunning() {return !disposed&&!paused&&visible&&!document.hidden&&!motion.matches}
  function tick(now:number) {
    frame=0
    if (!isRunning()) return
    if (!last) last=now
    const delta=now-last
    if(delta>=1000/30) {elapsed+=Math.min(delta,100)/1000;last=now;paint(elapsed)}
    frame=requestAnimationFrame(tick)
  }
  function reconcile() {
    const running=isRunning()
    stage!.dataset.animationPaused=String(!running)
    host.dataset.animationPaused=String(!running)
    if(running&&!frame){last=0;frame=requestAnimationFrame(tick)}
    else if(!running&&frame){cancelAnimationFrame(frame);frame=0;last=0}
  }
  const observer = new IntersectionObserver(entries=>{visible=entries.some(e=>e.isIntersecting);reconcile()},{threshold:.01})
  observer.observe(stage)
  document.addEventListener('visibilitychange',reconcile)
  motion.addEventListener('change',reconcile)
  function update(next:VisualState) {
    state={...next,warmth:clamp(next.warmth),activity:clamp(next.activity)}
    for(const element of new Set([host,stage!])) {
      element.dataset.season=state.season
      element.dataset.warmth=state.warmth.toFixed(3)
      element.dataset.activity=state.activity.toFixed(3)
      element.dataset.renovated=String(state.renovated)
      element.dataset.construction=String(state.construction)
    }
    stage!.style.setProperty('--home-warmth',String(state.warmth))
    stage!.style.setProperty('--factory-activity',String(state.activity))
    stage!.setAttribute('aria-label',`Un quartier français ${state.season==='spring'?'au printemps':'en hiver'}. ${state.caption}`)
    paint(elapsed)
  }
  update(state); reconcile()
  return {update,setPaused(value:boolean){paused=value;reconcile()},dispose(){disposed=true;reconcile();observer.disconnect();document.removeEventListener('visibilitychange',reconcile);motion.removeEventListener('change',reconcile)}}
}
