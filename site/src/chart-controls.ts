/** One delegated listener survives static prerender hydration and territory changes. */
export function bindChartControls(root: Document): void {
  function update(input: HTMLInputElement): void {
    const chart=input.closest<HTMLElement>('.chart-time');
    if(!chart) return;
    const periods: string[]=JSON.parse(chart.dataset.chartPeriods!);
    const readouts: string[]=JSON.parse(chart.dataset.chartReadouts!);
    const fractions: number[]=JSON.parse(chart.dataset.chartFractions!);
    const i=Math.max(0,Math.min(periods.length-1,Number(input.value)));
    chart.querySelector('output')!.innerHTML=readouts[i];
    input.setAttribute('aria-valuetext',periods[i]);
    chart.querySelector('.chart-scrub__year')!.textContent=periods[i];
    chart.querySelectorAll<SVGLineElement>('.chart-cursor').forEach(line=>{
      const left=Number(line.dataset.chartLeft), right=Number(line.dataset.chartRight);
      const x=left+fractions[i]*(right-left);
      line.setAttribute('x1',String(x));line.setAttribute('x2',String(x));
    });
  }
  root.addEventListener('input',event=>{if(event.target instanceof HTMLInputElement && event.target.closest('.chart-time'))update(event.target);});
  root.addEventListener('click',event=>{
    if(event.target instanceof Element) {
      const card=event.target.closest<HTMLElement>('[data-expand-card]');
      const interactive=event.target.closest('a,input,select,button');
      if(card && (!interactive || interactive.hasAttribute('data-expand-analysis')) && !card.closest('dialog')) {
        const opener=card.querySelector<HTMLButtonElement>('[data-expand-analysis]')!;
        const dialog=root.createElement('dialog');
        dialog.className='analysis-dialog';
        dialog.setAttribute('aria-label',opener.textContent??'Analyse détaillée');
        const close=root.createElement('button');close.type='button';close.className='analysis-dialog__close';close.textContent='Fermer';
        const copy=card.cloneNode(true) as HTMLElement;
        copy.removeAttribute('data-expand-card');
        copy.querySelector('[data-expand-analysis]')?.replaceWith(root.createTextNode(opener.textContent??''));
        dialog.append(close,copy);root.body.append(dialog);
        close.addEventListener('click',()=>dialog.close());
        dialog.addEventListener('close',()=>{dialog.remove();opener.focus({preventScroll:true});});
        dialog.showModal();return;
      }
    }

    if(!(event.target instanceof Element))return;
    const tab=event.target.closest<HTMLButtonElement>('[data-chart-tab]');
    if(tab){
      const scope=tab.closest('.territory-charts')!;
      scope.querySelectorAll('[data-chart-tab]').forEach(button=>button.setAttribute('aria-pressed',String(button===tab)));
      scope.querySelectorAll<HTMLElement>('[data-chart-panel]').forEach(panel=>{panel.hidden=panel.dataset.chartPanel!==tab.dataset.chartTab;});
      return;
    }
    const key=event.target.closest<HTMLButtonElement>('[data-waffle-key]');
    if(key){
      const chart=key.closest('.dataviz--composition')!;
      const selected=key.getAttribute('aria-pressed')!=='true';
      chart.querySelectorAll('[data-waffle-key]').forEach(button=>button.setAttribute('aria-pressed',String(selected && button===key)));
      chart.querySelectorAll<SVGElement>('[data-waffle-part]').forEach(cell=>{cell.style.opacity=selected && cell.dataset.wafflePart!==key.dataset.waffleKey?'.15':'1';});
    }
  });
  root.addEventListener('pointerdown',event=>{
    if(!(event.target instanceof Element))return;
    const svg=event.target.closest<SVGSVGElement>('.chart-svg');
    if(!svg)return;
    const chart=svg.closest<HTMLElement>('.chart-time')!;
    const input=chart.querySelector<HTMLInputElement>('input');if(!input)return;
    const rect=svg.getBoundingClientRect();
    const cursor=svg.querySelector<SVGLineElement>('.chart-cursor')!;
    const pos=(event.clientX-rect.left)/rect.width*svg.viewBox.baseVal.width;
    const fraction=(pos-Number(cursor.dataset.chartLeft))/(Number(cursor.dataset.chartRight)-Number(cursor.dataset.chartLeft));
    const fractions:number[]=JSON.parse(chart.dataset.chartFractions!);
    const nearest=fractions.reduce((best,v,i)=>Math.abs(v-fraction)<Math.abs(fractions[best]-fraction)?i:best,0);
    input.value=String(nearest); update(input);
  });
}
