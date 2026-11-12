/* ============================================================
   CUTE ANIMATED FLOWER BOUQUET — JavaScript
   ============================================================ */

(function () {
    'use strict';

    /* ---------- DOM References ---------- */
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => [...document.querySelectorAll(sel)];

    const bgCanvas = $('#bg-canvas');
    const bgCtx = bgCanvas.getContext('2d');
    const initialScreen = $('#initial-screen');
    const bouquetScreen = $('#bouquet-screen');
    const openBtn = $('#open-btn');
    const replayBtn = $('#replay-btn');
    const petalShowerBtn = $('#petal-shower-btn');
    const sendLoveBtn = $('#send-love-btn');
    const musicToggle = $('#music-toggle');
    const closeLoveBtn = $('#close-love-btn');
    const sendLoveOverlay = $('#send-love-overlay');
    const messageContainer = $('#message-container');
    const controls = $('#controls');
    const bouquetContainer = $('#bouquet-container');
    const bouquetSvg = $('#bouquet');

    /* ---------- State ---------- */
    let animating = false;
    let musicPlaying = false;
    let audioCtx = null;
    let gainNode = null;
    let melodyTimeout = null;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ==========================================================
       BACKGROUND PARTICLES  (Canvas)
       ========================================================== */
    const bgParticles = [];

    function resizeCanvas() {
        bgCanvas.width = window.innerWidth;
        bgCanvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    class BgParticle {
        constructor(type) {
            this.type = type;
            this.reset(true);
        }

        reset(initial = false) {
            this.x = Math.random() * bgCanvas.width;
            this.y = initial ? Math.random() * bgCanvas.height : bgCanvas.height + 20;
            this.size = 2 + Math.random() * 6;
            this.speedY = 0.15 + Math.random() * 0.5;
            this.speedX = (Math.random() - 0.5) * 0.3;
            this.opacity = 0.12 + Math.random() * 0.25;
            this.wobbleAmp = Math.random() * 20;
            this.wobbleSpeed = 0.005 + Math.random() * 0.01;
            this.phase = Math.random() * Math.PI * 2;
            this.life = 0;
        }

        update() {
            this.life++;
            this.y -= this.speedY;
            this.x += Math.sin(this.life * this.wobbleSpeed + this.phase) * 0.3 + this.speedX;
            if (this.y < -20) this.reset();
        }

        draw(ctx) {
            ctx.save();
            ctx.globalAlpha = this.opacity;
            if (this.type === 'bubble') {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 182, 213, 0.4)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 150, 200, 0.25)';
                ctx.lineWidth = 0.5;
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(this.x - this.size * 0.3, this.y - this.size * 0.3, this.size * 0.25, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.fill();
            } else if (this.type === 'star') {
                this.drawStar(ctx, this.x, this.y, 4, this.size, this.size * 0.4);
            } else if (this.type === 'heart') {
                this.drawHeart(ctx, this.x, this.y, this.size * 0.8);
            } else if (this.type === 'butterfly') {
                this.drawButterfly(ctx, this.x, this.y, this.size);
            }
            ctx.restore();
        }

        drawStar(ctx, cx, cy, spikes, outerR, innerR) {
            let rot = Math.PI / 2 * 3;
            const step = Math.PI / spikes;
            ctx.beginPath();
            ctx.moveTo(cx, cy - outerR);
            for (let i = 0; i < spikes; i++) {
                ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
                rot += step;
                ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
                rot += step;
            }
            ctx.closePath();
            const twinkle = 0.5 + 0.5 * Math.sin(this.life * 0.05);
            ctx.fillStyle = `rgba(255, 245, 200, ${twinkle})`;
            ctx.fill();
        }

        drawHeart(ctx, cx, cy, s) {
            ctx.beginPath();
            ctx.moveTo(cx, cy + s * 0.3);
            ctx.bezierCurveTo(cx - s, cy - s * 0.5, cx - s * 0.5, cy - s * 1.2, cx, cy - s * 0.5);
            ctx.bezierCurveTo(cx + s * 0.5, cy - s * 1.2, cx + s, cy - s * 0.5, cx, cy + s * 0.3);
            ctx.fillStyle = 'rgba(255, 105, 180, 0.55)';
            ctx.fill();
        }

        drawButterfly(ctx, cx, cy, s) {
            const wingFlap = Math.sin(this.life * 0.08) * 0.3 + 0.7;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.beginPath();
            ctx.ellipse(-s * 0.5, -s * 0.2, s * 0.8 * wingFlap, s * 0.5, -0.3, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(206, 147, 216, 0.55)';
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(s * 0.5, -s * 0.2, s * 0.8 * wingFlap, s * 0.5, 0.3, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(186, 127, 206, 0.55)';
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(0, 0, s * 0.1, s * 0.4, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(120, 80, 140, 0.6)';
            ctx.fill();
            ctx.restore();
        }
    }

    function initBgParticles() {
        bgParticles.length = 0;
        const count = Math.min(Math.floor((bgCanvas.width * bgCanvas.height) / 25000), 50);
        const types = ['bubble', 'bubble', 'star', 'star', 'heart', 'butterfly'];
        for (let i = 0; i < count; i++) {
            bgParticles.push(new BgParticle(types[i % types.length]));
        }
    }

    let bgAnimFrame;
    function animateBg() {
        bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
        for (const p of bgParticles) {
            p.update();
            p.draw(bgCtx);
        }
        if (!reducedMotion) bgAnimFrame = requestAnimationFrame(animateBg);
    }

    initBgParticles();
    if (!reducedMotion) animateBg();

    window.addEventListener('resize', () => {
        resizeCanvas();
        initBgParticles();
    });

    /* ==========================================================
       STEM ANIMATION — JS-driven stroke-dashoffset
       ========================================================== */
    function animateStemGrow(stem, duration, delay) {
        return new Promise(resolve => {
            let len;
            try { len = stem.getTotalLength(); } catch (e) { len = 400; }

            stem.style.strokeDasharray = len;
            stem.style.strokeDashoffset = len;
            stem.style.opacity = '1';

            setTimeout(() => {
                const start = performance.now();
                function step(now) {
                    const elapsed = now - start;
                    const progress = Math.min(elapsed / duration, 1);
                    // Ease out cubic
                    const eased = 1 - Math.pow(1 - progress, 3);
                    stem.style.strokeDashoffset = len * (1 - eased);
                    if (progress < 1) {
                        requestAnimationFrame(step);
                    } else {
                        stem.style.strokeDashoffset = '0';
                        resolve();
                    }
                }
                requestAnimationFrame(step);
            }, delay);
        });
    }

    /* ==========================================================
       LEAF ANIMATION — JS-driven scale
       ========================================================== */
    function animateLeafSprout(leaf, duration, delay) {
        return new Promise(resolve => {
            setTimeout(() => {
                leaf.style.opacity = '1';
                leaf.style.transition = `none`;

                const start = performance.now();
                function step(now) {
                    const elapsed = now - start;
                    const progress = Math.min(elapsed / duration, 1);
                    // Elastic ease
                    let eased;
                    if (progress < 0.6) {
                        eased = (progress / 0.6) * 1.15;
                    } else {
                        eased = 1.15 - 0.15 * ((progress - 0.6) / 0.4);
                    }
                    // We need to apply scale as a child transform or via CSS
                    // Since SVG transform is on the element, add a CSS transform
                    leaf.style.transform = `scale(${eased})`;
                    if (progress < 1) {
                        requestAnimationFrame(step);
                    } else {
                        leaf.style.transform = 'scale(1)';
                        leaf.classList.add('sprout');
                        resolve();
                    }
                }
                requestAnimationFrame(step);
            }, delay);
        });
    }

    /* ==========================================================
       FLOWER BLOOM — CSS class-driven (petals scale)
       ========================================================== */
    function animateFlowerBloom(flower, delay) {
        return new Promise(resolve => {
            setTimeout(() => {
                flower.style.opacity = '1';
                flower.classList.add('bloom');
                setTimeout(resolve, 1000);
            }, delay);
        });
    }

    /* ==========================================================
       OPEN SURPRISE — Main Transition
       ========================================================== */
    openBtn.addEventListener('click', () => {
        if (animating) return;
        startBouquetSequence();
    });

    function startBouquetSequence() {
        animating = true;

        // Exit initial screen
        initialScreen.classList.add('exit');
        initialScreen.classList.remove('active');

        setTimeout(() => {
            initialScreen.style.display = 'none';

            // Reset bouquet state
            resetBouquetState();

            // Show bouquet screen
            bouquetScreen.style.display = '';
            bouquetScreen.classList.add('active', 'enter');

            // Start the animation sequence
            setTimeout(() => runBouquetAnimation(), 500);
        }, 800);
    }

    function resetBouquetState() {
        // Hide wrapper & ribbon
        $$('.bouquet-part').forEach(el => el.classList.remove('show'));

        // Reset stems
        $$('.stem').forEach(stem => {
            stem.style.opacity = '0';
            stem.style.strokeDashoffset = '';
            stem.style.strokeDasharray = '';
            stem.classList.remove('grow');
        });

        // Reset leaves
        $$('.leaf').forEach(leaf => {
            leaf.style.opacity = '0';
            leaf.style.transform = 'scale(0)';
            leaf.classList.remove('sprout');
        });

        // Reset flowers
        $$('.flower-group').forEach(flower => {
            flower.style.opacity = '0';
            flower.classList.remove('bloom');
        });

        // Reset message & controls
        messageContainer.classList.remove('show');
        controls.classList.remove('show');

        // Clear sparkles
        const sparklesGroup = $('#svg-sparkles');
        if (sparklesGroup) sparklesGroup.innerHTML = '';
    }

    /* ==========================================================
       BOUQUET ANIMATION SEQUENCE
       ========================================================== */
    async function runBouquetAnimation() {
        const stems = $$('.stem');
        const leaves = $$('.leaf');
        const flowers = $$('.flower-group');

        if (reducedMotion) {
            // Show everything immediately
            $$('.bouquet-part').forEach(el => { el.classList.add('show'); el.style.opacity = '1'; });
            stems.forEach(s => { s.style.opacity = '1'; s.style.strokeDashoffset = '0'; });
            leaves.forEach(l => { l.style.opacity = '1'; l.style.transform = 'scale(1)'; l.classList.add('sprout'); });
            flowers.forEach(f => { f.style.opacity = '1'; f.classList.add('bloom'); });
            messageContainer.classList.add('show');
            controls.classList.add('show');
            animating = false;
            return;
        }

        // 1. Wrapper & Ribbon appear
        $('#wrapper').classList.add('show');
        await delay(300);
        $('#ribbon-bow').classList.add('show');
        await delay(700);

        // 2. Stems grow with stagger
        const stemPromises = stems.map((stem, i) =>
            animateStemGrow(stem, 1000, i * 120)
        );
        // Don't wait for all stems — start leaves partway through
        await delay(600);

        // 3. Leaves sprout with stagger
        leaves.forEach((leaf, i) => {
            animateLeafSprout(leaf, 600, i * 80);
        });
        await delay(600);

        // 4. Flowers bloom one by one
        for (let i = 0; i < flowers.length; i++) {
            await animateFlowerBloom(flowers[i], 250);
        }

        // 5. Wait for all stems to finish
        await Promise.all(stemPromises);

        // 6. Start sparkles
        startBouquetSparkles();
        await delay(400);

        // 7. Show message
        messageContainer.classList.add('show');
        await delay(600);

        // 8. Show controls
        controls.classList.add('show');
        animating = false;
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /* ==========================================================
       BOUQUET SPARKLES
       ========================================================== */
    let sparkleTimer = null;

    function startBouquetSparkles() {
        if (reducedMotion) return;
        stopBouquetSparkles();
        sparkleTimer = setInterval(() => {
            createSvgSparkle();
        }, 600);
    }

    function stopBouquetSparkles() {
        if (sparkleTimer) { clearInterval(sparkleTimer); sparkleTimer = null; }
    }

    function createSvgSparkle() {
        const sparklesGroup = $('#svg-sparkles');
        if (!sparklesGroup) return;

        const x = 100 + Math.random() * 400;
        const y = 50 + Math.random() * 400;
        const size = 3 + Math.random() * 5;

        const ns = 'http://www.w3.org/2000/svg';
        const g = document.createElementNS(ns, 'g');
        g.setAttribute('class', 'svg-sparkle');
        g.setAttribute('transform', `translate(${x}, ${y})`);

        const s = size;
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d',
            `M0,-${s} L${s * 0.3},-${s * 0.3} L${s},0 L${s * 0.3},${s * 0.3} ` +
            `L0,${s} L-${s * 0.3},${s * 0.3} L-${s},0 L-${s * 0.3},-${s * 0.3} Z`
        );

        const colors = ['#FFD700', '#FF69B4', '#FFFFFF', '#E1BEE7', '#BBDEFB'];
        path.setAttribute('fill', colors[Math.floor(Math.random() * colors.length)]);
        path.setAttribute('opacity', '0.8');

        g.appendChild(path);
        sparklesGroup.appendChild(g);

        setTimeout(() => {
            if (g.parentNode) g.parentNode.removeChild(g);
        }, 1500);
    }

    /* ==========================================================
       CLICK EFFECTS — Flowers & Bouquet
       ========================================================== */
    if (bouquetContainer) {
        bouquetContainer.addEventListener('click', (e) => {
            if (animating) return;
            const target = e.target.closest('.flower-group');
            if (target) {
                createClickSparkles(e.clientX, e.clientY, 8);
            } else {
                createClickHearts(e.clientX, e.clientY, 5);
            }
        });
    }

    function createClickSparkles(cx, cy, count) {
        if (reducedMotion) return;
        for (let i = 0; i < count; i++) {
            const el = document.createElement('div');
            el.className = 'click-sparkle';
            const angle = (Math.PI * 2 * i) / count;
            const dist = 15 + Math.random() * 25;
            const x = cx + Math.cos(angle) * dist;
            const y = cy + Math.sin(angle) * dist;
            el.style.left = x + 'px';
            el.style.top = y + 'px';
            const colors = ['#FFD700', '#FF69B4', '#E1BEE7', '#FFFFFF'];
            el.style.background = colors[Math.floor(Math.random() * colors.length)];
            const sz = (4 + Math.random() * 6) + 'px';
            el.style.width = sz;
            el.style.height = sz;
            el.style.boxShadow = `0 0 6px ${el.style.background}`;
            document.body.appendChild(el);
            el.addEventListener('animationend', () => el.remove());
        }
    }

    function createClickHearts(cx, cy, count) {
        if (reducedMotion) return;
        const hearts = ['💕', '💗', '💖', '❤️', '💘'];
        for (let i = 0; i < count; i++) {
            const el = document.createElement('span');
            el.className = 'click-heart';
            el.textContent = hearts[Math.floor(Math.random() * hearts.length)];
            el.style.left = (cx + (Math.random() - 0.5) * 60) + 'px';
            el.style.top = (cy + (Math.random() - 0.5) * 30) + 'px';
            el.style.animationDelay = (i * 0.08) + 's';
            document.body.appendChild(el);
            el.addEventListener('animationend', () => el.remove());
        }
    }

    /* ==========================================================
       REPLAY ANIMATION
       ========================================================== */
    replayBtn.addEventListener('click', () => {
        if (animating) return;
        animating = true;
        stopBouquetSparkles();

        // Fade out
        bouquetScreen.style.transition = 'opacity 0.5s';
        bouquetScreen.style.opacity = '0';

        setTimeout(() => {
            resetBouquetState();
            bouquetScreen.style.opacity = '1';
            setTimeout(() => runBouquetAnimation(), 300);
        }, 600);
    });

    /* ==========================================================
       PETAL SHOWER
       ========================================================== */
    petalShowerBtn.addEventListener('click', () => {
        triggerPetalShower();
    });

    function triggerPetalShower() {
        if (reducedMotion) return;
        const petals = ['🌸', '🌺', '💮', '🏵️', '🌷', '🌹'];
        const count = 30 + Math.floor(Math.random() * 20);

        for (let i = 0; i < count; i++) {
            const el = document.createElement('span');
            el.className = 'falling-petal';
            el.textContent = petals[Math.floor(Math.random() * petals.length)];
            el.style.setProperty('--fall-x', Math.random() * 100 + '%');
            el.style.setProperty('--fall-dur', (3 + Math.random() * 3) + 's');
            el.style.setProperty('--fall-delay', (Math.random() * 2) + 's');
            el.style.fontSize = (0.8 + Math.random() * 0.8) + 'rem';
            document.body.appendChild(el);
            el.addEventListener('animationend', () => el.remove());
        }
    }

    /* ==========================================================
       SEND LOVE
       ========================================================== */
    sendLoveBtn.addEventListener('click', showSendLove);
    closeLoveBtn.addEventListener('click', hideSendLove);

    function showSendLove() {
        const burst = $('.love-emoji-burst');
        if (burst) {
            burst.innerHTML = '';
            const emojis = ['💕', '💗', '💖', '💘', '💝', '💞', '❤️', '🥰', '😘', '✨'];
            for (let i = 0; i < 12; i++) {
                const span = document.createElement('span');
                span.textContent = emojis[Math.floor(Math.random() * emojis.length)];
                span.style.display = 'inline-block';
                span.style.margin = '4px';
                span.style.animation = `heartBeatOnce 0.6s ${i * 0.05}s cubic-bezier(0.34, 1.56, 0.64, 1) both`;
                burst.appendChild(span);
            }
        }

        ensureDynamicKeyframes();
        sendLoveOverlay.classList.add('show');
        sendLoveOverlay.setAttribute('aria-hidden', 'false');
        triggerPetalShower();
    }

    function hideSendLove() {
        sendLoveOverlay.classList.remove('show');
        sendLoveOverlay.setAttribute('aria-hidden', 'true');
    }

    function ensureDynamicKeyframes() {
        if (!document.getElementById('dynamic-keyframes')) {
            const style = document.createElement('style');
            style.id = 'dynamic-keyframes';
            style.textContent = `
                @keyframes heartBeatOnce {
                    0%   { opacity: 0; transform: scale(0); }
                    60%  { opacity: 1; transform: scale(1.3); }
                    100% { opacity: 1; transform: scale(1); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    /* ==========================================================
       ROMANTIC MUSIC BOX ENGINE (Web Audio API)
       ========================================================== */
    const ROMANTIC_MELODY = [
        { freq: 587.33, dur: 0.65, bass: 146.83 }, // D5, Bass D3
        { freq: 440.00, dur: 0.65, bass: 110.00 }, // A4, Bass A2
        { freq: 493.88, dur: 0.65, bass: 123.47 }, // B4, Bass B2
        { freq: 369.99, dur: 0.65, bass: 92.50 },  // F#4, Bass F#2
        { freq: 392.00, dur: 0.65, bass: 98.00 },  // G4, Bass G2
        { freq: 293.66, dur: 0.65, bass: 73.42 },  // D4, Bass D2
        { freq: 392.00, dur: 0.65, bass: 98.00 },  // G4, Bass G2
        { freq: 440.00, dur: 0.65, bass: 110.00 }, // A4, Bass A2
        // Sweet flowing romantic arpeggios
        { freq: 587.33, dur: 0.35, bass: 146.83 }, // D5
        { freq: 659.25, dur: 0.35 },               // E5
        { freq: 554.37, dur: 0.35, bass: 110.00 }, // C#5
        { freq: 440.00, dur: 0.35 },               // A4
        { freq: 493.88, dur: 0.35, bass: 123.47 }, // B4
        { freq: 587.33, dur: 0.35 },               // D5
        { freq: 440.00, dur: 0.35, bass: 92.50 },  // A4
        { freq: 369.99, dur: 0.35 },               // F#4
        { freq: 392.00, dur: 0.35, bass: 98.00 },  // G4
        { freq: 493.88, dur: 0.35 },               // B4
        { freq: 440.00, dur: 0.35, bass: 73.42 },  // A4
        { freq: 392.00, dur: 0.35 },               // G4
        { freq: 369.99, dur: 0.35, bass: 98.00 },  // F#4
        { freq: 440.00, dur: 0.35 },               // A4
        { freq: 493.88, dur: 0.35, bass: 110.00 }, // B4
        { freq: 554.37, dur: 0.55 },               // C#5
        { freq: 587.33, dur: 1.1,  bass: 146.83 }, // D5 (resolve)
    ];

    let delayNode = null;
    let delayFeedback = null;

    function initAudioContext() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        if (!gainNode) {
            gainNode = audioCtx.createGain();
            gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);

            try {
                delayNode = audioCtx.createDelay();
                delayNode.delayTime.setValueAtTime(0.24, audioCtx.currentTime);

                delayFeedback = audioCtx.createGain();
                delayFeedback.gain.setValueAtTime(0.22, audioCtx.currentTime);

                delayNode.connect(delayFeedback);
                delayFeedback.connect(delayNode);
                delayNode.connect(gainNode);
            } catch (e) {
                delayNode = null;
            }

            gainNode.connect(audioCtx.destination);
        }
    }

    function playMusicBoxNote(freq, startTime, duration, bassFreq = null) {
        if (!audioCtx || !gainNode) return;

        // 1. Fundamental note (bell chime)
        const osc = audioCtx.createOscillator();
        const noteGain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        noteGain.gain.setValueAtTime(0, startTime);
        noteGain.gain.linearRampToValueAtTime(0.09, startTime + 0.015);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 1.8);

        osc.connect(noteGain);
        if (delayNode) {
            noteGain.connect(delayNode);
        }
        noteGain.connect(gainNode);

        osc.start(startTime);
        osc.stop(startTime + duration * 1.8 + 0.05);

        // 2. Crystal chime overtone (sparkle)
        const overtone = audioCtx.createOscillator();
        const overtoneGain = audioCtx.createGain();
        overtone.type = 'sine';
        overtone.frequency.setValueAtTime(freq * 2, startTime);

        overtoneGain.gain.setValueAtTime(0, startTime);
        overtoneGain.gain.linearRampToValueAtTime(0.035, startTime + 0.01);
        overtoneGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.9);

        overtone.connect(overtoneGain);
        overtoneGain.connect(gainNode);

        overtone.start(startTime);
        overtone.stop(startTime + duration * 0.9 + 0.05);

        // 3. Warm gentle bass accompaniment
        if (bassFreq) {
            const bassOsc = audioCtx.createOscillator();
            const bassGain = audioCtx.createGain();
            bassOsc.type = 'triangle';
            bassOsc.frequency.setValueAtTime(bassFreq, startTime);

            bassGain.gain.setValueAtTime(0, startTime);
            bassGain.gain.linearRampToValueAtTime(0.05, startTime + 0.03);
            bassGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 2.2);

            bassOsc.connect(bassGain);
            bassGain.connect(gainNode);

            bassOsc.start(startTime);
            bassOsc.stop(startTime + duration * 2.2 + 0.05);
        }
    }

    function playMelodyLoop() {
        if (!musicPlaying || !audioCtx) return;
        if (melodyTimeout) { clearTimeout(melodyTimeout); melodyTimeout = null; }

        let time = audioCtx.currentTime + 0.08;
        let totalDuration = 0;

        for (const note of ROMANTIC_MELODY) {
            playMusicBoxNote(note.freq, time, note.dur, note.bass || null);
            time += note.dur;
            totalDuration += note.dur;
        }

        melodyTimeout = setTimeout(() => {
            if (musicPlaying) playMelodyLoop();
        }, (totalDuration + 1.2) * 1000);
    }

    function startMusic() {
        initAudioContext();
        if (gainNode) {
            try { gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime); } catch (e) {}
        }
        musicPlaying = true;
        if (musicToggle) musicToggle.classList.add('active');
        playMelodyLoop();
    }

    function stopMusic() {
        musicPlaying = false;
        if (musicToggle) musicToggle.classList.remove('active');
        if (melodyTimeout) { clearTimeout(melodyTimeout); melodyTimeout = null; }
        if (gainNode) {
            try { gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2); } catch (e) {}
        }
    }

    if (musicToggle) {
        musicToggle.addEventListener('click', () => {
            if (!musicPlaying) startMusic();
            else stopMusic();
        });
    }

    /* ==========================================================
       INITIALIZATION
       ========================================================== */
    function init() {
        bouquetScreen.classList.remove('active', 'enter');
        initialScreen.style.display = '';
        initialScreen.classList.add('active');
        initialScreen.classList.remove('exit');

        // Pre-hide bouquet elements
        $$('.bouquet-part').forEach(el => el.style.opacity = '0');
        $$('.stem').forEach(s => s.style.opacity = '0');
        $$('.leaf').forEach(l => { l.style.opacity = '0'; l.style.transform = 'scale(0)'; });
        $$('.flower-group').forEach(f => f.style.opacity = '0');
    }

    init();

})();
