import { useState, useEffect, useRef } from 'react'
import { useAuth } from './MultiplayerHelper';
import './App.css'

// Constants
const LETTER_SCORES: { [key: string]: number } = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8,
  K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1,
  U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10
}

const WORD_MULTIPLIERS: { [key: number]: number } = {
  3: 1,    // 3 letters
  4: 1,    // 4 letters
  5: 1.5,  // 5 letters
  6: 2,    // 6 letters
  7: 2.5,  // 7 letters
  8: 3     // 8+ letters
}

const REQUIRED_VOWELS = ['A', 'E', 'I', 'O', 'U']
const CONSONANTS = ['B', 'C', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'V', 'W', 'X', 'Y', 'Z']

const DUMMY_PLAYERS = {
  totalPlayers: 50,
  joiningPlayers: [
    { id: 44, name: "WordNinja", status: "ready" },
    { id: 45, name: "Wordsworth", status: "ready" },
    { id: 46, name: "SpellSeeker", status: "ready" },
    { id: 47, name: "LexiQuest", status: "joining" },
    { id: 48, name: "WordWeaver", status: "joining" },
    { id: 49, name: "AlphaKing", status: "joining" },
    { id: 50, name: "VocabVirtuoso", status: "joining" }
  ],
  activePlayers: [
    { id: 1, name: "WordMaster", wordsFound: 12, score: 345 },
    { id: 2, name: "LexiconPro", wordsFound: 10, score: 298 },
    { id: 3, name: "WordSmith", wordsFound: 9, score: 276 },
    { id: 4, name: "Spellbound", wordsFound: 8, score: 245 },
    { id: 5, name: "WordWizard", wordsFound: 7, score: 234 },
    { id: 6, name: "LetterLord", wordsFound: 7, score: 212 }
  ],
  finalStandings: [
    { id: 1, name: "WordMaster", wordsFound: 12, score: 345, rank: 1 },
    { id: 2, name: "LexiconPro", wordsFound: 10, score: 298, rank: 2 },
    { id: 3, name: "WordSmith", wordsFound: 9, score: 276, rank: 3 },
    { id: 4, name: "Spellbound", wordsFound: 8, score: 245, rank: 4 },
    { id: 5, name: "WordWizard", wordsFound: 7, score: 234, rank: 5 }
  ]
}

// Types
// @ts-ignore - Will be used in future implementation
interface Tile {
  letter: string
  points: number
  isActive: boolean
  id: string
}

// @ts-ignore - Will be used in future implementation
interface AudioContextType extends AudioContext {
  webkitAudioContext?: typeof AudioContext
}

// @ts-ignore - Will be used in future implementation
interface Sound {
  (): void
}

// @ts-ignore - Will be used in future implementation
interface Sounds {
  tileClick: () => void
  wordSuccess: () => void
  wordError: () => void
  gameOver: () => void
  shuffle: () => void
}

// Screen Component Types
// @ts-ignore - Will be used in future implementation
interface LobbyScreenProps {
  players: typeof DUMMY_PLAYERS.joiningPlayers
  onStart: () => void
  isSoundEnabled: boolean
  onToggleSound: () => void
  isAuthenticated: boolean
  signIn: () => void
  username: string
  signOut: () => void
}

// @ts-ignore - Will be used in future implementation
interface GameScreenProps {
  score: number
  wordsFound: number
  timeLeft: number
  currentWord: string
  tiles: Tile[]
  selectedTiles: number[]
  usedWords: Set<string>
  activePlayers: typeof DUMMY_PLAYERS.activePlayers
  dictionary: Set<string>
  onTileClick: (index: number) => void
  onSubmitWord: () => void
  onClear: () => void
  onShuffle: () => void
  calculateWordScore: (word: string) => number
  feedback: GameFeedback | null
  setFeedback: (feedback: GameFeedback | null) => void
  playSound: (type: SoundType) => void
}

// @ts-ignore - Will be used in future implementation
interface EndScreenProps {
  finalScore: number
  wordsFound: number
  onReturnToLobby: () => void
  finalStandings: typeof DUMMY_PLAYERS.finalStandings
  topWords: Array<{ word: string; score: number }>
}

