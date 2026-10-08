// <mm-motion-mark tone="primary|reverse|black|white|ignition" size="32" animate="once|loop" optical="auto|on|off">
// Production Motion Mark. Sequence: / → // → /// → ///. (signal arrives last). Honors prefers-reduced-motion.
(() => {
  if (customElements.get('mm-motion-mark')) return;
  const S = ["M2.91 59.34Q0 64 5.5 64L24 64Q26 64 27.06 62.3L63.09 4.66Q66 0 60.5 0L42 0Q40 0 38.94 1.7Z","M35.91 59.34Q33 64 38.5 64L57 64Q59 64 60.06 62.3L96.09 4.66Q99 0 93.5 0L75 0Q73 0 71.94 1.7Z","M68.91 59.34Q66 64 71.5 64L90 64Q92 64 93.06 62.3L129.09 4.66Q132 0 126.5 0L108 0Q106 0 104.94 1.7Z"], SIG = "M100.59 61.46Q99 64 102 64L119.8 64Q121 64 121.64 62.98L131.91 46.54Q133.5 44 130.5 44L112.7 44Q111.5 44 110.86 45.02Z", W = 134.5;
  const TONES = { primary:['#0B0B0B','#FF4A00'], reverse:['#EDE9E4','#FF4A00'], black:['#0B0B0B','#0B0B0B'], white:['#FFFFFF','#FFFFFF'], ignition:['#FF4A00','#FF4A00'], 'ink-on-ignition':['#0B0B0B','#0B0B0B'] };
  class MM extends HTMLElement {
    static get observedAttributes() { return ['tone','size','animate','optical','replay']; }
    connectedCallback() { this.render(); }
    attributeChangedCallback() { if (this.isConnected) this.render(); }
    render() {
      const [st, sg] = TONES[this.getAttribute('tone')] || TONES.primary;
      const size = +(this.getAttribute('size') || 32), anim = this.getAttribute('animate');
      const opt = this.getAttribute('optical') || 'auto', small = opt === 'on' || (opt === 'auto' && size <= 24);
      const vb = '0 0 ' + W + ' 64', s = S, g = SIG, w = size * W / 64;
      const root = this.shadowRoot || this.attachShadow({ mode: 'open' });
      const it = anim === 'loop' ? 'infinite' : '1';
      root.innerHTML = `<style>:host{display:inline-block;line-height:0}svg{display:block}
        .a path{opacity:0;animation:in var(--d,1.4s) cubic-bezier(.2,0,0,1) both ${it}}
        .a .s0{animation-delay:0ms}.a .s1{animation-delay:90ms}.a .s2{animation-delay:180ms}.a .sg{animation-delay:300ms}
        @keyframes in{0%{opacity:0;transform:translateX(-6%)}${anim==='loop'?'15%{opacity:1;transform:none}80%{opacity:1}100%{opacity:0}':'100%{opacity:1;transform:none}'}}
        @media (prefers-reduced-motion:reduce){.a path{animation:none;opacity:1}}</style>
        <svg viewBox="${vb}" width="${w}" height="${size}" role="img" aria-label="${this.getAttribute('label') || 'MorrMoto'}" class="${anim ? 'a' : ''}" style="${anim === 'once' ? '--d:520ms' : ''}">${s.map((p, i) => `<path class="s${i}" d="${p}" fill="${st}"/>`).join('')}<path class="sg" d="${g}" fill="${sg}"/></svg>`;
    }
  }
  customElements.define('mm-motion-mark', MM);
})();
