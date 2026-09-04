import React from 'react';

// One place for "profile picture, or a neutral fallback" so a bare number never
// stands in for a face again. The fallback is the first letter of the name --
// deliberately NOT the gamification level, which was being shown inside podium /
// menu circles and read as a ranking position (see the Leaderboard rework).
//
// `size` is the pixel box (also drives the initial's font size). `fallbackClassName`
// overrides the initial-circle colours per context; `rounded` its corner style.
const Avatar = ({
  src,
  name,
  size = 40,
  fallbackClassName = 'bg-orange-100 text-orange-600',
  rounded = 'rounded-full',
  className = '',
}) => {
  const box = { width: size, height: size };

  if (src) {
    return (
      <img
        src={src}
        alt={name || ''}
        style={box}
        className={`${rounded} object-cover flex-shrink-0 ${className}`}
      />
    );
  }

  const initial = (name?.trim()?.[0] || '?').toUpperCase();
  return (
    <div
      style={{ ...box, fontSize: Math.round(size * 0.42) }}
      className={`${rounded} ${fallbackClassName} flex items-center justify-center font-black leading-none flex-shrink-0 ${className}`}
      aria-label={name || undefined}
    >
      {initial}
    </div>
  );
};

export default Avatar;