interface Dictionary {
  words: string[]
}

// Dictionary validation (you would typically load this from an API)
// const DICTIONARY = new Set([...])

// Define window.AudioContext
declare global {
  interface Window {
    AudioContext: typeof AudioContext
    webkitAudioContext: typeof AudioContext
  }
}

// Calculate word score function
const calculateWordScore = (word: string): number => {
  const baseScore = word
    .toUpperCase()
    .split('')
    .reduce((score, letter) => score + (LETTER_SCORES[letter] || 0), 0)
  
  const length = word.length
  const multiplier = WORD_MULTIPLIERS[Math.min(length, 8)] || 1
  
  return Math.floor(baseScore * multiplier)
}

interface GameFeedback {
  message: string
  type: 'success' | 'error'
  timestamp: number
}

// Define sound frequencies outside the component
const SOUNDS = Object.freeze({
  START: 440.0,    // A4 note
  CLICK: 600.0,    // Button click
  SUCCESS: 800.0,  // Correct word
  ERROR: 200.0,    // Error
  GAME_OVER: 300.0,// Game over sound
  SHUFFLE: 700.0,  // Shuffle sound
  WORD_FOUND: 900.0 // Word found sound
});

// Ensure type safety for sound types
type SoundType = keyof typeof SOUNDS;

interface AudioContextState {
  context: AudioContext | null;
  gainNode: GainNode | null;
}

