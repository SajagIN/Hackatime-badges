document.addEventListener('DOMContentLoaded', () => {
    // Element references
    const elements = {
        userID: document.getElementById('userID'),
        label: document.getElementById('label'),
        color: document.getElementById('color'),
        style: document.getElementById('style'),
    };

    const badgePreview = document.getElementById('badge-preview');
    const outputCode = document.getElementById('output-code');
    const outputFormat = document.getElementById('output-format');
    const copyButton = document.querySelector('.copy-btn'); 
    const colorPicker = document.getElementById('color-picker');
    const badgeType = document.getElementById('badge-type');
    const topLanguageGroup = document.getElementById('top-language-group');
    const topLanguage = document.getElementById('top-language');
    const logoSelect = document.getElementById('logo-select');

    // Logo map (dropdown value -> Shields.io name or SVG URL)
    const logoUrlMap = {
        '': '',
        'hackclub-rounded': 'https://assets.hackclub.com/icon-rounded.svg',
        'hackclub-flat': 'https://assets.hackclub.com/icon-square.svg',
        'hackclub-pride-rounded': 'https://assets.hackclub.com/icon-progress-rounded.svg',
        'hackclub-pride-flat': 'https://assets.hackclub.com/icon-progress-square.svg',
        'hackclub-flag-white': 'https://assets.hackclub.com/flag-standalone-wtransparent.svg',
        'hackclub-flag-bw': 'https://assets.hackclub.com/flag-standalone-bw.svg',
    };

    function populateLogoDropdown() {
        if (!logoSelect) return;
        logoSelect.innerHTML = '<option value="">None</option>';
        Object.entries(logoUrlMap).forEach(([key, val]) => {
            if (key === '') return;
            let label = key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            if (key === 'hackclub-rounded') label = 'HC Rounded';
            if (key === 'hackclub-flat') label = 'HC Flat';
            if (key === 'hackclub-pride-rounded') label = 'HC Pride Rounded';
            if (key === 'hackclub-pride-flat') label = 'HC Pride Flat';
            if (key === 'hackclub-flag-white') label = 'HC Flag White';
            if (key === 'hackclub-flag-bw') label = 'HC Flag B/W';
            logoSelect.innerHTML += `<option value="${key}">${label}</option>`;
        });
    }
    populateLogoDropdown();

    function syncColorInputs(from) {
        if (from === 'picker') {
            let hex = colorPicker.value.replace('#', '');
            elements.color.value = hex;
        } else if (from === 'input') {
            let val = elements.color.value.trim();
            if (!val.startsWith('#')) val = '#' + val;
            if (/^#[0-9a-fA-F]{6}$/.test(val)) {
                colorPicker.value = val;
            }
        }
    }

    colorPicker.addEventListener('input', () => {
        syncColorInputs('picker');
        updateBadge();
    });
    elements.color.addEventListener('input', () => {
        syncColorInputs('input');
        updateBadge();
    });

    badgeType.addEventListener('change', () => {
        if (badgeType.value === 'top-language') {
            topLanguageGroup.classList.remove('hidden');
        } else {
            topLanguageGroup.classList.add('hidden');
        }
        updateBadge();
    });
    topLanguage.addEventListener('change', updateBadge);
    logoSelect.addEventListener('change', updateBadge);
    elements.userID.addEventListener('input', updateBadge);
    elements.label.addEventListener('input', updateBadge);
    elements.style.addEventListener('change', updateBadge);
    outputFormat.addEventListener('change', updateBadge);

    async function getLogoValue(selectedKey, logoMap) {
        const val = logoMap[selectedKey];
        if (!val) return '';
        if (!val.startsWith('http')) return val;
        try {
            const res = await fetch(val);
            if (!res.ok) return '';
            const svg = await res.text();
            const img = new Image();
            const svgBase64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
            return await new Promise(resolve => {
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    canvas.width = 14;
                    canvas.height = 14;
                    const ctx = canvas.getContext('2d');
                    ctx.clearRect(0, 0, 14, 14);
                    ctx.drawImage(img, 0, 0, 14, 14);
                    const pngBase64 = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
                    resolve(`data:image/png;base64,${pngBase64}`);
                };
                img.onerror = function() {
                    const cleanSvg = svg.replace(/<\?xml.*?\?>/g, '').trim();
                    const fallback = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(cleanSvg)))}`;
                    resolve(fallback);
                };
                img.src = svgBase64;
            });
        } catch {
            return '';
        }
    }

    function getAltText(label, badgeType, topLanguage) {
        let alt = label || 'Hack-a-Time';
        switch (badgeType) {
            case 'total': return alt + ' Total Time Badge';
            case 'daily': return alt + ' Daily Average Badge';
            case 'top-language': return alt + ` ${topLanguage} Time Badge`;
            case 'trust': return alt + ' Trust Level Badge';
            default: return alt + ' Badge';
        }
    }

    function getQueryAndLabel(badgeType, topLanguage, topLanguageIdx) {
        switch (badgeType) {
            case 'total':
                return { query: '$.data.human_readable_total', label: 'Total Time' };
            case 'daily':
                return { query: '$.data.human_readable_daily_average', label: 'Daily Avg' };
            case 'top-language':
                return {
                    query: `$.data.languages[${topLanguageIdx}].text`,
                    label: `${topLanguage} Time`
                };
            case 'trust':
                return { query: '$.trust_factor.trust_level', label: 'Trust Level' };
            default:
                return { query: '$.data.human_readable_total', label: 'Total Time' };
        }
    }

    function getOutputCode(badgeUrl, altText) {
        const format = outputFormat.value;
        if (format === 'markdown') {
            return `![${altText}](${badgeUrl})`;
        } else if (format === 'html') {
            return `<img src="${badgeUrl}" alt="${altText}" />`;
        } else if (format === 'link') {
            return badgeUrl;
        }
        return '';
    }

    async function updateBadge() {
        const userID = elements.userID.value.trim();
        const labelInput = elements.label.value.trim();
        const colorInput = elements.color.value.trim().replace('#', '');
        const style = elements.style.value;
        const selectedLogoKey = logoSelect.value;
        const currentBadgeType = badgeType.value;
        const currentTopLanguage = topLanguage.value;
        const currentTopLanguageIdx = topLanguage.selectedIndex;

        if (!userID) {
            badgePreview.src = '';
            badgePreview.alt = 'Enter a User ID to generate a badge.';
            outputCode.textContent = '';
            return;
        }

        const { query, label: defaultLabel } = getQueryAndLabel(currentBadgeType, currentTopLanguage, currentTopLanguageIdx);
        const label = labelInput || defaultLabel;
        const altText = getAltText(label, currentBadgeType, currentTopLanguage);

        const params = new URLSearchParams();
        params.append('url', `https://hackatime.hackclub.com/api/v1/users/${userID}/stats`);
        params.append('query', query);
        params.append('label', label);
        if (colorInput) params.append('color', colorInput);
        if (style) params.append('style', style);
        const logoValue = await getLogoValue(selectedLogoKey, logoUrlMap);
        if (logoValue) params.append('logo', logoValue);
        const badgeUrl = `https://img.shields.io/badge/dynamic/json?${params.toString()}`;
        badgePreview.src = badgeUrl;
        badgePreview.alt = altText;
        outputCode.textContent = getOutputCode(badgeUrl, altText);
    }

    if (copyButton) {
        copyButton.addEventListener('click', async function () {
            const valueToCopy = outputCode.textContent;
            if (!valueToCopy) return;
            try {
                await navigator.clipboard.writeText(valueToCopy);
                copyButton.textContent = 'Copied!';
                setTimeout(() => {
                    copyButton.textContent = 'Copy';
                }, 2000);
            } catch {
                const textArea = document.createElement('textarea');
                textArea.value = valueToCopy;
                textArea.style.position = 'fixed';
                textArea.style.left = '-9999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    document.execCommand('copy');
                    copyButton.textContent = 'Copied!';
                    setTimeout(() => {
                        copyButton.textContent = 'Copy';
                    }, 2000);
                } finally {
                    document.body.removeChild(textArea);
                }
            }
        });
    }

    // Always apply dark mode
    document.documentElement.classList.add('dark');
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) themeToggle.style.display = 'none';

    syncColorInputs('input');
    updateBadge();
});