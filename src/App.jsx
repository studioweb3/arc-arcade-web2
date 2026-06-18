import React, { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import confetti from 'canvas-confetti';
import './App.css'; // Assure-toi que le fichier CSS est dans le même dossier

// === NETWORK CONFIGURATIONS ===
const networks = {
    arc: {
        chainId: '0x4CEF52', 
        name: 'ARC Testnet',
        currency: 'USDC',
        depositAmount: "1.0", 
        nftContract: "0xC04DCc83D768b8cCa4fda77283cF5608CF77FEA0", 
        actionContract: "0x93FC5cb88E77bAdf3C964B358A1ae426e229A1E8", 
        swapFunction: "swapNFTForUSDC",
        isMainnet: false,
        hasSwap: true,          
        isFreeToPlay: false     
    },
    base: {
        chainId: '0x2105', 
        name: 'Base Mainnet',
        currency: 'ETH',
        depositAmount: "0", 
        nftContract: "0xfD1e87A1fc200b034cfD88F254B8b267f7B8F018", 
        actionContract: "0x1e970b9f120b539c2ED9A6e16729b54BebAFb977", 
        swapFunction: null,
        isMainnet: true,
        hasSwap: true,  
        isFreeToPlay: true      
    }
};

const nftABI = [
    "function mint(address to) public",
    "function balanceOf(address owner) view returns (uint256)",
    "function ownerOf(uint256 tokenId) view returns (address)", 
    "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
    "function approve(address to, uint256 tokenId) public",
    "function transferFrom(address from, address to, uint256 tokenId) public" 
];

const swapABI = [
    "function swapNFTForUSDC(uint256 tokenId) external"
];

const baseArcadeABI = [
    "function claimFreeCredits() public"
];

export default function App() {
    // --- ETATS DE L'APPLICATION ---
    const [activeView, setActiveView] = useState('game');
    const [currentNetworkKey, setCurrentNetworkKey] = useState('arc');
    const [userAddress, setUserAddress] = useState(null);
    const [credits, setCredits] = useState(0);
    const [statusMsg, setStatusMsg] = useState({ text: '', type: 'info' });
    const [swapStatusMsg, setSwapStatusMsg] = useState({ text: '', type: 'info' });
    const [isMinting, setIsMinting] = useState(false);
    const [isDepositing, setIsDepositing] = useState(false);
    const [isSwapping, setIsSwapping] = useState(false);
    const [showNftModal, setShowNftModal] = useState(false);
    const [nfts, setNfts] = useState(null); // null = non chargé, tableau vide = pas de NFT
    const [isLoadingNfts, setIsLoadingNfts] = useState(false);

    // --- ETATS DU JEU ---
    const canvasRef = useRef(null);
    const requestRef = useRef(null);
    const [gameActive, setGameActive] = useState(false);
    
    // Variables mutables pour la boucle de jeu (pour éviter les re-renders)
    const gameState = useRef({
        score: 0,
        TARGET_SCORE: 20,
        player: { x: 135, y: 280, targetY: 280, size: 30 },
        bullets: [],
        enemies: [],
        coins: [],
        stars: [],
        keys: { ArrowLeft: false, ArrowRight: false, Space: false },
        lastShot: 0
    });

    // --- INITIALISATION ---
    useEffect(() => {
        // Détection de Base via Coinbase Wallet
        if (typeof window.ethereum !== 'undefined') {
            if (window.ethereum.isCoinbaseWallet || window.ethereum.chainId === '0x2105' || window.ethereum.chainId === '8453') {
                setCurrentNetworkKey('base');
            }
        }
    }, []);

    useEffect(() => {
        // Chargement des crédits depuis le localStorage selon le réseau
        const savedCredits = parseInt(localStorage.getItem(`arc_credits_${currentNetworkKey}`)) || 0;
        setCredits(savedCredits);
        setStatusMsg({ text: '', type: 'info' });
        setSwapStatusMsg({ text: '', type: 'info' });
        
        // Initialisation des étoiles
        const initStars = () => {
            const stars = [];
            for (let i = 0; i < 50; i++) {
                stars.push({ x: Math.random() * 300, y: Math.random() * 350, size: Math.random() * 2, speed: 0.5 + Math.random() * 2 });
            }
            gameState.current.stars = stars;
        };
        initStars();

        // Auto-connexion
        setTimeout(autoConnectMetaMask, 500);
    }, [currentNetworkKey]);

    useEffect(() => {
        localStorage.setItem(`arc_credits_${currentNetworkKey}`, credits);
    }, [credits, currentNetworkKey]);

    // --- FONCTIONS WEB3 ---
    const autoConnectMetaMask = async () => {
        if (typeof window.ethereum !== 'undefined') {
            try {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts && accounts.length > 0) {
                    setUserAddress(accounts[0]);
                }
            } catch (e) {
                console.log("Erreur de reconnexion silencieuse :", e);
            }
        }
    };

    const switchMetaMaskNetwork = async (networkKey) => {
        if (!window.ethereum || !userAddress) return;
        const conf = networks[networkKey];
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: conf.chainId }],
            });
        } catch (error) {
            console.error("Veuillez ajouter le réseau dans MetaMask manuellement si besoin.", error);
        }
    };

    const handleConnect = async () => {
        if (typeof window.ethereum !== 'undefined') {
            try {
                setStatusMsg({ text: "Requesting access...", type: "info" });
                const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
                setUserAddress(accounts[0]);
                
                if (credits === 0) {
                    const msgTxt = networks[currentNetworkKey].isFreeToPlay ? "Claim credits to play." : `Deposit ${networks[currentNetworkKey].currency} to play.`;
                    setStatusMsg({ text: `Welcome! ${msgTxt}`, type: "info" });
                } else {
                    setStatusMsg({ text: "", type: "info" });
                }
                
                await switchMetaMaskNetwork(currentNetworkKey);
            } catch (e) { 
                setStatusMsg({ text: "❌ Connection refused.", type: "error" }); 
            }
        } else {
            setStatusMsg({ text: "❌ MetaMask not found.", type: "error" });
        }
    };

    const handleDeposit = async () => {
        const conf = networks[currentNetworkKey];
        try {
            setIsDepositing(true);
            setStatusMsg({ text: "Please confirm the transaction in MetaMask...", type: "info" });

            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            
            let tx;
            if (conf.isFreeToPlay) {
                const arcadeContract = new ethers.Contract(conf.actionContract, baseArcadeABI, signer);
                const builderSuffix = "0x62635f30303361366d736d0b0080218021802180218021802180218021";
                const txData = arcadeContract.interface.encodeFunctionData("claimFreeCredits");
                const finalData = txData + builderSuffix.substring(2);
                tx = await signer.sendTransaction({
                    to: conf.actionContract,
                    data: finalData
                });
            } else {
                tx = await signer.sendTransaction({ 
                    to: conf.actionContract, 
                    value: ethers.parseEther(conf.depositAmount) 
                });
            }
            
            setStatusMsg({ text: `⏳ Validating transaction on ${conf.name}...`, type: "info" });
            await tx.wait(); 
            
            setCredits(prev => prev + 10); 
            setStatusMsg({ text: "✅ Transaction confirmed! 10 Credits added.", type: "success" });
        } catch (e) {
            console.error(e);
            setStatusMsg({ text: "❌ Transaction cancelled or failed.", type: "error" });
        } finally {
            setIsDepositing(false);
        }
    };

    const handleMint = async () => {
        const conf = networks[currentNetworkKey];
        try {
            setIsMinting(true);
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const nftContract = new ethers.Contract(conf.nftContract, nftABI, signer);
            
            const builderSuffix = "0x62635f30303361366d736d0b0080218021802180218021802180218021";
            const txData = nftContract.interface.encodeFunctionData("mint", [userAddress]);
            const finalData = txData + builderSuffix.substring(2);
            
            const tx = await signer.sendTransaction({
                to: conf.nftContract,
                data: finalData
            });
            
            setStatusMsg({ text: `⏳ Minting on ${conf.name}...`, type: "info" });
            await tx.wait();
            
            setShowNftModal(false);
            setStatusMsg({ text: "🎨 NFT added to your wallet!", type: "warning" }); // warning = yellow/amber
            triggerConfetti(['#38BDF8', '#FBBF24']);
            
            // Recharger le dashboard en arrière-plan
            if(activeView === 'dashboard') loadDashboard();
            
        } catch (e) {
            setStatusMsg({ text: "❌ Minting error.", type: "error" });
        } finally {
            setIsMinting(false);
        }
    };

    const loadDashboard = async () => {
        if (!userAddress) return;
        const conf = networks[currentNetworkKey];
        
        setIsLoadingNfts(true);
        setNfts(null);

        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const nftContract = new ethers.Contract(conf.nftContract, nftABI, provider);
            
            const balance = await nftContract.balanceOf(userAddress);
            const count = Number(balance);

            if (count > 0) {
                // Simuler un tableau de NFTs pour l'affichage
                setNfts(Array(count).fill({ name: "ARC Winner", type: "Legendary Edition" }));
            } else {
                setNfts([]);
            }
        } catch (error) {
            console.error(error);
            setNfts(null);
            // Optionnel : gérer l'erreur d'affichage
        } finally {
            setIsLoadingNfts(false);
        }
    };

    // Charger le dashboard automatiquement quand on clique sur l'onglet
    useEffect(() => {
        if (activeView === 'dashboard' && userAddress) {
            loadDashboard();
        }
    }, [activeView, userAddress]);


    const handleSwap = async () => {
        const conf = networks[currentNetworkKey];
        if (!conf.hasSwap) return; 

        if (!userAddress) {
            setSwapStatusMsg({ text: "⚠️ Connect MetaMask first.", type: "error" });
            return;
        }

        try {
            setIsSwapping(true);
            setSwapStatusMsg({ text: "⏳ Step 1: Checking your inventory...", type: "info" });
            
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const nftContract = new ethers.Contract(conf.nftContract, nftABI, signer);
            
            const balance = await nftContract.balanceOf(userAddress);
            if (Number(balance) === 0) {
                setSwapStatusMsg({ text: "❌ You do not own any NFTs.", type: "error" });
                setIsSwapping(false);
                return;
            }
            
            setSwapStatusMsg({ text: "⏳ Searching for NFT ID...", type: "info" });
            const tokenIdToSwap = await nftContract.tokenOfOwnerByIndex(userAddress, 0);

            if (conf.isMainnet) {
                // LOGIQUE BURN (BASE MAINNET)
                setSwapStatusMsg({ text: `⏳ Executing Burn for NFT #${tokenIdToSwap}...`, type: "info" });
                const deadAddress = "0x000000000000000000000000000000000000dEaD";
                const txBurn = await nftContract.transferFrom(userAddress, deadAddress, tokenIdToSwap);
                
                setSwapStatusMsg({ text: `⏳ Burning on ${conf.name}...`, type: "info" });
                await txBurn.wait(); 

                setSwapStatusMsg({ text: "✅ NFT Burned successfully!", type: "success" });
                triggerConfetti(['#EF4444', '#F97316']);

            } else {
                // LOGIQUE SWAP USDC (ARC TESTNET)
                const swapContract = new ethers.Contract(conf.actionContract, swapABI, signer);
                
                setSwapStatusMsg({ text: `⏳ Step 2: Authorizing NFT #${tokenIdToSwap} (1/2)...`, type: "info" });
                const txApprove = await nftContract.approve(conf.actionContract, tokenIdToSwap);
                await txApprove.wait(); 

                setSwapStatusMsg({ text: `⏳ Step 3: Executing Swap for NFT #${tokenIdToSwap} (2/2)...`, type: "info" });
                const txSwap = await swapContract.swapNFTForUSDC(tokenIdToSwap);
                
                setSwapStatusMsg({ text: `⏳ Processing on ${conf.name}...`, type: "info" });
                await txSwap.wait(); 

                setSwapStatusMsg({ text: `✅ Swap successful! ${conf.depositAmount} ${conf.currency} has been sent to your wallet.`, type: "success" });
                triggerConfetti(['#10B981', '#34D399']);
            }
            
        } catch(e) {
            console.error("Detailed error:", e);
            if (e.code === "ACTION_REJECTED") {
                setSwapStatusMsg({ text: "❌ Transaction rejected in MetaMask.", type: "error" });
            } else {
                setSwapStatusMsg({ text: "❌ Transaction failed. Check the console (F12).", type: "error" });
            }
        } finally {
            setIsSwapping(false);
        }
    };

    // --- GAME ENGINE ---
    const triggerConfetti = (colors) => {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: colors, zIndex: 9999 });
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
            setStatusMsg({ text: "✨ Sector secured. NFT available!", type: "success" });
            setCredits(prev => prev + 5); 
            triggerConfetti(['#38BDF8', '#FBBF24']);
            setTimeout(() => { setShowNftModal(true); }, 1000);
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
            if(e.code === 'Space') { gameState.current.keys.Space = true; e.preventDefault(); }
        };
        const handleKeyUp = (e) => {
            if(e.code === 'ArrowLeft') gameState.current.keys.ArrowLeft = false;
            if(e.code === 'ArrowRight') gameState.current.keys.ArrowRight = false;
            if(e.code === 'Space') gameState.current.keys.Space = false;
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
          // Tir automatique : plus besoin d'appuyer sur Espace ou sur le bouton
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
        if (type === 'warning') return '#FBBF24';
        return '#38BDF8';
    };

    const currentConf = networks[currentNetworkKey];

    return (
        <div className="min-h-screen flex flex-col items-center justify-start pt-36 md:pt-24 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 relative pb-10">
            
            {/* --- NAVIGATION --- */}
            <nav className="absolute top-0 left-0 w-full p-4 md:p-6 flex flex-col md:flex-row justify-between items-center z-40 bg-slate-900/50 backdrop-blur-md border-b border-slate-800 gap-3 md:gap-0">
                <div className="text-xl md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400 flex items-center gap-2">
                    🚀 ARC Network
                </div>
                
                <div className="flex gap-4 md:gap-6 md:absolute md:left-1/2 md:-translate-x-1/2 text-xs md:text-sm">
                    <button 
                        onClick={() => setActiveView('game')} 
                        className={`pb-1 font-bold transition uppercase tracking-wider ${activeView === 'game' ? 'text-sky-400 border-b-2 border-sky-400' : 'text-slate-400 border-b-2 border-transparent hover:text-sky-300'}`}
                    >
                        🕹️ Arcade
                    </button>
                    <button 
                        onClick={() => setActiveView('dashboard')} 
                        className={`pb-1 font-bold transition uppercase tracking-wider ${activeView === 'dashboard' ? 'text-sky-400 border-b-2 border-sky-400' : 'text-slate-400 border-b-2 border-transparent hover:text-sky-300'}`}
                    >
                        🖼️ Dashboard
                    </button>
                    {currentConf.hasSwap && (
                        <button 
                            onClick={() => setActiveView('swap')} 
                            className={`pb-1 font-bold transition uppercase tracking-wider ${activeView === 'swap' ? 'text-sky-400 border-b-2 border-sky-400' : 'text-slate-400 border-b-2 border-transparent hover:text-sky-300'}`}
                        >
                            🔄 Swap
                        </button>
                    )}
                </div>

                <div>
                    <select 
                        value={currentNetworkKey}
                        onChange={(e) => {
                            setCurrentNetworkKey(e.target.value);
                            switchMetaMaskNetwork(e.target.value);
                        }}
                        className="bg-slate-800 text-sky-400 border border-sky-500/50 rounded-lg px-3 py-2 text-xs font-bold outline-none cursor-pointer hover:bg-slate-700 transition shadow-lg shadow-sky-500/20"
                    >
                        <option value="arc">🌐 ARC Testnet</option>
                        <option value="base">🔵 Base Mainnet</option>
                    </select>
                </div>
            </nav>

            {/* --- VIEW: GAME --- */}
            <div className={`w-full flex justify-center px-4 ${activeView !== 'game' ? 'hidden' : ''}`}>
                <div className="glass-panel p-5 rounded-3xl w-full max-w-lg text-center relative overflow-hidden">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-indigo-600 rounded-full blur-3xl opacity-20 pointer-events-none"></div>

                    <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400 mb-1">🚀 ARC Arcade</h1>
                    <p className="mono text-xs text-slate-400 mb-6 tracking-widest uppercase">
                        Web3 Play-to-Mint {currentConf.isMainnet ? 'Mainnet' : 'Testnet'}
                    </p>
                    
                    {userAddress && (
                    <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-4 mb-6 flex justify-center items-center">
                        <span className="text-slate-300 font-bold text-lg mr-4">Credits:</span>
                        <div className="flex items-center gap-2">
                            <span className="text-3xl font-bold text-emerald-400 drop-shadow-md">{credits}</span>
                            <span className="text-2xl">🪙</span>
                        </div>
                    </div>
                    )}

                    <div className="mb-6 relative">
                        <canvas ref={canvasRef} width="300" height="350" id="gameCanvas"></canvas>
                        
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

                    <div className="sm:hidden flex justify-between gap-3 mb-4 w-full">
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

                    {!userAddress && (
                        <button onClick={handleConnect} className="w-full bg-slate-800 hover:bg-slate-700 border border-indigo-500 text-white font-bold py-4 px-4 rounded-xl transition flex items-center justify-center gap-2 mb-4 shadow-lg shadow-indigo-500/20">
                            🦊 Connect MetaMask
                        </button>
                    )}

                    {userAddress && !gameActive && credits === 0 && (
                        <button onClick={handleDeposit} disabled={isDepositing} className="w-full bg-slate-700 hover:bg-slate-600 border border-emerald-500 text-emerald-400 font-bold py-3 px-4 rounded-xl transition flex items-center justify-center gap-2 mb-4">
                            {isDepositing ? "⏳ WAITING FOR METAMASK..." : (currentConf.isFreeToPlay ? "🎁 Claim 10 Credits (Gas fee only)" : `💳 Buy 10 Credits (${currentConf.depositAmount} ${currentConf.currency})`)}
                        </button>
                    )}

                    {userAddress && !gameActive && credits > 0 && (
                        <div className="flex-col gap-3 mb-4 w-full flex">
                            <button onClick={initGame} className="w-full bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold py-4 px-4 rounded-xl transition shadow-lg shadow-sky-500/30 text-lg uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed">
                                START MISSION (1 🪙)
                            </button>
                        </div>
                    )}

                    <p className="mono text-xs mt-4 h-4" style={{ color: getStatusColor(statusMsg.type) }}>
                        {statusMsg.text}
                    </p>
                </div>
            </div>

            {/* --- VIEW: DASHBOARD --- */}
            <div className={`w-full flex justify-center px-4 ${activeView !== 'dashboard' ? 'hidden' : ''}`}>
                <div className="glass-panel p-8 rounded-3xl w-full max-w-3xl text-center relative overflow-hidden">
                    <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400 mb-2">🖼️ Your Collection</h2>
                    <p className="mono text-xs text-slate-400 mb-8 tracking-widest uppercase">NFTs synced with the blockchain</p>
                    
                    <div className="flex flex-wrap justify-center gap-6 min-h-[200px] items-center">
                        {!userAddress ? (
                            <p className="text-slate-400">Connect MetaMask to view your collection.</p>
                        ) : isLoadingNfts ? (
                            <p className="text-sky-400 font-bold animate-pulse">⏳ Querying {currentConf.name}...</p>
                        ) : nfts && nfts.length > 0 ? (
                            nfts.map((nft, idx) => (
                                <div key={idx} className="nft-item bg-slate-800 p-3 rounded-2xl border border-slate-600 w-48 shadow-lg text-center">
                                    <div className="w-full h-48 bg-slate-700 rounded-xl mb-3 flex items-center justify-center border border-slate-600 overflow-hidden relative">
                                        {/* Placeholder pour l'image NFT car le src statique n'est pas fiable en React sans import */}
                                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 opacity-50"></div>
                                        <span className="text-5xl relative z-10">🏆</span>
                                    </div>
                                    <p className="text-white font-bold text-sm tracking-wide">{nft.name}</p>
                                    <p className="text-sky-400 text-xs mono mt-1">{nft.type}</p>
                                </div>
                            ))
                        ) : nfts && nfts.length === 0 ? (
                            <p className="text-slate-400">Your collection is empty. Win a game to mint!</p>
                        ) : (
                            <p className="text-red-400">❌ Error reading the contract.</p>
                        )}
                    </div>
                    
                    {userAddress && (
                    <button onClick={loadDashboard} className="mt-8 mx-auto bg-slate-800 hover:bg-slate-700 border border-sky-500 text-sky-400 font-bold py-2 px-6 rounded-xl transition flex items-center justify-center gap-2">
                        🔄 Refresh
                    </button>
                    )}
                </div>
            </div>

            {/* --- VIEW: SWAP --- */}
            {currentConf.hasSwap && (
            <div className={`w-full flex justify-center px-4 ${activeView !== 'swap' ? 'hidden' : ''}`}>
                <div className="glass-panel p-8 rounded-3xl w-full max-w-lg text-center relative overflow-hidden">
                    <h2 className={`text-3xl font-bold text-transparent bg-clip-text mb-2 ${currentConf.isMainnet ? 'bg-gradient-to-r from-red-500 to-orange-400' : 'bg-gradient-to-r from-emerald-400 to-teal-400'}`}>
                        {currentConf.isMainnet ? '🔥 Burn NFT' : '🔄 DEX Swap'}
                    </h2>
                    <p className="mono text-xs text-slate-400 mb-8 tracking-widest uppercase">Instant Liquidity</p>

                    <p className="text-slate-300 mb-6 text-sm">
                        {currentConf.isMainnet 
                            ? 'Permanently destroy your "ARC Mega Winner" NFT. (Gas fee only)'
                            : `Instantly swap your "ARC Mega Winner" NFT for ${currentConf.currency} directly to your wallet.`}
                    </p>
                    
                    <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 mb-6 flex justify-between items-center relative shadow-inner">
                        <div className="text-left w-1/3">
                            <p className="text-slate-400 text-[10px] uppercase tracking-widest mb-1">You burn</p>
                            <p className="text-lg font-bold text-white flex items-center gap-2">1x NFT <span className="text-xs">🖼️</span></p>
                        </div>
                        
                        <div className={`text-2xl w-1/3 text-center ${currentConf.isMainnet ? 'text-orange-500' : 'text-emerald-500'}`}>➡️</div>
                        
                        <div className="text-right w-1/3">
                            <p className="text-slate-400 text-[10px] uppercase tracking-widest mb-1">You receive</p>
                            <p className={`text-lg font-bold flex items-center justify-end gap-2 ${currentConf.isMainnet ? 'text-white' : 'text-emerald-400'}`}>
                                <span>{currentConf.isMainnet ? '0' : currentConf.depositAmount}</span> <span className="text-xs">{currentConf.currency}</span>
                            </p>
                        </div>
                    </div>

                    <button 
                        onClick={handleSwap} 
                        disabled={isSwapping}
                        className={`w-full text-white font-bold py-4 px-4 rounded-xl transition shadow-lg text-lg uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed ${
                            currentConf.isMainnet 
                                ? 'bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-400 hover:to-orange-500 shadow-red-500/30' 
                                : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-emerald-500/30'
                        }`}
                    >
                        {currentConf.isMainnet ? 'Burn NFT' : 'Approve & Swap'}
                    </button>
                    
                    <p className="mono text-xs mt-4 h-4" style={{ color: getStatusColor(swapStatusMsg.type) }}>
                        {swapStatusMsg.text}
                    </p>
                </div>
            </div>
            )}

            {/* --- MODAL NFT --- */}
            {showNftModal && (
            <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 z-50 animate-fade-in">
                <h3 className="text-amber-400 font-bold text-2xl mb-6 drop-shadow-[0_0_15px_rgba(251,191,36,0.8)] uppercase tracking-widest text-center">🏆 Mission Accomplished!</h3>
                <div className="nft-card relative rounded-2xl overflow-hidden mb-8 shadow-[0_0_60px_rgba(251,191,36,0.4)] border-2 border-amber-400/80 bg-slate-900" style={{ width: '240px', height: '340px' }}>
                    <div className="w-full h-full bg-gradient-to-br from-indigo-600 to-purple-800 flex items-center justify-center">
                        <span className="text-7xl">🏆</span>
                    </div>
                    <div className="holo-sweep absolute top-0 bottom-0 pointer-events-none z-20" style={{ width: '200%', transform: 'skewX(-20deg)' }}></div>
                </div>
                <button 
                    onClick={handleMint}
                    disabled={isMinting}
                    className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold py-4 px-6 rounded-xl text-lg transition shadow-[0_0_20px_rgba(249,115,22,0.4)] w-full max-w-xs tracking-widest uppercase disabled:opacity-50"
                >
                    {isMinting ? "⏳ Signing..." : "Mint my NFT"}
                </button>
            </div>
            )}
            
        </div>
    );
}
