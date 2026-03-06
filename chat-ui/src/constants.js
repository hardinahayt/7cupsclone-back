export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

export const fixImgUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('data:')) return url;
    // Prepend target base for relative cloudfront or site links
    return `https://www.7cups.com${url.startsWith('/') ? '' : '/'}${url}`;
};
