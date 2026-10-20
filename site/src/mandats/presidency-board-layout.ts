type LabelRect = { x:number; y:number; width:number; height:number };
/** Find the closest free rectangle, using measured label dimensions. Stable
 * iteration order keeps placement deterministic across refreshes. */
export function placePresidencyLabels(labels:LabelRect[],width:number,height:number): LabelRect[] {
 const placed:LabelRect[]=[];
 for(const label of labels) {
  const x=Math.max(8,Math.min(width-label.width-8,label.x-label.width/2));
  const y=Math.max(8,Math.min(height-label.height-8,label.y-label.height/2));
  const xs=[x,8,Math.max(8,width-label.width-8)], ys=[y,8,Math.max(8,height-label.height-8)];
  for(let n=8;n<=width-label.width-8;n+=8)xs.push(n);
  for(let n=8;n<=height-label.height-8;n+=8)ys.push(n);
  let best:LabelRect|undefined,distance=Infinity;
  for(const px of xs)for(const py of ys) {
   const cost=(px-x)**2+(py-y)**2;
   if(cost>=distance)continue;
   if(placed.some(p=>px<p.x+p.width+6&&px+label.width+6>p.x&&py<p.y+p.height+6&&py+label.height+6>p.y))continue;
   best={...label,x:px,y:py};distance=cost;
  }
  placed.push(best ?? {...label,x,y});
 }
 return placed;
}

function layoutStrategyPins(host:HTMLElement,country:HTMLElement,world:HTMLElement):void {
 const area=country.getBoundingClientRect(), map=world.getBoundingClientRect();
 const mobile=area.width<=650;
 const dock=host.querySelector<HTMLElement>('[data-live-fan]:not([hidden])');
 const availableWidth=!mobile&&dock ? dock.getBoundingClientRect().left-area.left-8 : area.width;
 const compact=mobile||availableWidth<650||area.height<250;
 const gap=6, columns=area.height<250 && availableWidth>=650 ? 6 : 3;
 const width=compact ? Math.min(160,(availableWidth-16-gap*(columns-1))/columns) : 160;
 const sectors=[...country.querySelectorAll<HTMLElement>('.pr-sector-pin')];
 const anchor=(pin:HTMLElement)=>({x:map.left-area.left+Number(pin.dataset.mapX)/100*map.width,y:map.top-area.top+Number(pin.dataset.mapY)/100*map.height});
 sectors.forEach(pin=>{pin.hidden=false;pin.dataset.pinLayout=compact?'compact':'map';pin.style.width=`${width}px`;});
 const rowHeight=Math.max(44,...sectors.map(pin=>pin.getBoundingClientRect().height));
 const labels=sectors.map((pin,i)=>{const rect=pin.getBoundingClientRect();return {...(compact?{x:8+i%columns*(width+gap)+width/2,y:8+Math.floor(i/columns)*(rowHeight+gap)+rect.height/2}:anchor(pin)),width:rect.width,height:rect.height};});
 const events=[...country.querySelectorAll<HTMLElement>('.pr-board-pin')];
 events.forEach(pin=>{pin.hidden=false;pin.dataset.pinAccessibleName??=pin.getAttribute('aria-label')??'';pin.setAttribute('aria-label',pin.dataset.pinAccessibleName);delete pin.dataset.clusterMembers;delete pin.dataset.clusterSeverity;pin.querySelector('.pr-pin-count')?.remove();pin.style.height='';});
 const rowsBottom=Math.max(8,...labels.map(p=>p.y+p.height/2))+6;
 // Reserve a compact event row before the phone panel; every member remains
 // available in the existing accessible cluster list.
 const groupEvents=compact&&events.length>0;
 const visibleEvents=groupEvents?events.slice(0,1):events;
 if(groupEvents) {
  const primary=events[0];primary.dataset.clusterMembers=JSON.stringify(events.map(p=>p.dataset.pinKey));
  primary.setAttribute('aria-label',`${events.length} événement${events.length===1?'':'s'} : ${events.map(p=>p.dataset.pinAccessibleName).join(' ; ')}`);
  if(events.some(p=>p.dataset.eventKind==='political'))primary.dataset.clusterSeverity='critical';
  const badge=document.createElement('span');badge.className='pr-pin-count';badge.textContent=String(events.length);primary.appendChild(badge);
  events.slice(1).forEach(pin=>pin.hidden=true);
 }
 visibleEvents.forEach((pin,i)=>{pin.style.width=`${compact?Math.min(240,availableWidth-(mobile?160:16)):190}px`;pin.dataset.pinLayout=compact?'compact':'map';if(compact)pin.style.height='44px';const rect=pin.getBoundingClientRect();labels.push({...compact?{x:mobile?8+rect.width/2:availableWidth/2,y:rowsBottom+rect.height/2+i*(rect.height+8)}:anchor(pin),width:rect.width,height:rect.height});});
 const boxes=placePresidencyLabels(labels,availableWidth,area.height);
 const pins=[...sectors,...visibleEvents];
 pins.forEach((pin,i)=>{pin.style.left=`${boxes[i].x}px`;pin.style.top=`${boxes[i].y}px`;});
 if(mobile&&dock) dock.style.setProperty('--pr-mobile-fan-top',`${Math.max(8,...boxes.map(p=>p.y+p.height))+8}px`);
 const leaders=pins.map((pin,i)=>{const a=anchor(pin),p=boxes[i];return `<path d="M${p.x+p.width/2} ${p.y+p.height/2} L${a.x} ${a.y}"/><circle cx="${a.x}" cy="${a.y}" r="3"/>`;});
 const svg=host.querySelector<SVGElement>('[data-pin-leaders]')!;svg.setAttribute('viewBox',`0 0 ${area.width} ${area.height}`);svg.innerHTML=leaders.join('');
 host.dataset.pinLayoutViewport=`${Math.round(area.width)}x${Math.round(area.height)}`;
}
/** Project real map anchors into the viewport, then separate readable labels.
 * Leader lines preserve location; off-screen places remain actionable. */
