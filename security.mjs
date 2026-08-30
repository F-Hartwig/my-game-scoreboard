export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function createId() {
    const values = new Uint32Array(2);
    crypto.getRandomValues(values);
    const high = values[0] & 0x001fffff;
    return high * 0x100000000 + values[1];
}
