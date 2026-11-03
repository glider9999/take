import { ChatApp } from './components/ChatApp.js';

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app');
  if (root) {
    const app = new ChatApp({ container: root, isDesktop: false });
    app.mount();
  }
});