export function layoutPresidencyPins(host: HTMLElement): void {
  const country = host.querySelector<HTMLElement>('.pr-country')!;
  const world = host.querySelector<HTMLElement>('.pr-world')!;
  if(host.dataset.version==='17') {
    const brief=host.querySelector<HTMLElement>('.pr-strategy-brief');
    if(brief) {
      const height=`${brief.getBoundingClientRect().height}px`;
      if(host.style.getPropertyValue('--pr-strategy-brief-height')!==height)host.style.setProperty('--pr-strategy-brief-height',height);
    }
    const style=getComputedStyle(host), root=host.getBoundingClientRect();
    const nominalBottom=parseFloat(style.getPropertyValue('--pr-strategy-sectors'))+parseFloat(style.getPropertyValue('--pr-strategy-news'));
    // Compare against the nominal footer, independently of the current fallback.
    // This avoids toggling it back on as soon as the extra room becomes available.
    const available=root.bottom-country.getBoundingClientRect().top-nominalBottom;
    const rows=root.width<=650?2:1;
    const pinHeight=Math.max(44,...[...country.querySelectorAll<HTMLElement>('.pr-sector-pin')].map(pin=>pin.getBoundingClientRect().height));
    host.dataset.compactReadings=String(available<16+rows*(pinHeight+6)+50);
  }
  const area = country.getBoundingClientRect(), map = world.getBoundingClientRect();
  if (!area.width || !area.height) return;
  if(host.dataset.version==='17'){layoutStrategyPins(host,country,world);return;}
  const mobile = area.width <= 650;
  // Six compact sector controls always remain separate; only event cards cluster.
  const sectorPins = [...country.querySelectorAll<HTMLElement>('.pr-sector-pin')];
  const dock = host.querySelector<HTMLElement>('[data-live-fan][data-fan-docked]:not([hidden])');
  // Measure the space before the dock, rather than a nominal minimum width that
  // can put controls behind it on landscape phones.
  const usableWidth = !mobile && dock ? Math.max(0, dock.getBoundingClientRect().left - area.left - 8) : area.width;
  const compactGrid = !mobile && (area.height < 250 || usableWidth < 650);
  const columns = compactGrid ? 3 : 2;
  const pinWidth = compactGrid ? Math.min(160, (usableWidth - 32) / columns)
    : mobile ? Math.min(150, (area.width - 24) / 2) : 160;
  sectorPins.forEach((pin, index) => {
    pin.hidden = false;
    pin.dataset.pinLayout = compactGrid ? 'compact' : 'map';
    const ax = map.left - area.left + Number(pin.dataset.mapX) / 100 * map.width;
    const ay = map.top - area.top + Number(pin.dataset.mapY) / 100 * map.height;
    const x = compactGrid ? 8 + index % columns * (usableWidth - 16 - pinWidth) / (columns - 1)
      : mobile ? 8 + index % columns * (area.width - 16) / columns
      : Math.max(8, Math.min(usableWidth - pinWidth - 8, ax - pinWidth / 2));
    const y = compactGrid ? 8 + Math.floor(index / columns) * 52
      : mobile ? 12 + Math.floor(index / columns) * 52
      : Math.max(12, Math.min(area.height - 100, ay - 24));
    pin.style.left = `${x}px`; pin.style.top = `${y}px`; pin.style.width = `${pinWidth}px`;
  });
  const width = mobile ? Math.min(156, (area.width - 26) / 2) : 190;
  const height = mobile ? 68 : 76;
  const top = 14, bottom = area.height - 58;
  const pins = [...country.querySelectorAll<HTMLElement>('.pr-board-pin')];
  const positions = pins.map((pin, index) => {
    pin.hidden=false;
    pin.dataset.pinAccessibleName ??= pin.getAttribute('aria-label') ?? '';
    pin.setAttribute('aria-label',pin.dataset.pinAccessibleName);
    delete pin.dataset.clusterMembers;
    delete pin.dataset.clusterSeverity;
    pin.querySelector('.pr-pin-count')?.remove();
    const ax = map.left - area.left + Number(pin.dataset.mapX) / 100 * map.width;
    const ay = map.top - area.top + Number(pin.dataset.mapY) / 100 * map.height;
    const side = mobile ? index % 2 : ax < area.width / 2 ? 0 : 1;
    return { pin, ax, ay, side, x: Math.max(8, Math.min(area.width-width-8, ax + (side ? 20 : -width-20))), y: Math.max(top, Math.min(bottom-height, ay-height/2)) };
  });
  if (mobile) {
    const maxPins=Math.max(4,Math.min(8,Math.floor((bottom-top)/(height+8))*2));
    const groups=positions.map(p=>[p]);
    while(groups.length>maxPins) {
      let first=0,second=1,nearest=Infinity;
      for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++) {
        const a=groups[i][0],b=groups[j][0];
        const distance=Math.hypot(a.ax-b.ax,a.ay-b.ay);
        if(distance<nearest){nearest=distance;first=i;second=j;}
      }
      groups[first].push(...groups[second]);groups.splice(second,1);
    }
    for(const group of groups) if(group.length>1) {
      const primary=group[0].pin;
      primary.dataset.clusterMembers=JSON.stringify(group.map(p=>p.pin.dataset.pinKey));
      if(group.some(p=>p.pin.dataset.severity==='critical'||p.pin.dataset.stage==='crisis'||p.pin.dataset.eventKind==='political'))primary.dataset.clusterSeverity='critical';
      primary.setAttribute('aria-label',`${group.length} événements proches : ${group.map(p=>p.pin.dataset.pinAccessibleName).join(' ; ')}`);
      const badge=document.createElement('span');badge.className='pr-pin-count';badge.textContent=`+${group.length-1}`;
      badge.setAttribute('aria-label',`${group.length} événements regroupés, ouvrir la liste`);primary.appendChild(badge);
      for(const p of group.slice(1))p.pin.hidden=true;
    }
    positions.splice(0,positions.length,...groups.map((group,i)=>({...group[0],side:i%2})));
    for (const side of [0,1]) {
      const column = positions.filter(p => p.side === side).sort((a,b)=>a.ay-b.ay);
      const gap = Math.max(4, Math.min(24, (bottom-top-column.length*height) / Math.max(1,column.length-1)));
      column.forEach((p,i)=>{
        p.x = side ? area.width-width-8 : 8;
        const low = top + i*(height+gap);
        const high = bottom - (column.length-i)*height - (column.length-i-1)*gap;
        p.y = Math.max(low, Math.min(high,p.y));
        if(i) p.y=Math.max(p.y,column[i-1].y+height+gap);
      });
    }
  } else {
    // Deterministic relaxation keeps the same event near its location as others arrive.
    for(let pass=0;pass<12;pass++) for(let i=0;i<positions.length;i++) for(let j=i+1;j<positions.length;j++) {
      const a=positions[i],b=positions[j];
      if(Math.abs(a.x-b.x)<width+12 && Math.abs(a.y-b.y)<height+12) {
        const move=(height+12-Math.abs(a.y-b.y))/2;
        if(a.y<=b.y){ a.y-=move;b.y+=move; } else {a.y+=move;b.y-=move;}
        for(const p of [a,b])p.y=Math.max(top,Math.min(bottom-height,p.y));
      }
    }
  }
  const leaders = positions.map(({pin,x,y,ax,ay})=>{
    pin.style.left=`${x}px`;pin.style.top=`${y}px`;pin.style.width=`${width}px`;
    pin.dataset.offscreen=String(ax<0||ax>area.width||ay<0||ay>area.height);
    const px=Math.max(3,Math.min(area.width-3,ax)),py=Math.max(3,Math.min(area.height-3,ay));
    const fromX=x+width/2,fromY=y+height/2;
    return `<path d="M${fromX} ${fromY} L${px} ${py}"/><circle cx="${px}" cy="${py}" r="3"/>`;
  });
  const svg=host.querySelector<SVGElement>('[data-pin-leaders]')!;
  svg.setAttribute('viewBox',`0 0 ${area.width} ${area.height}`);
  svg.innerHTML=leaders.join('');
}