const App = () => {
  const [currentScreen, setCurrentScreen] = useState<'lobby' | 'game' | 'end'>('lobby')
  const [timeLeft, setTimeLeft] = useState(60)
  const [score, setScore] = useState(0)
  const [wordsFound, setWordsFound] = useState(0)
  const [currentWord, setCurrentWord] = useState('')
  const [selectedTiles, setSelectedTiles] = useState<number[]>([])
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set())
  const [tiles, setTiles] = useState<Tile[]>([])
  const [dictionary, setDictionary] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [feedback, setFeedback] = useState<GameFeedback | null>(null)
  const [isSoundEnabled, setIsSoundEnabled] = useState(true)
  
  const audioContext = useRef<AudioContext | null>(null)
  const gameTimer = useRef<NodeJS.Timeout | null>(null)
  // Add a ref to track audio context state
  const audioState = useRef<AudioContextState>({
    context: null,
    gainNode: null
  })

  const { isAuthenticated, signOut, username, signIn } = useAuth();

    

  // Function to safely create audio context
  const createAudioContext = () => {
    if (!audioState.current.context) {
      try {
        const context = new AudioContext();
        const gainNode = context.createGain();
        gainNode.connect(context.destination);
        audioState.current = { context, gainNode };
      } catch (error) {
        console.error('Failed to create AudioContext:', error);
      }
    }
    return audioState.current;
  }

  // Function to safely cleanup audio context
  const cleanupAudioContext = () => {
    try {
      if (audioState.current.context?.state !== 'closed') {
        audioState.current.context?.close();
      }
      audioState.current = { context: null, gainNode: null };
    } catch (error) {
      console.error('Failed to cleanup AudioContext:', error);
    }
  }

  // Function to play sound
  const playSound = (type: SoundType) => {
    if (!isSoundEnabled) return;
    console.log('Playing sound:', type); // Debug log

    // Get frequency and validate it exists
    const frequency = SOUNDS[type];
    if (frequency === undefined) {
      console.error(`Sound type "${type}" not found in SOUNDS`);
      return;
    }

    try {
      const { context, gainNode } = createAudioContext();
      if (!context || !gainNode) {
        console.error('Audio context or gain node not available');
        return;
      }

      const oscillator = context.createOscillator();
      oscillator.connect(gainNode);
      
      const currentTime = context.currentTime;
      
      // Set the frequency and volume
      oscillator.frequency.value = frequency;
      gainNode.gain.setValueAtTime(0.1, currentTime);
      
      // Play the sound
      oscillator.start(currentTime);
      oscillator.stop(currentTime + 0.1);
      
      // Cleanup
      oscillator.onended = () => {
        try {
          oscillator.disconnect();
        } catch (error) {
          console.error('Error disconnecting oscillator:', error);
        }
      };
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  }

  // Generate initial tiles with unique letters and all vowels
  const generateInitialTiles = () => {
    const newTiles: Tile[] = []
    const usedLetters = new Set<string>()

    // First, add all vowels
    REQUIRED_VOWELS.forEach(vowel => {
      newTiles.push({
        letter: vowel,
        points: LETTER_SCORES[vowel],
        isActive: false,
        id: `tile-${vowel}-${Math.random()}`
      })
      usedLetters.add(vowel)
    })

    // Then add unique consonants until we have 16 tiles
    while (newTiles.length < 16) {
      const consonant = CONSONANTS[Math.floor(Math.random() * CONSONANTS.length)]
      if (!usedLetters.has(consonant)) {
        newTiles.push({
          letter: consonant,
          points: LETTER_SCORES[consonant],
          isActive: false,
          id: `tile-${consonant}-${Math.random()}`
        })
        usedLetters.add(consonant)
      }
    }

    // Shuffle the tiles
    for (let i = newTiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newTiles[i], newTiles[j]] = [newTiles[j], newTiles[i]]
    }

    setTiles(newTiles)
  }

  // Initialize game
  useEffect(() => {
    generateInitialTiles()
  }, [])

  // Handle tile click without adjacency requirement
  const handleTileClick = (index: number) => {
    playSound('CLICK')
    
    const newSelectedTiles = [...selectedTiles, index]
    setSelectedTiles(newSelectedTiles)
    
    setTiles(prev => prev.map((tile, i) => ({
      ...tile,
      isActive: newSelectedTiles.includes(i)
    })))
    
    setCurrentWord(newSelectedTiles.map(i => tiles[i].letter).join(''))
  }

  // Clear selection
  const clearSelection = () => {
    setSelectedTiles([])
    setCurrentWord('')
    setTiles(prev => prev.map(tile => ({ ...tile, isActive: false })))
  }

  // Handle word submit with score calculation
  const handleWordSubmit = () => {
    if (currentWord.length < 1) {
      setFeedback({
        message: 'Word must be at least 3 letters long',
        type: 'error',
        timestamp: Date.now()
      });
      playSound('ERROR');
      clearSelection();
      return;
    }
    
    const wordLower = currentWord.toLowerCase();
    
    if (usedWords.has(wordLower)) {
      setFeedback({
        message: 'Word already found!',
        type: 'error',
        timestamp: Date.now()
      });
      playSound('ERROR');
      clearSelection();
      return;
    }

    if (!dictionary.has(wordLower)) {
      setFeedback({
        message: 'Word not in dictionary!',
        type: 'error',
        timestamp: Date.now()
      });
      playSound('ERROR');
      clearSelection();
      return;
    }

    const wordScore = calculateWordScore(currentWord);
    setScore(prev => prev + wordScore);
    setWordsFound(prev => prev + 1);
    setUsedWords(prev => new Set([...prev, wordLower]));
    setFeedback({
      message: `+${wordScore} points!`,
      type: 'success',
      timestamp: Date.now()
    });
    playSound('SUCCESS');
    clearSelection();
  };

  // Reset game state
  const resetGame = () => {
    try {
      playSound('START');
      setScore(0)
      setWordsFound(0)
      setTimeLeft(60)
      setCurrentWord('')
      setSelectedTiles([])
      setUsedWords(new Set())
      generateInitialTiles()
      playSound('GAME_OVER');
    } catch (error) {
      console.error('Error in resetGame:', error);
    }
  }

  // Start game handler
  const handleStartGame = () => {
    try {
      if (isAuthenticated) {
        playSound('START');
        resetGame()
        setCurrentScreen('game')
      } else {
        signIn()
      }
    } catch (error) {
      console.error('Error in handleStartGame:', error);
    }
  }

  // Return to lobby handler
  const handleReturnToLobby = () => {
    resetGame()
    setCurrentScreen('lobby')
    playSound('SHUFFLE')
  }

  // Audio cleanup
  useEffect(() => {
    return () => {
      if (gameTimer.current) {
        clearInterval(gameTimer.current)
      }
      if (audioContext.current?.state === 'running') {
        audioContext.current.close()
      }
    }
  }, [])

  // Game timer effect
  useEffect(() => {
    if (currentScreen === 'game' && timeLeft > 0) {
      gameTimer.current = setInterval(() => {
        setTimeLeft(prev => {
          const newTime = prev - 1
          if (newTime <= 0) {
            if (gameTimer.current) clearInterval(gameTimer.current)
            setCurrentScreen('end')
          }
          return newTime
        })
      }, 1000)

      return () => {
        if (gameTimer.current) clearInterval(gameTimer.current)
      }
    }
  }, [currentScreen])

  // Handle sound toggle
  const handleSoundToggle = () => {
    setIsSoundEnabled(prev => {
      if (!prev) {
        createAudioContext();
      } else {
        cleanupAudioContext();
      }
      return !prev;
    });
    playSound('CLICK');
  };

  // Shuffle tiles while maintaining letter properties
  const shuffleTiles = () => {
    setTiles(prev => {
      const newTiles = [...prev]
      for (let i = newTiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newTiles[i], newTiles[j]] = [newTiles[j], newTiles[i]]
      }
      return newTiles.map(tile => ({ ...tile, isActive: false }))
    })
    clearSelection()
    playSound('SHUFFLE')
  }

  // Word List Management
  // const addWordToList = (word: string, points: number) => {
  //   const wordsList = document.querySelector('.words-list')
  //   if (!wordsList) return

  //   const wordItem = document.createElement('div')
  //   wordItem.className = 'word-item'
  //   wordItem.innerHTML = `
  //     <span class="word">${word.toUpperCase()}</span>
  //     <span class="score">${points}</span>
  //   `

  //   if (wordsList.firstChild) {
  //     wordsList.insertBefore(wordItem, wordsList.firstChild)
  //   } else {
  //     wordsList.appendChild(wordItem)
  //   }
  // }

  // Update Top Words
  // const updateTopWords = () => {
  //   const topWords = Array.from(usedWords)
  //     .map(word => ({
  //       word: word.toUpperCase(),
  //       score: calculateWordScore(word)
  //     }))
  //     .sort((a, b) => b.score - a.score)
  //     .slice(0, 5)

  //   const container = document.querySelector('.top-words')
  //   if (container) {
  //     container.innerHTML = `
  //       <h3>Top Words</h3>
  //       ${topWords.map(({word, score}) => `
  //         <div class="word-row">
  //           <span class="word">${word}</span>
  //           <span class="points">${score} pts</span>
  //         </div>
  //       `).join('')}
  //     `
  //   }
  // }

  // Feedback Display
  // const showFeedback = (type: 'success' | 'error' | 'warning', message: string) => {
  //   const wordDisplay = document.querySelector('.word-display')
  //   if (!wordDisplay) return

  //   wordDisplay.textContent = message
  //   wordDisplay.className = `word-display feedback`
  //   wordDisplay.setAttribute('data-type', type)

  //   setTimeout(() => {
  //     wordDisplay.className = 'word-display'
  //     wordDisplay.textContent = currentWord || 'ENTER YOUR WORD'
  //   }, 1000)
  // }

  // Handle keyboard controls
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (currentScreen !== 'game') return

      if (e.key === 'Enter') {
        handleWordSubmit()
      } else if (e.key === 'Escape') {
        clearSelection()
      } else if (e.key === ' ') { // Spacebar
        e.preventDefault()
        shuffleTiles()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [currentScreen, currentWord])

  // Load dictionary on mount
  useEffect(() => {
    const loadDictionary = async () => {
      try {
        // Try to get dictionary from cache first
        const cachedDictionary = localStorage.getItem('wordblitz_dictionary')
        
        if (cachedDictionary) {
          setDictionary(new Set(JSON.parse(cachedDictionary)))
          setIsLoading(false)
          return
        }

        // If not in cache, fetch from file
        const response = await fetch('/dictionary.json')
        const data: Dictionary = await response.json()
        
        // Convert to Set for O(1) lookups and store in lowercase
        const wordSet = new Set(data.words)
        
        // Cache the dictionary
        localStorage.setItem('wordblitz_dictionary', JSON.stringify(Array.from(wordSet)))
        
        setDictionary(wordSet)
        setIsLoading(false)
      } catch (error) {
        console.error('Error loading dictionary:', error)

        setIsLoading(false)
      }
    }

    loadDictionary()
  }, [])

  // Show loading state while dictionary is being loaded
  if (isLoading) {
    return (
      <div className="loading-screen">
        <h1>WORDBLITZ</h1>
        <div className="loading-spinner">Loading Dictionary...</div>
      </div>
    )
  }

  // Update screen components with new props
  return (
    <div className="container">
      {currentScreen === 'lobby' && (
        <LobbyScreen 
          players={DUMMY_PLAYERS.joiningPlayers}
          onStart={handleStartGame}
          isSoundEnabled={isSoundEnabled}
          onToggleSound={handleSoundToggle}
          isAuthenticated={isAuthenticated}
          signIn={signIn}
          username={username}
          signOut={signOut}
        />
      )}
      {currentScreen === 'game' && (
        <GameScreen 
          score={score}
          wordsFound={wordsFound}
          timeLeft={timeLeft}
          currentWord={currentWord}
          tiles={tiles}
          selectedTiles={selectedTiles}
          usedWords={usedWords}
          activePlayers={DUMMY_PLAYERS.activePlayers}
          dictionary={dictionary}
          onTileClick={handleTileClick}
          onSubmitWord={handleWordSubmit}
          onClear={clearSelection}
          onShuffle={shuffleTiles}
          calculateWordScore={calculateWordScore}
          feedback={feedback}
          setFeedback={setFeedback}
          playSound={playSound}
        />
      )}
      {currentScreen === 'end' && (
        <EndScreen 
          finalScore={score}
          wordsFound={wordsFound}
          onReturnToLobby={handleReturnToLobby}
          finalStandings={DUMMY_PLAYERS.finalStandings}
          topWords={Array.from(usedWords)
            .map(word => ({
              word: word.toUpperCase(),
              score: calculateWordScore(word)
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)}
        />
      )}
    </div>
  )
}

const LobbyScreen: React.FC<LobbyScreenProps> = ({ 
  players, 
  onStart, 
  isSoundEnabled, 
  onToggleSound, 
  isAuthenticated, 
  signIn,
  username,
  signOut 
}) => {
  const [showGuestInput, setShowGuestInput] = useState(false);
  const [guestName, setGuestName] = useState('');
  const { setGuestName: setAuthGuestName } = useAuth();

  const handleGuestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (guestName.trim()) {
      setAuthGuestName(guestName.trim());
      setShowGuestInput(false);
    }
  };

  return (
    <div className="screen lobby-screen active">
      <div className="header">
        <button 
          className="sound-toggle"
          onClick={onToggleSound}
          aria-label={isSoundEnabled ? 'Mute sound' : 'Unmute sound'}
        >
          {isSoundEnabled ? '🔊' : '🔇'}
        </button>
        <div className="header-column title">
          <h1>WORDBLITZ</h1>
        </div>
        {isAuthenticated && (
          <button 
            className="sign-out-button"
            onClick={signOut}
          >
            Sign Out
          </button>
        )}
      </div>
      <div className="game-columns">
        <div className="column">
          <h2>Players Joining <span>{players.length}</span></h2>
          <div className="joining-list">
            {players.map((player) => (
              <div key={player.id} className="joining-player">
                <span className="player-name">{player.name}</span>
                <span className={`status ${player.status}`}>{player.status}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="column center">
          {isAuthenticated ? (
            <>
              <div className="welcome-message">
                <p>Welcome, {username}!</p>
              </div>
              <div className="start-game-container">
                <button 
                  className="start-game-button"
                  onClick={onStart}
                >
                  Start Game
                </button>
              </div>
            </>
          ) : showGuestInput ? (
            <form onSubmit={handleGuestSubmit} className="guest-form">
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Enter nickname..."
                maxLength={15}
                className="guest-input"
              />
              <div className="guest-buttons">
                <button type="submit" className="start-game-button">
                  Play as Guest
                </button>
                <button 
                  type="button" 
                  className="secondary-button"
                  onClick={() => setShowGuestInput(false)}
                >
                  Back
                </button>
              </div>
            </form>
          ) : (
            <div className="start-game-container">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button 
                  className="start-game-button"
                  onClick={signIn}
                >
                  Sign In
                </button>
                <button 
                  className="secondary-button"
                  onClick={() => setShowGuestInput(true)}
                  style={{ 
                    backgroundColor: '#2a2e33',
                    padding: '15px 30px',
                    borderRadius: '4px',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Play as Guest
                </button>
              </div>
            </div>
          )}
          <h3 style={{ textAlign: 'center' }}>How To Play</h3>
          <div className="instructions">
            <p style={{ textAlign: 'center' }}>• All words must be in the dictionary</p>
            <p style={{ textAlign: 'center' }}>• Longer words score more points</p>
            <p style={{ textAlign: 'center' }}>• Beat the clock and other players!</p>
          </div>
        </div>
        <div className="column">
          <h2>Scoring</h2>
          <div className="multipliers">
            <p>1-4 letters: 1× points</p>
            <p>5 letters: 1.5× points</p>
            <p>6 letters: 2× points</p>
            <p>7 letters: 2.5× points</p>
            <p>8+ letters: 3× points</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const GameScreen: React.FC<GameScreenProps> = ({
  score,
  wordsFound,
  timeLeft,
  currentWord,
  tiles,
  usedWords,
  activePlayers,
  dictionary,
  onTileClick,
  onSubmitWord,
  onClear,
  onShuffle,
  calculateWordScore,
  feedback,
  setFeedback,
  playSound
}) => {
  const [validationStatus, setValidationStatus] = useState<'none' | 'valid' | 'invalid'>('none');

  const handleSubmit = () => {
    const wordLower = currentWord.toLowerCase();
    
    if (currentWord.length < 3) {
      setValidationStatus('invalid');
      setFeedback({
        message: 'Word must be at least 3 letters long',
        type: 'error',
        timestamp: Date.now()
      });
      playSound('ERROR');
    } else if (usedWords.has(wordLower)) {
      setValidationStatus('invalid');
      setFeedback({
        message: 'Word already found!',
        type: 'error',
        timestamp: Date.now()
      });
      playSound('ERROR');
    } else if (!dictionary.has(wordLower)) {
      setValidationStatus('invalid');
      setFeedback({
        message: 'Word not in dictionary!',
        type: 'error',
        timestamp: Date.now()
      });
      playSound('ERROR');
    } else {
      setValidationStatus('valid');
      onSubmitWord();
    }

    // Reset validation status after animation
    setTimeout(() => {
      setValidationStatus('none');
      onClear();
    }, 1000);
  };

  // Calculate progress percentage (assuming game starts at 60 seconds)
  const timeProgress = (timeLeft / 60) * 100

  return (
    <div className="screen game-screen active">
      <div className="header">
        <div className="header-column">
          <p>Words Found</p>
          <span className="counter">{wordsFound}</span>
        </div>
        <div className="header-column title">
          <h1>WORDBLITZ</h1>
          <div className="time-container">
            <span className={`time-left ${timeLeft <= 10 ? 'warning' : ''}`}>
              {timeLeft}s
            </span>
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ 
                  width: `${timeProgress}%`,
                  backgroundColor: timeLeft <= 10 ? '#ff4444' : '#4CAF50'
                }}
              />
            </div>
          </div>
        </div>
        <div className="header-column">
          <p>Score</p>
          <span className="counter">{score}</span>
        </div>
      </div>

      <div className="game-columns">
        <div className="column">
          <h2>Leaderboard</h2>
          <div className="leaderboard">
            {activePlayers.map((player) => (
              <div key={player.id} className="player-row">
                <span className="player-name">{player.name}</span>
                <span className="player-score">{player.score}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="column center">
          <div className="game-area">
            <div className={`word-display ${validationStatus}`}>
              {feedback && (
                <div 
                  className={`feedback ${feedback.type}`}
                  key={feedback.timestamp}
                  onAnimationEnd={() => setFeedback(null)}
                >
                  {feedback.message}
                </div>
              )}
              <span className="current-word">{currentWord}</span>
            </div>
            
            <div className="tile-grid">
              {tiles.map((tile, index) => (
                <button
                  key={tile.id}
                  className={`tile ${tile.isActive ? 'active' : ''}`}
                  onClick={() => onTileClick(index)}
                >
                  <span className="letter">{tile.letter}</span>
                  <span className="points">{tile.points}</span>
                </button>
              ))}
            </div>

            <div className="controls">
              <button 
                className="control-button clear"
                onClick={onClear}
                disabled={!currentWord}
              >
                <span className="icon">↺</span>
                Clear
                <span className="shortcut">ESC</span>
              </button>

              <button
                className="control-button submit"
                onClick={handleSubmit}
                disabled={currentWord.length < 1}
              >
                <span className="icon">✓</span>
                Submit
                <span className="shortcut">↵</span>
              </button>

              <button 
                className="control-button shuffle"
                onClick={onShuffle}
              >
                <span className="icon">⟲</span>
                Shuffle
                <span className="shortcut">Space</span>
              </button>
            </div>
          </div>
        </div>

        <div className="column">
          <h2>Words Found</h2>
          <div className="words-list">
            {Array.from(usedWords).map((word, index) => (
              <div key={index} className="word-item">
                <span className="word">{word.toUpperCase()}</span>
                <span className="score">{calculateWordScore(word)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper function to check if tiles are adjacent
// const isAdjacent = (index1: number, index2: number) => {
//   const row1 = Math.floor(index1 / 4)
//   const col1 = index1 % 4
//   const row2 = Math.floor(index2 / 4)
//   const col2 = index2 % 4
//   
//   return Math.abs(row1 - row2) <= 1 && Math.abs(col1 - col2) <= 1
// }

const EndScreen: React.FC<{
  finalScore: number
  wordsFound: number
  onReturnToLobby: () => void
  finalStandings: typeof DUMMY_PLAYERS.finalStandings
  topWords: Array<{ word: string; score: number }>
}> = ({ finalScore, wordsFound, onReturnToLobby, finalStandings, topWords }) => {
  return (
    <div className="screen end-screen active">
      <div className="header">
        <div className="header-column title">
          <h1>WORDBLITZ</h1>
        </div>
      </div>
      <div className="game-columns">
        <div className="column">
          <h2>Final Standings</h2>
          <div className="final-standings">
            {finalStandings.map((player) => (
              <div key={player.id} className="standings-row">
                <div className="rank">{player.rank}</div>
                <div className="player-content">
                  <div className="player-info">
                    <div className="player-name">{player.name}</div>
                    <span className="words-found">{player.wordsFound} words</span>
                  </div>
                  <div className="final-score">{player.score}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="column center">
          <h2>Game Statistics</h2>
          <div className="game-stats">
            <div className="stat-item">
              <span className="stat-label">Total Score</span>
              <span className="stat-value">{finalScore}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Words Found</span>
              <span className="stat-value">{wordsFound}</span>
            </div>
            {/* Additional stats can be added here */}
          </div>
          <div className="return-lobby-container">
            <button 
              className="return-lobby-button"
              onClick={onReturnToLobby}
            >
              Return to Lobby
            </button>
          </div>
        </div>
        <div className="column">
          <h2>Top Words</h2>
          <div className="top-words">
            {topWords.map(({word, score}) => (
              <div key={word} className="word-row">
                <span className="word">{word}</span>
                <span className="points">{score} pts</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Add animations CSS
// const gameAnimations = `
//   @keyframes shake {
//     0%, 100% { transform: translateX(0); }
//     25% { transform: translateX(-5px); }
//     75% { transform: translateX(5px); }
//   }
//
//   @keyframes fadeIn {
//     from { opacity: 0; transform: translateY(-10px); }
//     to { opacity: 1; transform: translateY(0); }
//   }
//
//   @keyframes scorePopup {
//     0% { transform: translateY(0) scale(1); opacity: 1; }
//     100% { transform: translateY(-20px) scale(1.2); opacity: 0; }
//   }
//
//   @keyframes pulse {
//     0% { transform: scale(1); }
//     50% { transform: scale(1.05); }
//     100% { transform: scale(1); }
//   }
// `

export default App;