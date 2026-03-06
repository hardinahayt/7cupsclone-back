import { Bot } from 'lucide-react';

/**
 * Floating auto-reply toggle pill shown in the bottom-right corner.
 */
export function AutoReplyToggle({ enabled, onToggle, toggling }) {
    return (
        <button
            onClick={onToggle}
            disabled={toggling}
            title={enabled ? 'Auto-Reply ON — click to disable' : 'Auto-Reply OFF — click to enable'}
            style={{
                position: 'fixed',
                bottom: 28,
                right: 28,
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: 50,
                border: 'none',
                cursor: toggling ? 'wait' : 'pointer',
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: 0.3,
                boxShadow: enabled
                    ? '0 4px 20px rgba(124,58,237,0.45)'
                    : '0 4px 16px rgba(0,0,0,0.25)',
                background: enabled
                    ? 'linear-gradient(135deg, #7c3aed, #4f46e5)'
                    : 'var(--bg-secondary, #1e1e2e)',
                color: enabled ? '#fff' : 'var(--text-secondary, #888)',
                transition: 'all 0.25s ease',
                transform: toggling ? 'scale(0.95)' : 'scale(1)',
            }}
        >
            <Bot
                size={17}
                style={{
                    animation: enabled ? 'spin 3s linear infinite' : 'none',
                }}
            />
            {toggling
                ? 'Switching...'
                : enabled
                    ? '🤖 AI Reply ON'
                    : 'AI Reply OFF'
            }
            {/* Pulsing dot when active */}
            {enabled && (
                <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#4ade80',
                    display: 'inline-block',
                    animation: 'pulse-dot 1.5s ease-in-out infinite',
                }} />
            )}
        </button>
    );
}