export function presidencyClusterMarkup(host:HTMLElement, keys:string[]): string {
  const wrapper=document.createElement('div');
  for(const key of keys) {
    const pin=[...host.querySelectorAll<HTMLElement>('.pr-board-pin')].find(p=>p.dataset.pinKey===key);
    if(!pin)continue;
    const button=document.createElement('button');button.type='button';button.className='pr-cluster-choice';
    button.dataset.action=pin.dataset.action;
    if(pin.dataset.sector)button.dataset.sector=pin.dataset.sector;
    if(pin.dataset.event)button.dataset.event=pin.dataset.event;
    button.dataset.mapX=pin.dataset.mapX;
    button.innerHTML=pin.querySelector('.pr-pin__label')?.innerHTML ?? '';
    const countdown=pin.querySelector<HTMLElement>('[data-crisis-due]');
    if(countdown){const time=countdown.cloneNode(true) as HTMLElement;time.className='pr-cluster-time';button.appendChild(time);}
    wrapper.appendChild(button);
  }
  const title=wrapper.childElementCount===1 ? "Événement proche" : "Événements proches";
  return `<section class="pr-fan pr-cluster-fan" aria-label="${title}"><header><strong>${title} · ${wrapper.childElementCount}</strong><button type="button" data-action="presidency-deselect" aria-label="Fermer les événements">×</button></header>${wrapper.innerHTML}</section>`;
}

/** Keep existing event elements so tick updates do not replay arrival animations. */
export function updatePresidencyPins(target: Element, markup: string): void {
  const template=document.createElement('template');template.innerHTML=markup;
  const existing=new Map([...target.children].map(el=>[(el as HTMLElement).dataset.pinKey,el]));
  const nodes=[...template.content.children].map(next=>{
    const current=existing.get((next as HTMLElement).dataset.pinKey);
    if(!current)return next;
    for(const attr of [...current.attributes]) if(!next.hasAttribute(attr.name)&&attr.name!=='style')current.removeAttribute(attr.name);
    for(const attr of [...next.attributes])if(current.getAttribute(attr.name)!==attr.value)current.setAttribute(attr.name,attr.value);
    if(current.innerHTML!==next.innerHTML)current.innerHTML=next.innerHTML;
    return current;
  });
  // append moves existing nodes without recreating their animation timelines.
  for(const node of [...target.children])if(!nodes.includes(node))node.remove();
  nodes.forEach(node=>target.appendChild(node));
}
