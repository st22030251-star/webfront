import React, { useState, useRef, useEffect } from "react";

// Paleta y helpers de estilo (estilo oscuro minimalista tipo Android)
const theme = {
  bg: "#121212",
  surface: "#1E1E1E",
  surfaceLow: "#181818",
  border: "#2A2A2A",
  text: "#EDEDED",
  textMuted: "#9AA0A6",
  accent: "#03DAC6",
};

// ====== Persistencia con IndexedDB ======
const DB_NAME = "music-player-db";
const DB_VERSION = 7; // v7: añade almacenamiento de carátulas personalizadas
const STORE_DIRS = "dirs";
const STORE_PLAYLISTS = "playlists";
const STORE_SETTINGS = "settings";
const STORE_SONGS = "songs";
const STORE_PLAYBACK_STATE = "playbackState";
const STORE_COVERS = "covers"; // key: song.key -> { type, dataUrl, thumbUrl }

// Polyfill para navegadores móviles
if (typeof window.showDirectoryPicker === 'undefined') {
  window.showDirectoryPicker = async () => {
    throw new Error('Not supported on mobile');
  };
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_DIRS)) db.createObjectStore(STORE_DIRS);
      if (!db.objectStoreNames.contains(STORE_PLAYLISTS)) db.createObjectStore(STORE_PLAYLISTS);
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) db.createObjectStore(STORE_SETTINGS);
      if (!db.objectStoreNames.contains(STORE_SONGS)) db.createObjectStore(STORE_SONGS);
      if (!db.objectStoreNames.contains(STORE_PLAYBACK_STATE)) db.createObjectStore(STORE_PLAYBACK_STATE);
      if (!db.objectStoreNames.contains(STORE_COVERS)) db.createObjectStore(STORE_COVERS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveDirHandles(handles) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DIRS, "readwrite");
    tx.objectStore(STORE_DIRS).put(handles, "handles");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadDirHandles() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DIRS, "readonly");
    const req = tx.objectStore(STORE_DIRS).get("handles");
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function savePlaylists(playlists) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PLAYLISTS, "readwrite");
    tx.objectStore(STORE_PLAYLISTS).put(playlists, "items");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadPlaylists() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PLAYLISTS, "readonly");
    const req = tx.objectStore(STORE_PLAYLISTS).get("items");
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function savePlaybackState(state) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PLAYBACK_STATE, "readwrite");
    tx.objectStore(STORE_PLAYBACK_STATE).put(state, "currentState");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadPlaybackState() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PLAYBACK_STATE, "readonly");
    const req = tx.objectStore(STORE_PLAYBACK_STATE).get("currentState");
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function saveSettings(settings) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SETTINGS, "readwrite");
    tx.objectStore(STORE_SETTINGS).put(settings, "appSettings");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadSettings() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SETTINGS, "readonly");
    const req = tx.objectStore(STORE_SETTINGS).get("appSettings");
    req.onsuccess = () => resolve(req.result || { minDuration: 30 });
    req.onerror = () => reject(req.error);
  });
}

async function saveSongs(songs) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SONGS, "readwrite");
    tx.objectStore(STORE_SONGS).put(songs, "allSongs");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadSongs() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SONGS, "readonly");
    const req = tx.objectStore(STORE_SONGS).get("allSongs");
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

// Componente Modal básico (oscuro)
function Modal({ isOpen, onClose, children }) {
  const [isSmall, setIsSmall] = useState(false);
  useEffect(() => {

    // Registrar service worker para notificaciones
    if ('serviceWorker' in navigator && 'Notification' in window) {
      navigator.serviceWorker.register('/sw.js')
        .then(() => console.log('Service Worker registrado'))
        .catch(err => console.log('Error registrando SW:', err));
    }

    // Escuchar mensajes del service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data && event.data.type === 'NOTIFICATION_ACTION') {
          switch (event.data.action) {
            case 'previous':
              prevTrack();
              break;
            case 'playpause':
              setIsPlaying(!isPlaying);
              break;
            case 'next':
              nextTrack();
              break;
          }
        }
      });
    }

    const mq = window.matchMedia && window.matchMedia('(max-width: 640px)');
    const update = () => setIsSmall(!!mq && mq.matches);
    update();
    if (mq && mq.addEventListener) {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    } else if (mq && mq.addListener) {
      // Safari legacy
      mq.addListener(update);
      return () => mq.removeListener(update);
    }
  }, []);

  if (!isOpen) return null;

  const containerStyle = isSmall
    ? {
      position: 'fixed',
      inset: 0,
      backgroundColor: theme.surface,
      color: theme.text,
      padding: 16,
      borderRadius: 0,
      zIndex: 1000,
      overflowY: 'auto',
      width: '90vw',
      height: '100vh',
      border: `1px solid ${theme.border}`,
    }
    : {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: theme.surface,
      color: theme.text,
      padding: 20,
      borderRadius: 12,
      zIndex: 1000,
      maxHeight: '80vh',
      overflowY: 'auto',
      width: '92%',
      maxWidth: 520,
      border: `1px solid ${theme.border}`,
      boxShadow: '0 10px 30px rgba(0,0,0,.5)',
    };

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 999 }}
        onClick={onClose}
      />
      <div style={containerStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            title="Cerrar"
            style={{ background: theme.surfaceLow, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}
          >
            ✖
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

function PersistentNotification({
  currentSong,
  isPlaying,
  onPlayPause,
  onNext,
  onPrevious
}) {
  // No mostrar en Android ya que usamos notificaciones del sistema
  if (!currentSong || /Android/i.test(navigator.userAgent)) {
    return null;
  }

  return (
    <div style={{
      position: "fixed",
      bottom: 20,
      left: "50%",
      transform: "translateX(-50%)",
      backgroundColor: theme.surface,
      color: theme.text,
      padding: "12px 16px",
      borderRadius: 12,
      border: `1px solid ${theme.border}`,
      boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      gap: 12,
      zIndex: 1001,
      minWidth: 300,
      maxWidth: "90%"
    }}>
      <div style={{
        flex: 1,
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }}>
        {currentSong.name}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onPrevious}
          style={{
            background: "transparent",
            border: "none",
            color: theme.text,
            cursor: "pointer",
            fontSize: 16
          }}
          title="Anterior"
        >
          ⏮️
        </button>
        <button
          onClick={onPlayPause}
          style={{
            background: "transparent",
            border: "none",
            color: theme.text,
            cursor: "pointer",
            fontSize: 16
          }}
          title={isPlaying ? "Pausar" : "Reproducir"}
        >
          {isPlaying ? "⏸️" : "▶️"}
        </button>
        <button
          onClick={onNext}
          style={{
            background: "transparent",
            border: "none",
            color: theme.text,
            cursor: "pointer",
            fontSize: 16
          }}
          title="Siguiente"
        >
          ⏭️
        </button>
      </div>
    </div>
  );
}

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const action = event.action;
  if (action) {
    // Enviar mensaje a la app para manejar la acción
    clients.matchAll().then(function (clients) {
      clients.forEach(function (client) {
        client.postMessage({
          type: 'NOTIFICATION_ACTION',
          action: action
        });
      });
    });
  } else {
    // Enfocar la app si se hace clic en el cuerpo de la notificación
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(function (clientList) {
        if (clientList.length > 0) {
          return clientList[0].focus();
        }
        return clients.openWindow('/');
      })
    );
  }
});

