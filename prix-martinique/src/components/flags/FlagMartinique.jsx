import React from 'react';

// The official 2023 Martinique flag (black field, green band, red triangle) --
// not the Unicode 🇲🇶 emoji's traditional blue/white "fer-de-lance" design,
// which several Martinicans (including the person who requested this swap)
// consider a colonial-era symbol rather than a flag of Martinique itself.
// Deliberately diverges from what mobile phones render for the emoji
// character for that reason. Embedded as inline SVG rather than the emoji
// character regardless, since flag emoji rendering support is inconsistent
// across desktop OS/browser font configurations (see FlagFrance.jsx).
// Path data: flag-icons (https://github.com/lipis/flag-icons), MIT licensed.
const FlagMartinique = ({ className = 'w-4 h-4' }) => (
    <svg viewBox="0 0 640 480" className={className} xmlns="http://www.w3.org/2000/svg" aria-label="Martinique">
        <path fill="#231f1e" d="M0 0h640v480H0z" />
        <path fill="#00a650" d="M0 0h640v240H0z" />
        <path fill="#ef1923" d="m0 0 320 240L0 480z" />
    </svg>
);

export default FlagMartinique;
