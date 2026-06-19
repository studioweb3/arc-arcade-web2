import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import './App.css'; // Assure-toi que le fichier CSS est dans le même dossier

export default function App() {
    // --- ETATS DE L'APPLICATION (WEB2) ---
    const [credits, setCredits] = useState(3);
    const [statusMsg, setStatusMsg] = useState({ text: 'Welcome to ARC Arcade!', type: 'info' });
    const [showWinModal, setShowWinModal] = useState(false);

    // --- ETATS DU JEU ---
    const canvasRef = useRef(null);
    const requestRef = useRef(null);
    const [gameActive, setGameActive] = useState(false);
    
    // Variables mutables pour la boucle de jeu
    const gameState = useRef({
        score: 0,
        TARGET_SCORE: 40, // 20 pièces LVL 1 + 20 pièces LVL 2 = Boss
        level: 1,
        player: { x: 135, y: 280, targetY: 280, size: 30 },
        lives: 3,               // 3 Vies au départ
        invincibleUntil: 0,     // Temps d'invincibilité après avoir été touché
        hasShield: false,
        bullets: [],
        enemies: [],
        coins: [],
        stars: [],
        powerups: [],
        boss: { active: false, x: 150, y: 60, hp: 30, maxHp: 30, direction: 1, lastShot: 0, bullets: [] },
        keys: { ArrowLeft: false, ArrowRight: false },
        lastShot: 0
    });

    // --- INITIALISATION ---
    useEffect(() => {
        const savedCredits = parseInt(localStorage.getItem('arc_credits_web2')) || 3;
        setCredits(savedCredits);
        
        const initStars = () => {
            const stars = [];
            for (let i = 0; i < 50; i++) {
                stars.push({ x: Math.random() * 300, y: Math.random() * 350, size: Math.random() * 2, speed: 0.5 + Math.random() * 2 });
            }
            gameState.current.stars = stars;
        };
        initStars();
    }, []);

    useEffect(() => {
        localStorage.setItem('arc_credits_web2', credits);
    }, [credits]);

    // --- FONCTIONS WEB2 ---
    const addFreeCredits = () => {
        setCredits(prev => prev + 5);
        setStatusMsg({ text: "✅ 5 Free Credits added!", type: "success" });
    };

    const triggerConfetti = () => {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#38BDF8', '#FBBF24'], zIndex: 9999 });
    };

    const initGame = () => {
        if (credits < 1 || gameActive) return;
        setCredits(prev => prev - 1);
        
        gameState.current.score = 0;
        gameState.current.level = 1;
        gameState.current.player.x = 135;
        gameState.current.player.y = 280;
        gameState.current.player.targetY = 280;
        gameState.current.lives = 3;
        gameState.current.invincibleUntil = 0;
        gameState.current.hasShield = false;
        gameState.current.bullets = [];
        gameState.current.enemies = [];
        gameState.current.coins = [];
        gameState.current.powerups = [];
        gameState.current.boss = { active: false, x: 150, y: 60, hp: 30, maxHp: 30, direction: 1, lastShot: 0, bullets: [] };
        
        setGameActive(true);
        setStatusMsg({ text: "🚀 Level 1! Collect 20 coins.", type: "info" });
    };

    const endGame = (won) => {
        setGameActive(false);
        if (won) {
            setStatusMsg({ text: "✨ BOSS DEFEATED! Sector secured!", type: "success" });
            triggerConfetti();
            setTimeout(() => { setShowWinModal(true); }, 1000);
        } else {
            setStatusMsg({ text: "GAME OVER ! Try again!", type: "error" });
            gameState.current.player.targetY = 280; 
        }
    };

    // Gestion du clavier (PC)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if(e.code === 'ArrowLeft') gameState.current.keys.ArrowLeft = true;
            if(e.code === 'ArrowRight') gameState.current.keys.ArrowRight = true;
        };
        const handleKeyUp = (e) => {
            if(e.code === 'ArrowLeft') gameState.current.keys.ArrowLeft = false;
            if(e.code === 'ArrowRight') gameState.current.keys.ArrowRight = false;
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // Boucle d'animation du canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const render = () => {
            const state = gameState.current;
            const isInvincible = Date.now() < state.invincibleUntil;
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "white";
            
            // Dessiner les étoiles
            state.stars.forEach(s => {
                ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2); ctx.fill();
                s.y += (state.boss.active ? s.speed * 2 : s.speed); 
                if (s.y > canvas.height) s.y = 0;
            });

            if (gameActive) {
                state.player.targetY = state.boss.active ? 300 : 280 - (state.score / state.TARGET_SCORE) * 200;
            }
            state.player.y += (state.player.targetY - state.player.y) * 0.05;

            // Déplacements joueur (via clavier PC)
            if (state.keys.ArrowLeft && state.player.x > 0) state.player.x -= 4;
            if (state.keys.ArrowRight && state.player.x < canvas.width - state.player.size) state.player.x += 4;
            
            // Tir automatique du joueur
            if (Date.now() - state.lastShot > 250 && gameActive) { 
                state.bullets.push({ x: state.player.x + 10, y: state.player.y }); 
                state.lastShot = Date.now(); 
            }

            // --- DESSINER LE JOUEUR ---
            // Le vaisseau clignote 1 frame sur 2 s'il est invincible
            if (!isInvincible || Math.floor(Date.now() / 150) % 2 === 0) {
                ctx.save();
                if (state.hasShield) {
                    ctx.beginPath();
                    ctx.arc(state.player.x + 15, state.player.y + 15, 25, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(56, 189, 248, 0.3)';
                    ctx.fill();
                    ctx.strokeStyle = '#38BDF8';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }

                ctx.font = '28px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                let flameY = 41 + Math.sin(Date.now() / 80) * 2; 
                
                ctx.save();
                ctx.translate(state.player.x + 15, state.player.y + flameY); 
                ctx.rotate(Math.PI); 
                ctx.fillText('🔥', 0, 0); 
                ctx.restore();
                
                ctx.save();
                ctx.translate(state.player.x + 15, state.player.y + 15); 
                ctx.rotate(-45 * Math.PI / 180); 
                ctx.fillText('🚀', 0, 0); 
                ctx.restore();
                ctx.restore();
            }

            if (gameActive) {
                // --- LOGIQUE DES BALLES DU JOUEUR ---
                state.bullets.forEach((b, index) => {
                    b.y -= 8; 
                    ctx.fillStyle = '#22D3EE'; ctx.shadowBlur = 10; ctx.shadowColor = '#22D3EE';
                    ctx.fillRect(b.x + 4, b.y, 3, 15); ctx.shadowBlur = 0;
                    
                    let bulletRemoved = false;

                    // Collision des balles avec le Boss
                    if (state.boss.active) {
                        const floatY = state.boss.y + Math.sin(Date.now() / 200) * 10;
                        if (b.x > state.boss.x - 30 && b.x < state.boss.x + 30 && b.y > floatY - 20 && b.y < floatY + 20) {
                            state.boss.hp--;
                            state.bullets.splice(index, 1);
                            bulletRemoved = true;
                            
                            if (state.boss.hp <= 0) {
                                endGame(true);
                            }
                        }
                    }

                    if (!bulletRemoved && b.y < 0) state.bullets.splice(index, 1);
                });

                // --- GESTION DU BOSS (NIVEAU 3) ---
                if (state.boss.active) {
                    const boss = state.boss;
                    
                    boss.x += 1.5 * boss.direction; 
                    if (boss.x <= 30) boss.direction = 1;
                    if (boss.x >= canvas.width - 30) boss.direction = -1;

                    const floatY = boss.y + Math.sin(Date.now() / 200) * 10;

                    // Dessiner le Boss
                    ctx.save();
                    ctx.font = '50px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('🛸', boss.x, floatY);
                    ctx.restore();

                    // Barre de vie du Boss
                    ctx.fillStyle = '#EF4444'; 
                    ctx.fillRect(boss.x - 25, floatY - 40, 50, 4);
                    ctx.fillStyle = '#10B981'; 
                    ctx.fillRect(boss.x - 25, floatY - 40, (boss.hp / boss.maxHp) * 50, 4);

                    // Tirs du Boss
                    if (Date.now() - boss.lastShot > 800) { 
                        boss.bullets.push({ x: boss.x - 15, y: floatY + 20 });
                        boss.bullets.push({ x: boss.x + 15, y: floatY + 20 });
                        boss.lastShot = Date.now();
                    }

                    // Tirs du Boss (Mouvement + Collision)
                    boss.bullets.forEach((bb, bbi) => {
                        bb.y += 3.5; 
                        ctx.fillStyle = '#EF4444'; ctx.shadowBlur = 10; ctx.shadowColor = '#EF4444';
                        ctx.fillRect(bb.x, bb.y, 4, 15); ctx.shadowBlur = 0;
                        
                        // Si un laser touche le joueur
                        if (bb.y > state.player.y && bb.y < state.player.y + 20 && bb.x > state.player.x && bb.x < state.player.x + 20) {
                            if (!isInvincible) {
                                if (state.hasShield) {
                                    state.hasShield = false; 
                                    boss.bullets.splice(bbi, 1);
                                } else {
                                    state.lives--;
                                    if (state.lives > 0) {
                                        state.invincibleUntil = Date.now() + 2000;
                                        boss.bullets.splice(bbi, 1);
                                        boss.hp = boss.maxHp; // LE BOSS SE SOIGNE COMPLETEMENT !
                                        setStatusMsg({ text: "⚠️ Boss regenerated! Keep fighting!", type: "error" });
                                    } else {
                                        endGame(false); 
                                    }
                                }
                            }
                        } else if (bb.y > canvas.height) {
                            boss.bullets.splice(bbi, 1);
                        }
                    });
                } 
                // --- GESTION DES ENNEMIS NORMAUX (NIVEAUX 1 & 2) ---
                else {
                    const enemySpawnRate = state.level === 2 ? 0.055 : 0.04;
                    if (Math.random() < enemySpawnRate) state.enemies.push({ x: Math.random() * (canvas.width - 30), y: -30 });
                    
                    state.enemies.forEach((e, i) => {
                        e.y += 2.2; ctx.font = '28px Arial'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
                        ctx.fillText('👾', e.x, e.y + 25);
                        
                        // Tir du joueur sur les petits ennemis
                        state.bullets.forEach((b, bi) => {
                            if (b.x > e.x - 5 && b.x < e.x + 25 && b.y > e.y && b.y < e.y + 30) {
                                state.coins.push({ x: e.x, y: e.y }); 
                                state.bullets.splice(bi, 1); 
                                state.enemies.splice(i, 1);
                            }
                        });
                        
                        // Collision joueur / ennemi
                        if (e.y + 15 > state.player.y && e.y < state.player.y + 20 && e.x + 15 > state.player.x && e.x < state.player.x + 20) {
                            if (!isInvincible) {
                                if (state.hasShield) {
                                    state.hasShield = false;
                                    state.enemies.splice(i, 1);
                                } else {
                                    state.lives--;
                                    if (state.lives > 0) {
                                        state.invincibleUntil = Date.now() + 2000;
                                        state.enemies.splice(i, 1);
                                    } else {
                                        endGame(false);
                                    }
                                }
                            }
                        } else if (e.y > canvas.height) {
                            state.enemies.splice(i, 1);
                        }
                    });
                }

                // --- BONUS (BOUCLIERS) --- (Tombent 3x moins souvent)
                if (state.level >= 2 && Math.random() < 0.001) state.powerups.push({ x: Math.random() * (canvas.width - 30), y: -30 });
                state.powerups.forEach((p, i) => {
                    p.y += 1.8; 
                    ctx.font = '22px Arial'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
                    ctx.fillText('🛡️', p.x, p.y + 25);

                    if (p.y + 20 > state.player.y && p.y < state.player.y + 20 && p.x + 20 > state.player.x && p.x < state.player.x + 20) {
                        state.hasShield = true;
                        state.powerups.splice(i, 1); 
                    } else if (p.y > canvas.height) {
                        state.powerups.splice(i, 1); 
                    }
                });

                // --- PIECES --- 
                if (!state.boss.active) {
                    state.coins.forEach((c, i) => {
                        c.y += 2.5; ctx.fillText('🪙', c.x, c.y + 25);
                        if (c.y + 20 > state.player.y && c.y < state.player.y + 20 && c.x + 20 > state.player.x && c.x < state.player.x + 20) {
                            state.coins.splice(i, 1); 
                            state.score++; 
                            
                            if (state.score === 20 && state.level === 1) {
                                state.level = 2;
                                state.powerups.push({ x: canvas.width / 2 - 15, y: -30 }); 
                                setStatusMsg({ text: "⚠️ LEVEL 2! Enemies approaching faster!", type: "warning" });
                            }
                            
                            if (state.score >= state.TARGET_SCORE && !state.boss.active) {
                                state.level = 3;
                                state.boss.active = true;
                                state.enemies = []; 
                                state.coins = [];
                                setStatusMsg({ text: "🚨 WARNING: MOTHERSHIP APPROACHING! 🚨", type: "error" });
                            }
                        } else if (c.y > canvas.height) {
                            state.coins.splice(i, 1); 
                        }
                    });
                }
            }

            // --- HUD UI EN HAUT ---
            ctx.fillStyle = '#FBBF24'; ctx.font = 'bold 14px Courier New'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
            
            if (state.boss.active) {
                ctx.fillStyle = '#EF4444';
                ctx.fillText(`🚨 BOSS FIGHT 🚨`, 10, 25);
                const progress = (state.boss.hp / state.boss.maxHp) * 100;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'; ctx.fillRect(10, 35, 100, 4);
                ctx.fillStyle = '#EF4444'; ctx.fillRect(10, 35, progress, 4);
            } else {
                ctx.fillText(`LVL ${state.level} | TARGETS: ${state.score}/${state.TARGET_SCORE}`, 10, 25);
                const progress = (state.score / state.TARGET_SCORE) * 100;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'; ctx.fillRect(10, 35, 100, 4);
                ctx.fillStyle = '#10B981'; ctx.fillRect(10, 35, progress, 4);
            }

            // Affichage des Vies en haut à droite
            ctx.fillStyle = '#EF4444'; ctx.font = '16px Arial'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
            ctx.fillText('❤️'.repeat(state.lives), canvas.width - 10, 25);

            requestRef.current = requestAnimationFrame(render);
        };

        requestRef.current = requestAnimationFrame(render);
        return () => cancelAnimationFrame(requestRef.current);
    }, [gameActive]);

    const getStatusColor = (type) => {
        if (type === 'error') return '#EF4444';
        if (type === 'success') return '#10B981';
        if (type === 'warning') return '#FBBF24';
        return '#38BDF8';
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-start pt-24 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 relative pb-10">
            
            {/* --- NAVIGATION --- */}
            <nav className="absolute top-0 left-0 w-full p-6 flex justify-center items-center z-40 bg-slate-900/50 backdrop-blur-md border-b border-slate-800">
                <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400 flex items-center gap-2">
                    🚀 ARC Arcade <span className="text-sm border border-sky-500 rounded px-2 text-sky-400 ml-2">FREE PLAY</span>
                </div>
            </nav>

            {/* --- VIEW: GAME --- */}
            <div className="w-full flex justify-center px-4 mt-10">
                <div className="glass-panel p-5 rounded-3xl w-full max-w-lg text-center relative overflow-hidden">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-indigo-600 rounded-full blur-3xl opacity-20 pointer-events-none"></div>
                    
                    <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-4 mb-6 flex justify-center items-center relative z-10">
                        <span className="text-slate-300 font-bold text-lg mr-4">Credits:</span>
                        <div className="flex items-center gap-2">
                            <span className="text-3xl font-bold text-emerald-400 drop-shadow-md">{credits}</span>
                            <span className="text-2xl">🪙</span>
                        </div>
                    </div>

                    <div className="mb-6 relative">
                        <canvas 
                            ref={canvasRef} 
                            width="300" 
                            height="350" 
                            id="gameCanvas" 
                            className="mx-auto rounded-xl shadow-lg shadow-sky-900/20 touch-none cursor-crosshair"
                            onTouchMove={(e) => {
                                if (!gameActive) return;
                                const rect = canvasRef.current.getBoundingClientRect();
                                const scaleX = 300 / rect.width;
                                let newX = (e.touches[0].clientX - rect.left) * scaleX - 15;
                                if (newX < 0) newX = 0;
                                if (newX > 270) newX = 270;
                                gameState.current.player.x = newX;
                            }}
                            onMouseMove={(e) => {
                                if (!gameActive) return;
                                if (e.buttons === 1) { 
                                    const rect = canvasRef.current.getBoundingClientRect();
                                    const scaleX = 300 / rect.width;
                                    let newX = (e.clientX - rect.left) * scaleX - 15;
                                    if (newX < 0) newX = 0;
                                    if (newX > 270) newX = 270;
                                    gameState.current.player.x = newX;
                                }
                            }}
                        ></canvas>
                        
                        {!gameActive && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/60 rounded-xl pointer-events-none">
                            {gameState.current.score > 0 && gameState.current.score < gameState.current.TARGET_SCORE && gameState.current.lives === 0 ? (
                                <>
                                    <p className="text-red-500 font-bold text-xl mb-1">HULL DESTROYED 💥</p>
                                    <p className="text-slate-400 text-xs mb-4">Score: {gameState.current.score}</p>
                                </>
                            ) : gameState.current.boss.active && gameState.current.boss.hp <= 0 ? (
                                <p className="text-emerald-400 font-bold text-xl mb-4">BOSS DESTROYED!</p>
                            ) : (
                                <p className="text-white font-bold mb-2 text-lg drop-shadow-md">Ready for takeoff?</p>
                            )}
                            <p className="text-slate-300 text-xs mono mb-4">Insert 1 🪙 to start</p>
                            <p className="text-sky-400 text-[10px] mono uppercase tracking-tighter">👆 Glisse pour bouger | 🚀 Auto-Fire</p>
                        </div>
                        )}
                    </div>

                    {!gameActive && credits === 0 && (
                        <button onClick={addFreeCredits} className="w-full bg-slate-700 hover:bg-slate-600 border border-emerald-500 text-emerald-400 font-bold py-3 px-4 rounded-xl transition flex items-center justify-center gap-2 mb-4 relative z-10">
                            🎁 Get 5 Free Credits
                        </button>
                    )}

                    {!gameActive && credits > 0 && (
                        <button onClick={initGame} className="w-full bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold py-4 px-4 rounded-xl transition shadow-lg shadow-sky-500/30 text-lg uppercase tracking-wider relative z-10">
                            START MISSION (1 🪙)
                        </button>
                    )}

                    <p className="mono text-xs mt-4 h-4" style={{ color: getStatusColor(statusMsg.type) }}>
                        {statusMsg.text}
                    </p>
                </div>
            </div>

            {/* --- WIN MODAL (WEB2) --- */}
            {showWinModal && (
            <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 z-50 animate-fade-in">
                <h3 className="text-amber-400 font-bold text-3xl mb-6 drop-shadow-[0_0_15px_rgba(251,191,36,0.8)] uppercase tracking-widest text-center">🏆 You Win!</h3>
                <p className="text-white text-lg mb-8 text-center max-w-sm">
                    In the Web3 version, this victory earns you a real Arcade NFT on the blockchain!
                </p>
                <button 
                    onClick={() => setShowWinModal(false)}
                    className="bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold py-4 px-6 rounded-xl text-lg transition shadow-[0_0_20px_rgba(56,189,248,0.4)] w-full max-w-xs tracking-widest uppercase"
                >
                    Play Again
                </button>
            </div>
            )}
            
        </div>
    );
}
