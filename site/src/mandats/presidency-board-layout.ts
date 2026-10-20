/** Project real map anchors into the viewport, then separate readable labels.
 * Leader lines preserve location; off-screen places remain actionable. */
export function layoutPresidencyPins(host: HTMLElement): void {
  const country = host.querySelector<HTMLElement>('.pr-country')!;
  const world = host.querySelector<HTMLElement>('.pr-world')!;
  const area = country.getBoundingClientRect(), map = world.getBoundingClientRect();
  if (!area.width || !area.height) return;
  const mobile = area.width <= 650;
  const width = mobile ? Math.min(156, (area.width - 26) / 2) : 190;
  const strategy = host.matches('[data-version="17"]');
  const compact = strategy && mobile && window.matchMedia("(max-height:650px)").matches;
  const height = compact ? 48 : mobile ? 68 : 76;
  const top = compact ? 6 : 14, bottom = area.height - 58;
  const pins = [...country.querySelectorAll<HTMLElement>('.pr-board-pin')];
  const positions = pins.map((pin, index) => {
    pin.hidden=false;
    pin.dataset.pinAccessibleName ??= pin.getAttribute('aria-label') ?? '';
    pin.setAttribute('aria-label',pin.dataset.pinAccessibleName);
    delete pin.dataset.clusterMembers;
    pin.querySelector('.pr-pin-count')?.remove();
    const ax = map.left - area.left + Number(pin.dataset.mapX) / 100 * map.width;
    const ay = map.top - area.top + Number(pin.dataset.mapY) / 100 * map.height;
    const side = mobile ? index % 2 : ax < area.width / 2 ? 0 : 1;
    return { pin, ax, ay, side, x: Math.max(8, Math.min(area.width-width-8, ax + (side ? 20 : -width-20))), y: Math.max(top, Math.min(bottom-height, ay-height/2)) };
  });
  if (mobile) {
    const maxPins=Math.max(4,Math.min(8,Math.floor((bottom-top+(strategy ? 4 : 0))/(height+(strategy ? 4 : 8)))*2));
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
    if(pin.dataset.panel)button.dataset.panel=pin.dataset.panel;
    button.dataset.mapX=pin.dataset.mapX;
    button.innerHTML=pin.querySelector('.pr-pin__label')?.innerHTML ?? '';
    const countdown=pin.querySelector<HTMLElement>('[data-crisis-due]');
    if(countdown){const time=countdown.cloneNode(true) as HTMLElement;time.className='pr-cluster-time';button.appendChild(time);}
    wrapper.appendChild(button);
  }
  return `<section class="pr-fan pr-cluster-fan" aria-label="Événements proches"><header><strong>Événements proches · ${wrapper.childElementCount}</strong><button type="button" data-action="presidency-deselect" aria-label="Fermer les événements">×</button></header>${wrapper.innerHTML}</section>`;
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