export default function MusicPlayer() {
  const [modalOpen, setModalOpen] = useState(false);
  const [directories, setDirectories] = useState([]); // nombres para UI
  const [dirHandles, setDirHandles] = useState([]); // FileSystemDirectoryHandle[]
  const [songs, setSongs] = useState([]); // { name, file, key }

  // Playlists [{ id, name, trackKeys: string[] }]
  const [playlists, setPlaylists] = useState([]);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [selectedPlaylistForAdd, setSelectedPlaylistForAdd] = useState("");
  const [activePlaylistId, setActivePlaylistId] = useState(null);
  const [restorePlayback, setRestorePlayback] = useState(false);

  // Slider: 0 = General, 1 = Playlists
  const [panelIndex, setPanelIndex] = useState(0);

  // Reproducción basada en cola (queue: índices hacia songs)
  const [queue, setQueue] = useState([]);
  const [trackIndex, setTrackIndex] = useState(0); // índice dentro de queue
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);
  const loadedSongKeyRef = useRef(null); // Track loaded song to avoid unnecessary reloads
  const idbHandlesFailedRef = useRef(false);

  // Modal para agregar canción a playlist
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [songIndexToAdd, setSongIndexToAdd] = useState(null);
  const [tempPlaylistId, setTempPlaylistId] = useState("");

  // Configuración de filtro de duración
  const [minDuration, setMinDuration] = useState(30); // Valor por defecto: 30 segundos
  const [isScanning, setIsScanning] = useState(false);

  // Now Playing modal and artwork state
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);
  const [coverCollapsed, setCoverCollapsed] = useState(false);
  const [artworkUrl, setArtworkUrl] = useState("");

  // Utilidad para formatear mm:ss
  const formatTime = (sec) => {
    if (!isFinite(sec) || sec < 0) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const songKeyFromFile = (file) => `${file.name}|${file.size}|${file.lastModified}`;
  const uniqueByKey = (arr) => Array.from(new Map(arr.map((s) => [s.key, s])).values());

  // Helpers de carátulas personalizadas
  async function saveCover(key, coverObj) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_COVERS, 'readwrite');
      tx.objectStore(STORE_COVERS).put(coverObj, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async function loadCover(key) {
    if (!key) return null;
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_COVERS, 'readonly');
      const req = tx.objectStore(STORE_COVERS).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  // Genera una carátula (artwork) automática basada en la clave de la canción
  const generateArtworkForSong = async (song) => {
    try {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      // Color derivado de la key
      const keyStr = song?.key || 'default';
      let hash = 0;
      for (let i = 0; i < keyStr.length; i++) hash = ((hash << 5) - hash) + keyStr.charCodeAt(i) | 0;
      const hue = Math.abs(hash) % 360;
      const grad = ctx.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0, `hsl(${hue}, 70%, 35%)`);
      grad.addColorStop(1, `hsl(${(hue + 40) % 360}, 70%, 20%)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      // Ícono musical simple
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = 'bold 180px system-ui, Segoe UI Emoji, Noto Color Emoji';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🎵', size / 2, size / 2);

      return canvas.toDataURL('image/png');
    } catch (e) {
      return '';
    }
  };

  // Intentar almacenamiento persistente (Android/Chrome)
  useEffect(() => {
    (async () => {
      if (navigator.storage?.persist) {
        try { await navigator.storage.persist(); } catch (_) { }
      }
    })();
  }, []);

  // Guardar configuración cuando cambia
  useEffect(() => {
    (async () => {
      try {
        await saveSettings({ minDuration });
      } catch (error) {
        console.warn("Error guardando configuración:", error);
      }
    })();
  }, [minDuration]);

  // Guardar canciones cuando cambian
  useEffect(() => {
    (async () => {
      if (songs.length > 0) {
        try {
          // Preparar canciones para almacenamiento (convertir File a datos serializables)
          const songsForStorage = await Promise.all(
            songs.map(async (song) => {
              const fileData = await readFileAsArrayBuffer(song.file);
              return {
                name: song.name,
                key: song.key,
                duration: song.duration,
                fileData: fileData,
                fileType: song.file.type
              };
            })
          );
          await saveSongs(songsForStorage);
        } catch (error) {
          console.warn("Error guardando canciones:", error);
        }
      }
    })();
  }, [songs]);

  // Cargar desde IndexedDB al iniciar - MODIFICADO para cargar estado de reproducción
  useEffect(() => {
    (async () => {
      try {
        const [handles, pls, settings, savedSongs, playbackState] = await Promise.all([
          loadDirHandles().catch(() => []),
          loadPlaylists().catch(() => []),
          loadSettings().catch(() => ({ minDuration: 30 })),
          loadSongs().catch(() => []),
          loadPlaybackState().catch(() => null)
        ]);

        if (Array.isArray(pls)) setPlaylists(pls);
        if (settings.minDuration) setMinDuration(settings.minDuration);

        // Cargar canciones guardadas
        if (Array.isArray(savedSongs) && savedSongs.length > 0) {
          // Convertir los objetos guardados a File objects
          const songsWithFiles = await Promise.all(
            savedSongs.map(async (song) => {
              return {
                ...song,
                file: new File([song.fileData], song.name, { type: song.fileType })
              };
            })
          );
          setSongs(songsWithFiles);

          // Restaurar estado de reproducción si existe y es reciente (menos de 1 hora)
          if (playbackState && playbackState.songKey &&
            (Date.now() - playbackState.timestamp) < 3600000) {
            const songIndex = songsWithFiles.findIndex(s => s.key === playbackState.songKey);
            if (songIndex !== -1) {
              setRestorePlayback(true);
              // Esperar a que las canciones estén completamente cargadas
              setTimeout(() => {
                setTrackIndex(songIndex);
                if (playbackState.isPlaying) {
                  setIsPlaying(true);
                }
                // Restaurar el tiempo después de que el audio esté listo
                if (audioRef.current && playbackState.currentTime) {
                  setTimeout(() => {
                    audioRef.current.currentTime = playbackState.currentTime;
                  }, 800);
                }
              }, 200);
            }
          }
        }

        if (Array.isArray(handles) && handles.length) {
          setDirHandles(handles);
          setDirectories(handles.map((h) => ({ name: h.name })));
        }
      } catch (_) { /* ignorar */ }
    })();
  }, []);

  // Leer archivo como ArrayBuffer para almacenamiento
  const readFileAsArrayBuffer = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  // Construir mapa key->index
  const keyToIndex = React.useMemo(() => {
    const m = new Map();
    songs.forEach((s, i) => m.set(s.key, i));
    return m;
  }, [songs]);

  // Reconstruir cola cuando cambian canciones o playlist activa
  useEffect(() => {
    if (!songs.length) { setQueue([]); setTrackIndex(0); return; }

    if (activePlaylistId) {
      const pl = playlists.find((p) => p.id === activePlaylistId);
      if (pl) {
        const indices = pl.trackKeys.map((k) => keyToIndex.get(k)).filter((x) => x !== undefined);
        setQueue(indices);
        // Solo actualizar trackIndex si no estamos restaurando la reproducción
        if (!restorePlayback) {
          setTrackIndex((ti) => (indices.length ? Math.min(ti, indices.length - 1) : 0));
        }
        return;
      }
    }

    const all = songs.map((_, i) => i);
    setQueue(all);
    // Solo actualizar trackIndex si no estamos restaurando la reproducción
    if (!restorePlayback) {
      setTrackIndex((ti) => (all.length ? Math.min(ti, all.length - 1) : 0));
    }
  }, [songs, activePlaylistId, playlists, keyToIndex, restorePlayback]);

  // Reflejar loop
  useEffect(() => { if (audioRef.current) audioRef.current.loop = isLooping; }, [isLooping]);

  useEffect(() => {
    if (!audioRef.current || !queue.length || !songs.length) return;

    const songIdx = queue[trackIndex];
    const song = songs[songIdx];
    if (!song) return;

    // Avoid reloading if the same song is already loaded
    if (loadedSongKeyRef.current === song.key) {
      // If only play/pause toggled, just ensure state
      if (isPlaying) {
        audioRef.current.play().catch(() => setIsPlaying(false));
      } else {
        audioRef.current.pause();
      }
      return;
    }

    // Crear una nueva URL para el archivo
    const url = URL.createObjectURL(song.file);
    const previousSrc = audioRef.current.src;

    // Configurar el audio
    audioRef.current.pause();
    audioRef.current.src = url;
    loadedSongKeyRef.current = song.key;
    audioRef.current.load();

    // Función para manejar la reproducción
    const playAudio = async () => {
      try {
        if (isPlaying) {
          await audioRef.current.play();
        }
      } catch (error) {
        console.warn("Error al reproducir:", error);
        // Si hay error, no mantener el estado de reproducción
        setIsPlaying(false);
      }
    };

    // No resetear currentTime si estamos restaurando la reproducción
    if (!restorePlayback) {
      setCurrentTime(0);
    }
    setDuration(0);

    // Reproducir después de cargar los metadatos
    const handleLoadedData = async () => {
      if (isPlaying && !restorePlayback) {
        await playAudio();
      }
      audioRef.current.removeEventListener('loadeddata', handleLoadedData);
    };

    audioRef.current.addEventListener('loadeddata', handleLoadedData);

    // Si estamos restaurando la reproducción, esperar un momento
    if (restorePlayback && isPlaying) {
      setTimeout(() => {
        playAudio();
      }, 300);
    }

    // Una vez que hemos cargado la canción, marcamos que ya no necesitamos restaurar
    if (restorePlayback) {
      setTimeout(() => {
        setRestorePlayback(false);
      }, 500);
    }

    return () => {
      URL.revokeObjectURL(url);
      if (previousSrc && previousSrc.startsWith('blob:')) {
        URL.revokeObjectURL(previousSrc);
      }
    };
  }, [trackIndex, queue, restorePlayback]);

  // Play/Pause - MODIFICADO para manejar promesas correctamente
  useEffect(() => {
    if (!audioRef.current) return;

    const handlePlayPause = async () => {
      try {
        if (isPlaying) {
          await audioRef.current.play();
        } else {
          audioRef.current.pause();
        }
      } catch (error) {
        console.warn("Error en play/pause:", error);
        // Si falla la reproducción, actualizar el estado
        if (error.name !== 'AbortError') {
          setIsPlaying(false);
        }
      }
    };

    handlePlayPause();
  }, [isPlaying]);

  // Obtener duración de un archivo de audio
  const getAudioDuration = (file) => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const audio = new Audio();
      audio.addEventListener('loadedmetadata', () => {
        resolve(audio.duration);
        URL.revokeObjectURL(url);
      });
      audio.addEventListener('error', () => {
        resolve(0);
        URL.revokeObjectURL(url);
      });
      audio.src = url;
    });
  };

  // Escanear y fusionar canciones desde directorios (con permisos)
  const scanAndMergeSongs = async (handles) => {
    const collected = [];
    for (const h of handles) {
      try {
        // Para handles virtuales (móviles)
        if (h.getFiles) {
          try {
            const files = await h.getFiles();
            for (const fileHandle of files) {
              if (fileHandle.kind === "file" && fileHandle.name.toLowerCase().endsWith(".mp3")) {
                try {
                  const file = await fileHandle.getFile();
                  const duration = await getAudioDuration(file);

                  // Filtrar por duración mínima
                  if (duration >= minDuration) {
                    collected.push({
                      name: fileHandle.name,
                      file,
                      key: songKeyFromFile(file),
                      duration
                    });
                  }
                } catch (_) { /* ignorar archivo inaccesible */ }
              }
            }
          } catch (error) {
            console.warn("Error escaneando directorio virtual:", error);
          }
        }
        // Para FileSystemDirectoryHandle (escritorio)
        else {
          let perm = "prompt";
          if (h.queryPermission) perm = await h.queryPermission({ mode: "read" });
          if (perm !== "granted" && h.requestPermission) {
            const res = await h.requestPermission({ mode: "read" });
            if (res !== "granted") continue;
          }
          for await (const entry of h.values()) {
            if (entry.kind === "file" && entry.name.toLowerCase().endsWith(".mp3")) {
              try {
                const file = await entry.getFile();
                const duration = await getAudioDuration(file);

                // Filtrar por duración mínima
                if (duration >= minDuration) {
                  collected.push({
                    name: entry.name,
                    file,
                    key: songKeyFromFile(file),
                    duration
                  });
                }
              } catch (_) { /* ignorar archivo inaccesible */ }
            }
          }
        }
      } catch (_) { /* ignorar errores del directorio */ }
    }
    if (collected.length) setSongs((prev) => uniqueByKey([...prev, ...collected]));
  };

  // Función para buscar canciones automáticamente en el dispositivo
  const scanDeviceForMusic = async () => {
    setIsScanning(true);
    try {
      // Esta función es experimental y requiere permisos especiales
      // En navegadores modernos, podemos intentar usar la API de File System Access

      if ('showDirectoryPicker' in window) {
        // Ya tenemos implementación para seleccionar carpetas
        // Podemos intentar acceder a directorios comunes
        alert("Para escanear automáticamente, por favor selecciona las carpetas donde buscar música.");
        return;
      }

      // Para dispositivos móviles, intentamos una estrategia diferente
      if (navigator.userAgent.includes('Android')) {
        // En Android, intentamos usar la API de Content Indexing (experimental)
        try {
          // Esto es experimental y puede no funcionar en todos los navegadores
          if ('getInstalledRelatedApps' in navigator) {
            alert("El escaneo automático requiere que selecciones manualmente las carpetas con música.");
          } else {
            alert("Tu navegador no soporta escaneo automático. Por favor selecciona manualmente las carpetas con música.");
          }
        } catch (error) {
          console.error("Error en escaneo automático:", error);
          alert("No se pudo realizar el escaneo automático. Por favor selecciona manualmente las carpetas.");
        }
      } else {
        alert("El escaneo automático no está disponible en tu dispositivo. Por favor selecciona manualmente las carpetas con música.");
      }
    } finally {
      setIsScanning(false);
    }
  };

  // Función para seleccionar archivos manualmente (como antes)
  const selectMusicFiles = async () => {
    if (!window.showOpenFilePicker) {
      alert("Esta función solo está disponible en navegadores modernos");
      return;
    }

    setIsScanning(true);
    try {
      const fileHandles = await window.showOpenFilePicker({
        multiple: true,
        types: [{
          description: 'Archivos de audio',
          accept: {
            'audio/*': ['.mp3', '.m4a', '.wav', '.ogg', '.flac']
          }
        }]
      });

      const collected = [];
      for (const handle of fileHandles) {
        try {
          const file = await handle.getFile();
          if (file.type.startsWith('audio/') || file.name.toLowerCase().endsWith('.mp3')) {
            const duration = await getAudioDuration(file);

            // Filtrar por duración mínima
            if (duration >= minDuration) {
              collected.push({
                name: file.name,
                file,
                key: songKeyFromFile(file),
                duration
              });
            }
          }
        } catch (error) {
          console.warn("Error procesando archivo:", error);
        }
      }

      if (collected.length) {
        setSongs((prev) => uniqueByKey([...prev, ...collected]));
        alert(`Se agregaron ${collected.length} canciones`);
      } else {
        alert("No se encontraron canciones que cumplan con el filtro de duración");
      }
    } catch (error) {
      console.warn("Error al seleccionar archivos:", error);
      if (error.name !== 'AbortError') {
        alert("No se pudieron seleccionar archivos. Asegúrate de conceder los permisos necesarios.");
      }
    } finally {
      setIsScanning(false);
    }
  };

  // Siguiente/Anterior
  const nextTrack = () => {
    if (!queue.length) return;
    setTrackIndex((prev) => {
      if (isShuffling && queue.length > 1) {
        let rnd; do { rnd = Math.floor(Math.random() * queue.length); } while (rnd === prev);
        return rnd;
      }
      return (prev + 1) % queue.length;
    });
    setIsPlaying(true);
  };
  const prevTrack = () => { if (queue.length) { setTrackIndex((p) => (p === 0 ? queue.length - 1 : p - 1)); setIsPlaying(true); } };

  // Navegar entre playlists
  const nextPlaylist = () => {
    if (!playlists.length) return;
    if (!activePlaylistId) { setActivePlaylistId(playlists[0].id); setPanelIndex(1); return; }
    const idx = playlists.findIndex(p => p.id === activePlaylistId);
    const next = (idx + 1) % playlists.length;
    setActivePlaylistId(playlists[next].id);
    setPanelIndex(1);
  };
  const prevPlaylist = () => {
    if (!playlists.length) return;
    if (!activePlaylistId) { setActivePlaylistId(playlists[playlists.length - 1].id); setPanelIndex(1); return; }
    const idx = playlists.findIndex(p => p.id === activePlaylistId);
    const prev = (idx - 1 + playlists.length) % playlists.length;
    setActivePlaylistId(playlists[prev].id);
    setPanelIndex(1);
  };

  const selectTrackFromAllSongs = (songIndex) => {
    // Si ya estamos reproduciendo esta canción, no hacer nada
    if (queue[trackIndex] === songIndex && activePlaylistId === null) return;

    setActivePlaylistId(null);
    setQueue(songs.map((_, i) => i));
    setTrackIndex(songIndex);
    setIsPlaying(true);
  };
  const selectTrackFromPlaylist = (playlistId, queuePos) => {
    // Si ya estamos reproduciendo esta playlist y esta posición, no hacer nada
    if (activePlaylistId === playlistId && trackIndex === queuePos) return;

    setActivePlaylistId(playlistId);
    setTrackIndex(queuePos);
    setIsPlaying(true);
  };

  const handleEnded = () => { if (!isLooping) nextTrack(); };
  const handleTimeUpdate = () => { if (audioRef.current) setCurrentTime(audioRef.current.currentTime || 0); };
  const handleLoadedMetadata = () => { if (audioRef.current) setDuration(audioRef.current.duration || 0); };
  const handleSeek = (e) => { const v = Number(e.target.value); setCurrentTime(v); if (audioRef.current) audioRef.current.currentTime = v; };

  // Directorios: agregar y persistir con protección de duplicados y fallos de IDB
  const addDirectory = async () => {
    try {
      // Detectar si es móvil y usar input file con webkitdirectory
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      if (isMobile) {
        // Para Android/iOS: usar input file con webkitdirectory
        return new Promise((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.webkitdirectory = true;
          input.multiple = true;

          input.onchange = async (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) {
              resolve();
              return;
            }

            // Obtener el nombre de la carpeta desde la ruta relativa
            const folderName = files[0].webkitRelativePath.split('/')[0] || 'Mobile Folder';

            // Crear un directorio virtual para móviles
            const virtualDirHandle = {
              name: folderName,
              kind: 'directory',
              isSameEntry: async (other) => other.name === this.name,
              // Método para obtener archivos
              getFiles: async () => {
                const fileHandles = [];
                for (const file of files) {
                  // Solo incluir archivos de la carpeta seleccionada
                  if (file.webkitRelativePath.startsWith(folderName + '/')) {
                    fileHandles.push({
                      kind: 'file',
                      name: file.name,
                      getFile: async () => file
                    });
                  }
                }
                return fileHandles;
              }
            };

            // Verificar duplicados
            let already = false;
            for (const h of dirHandles) {
              try {
                if (h.name === virtualDirHandle.name) {
                  already = true;
                  break;
                }
              } catch (_) { }
            }

            if (already) {
              alert("La carpeta ya está agregada");
              resolve();
              return;
            }

            const newHandles = [...dirHandles, virtualDirHandle];
            setDirHandles(newHandles);
            setDirectories((prev) => [...prev, { name: virtualDirHandle.name }]);

            // Persistir
            try {
              if (!idbHandlesFailedRef.current) await saveDirHandles(newHandles);
            } catch (_) {
              idbHandlesFailedRef.current = true;
            }

            // Escanear canciones
            await scanAndMergeSongs([virtualDirHandle]);
            resolve();
          };

          input.oncancel = () => resolve();
          input.click();
        });
      } else {
        // Para desktop: usar showDirectoryPicker normal
        if (!window.showDirectoryPicker) {
          alert("Tu navegador no soporta selección de carpetas");
          return;
        }

        const dirHandle = await window.showDirectoryPicker();

        // Evitar duplicados
        let already = false;
        for (const h of dirHandles) {
          try {
            if (h.isSameEntry) {
              if (await h.isSameEntry(dirHandle)) {
                already = true;
                break;
              }
            } else if (h.name === dirHandle.name) {
              already = true;
              break;
            }
          } catch (_) { }
        }

        if (already) {
          alert("La carpeta ya está agregada");
          return;
        }

        const newHandles = [...dirHandles, dirHandle];
        setDirHandles(newHandles);
        setDirectories((prev) => [...prev, { name: dirHandle.name }]);

        // Persistir
        try {
          if (!idbHandlesFailedRef.current) await saveDirHandles(newHandles);
        } catch (_) {
          idbHandlesFailedRef.current = true;
        }

        // Escanear canciones
        await scanAndMergeSongs([dirHandle]);
      }
    } catch (e) {
      console.warn("Error agregando carpeta", e);
      alert("No se pudo leer la carpeta seleccionada.");
    }
  };

  // Eliminar directorio y sus canciones asociadas
  const removeDirectory = async (index) => {
    try {
      // Confirmar eliminación
      if (!confirm(`¿Estás seguro de eliminar la carpeta "${directories[index].name}"?`)) {
        return;
      }

      // Obtener el handle que se va a eliminar
      const handleToRemove = dirHandles[index];

      // Crear nuevos arrays sin el directorio eliminado
      const newDirHandles = dirHandles.filter((_, i) => i !== index);
      const newDirectories = directories.filter((_, i) => i !== index);

      // Actualizar estado
      setDirHandles(newDirHandles);
      setDirectories(newDirectories);

      // Persistir cambios en IndexedDB
      try {
        if (!idbHandlesFailedRef.current) {
          await saveDirHandles(newDirHandles);
        }
      } catch (e) {
        console.warn("Error guardando cambios en IndexedDB", e);
        idbHandlesFailedRef.current = true;
      }

    } catch (e) {
      console.warn("Error eliminando carpeta", e);
      alert("Ocurrió un error al eliminar la carpeta.");
    }
  };

  // Rescanear todas las canciones con el filtro actual
  const rescanAllSongs = async () => {
    setIsScanning(true);
    try {
      // Mantener las canciones existentes
      const currentSongs = [...songs];
      setSongs([]);

      // Volver a escanear desde los directorios
      if (dirHandles.length > 0) {
        await scanAndMergeSongs(dirHandles);
      }

      // Restaurar las canciones que ya estaban (por si se perdieron durante el escaneo)
      setSongs(prev => uniqueByKey([...prev, ...currentSongs]));

      alert("Rescan completado. Se aplicó el filtro de duración actual.");
    } catch (error) {
      console.warn("Error en rescan:", error);
      alert("Error al rescaneear las canciones.");
    } finally {
      setIsScanning(false);
    }
  };

  // Playlists: crear, persistir, abrir
  const createPlaylist = async () => {
    const name = newPlaylistName.trim();
    if (!name) return;
    const pl = { id: String(Date.now()), name, trackKeys: [] };
    const updated = [...playlists, pl];
    setPlaylists(updated);
    setNewPlaylistName("");
    setSelectedPlaylistForAdd(pl.id);
    try { await savePlaylists(updated); } catch (_) { }
  };
  const openPlaylist = (plId) => { setActivePlaylistId(plId); setPanelIndex(1); };
  const showAllSongs = () => { setActivePlaylistId(null); setPanelIndex(0); };

  // Eliminar playlist completa
  const deletePlaylist = async (plId) => {
    if (!plId) return;
    const pl = playlists.find(p => p.id === plId);
    if (!pl) return;
    if (!confirm(`¿Eliminar la lista "${pl.name}"?`)) return;
    const updated = playlists.filter((p) => p.id !== plId);
    setPlaylists(updated);
    if (activePlaylistId === plId) {
      setActivePlaylistId(null);
      setPanelIndex(0);
    }
    try { await savePlaylists(updated); } catch (_) { }
  };

  // Agregar canción a una playlist por ID
  const addSongToPlaylist = async (plId, songIdx) => {
    if (!plId || songIdx == null) return;
    const s = songs[songIdx];
    if (!s) return;
    const updated = playlists.map((pl) => {
      if (pl.id !== plId) return pl;
      const exists = pl.trackKeys.includes(s.key);
      return exists ? pl : { ...pl, trackKeys: [...pl.trackKeys, s.key] };
    });
    setPlaylists(updated);
    try { await savePlaylists(updated); } catch (_) { }

    // Mostrar confirmación sin interrumpir la reproducción
    const pl = updated.find(p => p.id === plId);
    if (pl) {
      // Podrías agregar aquí una notificación toast si lo deseas
      console.log(`Canción agregada a ${pl.name}`);
    }
  };

  // Eliminar canción de una playlist
  const removeSongFromPlaylist = async (plId, songKey) => {
    if (!plId || !songKey) return;
    const updated = playlists.map((pl) => (
      pl.id !== plId ? pl : { ...pl, trackKeys: pl.trackKeys.filter((k) => k !== songKey) }
    ));
    setPlaylists(updated);
    try { await savePlaylists(updated); } catch (_) { }
  };

  // Confirmación desde el modal de selección de playlist
  const handleConfirmAddToPlaylist = async () => {
    if (!tempPlaylistId) { alert("Selecciona una lista"); return; }
    if (songIndexToAdd == null) return;
    await addSongToPlaylist(tempPlaylistId, songIndexToAdd);
    setAddModalOpen(false);
    setSongIndexToAdd(null);
  };

  // Estilos botones base
  const baseButton = {
    background: theme.surface,
    color: theme.text,
    border: `1px solid ${theme.border}`,
    borderRadius: 12,
    padding: "10px 14px",
    cursor: "pointer",
    minWidth: 44,
    minHeight: 44,
  };

  // Canción actual
  const currentSong = queue.length && songs.length ? songs[queue[trackIndex]] : null;

  // Generate/update artwork when song changes (prefer custom cover if available)
  useEffect(() => {
    (async () => {
      if (!currentSong) { setArtworkUrl(""); return; }
      const existing = await loadCover(currentSong.key).catch(() => null);
      if (existing?.dataUrl) {
        setArtworkUrl(existing.dataUrl);
        return;
      }
      const url = await generateArtworkForSong(currentSong);
      setArtworkUrl(url);
    })();
  }, [currentSong]);

  // Abrir automáticamente la vista Now Playing al iniciar una canción
  useEffect(() => {
    if (currentSong && isPlaying) {
      setNowPlayingOpen(true);
    }
  }, [currentSong, isPlaying]);

  useEffect(() => {
    const saveCurrentState = async () => {
      if (currentSong && audioRef.current) {
        const playbackState = {
          songKey: currentSong.key,
          currentTime: audioRef.current.currentTime,
          isPlaying: isPlaying,
          timestamp: Date.now()
        };
        try {
          await savePlaybackState(playbackState);
        } catch (error) {
          console.warn("Error guardando estado de reproducción:", error);
        }
      }
    };

    // Guardar cada 2 segundos
    const interval = setInterval(saveCurrentState, 2000);
    return () => clearInterval(interval);
  }, [currentSong, isPlaying]);

  // Android: Media Session API to show persistent notification with seekbar and controls
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    if (!/Android/i.test(navigator.userAgent)) return;

    const song = currentSong;
    if (!song) return;

    // Set metadata
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.name,
      artist: 'MUSICREP',
      album: 'Local',
      artwork: artworkUrl ? [
        { src: artworkUrl, sizes: '512x512', type: 'image/png' }
      ] : undefined,
    });

    const getPositionState = () => ({
      duration: Number.isFinite(duration) ? duration : 0,
      playbackRate: 1.0,
      position: Number.isFinite(currentTime) ? currentTime : 0,
    });

    if ('setPositionState' in navigator.mediaSession) {
      try { navigator.mediaSession.setPositionState(getPositionState()); } catch (_) {}
    }

    const actionHandlers = [
      ['play', async () => { setIsPlaying(true); }],
      ['pause', () => { setIsPlaying(false); }],
      ['previoustrack', () => { prevTrack(); }],
      ['nexttrack', () => { nextTrack(); }],
      ['seekto', (details) => {
        const to = Math.min(Math.max(details.seekTime || 0, 0), duration || 0);
        if (audioRef.current) {
          audioRef.current.currentTime = to;
        }
        setCurrentTime(to);
        if ('setPositionState' in navigator.mediaSession) {
          try { navigator.mediaSession.setPositionState(getPositionState()); } catch (_) {}
        }
      }],
      ['seekbackward', (details) => {
        const step = details.seekOffset || 10;
        const to = Math.max((audioRef.current?.currentTime || 0) - step, 0);
        if (audioRef.current) audioRef.current.currentTime = to;
        setCurrentTime(to);
      }],
      ['seekforward', (details) => {
        const step = details.seekOffset || 10;
        const to = Math.min((audioRef.current?.currentTime || 0) + step, duration || 0);
        if (audioRef.current) audioRef.current.currentTime = to;
        setCurrentTime(to);
      }],
      ['stop', () => { setIsPlaying(false); }],
    ];

    // Register handlers
    actionHandlers.forEach(([action, handler]) => {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch (_) {}
    });

    // Cleanup: remove handlers
    return () => {
      actionHandlers.forEach(([action]) => {
        try { navigator.mediaSession.setActionHandler(action, null); } catch (_) {}
      });
    };
  }, [currentSong, duration, currentTime, prevTrack, nextTrack, artworkUrl]);

  // Keep Media Session position state synced while playing
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    if (!currentSong) return;
    if ('setPositionState' in navigator.mediaSession) {
      try {
        navigator.mediaSession.setPositionState({
          duration: Number.isFinite(duration) ? duration : 0,
          playbackRate: 1.0,
          position: Number.isFinite(currentTime) ? currentTime : 0,
        });
      } catch (_) {}
    }
  }, [currentSong, currentTime, duration]);

  // Reflect playing/paused into mediaSession playbackState (Android shows correct icon)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  return (
    <div
      style={{
        maxWidth: 680,
        margin: "20px auto",
        padding: 16,
        position: "relative",
        background: theme.bg,
        color: theme.text,
        borderRadius: 16,
        border: `1px solid ${theme.border}`,
        boxShadow: "0 8px 24px rgba(0,0,0,.4)",
      }}
    >
      {/* Botón de configuración arriba a la derecha */}
      <button
        onClick={() => setModalOpen(true)}
        title="Configuración"
        style={{ ...baseButton, position: "absolute", top: 12, right: 12, padding: "8px 12px", borderRadius: 999, background: theme.surfaceLow }}
      >
        ⚙️
      </button>

      {/* Botón de slide panel (izquierda) */}
      <button
        onClick={() => setPanelIndex((i) => (i === 0 ? 1 : 0))}
        title={panelIndex === 0 ? "Ir a Playlists" : "Volver a Canciones"}
        style={{ ...baseButton, position: "absolute", top: 12, left: 12, padding: "8px 12px", borderRadius: 999, background: theme.surfaceLow }}
      >
        {panelIndex === 0 ? "Playlists" : "Canciones"}
      </button>

      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, textAlign: "center" }}>Reproductor de Música</h2>
      <p style={{ margin: "6px 0 12px", color: theme.textMuted, fontSize: 12, textAlign: "center" }}>Local • Estilo oscuro</p>

      {/* Slider de paneles: General (todas) / Playlists */}
      <div style={{ overflow: "hidden", border: `1px solid ${theme.border}`, borderRadius: 12, background: theme.surface }}>
        <div
          style={{
            display: "flex",
            width: "200%",
            transform: `translateX(-${panelIndex * 50}%)`,
            transition: "transform 280ms ease",
          }}
        >
          {/* Panel 1: General (todas las canciones) */}
          <div style={{ width: "50%", padding: 10, boxSizing: "border-box" }}>
            {songs.length > 0 ? (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 300, overflowY: "auto" }}>
                {songs.map((song, index) => {
                  const selected = currentSong && song.key === currentSong.key;
                  return (
                    <li
                      key={song.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        cursor: "pointer",
                        background: selected ? "#2A2A2A" : "transparent",
                        color: theme.text,
                        padding: "10px 12px",
                        borderRadius: 10,
                        marginBottom: 6,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }} onClick={() => { selectTrackFromAllSongs(index); setNowPlayingOpen(true); }}>
                        <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{song.name}</div>
                        <div style={{ fontSize: 12, color: theme.textMuted }}>
                          {formatTime(song.duration || 0)}
                        </div>
                      </div>
                      {/* Agregar a playlist (abre modal con listas existentes) */}
                      <button
                        title="Agregar a una lista"
                        onClick={() => { setSongIndexToAdd(index); setTempPlaylistId(selectedPlaylistForAdd || ""); setAddModalOpen(true); }}
                        style={{ ...baseButton, padding: "6px 10px" }}
                      >
                        ➕
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p style={{ color: theme.textMuted }}>No hay canciones. Abre Configuración y agrega una carpeta.</p>
            )}
          </div>

          {/* Panel 2: Playlists */}
          <div style={{ width: "50%", padding: 10, boxSizing: "border-box", borderLeft: `1px solid ${theme.border}` }}>
            <h4 style={{ margin: 4, color: theme.textMuted }}>Listas de reproducción</h4>

            {/* Crear nueva lista */}
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <input
                type="text"
                placeholder="Nombre de la lista"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                style={{ flex: 1, minWidth: 160, background: theme.surfaceLow, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "10px 12px" }}
              />
              <button style={{ ...baseButton, background: theme.accent, color: "#00201C" }} onClick={createPlaylist}>Crear</button>
            </div>

            {/* Listado de listas existentes */}
            {playlists.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10, maxHeight: 220, overflowY: "auto" }}>
                {playlists.map((pl) => (
                  <div key={pl.id} style={{ background: theme.surfaceLow, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "8px 10px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <strong>{pl.name}</strong>
                        <span style={{ color: theme.textMuted, fontSize: 12 }}>{pl.trackKeys.length} canciones</span>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button style={baseButton} onClick={() => openPlaylist(pl.id)}>Abrir</button>
                        <button
                          style={{ ...baseButton, color: "#ff6b6b" }}
                          onClick={() => deletePlaylist(pl.id)}
                          title="Eliminar esta lista"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>

                    {/* Vista rápida de canciones de la lista (clic para reproducir) */}
                    {pl.id === activePlaylistId && pl.trackKeys.length > 0 && (
                      <ul style={{ listStyle: "none", padding: 0, marginTop: 8 }}>
                        {pl.trackKeys.map((k, i) => {
                          const idx = keyToIndex.get(k);
                          const s = idx !== undefined ? songs[idx] : null;
                          if (!s) return null;
                          const selected = currentSong && s.key === currentSong.key;
                          return (
                            <li key={`${pl.id}-${k}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: selected ? "#2A2A2A" : "transparent" }}>
                              <div onClick={() => { selectTrackFromPlaylist(pl.id, i); setNowPlayingOpen(true); }} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span>
                                <div style={{ fontSize: 12, color: theme.textMuted }}>
                                  {formatTime(s.duration || 0)}
                                </div>
                              </div>
                              <button
                                title="Quitar de esta lista"
                                onClick={() => removeSongFromPlaylist(pl.id, s.key)}
                                style={{ ...baseButton, padding: "4px 8px", color: "#ff6b6b" }}
                              >
                                🗑️
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: theme.textMuted, marginTop: 10 }}>Crea tu primera lista para organizar tus canciones.</p>
            )}


          </div>
        </div>
      </div>

      {/* Elemento de audio */}
      <audio
        ref={audioRef}
        onEnded={handleEnded}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onError={(e) => {
          console.error("Error de audio:", e);
          setIsPlaying(false);
        }}
      />

      {/* Controles inferiores */}
      <div style={{ marginTop: 16, borderTop: `1px solid ${theme.border}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Nombre de la canción */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "left", flex: 1 }}>
            {currentSong?.name || ""}
          </div>
          <button style={{ ...baseButton, padding: "6px 10px" }} onClick={() => setNowPlayingOpen(true)} title="Abrir vista de reproducción">🖼️</button>
        </div>

        {/* Slider de tiempo con etiquetas */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ minWidth: 48, textAlign: "right", color: theme.textMuted, fontVariantNumeric: "tabular-nums" }}>{formatTime(currentTime)}</span>
          <input type="range" min={0} max={Math.max(0, Math.floor(duration))} value={Math.floor(currentTime)} onChange={handleSeek} style={{ flex: 1, accentColor: theme.accent, background: "transparent" }} />
          <span style={{ minWidth: 48, color: theme.textMuted, fontVariantNumeric: "tabular-nums" }}>{formatTime(duration)}</span>
        </div>

        {/* Botones: atrás, reproducir/pausa, siguiente, aleatorio, repetir */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button style={baseButton} onClick={prevTrack} title="Anterior">⏮️</button>
          <button style={{ ...baseButton, background: isPlaying ? theme.surface : theme.accent, color: isPlaying ? theme.text : "#00201C", fontWeight: 700, minWidth: 64 }} onClick={() => setIsPlaying(!isPlaying)} title="Pausa/Reproducir">{isPlaying ? "⏸️" : "▶️"}</button>
          <button style={baseButton} onClick={nextTrack} title="Siguiente">⏭️</button>
          <button onClick={() => setIsShuffling((s) => !s)} title="Aleatorio (shuffle)" style={{ ...baseButton, background: isShuffling ? "#113D39" : theme.surface, color: isShuffling ? theme.accent : theme.text }}>🔀</button>
          <button onClick={() => setIsLooping((v) => !v)} title="Repetir pista" style={{ ...baseButton, background: isLooping ? "#113D39" : theme.surface, color: isLooping ? theme.accent : theme.text }}>🔁</button>
        </div>
      </div>

      {/* Now Playing: vista con carátula y controles, carátula colapsable */}
      <Modal isOpen={nowPlayingOpen} onClose={() => setNowPlayingOpen(false)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: coverCollapsed ? "none" : "block" }}>
            <div style={{ width: "100%", aspectRatio: "1/1", background: theme.surfaceLow, borderRadius: 12, border: `1px solid ${theme.border}`, overflow: "hidden" }}>
              {artworkUrl ? (
                <img
                  src={artworkUrl}
                  alt="cover"
                  style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }}
                  title="Cambiar carátula (imagen o video)"
                  onClick={async () => {
                    try {
                      // input oculto para seleccionar imagen o video
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*,video/*';
                      input.onchange = async (e) => {
                        const file = e.target.files && e.target.files[0];
                        if (!file || !currentSong) return;

                        // Crear preview estático si es video (primer frame)
                        const toDataURL = (blob) => new Promise((res, rej) => {
                          const reader = new FileReader();
                          reader.onload = () => res(reader.result);
                          reader.onerror = rej;
                          reader.readAsDataURL(blob);
                        });

                        let dataUrl = '';
                        if (file.type.startsWith('video/')) {
                          // Capturar primer frame del video
                          const video = document.createElement('video');
                          video.preload = 'auto';
                          video.muted = true;
                          video.src = URL.createObjectURL(file);
                          await new Promise((r) => video.addEventListener('loadeddata', r, { once: true }));
                          video.currentTime = 0.1;
                          await new Promise((r) => video.addEventListener('seeked', r, { once: true }));
                          const canvas = document.createElement('canvas');
                          canvas.width = 512; canvas.height = 512;
                          const ctx = canvas.getContext('2d');
                          // cubrir el canvas con el frame escalado
                          const ratio = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
                          const nw = video.videoWidth * ratio;
                          const nh = video.videoHeight * ratio;
                          const nx = (canvas.width - nw) / 2;
                          const ny = (canvas.height - nh) / 2;
                          ctx.fillStyle = '#000';
                          ctx.fillRect(0, 0, canvas.width, canvas.height);
                          ctx.drawImage(video, nx, ny, nw, nh);
                          dataUrl = canvas.toDataURL('image/png');
                          URL.revokeObjectURL(video.src);
                        } else {
                          // Imagen directa -> dataURL
                          dataUrl = await toDataURL(file);
                        }

                        setArtworkUrl(dataUrl);
                        await saveCover(currentSong.key, { type: 'custom', dataUrl });
                      };
                      input.click();
                    } catch (err) {
                      console.warn('No se pudo actualizar la carátula:', err);
                    }
                  }}
                />
              ) : (
                <div
                  style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: theme.textMuted, cursor: "pointer" }}
                  title="Agregar carátula (imagen o video)"
                  onClick={async () => {
                    try {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*,video/*';
                      input.onchange = async (e) => {
                        const file = e.target.files && e.target.files[0];
                        if (!file || !currentSong) return;

                        const toDataURL = (blob) => new Promise((res, rej) => {
                          const reader = new FileReader();
                          reader.onload = () => res(reader.result);
                          reader.onerror = rej;
                          reader.readAsDataURL(blob);
                        });

                        let dataUrl = '';
                        if (file.type.startsWith('video/')) {
                          const video = document.createElement('video');
                          video.preload = 'auto';
                          video.muted = true;
                          video.src = URL.createObjectURL(file);
                          await new Promise((r) => video.addEventListener('loadeddata', r, { once: true }));
                          video.currentTime = 0.1;
                          await new Promise((r) => video.addEventListener('seeked', r, { once: true }));
                          const canvas = document.createElement('canvas');
                          canvas.width = 512; canvas.height = 512;
                          const ctx = canvas.getContext('2d');
                          const ratio = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
                          const nw = video.videoWidth * ratio;
                          const nh = video.videoHeight * ratio;
                          const nx = (canvas.width - nw) / 2;
                          const ny = (canvas.height - nh) / 2;
                          ctx.fillStyle = '#000';
                          ctx.fillRect(0, 0, canvas.width, canvas.height);
                          ctx.drawImage(video, nx, ny, nw, nh);
                          dataUrl = canvas.toDataURL('image/png');
                          URL.revokeObjectURL(video.src);
                        } else {
                          dataUrl = await toDataURL(file);
                        }
                        setArtworkUrl(dataUrl);
                        await saveCover(currentSong.key, { type: 'custom', dataUrl });
                      };
                      input.click();
                    } catch (err) {
                      console.warn('No se pudo actualizar la carátula:', err);
                    }
                  }}
                >
                  Sin carátula
                </div>
              )}
            </div>
          </div>
          <button style={{ ...baseButton, width: "100%" }} onClick={() => setCoverCollapsed(!coverCollapsed)}>
            {coverCollapsed ? "Mostrar carátula" : "Ocultar carátula"}
          </button>

          <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {currentSong?.name || ""}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ minWidth: 48, textAlign: "right", color: theme.textMuted, fontVariantNumeric: "tabular-nums" }}>{formatTime(currentTime)}</span>
            <input type="range" min={0} max={Math.max(0, Math.floor(duration))} value={Math.floor(currentTime)} onChange={handleSeek} style={{ flex: 1, accentColor: theme.accent, background: "transparent" }} />
            <span style={{ minWidth: 48, color: theme.textMuted, fontVariantNumeric: "tabular-nums" }}>{formatTime(duration)}</span>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button style={baseButton} onClick={prevTrack} title="Anterior">⏮️</button>
            <button style={{ ...baseButton, background: isPlaying ? theme.surface : theme.accent, color: isPlaying ? theme.text : "#00201C", fontWeight: 700, minWidth: 64 }} onClick={() => setIsPlaying(!isPlaying)} title="Pausa/Reproducir">{isPlaying ? "⏸️" : "▶️"}</button>
            <button style={baseButton} onClick={nextTrack} title="Siguiente">⏭️</button>
          </div>
        </div>
      </Modal>

      {/* Modal de Configuración */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}>
        <h3 style={{ marginTop: 0 }}>Configuración</h3>

        {/* Botón para escaneo automático */}
        <div style={{ marginBottom: 16 }}>
          <button
            style={{ ...baseButton, background: theme.surfaceLow, width: "100%" }}
            onClick={scanDeviceForMusic}
            disabled={isScanning}
          >
            {isScanning ? "Escaneando..." : "Buscar canciones automáticamente"}
          </button>
          <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>
            Intenta encontrar canciones en el dispositivo (experimental)
          </p>
        </div>

        {/* Botón para seleccionar archivos manualmente */}
        <div style={{ marginBottom: 16 }}>
          <button
            style={{ ...baseButton, background: theme.surfaceLow, width: "100%" }}
            onClick={selectMusicFiles}
            disabled={isScanning}
          >
            Seleccionar archivos de música manualmente
          </button>
          <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>
            Selecciona archivos de audio individuales para agregar
          </p>
        </div>

        {/* Botón para agregar carpeta */}
        <div style={{ marginBottom: 16 }}>
          <button style={{ ...baseButton, background: theme.surfaceLow, width: "100%" }} onClick={addDirectory}>
            Agregar Carpeta de Música
          </button>
          <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>
            Agrega una carpeta completa con archivos de música
          </p>
        </div>

        {/* Botón para rescanear canciones existentes */}
        <div style={{ marginBottom: 16 }}>
          <button
            style={{ ...baseButton, background: theme.surfaceLow, width: "100%" }}
            onClick={rescanAllSongs}
            disabled={isScanning}
          >
            {isScanning ? "Reescaneando..." : "Reescanear canciones con filtro actual"}
          </button>
          <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>
            Aplica el filtro de duración actual a todas las canciones
          </p>
        </div>

        {/* Filtro de duración mínima */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 8, color: theme.text }}>
            Duración mínima de canciones: {minDuration} segundos
          </label>
          <input
            type="range"
            min={1}
            max={60}
            value={minDuration}
            onChange={(e) => setMinDuration(parseInt(e.target.value))}
            style={{ width: "100%", accentColor: theme.accent }}
          />
          <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>
            Canciones más cortas que esto no se incluirán en la biblioteca
          </p>
        </div>

        <h4 style={{ color: theme.textMuted, marginTop: 16 }}>Carpetas seleccionadas</h4>
        <ul style={{ paddingLeft: 16, marginTop: 8 }}>
          {directories.map((dir, i) => (
            <li key={i} style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{dir.name}</span>
              <button
                onClick={() => removeDirectory(i)}
                style={{
                  background: theme.surfaceLow,
                  color: "#ff6b6b",
                  border: `1px solid ${theme.border}`,
                  borderRadius: 8,
                  padding: "4px 8px",
                  cursor: "pointer",
                  fontSize: 12
                }}
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button style={baseButton} onClick={() => setModalOpen(false)}>Cerrar</button>
        </div>
        <p style={{ color: theme.textMuted, fontSize: 12, marginTop: 10 }}>
          Las canciones agregadas se mantendrán en el reproductor incluso después de cerrar la aplicación.
        </p>
      </Modal>

      <PersistentNotification
        currentSong={currentSong}
        isPlaying={isPlaying}
        onPlayPause={() => setIsPlaying(!isPlaying)}
        onNext={nextTrack}
        onPrevious={prevTrack}
      />

      {/* Modal: seleccionar playlist para agregar canción */}
      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)}>
        <h3 style={{ marginTop: 0 }}>Agregar a una lista</h3>
        {playlists.length === 0 ? (
          <p style={{ color: theme.textMuted }}>No hay listas creadas. Crea una en la pestaña Playlists.</p>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <span style={{ color: theme.textMuted, fontSize: 12 }}>Selecciona una lista:</span>
              <select
                value={tempPlaylistId}
                onChange={(e) => setTempPlaylistId(e.target.value)}
                style={{ background: theme.surfaceLow, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "8px 10px" }}
              >
                <option value="">Selecciona una lista</option>
                {playlists.map((pl) => (
                  <option key={pl.id} value={pl.id}>{pl.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button style={baseButton} onClick={() => setAddModalOpen(false)}>Cancelar</button>
              <button style={{ ...baseButton, background: theme.accent, color: "#00201C" }} onClick={handleConfirmAddToPlaylist}>Agregar</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}