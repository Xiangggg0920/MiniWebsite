const media = JSON.parse(document.querySelector('#media').textContent);
const stories = media.filter(item => item.type === 'shorts');
const gallery = media.filter(item => item.type !== 'shorts');
document.querySelector('#post-count').textContent = gallery.length;
const avatar = document.querySelector('.avatar-trigger');
const filters = document.querySelectorAll('[data-filter]');
const grid = document.querySelector('.grid');
const empty = document.querySelector('.empty');
const dialog = document.querySelector('dialog');
const preview = document.querySelector('.preview');
let opener;

function errorMessage(message) {
  const element = document.createElement('span');
  element.className = 'error';
  element.textContent = message;
  return element;
}

function photo(item, thumbnail = false) {
  const img = document.createElement('img');
  img.alt = thumbnail ? '' : item.name;
  if (thumbnail) img.loading = 'lazy';
  img.addEventListener('error', () => img.replaceWith(errorMessage('照片無法載入')), { once: true });
  img.src = item.url;
  return img;
}

function show(item, button, storyIndex = -1) {
  opener = button;
  const isStory = storyIndex >= 0;
  dialog.classList.toggle('story', isStory);
  dialog.setAttribute('aria-label', isStory ? 'Mini 的限時動態' : '媒體預覽');
  if (item.type === 'image') {
    preview.replaceChildren(photo(item));
  } else {
    const video = document.createElement('video');
    video.controls = true;
    video.playsInline = true;
    if (item.poster) video.poster = item.poster;
    video.setAttribute('aria-label', item.name);
    video.addEventListener('error', () => video.replaceWith(errorMessage('影片無法播放')), { once: true });
    video.src = item.url;
    preview.replaceChildren(video);
    if (isStory) {
      video.muted = true;
      video.addEventListener('ended', () => {
        if (!dialog.open) return;
        const next = stories[storyIndex + 1];
        if (next) show(next, button, storyIndex + 1);
        else dialog.close();
      }, { once: true });
      video.play().catch(() => {
        // 原生播放控制可供訪客在瀏覽器阻擋自動播放時使用。
      });
    }
  }
  if (!dialog.open) dialog.showModal();
}

function render(filter) {
  const items = gallery.filter(item => filter === 'all' || item.type === filter);
  grid.replaceChildren(...items.map(item => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `tile ${item.type}`;
    button.setAttribute('aria-label', `開啟${item.type === 'image' ? '照片' : '影片'}：${item.name}`);
    if (item.type === 'image') {
      button.append(photo(item, true));
    } else {
      if (item.poster) {
        const poster = document.createElement('img');
        poster.alt = '';
        poster.loading = 'lazy';
        poster.addEventListener('error', () => poster.remove(), { once: true });
        poster.src = item.poster;
        button.append(poster);
      }
      const icon = document.createElement('span');
      icon.className = 'play';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = '▶';
      button.append(icon);
    }
    button.addEventListener('click', () => show(item, button));
    return button;
  }));
  empty.hidden = items.length > 0;
  empty.textContent = items.length ? '' : '這裡還沒有媒體。';
}

filters.forEach(button => button.addEventListener('click', () => {
  filters.forEach(filter => filter.setAttribute('aria-pressed', String(filter === button)));
  render(button.dataset.filter);
}));
dialog.addEventListener('close', () => {
  preview.replaceChildren();
  opener?.focus();
});
if (stories.length) {
  avatar.disabled = false;
  avatar.addEventListener('click', () => show(stories[0], avatar, 0));
}
render('all');
