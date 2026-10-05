import './input.css';

export function setMenuState(button, navigation, isOpen) {
  button.setAttribute('aria-expanded', String(isOpen));
  button.setAttribute(
    'aria-label',
    isOpen ? 'Close navigation menu' : 'Open navigation menu',
  );
  navigation.dataset.open = String(isOpen);
}

export function bindMenu(button, navigation) {
  if (!button || !navigation) {
    return () => {};
  }

  let isOpen = false;
  const update = (nextOpen) => {
    isOpen = nextOpen;
    setMenuState(button, navigation, isOpen);
  };
  const onToggle = () => update(!isOpen);
  const onNavigationClick = (event) => {
    if (event.target instanceof Element && event.target.closest('a')) {
      update(false);
    }
  };
  const onKeydown = (event) => {
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      update(false);
      button.focus();
    }
  };

  update(false);
  button.addEventListener('click', onToggle);
  navigation.addEventListener('click', onNavigationClick);
  document.addEventListener('keydown', onKeydown);

  return () => {
    button.removeEventListener('click', onToggle);
    navigation.removeEventListener('click', onNavigationClick);
    document.removeEventListener('keydown', onKeydown);
  };
}

export function bindImageFallbacks(root = document) {
  const handlers = new Map();
  const images = [...root.querySelectorAll('[data-fallback-image]')];
  const failImage = (image) => {
    image.hidden = true;
    image.closest('[data-image-frame]')?.classList.add('is-fallback');
  };

  for (const image of images) {
    if (image.complete && image.naturalWidth === 0) {
      failImage(image);
      continue;
    }

    const onError = () => failImage(image);
    handlers.set(image, onError);
    image.addEventListener('error', onError, { once: true });
  }

  return () => {
    for (const [image, onError] of handlers) {
      image.removeEventListener('error', onError);
    }
  };
}
