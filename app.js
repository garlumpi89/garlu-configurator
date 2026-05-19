
const btn = document.getElementById('connectBtn');
const dot = document.getElementById('statusDot');
const status = document.getElementById('connectionStatus');
const info = document.getElementById('deviceInfo');

btn.addEventListener('click', () => {
  btn.textContent = 'GARLU Connected';
  btn.classList.add('connected');

  dot.classList.add('connected');
  status.textContent = 'GARLU connected';
  info.innerHTML = 'GARLU Fader Mini<br>FW v1.7';
});
