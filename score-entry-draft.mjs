export function hasScoreEntryDraft(root = document) {
    const inputs = [...root.querySelectorAll('#roundInputs input')];
    if (inputs.some(input => String(input.value ?? '').trim() !== '')) return true;

    const signButtons = [...root.querySelectorAll('#roundInputs button[id^="sign_"]')];
    return signButtons.some(button => String(button.textContent ?? '').trim() === '-');
}