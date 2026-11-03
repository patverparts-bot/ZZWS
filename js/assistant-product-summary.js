(() => {
  // Prefer useful technical facts; keep source labels and values unchanged.
  const important=/dimensions|width|height|depth|volume|capacity|diagonal|screen size|resolution|memory|processor|power|noise|energy|motor|compressor|no.?frost|smart|grill|convection|installation|размер|объ[её]м|мощност|տարող|չափ/i;
  const secondary=/manufacturer|country|warranty|colou?r|model|brand/i;
  window.ZZWS_ASSISTANT_SUMMARY=specs=>{
    const rows=(specs||[]).filter(s=>s&&s.name&&s.value!=null),preferred=rows.filter(s=>important.test(s.name));
    return [...preferred,...rows.filter(s=>!preferred.includes(s)&&!secondary.test(s.name)),...rows.filter(s=>secondary.test(s.name))].slice(0,4);
  };
})();
