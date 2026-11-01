(() => {
  const desktop = window.matchMedia('(min-width: 768px) and (hover: hover)');
  let preview;
  function hidePreview() {
    if (preview?.classList.contains('is-visible')) preview.classList.remove('is-visible');
  }

  document.addEventListener('pointerover', event => {
    if (!desktop.matches || event.pointerType === 'touch' || document.querySelector('dialog[open]')) return;
    const container = event.target.closest?.('.product-img-container');
    if (!container || container.contains(event.relatedTarget)) return;
    const image = container.querySelector('.product-img.image-loaded');
    if (!image || !image.complete || !image.naturalWidth) return;
    if (!preview) {
      preview = document.createElement('div');
      preview.className = 'desktop-photo-preview';
      preview.setAttribute('aria-hidden', 'true');
      preview.appendChild(document.createElement('img'));
      document.body.appendChild(preview);
    }
    const rect = container.getBoundingClientRect();
    const gap = 12;
    const size = Math.min(560, window.innerWidth - gap * 2, window.innerHeight - gap * 2);
    const beside = rect.right + gap + size <= window.innerWidth - gap ? rect.right + gap : rect.left - gap - size;
    const left = Math.max(gap, Math.min(beside, window.innerWidth - size - gap));
    const top = Math.max(gap, Math.min(rect.top + rect.height / 2 - size / 2, window.innerHeight - size - gap));
    preview.style.width = size + 'px';
    preview.style.height = size + 'px';
    preview.style.left = left + 'px';
    preview.style.top = top + 'px';
    preview.firstElementChild.src = image.currentSrc || image.src;
    preview.firstElementChild.alt = image.alt;
    preview.classList.add('is-visible');
  });

  document.addEventListener('pointerout', event => {
    const container = event.target.closest?.('.product-img-container');
    if (container && !container.contains(event.relatedTarget)) hidePreview();
  });
  document.addEventListener('scroll', hidePreview, true);
  window.addEventListener('resize', hidePreview);
  window.addEventListener('blur', hidePreview);
  document.addEventListener('pointerdown', hidePreview, true);
  // Modal openings and logout must not leave a floating photo above the new screen.
  const modalObserver = new MutationObserver(() => {
    if (document.querySelector('dialog[open]') || document.getElementById('mainApp')?.classList.contains('hidden')) hidePreview();
  });
  modalObserver.observe(document.body, {subtree:true, attributes:true, attributeFilter:['open']});
  const mainApp = document.getElementById('mainApp');
  if (mainApp) modalObserver.observe(mainApp, {attributes:true, attributeFilter:['class']});
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') hidePreview();
  });
})();
