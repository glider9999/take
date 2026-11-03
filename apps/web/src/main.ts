import { ChatApp } from '@take/ui';
import '@take/ui/styles/app.css';

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app');
  if (root) {
    const app = new ChatApp({ container: root, isDesktop: false });
    app.mount();
  }
});

