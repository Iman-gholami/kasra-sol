/** The «آخرین دونه‌ها» stamp (the owner's pick): a white sticker with a scalloped edge and a dashed red ring around a
 * red centre reading «فقط ۱ دونه». Decorative: the section title says the same. Its edge turns with page scrolling where
 * supported (home.css). */
export function LastPieceStamp() {
  return <svg className="last-pieces-stamp" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
    <g className="last-pieces-stamp-edge">
      <path d="M63.56 7.25 Q67.12 10.51 71.45 8.39 Q75.78 6.27 78.27 10.39 Q80.77 14.52 85.52 13.70 Q90.28 12.89 91.51 17.55 Q92.74 22.21 97.53 22.77 Q102.32 23.33 102.19 28.15 Q102.06 32.97 106.50 34.85 Q110.94 36.74 109.46 41.33 Q107.97 45.91 111.70 48.97 Q115.43 52.03 112.72 56.02 Q110.00 60.00 112.72 63.98 Q115.43 67.97 111.70 71.03 Q107.97 74.09 109.46 78.67 Q110.94 83.26 106.50 85.15 Q102.06 87.03 102.19 91.85 Q102.32 96.67 97.53 97.23 Q92.74 97.79 91.51 102.45 Q90.28 107.11 85.52 106.30 Q80.77 105.48 78.27 109.61 Q75.78 113.73 71.45 111.61 Q67.12 109.49 63.56 112.75 Q60.00 116.00 56.44 112.75 Q52.88 109.49 48.55 111.61 Q44.22 113.73 41.73 109.61 Q39.23 105.48 34.48 106.30 Q29.72 107.11 28.49 102.45 Q27.26 97.79 22.47 97.23 Q17.68 96.67 17.81 91.85 Q17.94 87.03 13.50 85.15 Q9.06 83.26 10.54 78.67 Q12.03 74.09 8.30 71.03 Q4.57 67.97 7.28 63.98 Q10.00 60.00 7.28 56.02 Q4.57 52.03 8.30 48.97 Q12.03 45.91 10.54 41.33 Q9.06 36.74 13.50 34.85 Q17.94 32.97 17.81 28.15 Q17.68 23.33 22.47 22.77 Q27.26 22.21 28.49 17.55 Q29.72 12.89 34.48 13.70 Q39.23 14.52 41.73 10.39 Q44.22 6.27 48.55 8.39 Q52.88 10.51 56.44 7.25 Q60.00 4.00 63.56 7.25Z" fill="#fff"/>
      <circle cx="60" cy="60" r="43" fill="none" stroke="#B51F2B" strokeWidth="1.6" strokeDasharray="2.5 4"/>
    </g>
    <circle cx="60" cy="60" r="36" fill="#B51F2B"/>
    <text x="60" y="47" textAnchor="middle" fontWeight="800" fontSize="11" fill="#fff">فقط</text>
    <text x="60" y="78" textAnchor="middle" fontWeight="900" fontSize="34" fill="#fff">۱</text>
    <text x="60" y="91" textAnchor="middle" fontWeight="800" fontSize="11" fill="#FFD7DA">دونه</text>
  </svg>;
}
