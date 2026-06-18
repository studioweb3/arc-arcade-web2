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
        TARGET_SCORE: 20,
        player: { x: 135, y: 280, targetY: 280, size: 30 },
        bullets: [],
        enemies: [],
        coins: [],
        stars: [],
        keys: { ArrowLeft: false, ArrowRight: false },
        lastShot: 0
    });

    // --- INITIALISATION ---
    useEffect(() => {
        // Chargement des crédits depuis le localStorage du navigateur
        const savedCredits = parseInt(localStorage.getItem('arc_credits_web2')) || 3;
        setCredits(savedCredits);
        
        // Initialisation des étoiles
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
        gameState.current.player.x = 135;
        gameState.current.player.y = 280;
        gameState.current.player.targetY = 280;
        gameState.current.bullets = [];
        gameState.current.enemies = [];
        gameState.current.coins = [];
        
        setGameActive(true);
        setStatusMsg({ text: "🚀 In hyperspace! Collect 20 coins.", type: "info" });
    };

    const endGame = (won) => {
        setGameActive(false);
        if (won) {
            setStatusMsg({ text: "✨ Sector secured!", type: "success" });
            triggerConfetti();
            setTimeout(() => { setShowWinModal(true); }, 1000);
        } else {
            setStatusMsg({ text: "Repairs needed... Try again!", type: "error" });
            gameState.current.player.targetY = 280; 
        }
    };

    // Gestion du clavier
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
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "white";
            
            // Dessiner les étoiles
            state.stars.forEach(s => {
                ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2); ctx.fill();
                s.y += s.speed; if (s.y > canvas.height) s.y = 0;
            });

            if (gameActive) {
                state.player.targetY = 280 - (state.score / state.TARGET_SCORE) * 230;
            }
            state.player.y += (state.player.targetY - state.player.y) * 0.05;

            // Déplacements joueur
            if (state.keys.ArrowLeft && state.player.x > 0) state.player.x -= 4;
            if (state.keys.ArrowRight && state.player.x < canvas.width - state.player.size) state.player.x += 4;
            
            // Tir automatique : plus besoin d'appuyer sur Espace
            if (Date.now() - state.lastShot > 250 && gameActive) { 
                state.bullets.push({ x: state.player.x + 10, y: state.player.y }); 
                state.lastShot = Date.now(); 
            }

            // Dessiner joueur
            ctx.save(); ctx.font = '28px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
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

            if (gameActive) {
                // Balles
                state.bullets.forEach((b, index) => {
                    b.y -= 8; ctx.fillStyle = '#22D3EE'; ctx.shadowBlur = 10; ctx.shadowColor = '#22D3EE';
                    ctx.fillRect(b.x + 4, b.y, 3, 15); ctx.shadowBlur = 0;
                    if (b.y < 0) state.bullets.splice(index, 1);
                });

                // Ennemis
                if (Math.random() < 0.04) state.enemies.push({ x: Math.random() * (canvas.width - 30), y: -30 });
                state.enemies.forEach((e, i) => {
                    e.y += 2.2; ctx.font = '28px Arial'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
                    ctx.fillText('👾', e.x, e.y + 25);
                    
                    state.bullets.forEach((b, bi) => {
                        if (b.x > e.x - 5 && b.x < e.x + 25 && b.y > e.y && b.y < e.y + 30) {
                            state.coins.push({ x: e.x, y: e.y }); 
                            state.bullets.splice(bi, 1); 
                            state.enemies.splice(i, 1);
                        }
                    });
                    
                    // Collision joueur
                    if (e.y + 15 > state.player.y && e.y < state.player.y + 20 && e.x + 15 > state.player.x && e.x < state.player.x + 20) {
                        endGame(false);
                    }
                    if (e.y > canvas.height) state.enemies.splice(i, 1);
                });

                // Pièces
                state.coins.forEach((c, i) => {
                    c.y += 2.5; ctx.fillText('🪙', c.x, c.y + 25);
                    if (c.y + 20 > state.player.y && c.y < state.player.y + 20 && c.x + 20 > state.player.x && c.x < state.player.x + 20) {
                        state.coins.splice(i, 1); 
                        state.score++; 
                        if (state.score >= state.TARGET_SCORE) {
                            endGame(true);
                        }
                    } else if (c.y > canvas.height) {
                        state.coins.splice(i, 1); 
                    }
                });
            }

            // HUD UI
            ctx.fillStyle = '#FBBF24'; ctx.font = 'bold 14px Courier New'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
            ctx.fillText(`TARGETS: ${state.score}/${state.TARGET_SCORE}`, 10, 25);
            const progress = (state.score / state.TARGET_SCORE) * 100;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'; ctx.fillRect(10, 35, 100, 4);
            ctx.fillStyle = '#10B981'; ctx.fillRect(10, 35, progress, 4);

            requestRef.current = requestAnimationFrame(render);
        };

        requestRef.current = requestAnimationFrame(render);
        return () => cancelAnimationFrame(requestRef.current);
    }, [gameActive]);

    // Helpers pour l'interface
    const getStatusColor = (type) => {
        if (type === 'error') return '#EF4444';
        if (type === 'success') return '#10B981';
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
                        <canvas ref={canvasRef} width="300" height="350" id="gameCanvas" className="mx-auto rounded-xl shadow-lg shadow-sky-900/20"></canvas>
                        
                        {!gameActive && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/60 rounded-xl">
                            {gameState.current.score > 0 && gameState.current.score < gameState.current.TARGET_SCORE ? (
                                <>
                                    <p className="text-red-500 font-bold text-xl mb-1">HULL DESTROYED 💥</p>
                                    <p className="text-slate-400 text-xs mb-4">Score: {gameState.current.score}</p>
                                </>
                            ) : gameState.current.score >= gameState.current.TARGET_SCORE ? (
                                <p className="text-emerald-400 font-bold text-xl mb-4">OBJECTIVE REACHED!</p>
                            ) : (
                                <p className="text-white font-bold mb-2 text-lg drop-shadow-md">Ready for takeoff?</p>
                            )}
                            <p className="text-slate-300 text-xs mono mb-4">Insert 1 🪙 to start</p>
                            <p className="text-sky-400 text-[10px] mono uppercase tracking-tighter">⬅️ ➡️ Move | 🚀 Auto-Fire</p>
                        </div>
                        )}
                    </div>

                    <div className="sm:hidden flex justify-between gap-3 mb-4 w-full relative z-10">
                        <button 
                            onTouchStart={(e) => { e.preventDefault(); gameState.current.keys.ArrowLeft = true; }}
                            onTouchEnd={(e) => { e.preventDefault(); gameState.current.keys.ArrowLeft = false; }}
                            onMouseDown={(e) => { e.preventDefault(); gameState.current.keys.ArrowLeft = true; }}
                            onMouseUp={(e) => { e.preventDefault(); gameState.current.keys.ArrowLeft = false; }}
                            onMouseLeave={(e) => { e.preventDefault(); gameState.current.keys.ArrowLeft = false; }}
                            className="bg-slate-700 hover:bg-slate-600 text-white p-4 rounded-xl flex-1 text-3xl active:bg-sky-500 transition select-none touch-manipulation shadow-lg"
                        >⬅️</button>
                        <button 
                            onTouchStart={(e) => { e.preventDefault(); gameState.current.keys.ArrowRight = true; }}
                            onTouchEnd={(e) => { e.preventDefault(); gameState.current.keys.ArrowRight = false; }}
                            onMouseDown={(e) => { e.preventDefault(); gameState.current.keys.ArrowRight = true; }}
                            onMouseUp={(e) => { e.preventDefault(); gameState.current.keys.ArrowRight = false; }}
                            onMouseLeave={(e) => { e.preventDefault(); gameState.current.keys.ArrowRight = false; }}
                            className="bg-slate-700 hover:bg-slate-600 text-white p-4 rounded-xl flex-1 text-3xl active:bg-sky-500 transition select-none touch-manipulation shadow-lg"
                        >➡️</button>
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
