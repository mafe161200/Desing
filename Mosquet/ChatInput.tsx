import React, { useState, useRef, FormEvent, ChangeEvent } from 'react';
import './ChatInput.css'; // Asume estilos base para el chat

interface ChatInputProps {
  onSendMessage: (message: string) => void;
}

const EMOJI_LIST = ['😀', '😂', '❤️', '👍', '🙌', '🔥', '👀', '✨', '✅', '🚀'];

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage }) => {
  const [message, setMessage] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    
    // Validación de entrada (KISS y Seguridad)
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      console.warn('[ChatInput]: Intento de envío de mensaje vacío bloqueado.');
      return; 
    }

    try {
      onSendMessage(trimmedMessage);
      setMessage('');
      setShowEmojis(false);
    } catch (error) {
      console.error('[ChatInput]: Error al enviar el mensaje', error);
      // Aquí se podría disparar un toast de error general
    }
  };

  const handleEmojiClick = (emoji: string) => {
    if (!inputRef.current) return;

    // Insertar emoji en la posición actual del cursor
    const start = inputRef.current.selectionStart || 0;
    const end = inputRef.current.selectionEnd || 0;
    const textBefore = message.substring(0, start);
    const textAfter = message.substring(end, message.length);

    setMessage(textBefore + emoji + textAfter);
    setShowEmojis(false);

    // Restaurar el foco al input después de insertar el emoji
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(start + emoji.length, start + emoji.length);
      }
    }, 0);
  };

  return (
    <div className="chat-input-container">
      <form onSubmit={handleSend} className="chat-form">
        
        <div className="emoji-wrapper">
          <button 
            type="button" 
            className="emoji-toggle-btn"
            onClick={() => setShowEmojis(!showEmojis)}
            aria-label="Abrir selector de emojis"
          >
            😀
          </button>

          {showEmojis && (
            <div className="emoji-popover">
              {EMOJI_LIST.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  className="emoji-btn"
                  onClick={() => handleEmojiClick(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 
          Corrección de la "memoria" del input:
          autoComplete="off", name dinámico/específico y spellCheck false evitan 
          las sugerencias molestas del navegador.
        */}
        <input
          ref={inputRef}
          type="text"
          name="team_chat_input_field" 
          autoComplete="off"
          spellCheck="false"
          className="chat-text-input"
          placeholder="Escribe un mensaje al equipo..."
          value={message}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setMessage(e.target.value)}
        />

        <button type="submit" className="send-btn" aria-label="Enviar mensaje">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="send-icon">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>
    </div>
  );
};
