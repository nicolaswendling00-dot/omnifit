// OmniFit — Style commun des graphiques
//
// Objectif : des courbes lisibles et sobres, pas des tracés bruités.
//  · aucun point de donnée (la courbe seule suffit, les points saturent l'écran)
//  · interpolation monotone : la courbe passe par les valeurs SANS créer de
//    bosses parasites entre deux points (contrairement à `tension` seul)
//  · graduations rares et discrètes, grille horizontale uniquement
//  · dégradé sous la courbe plutôt qu'un aplat translucide

// Dégradé vertical sous une courbe. Nécessite le contexte du canvas ; on
// retombe sur une couleur translucide si l'aire de dessin n'est pas encore
// connue (premier rendu).
export function areaGradient(ctx, chartArea, color, alpha = 0.28) {
  if (!chartArea || !ctx) return withAlpha(color, alpha * 0.5);
  const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  g.addColorStop(0, withAlpha(color, alpha));
  g.addColorStop(1, withAlpha(color, 0));
  return g;
}

function withAlpha(color, a) {
  if (color.startsWith('#')) {
    const n = parseInt(color.slice(1), 16);
    const r = (n >> 16) & 255; const g = (n >> 8) & 255; const b = n & 255;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return color;
}

// Jeu d'options commun. `opts` :
//   yTicks   : nb max de graduations verticales (défaut 4)
//   xTicks   : nb max d'étiquettes horizontales (défaut 5)
//   ySuffix  : unité ajoutée aux graduations (ex. ' kg', '%')
//   yMin/yMax: bornes forcées
//   legend   : afficher la légende (défaut false)
export function lineChartOptions(opts = {}) {
  const grid = 'rgba(148, 163, 184, 0.10)';
  const tick = { color: '#8A9099', font: { size: 10, family: 'Inter' } };
  return {
    responsive: true,
    maintainAspectRatio: false,
    // La courbe seule : ni points, ni marqueurs au survol.
    elements: { point: { radius: 0, hoverRadius: 0, hitRadius: 0 } },
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: opts.legend
        ? { labels: { color: '#8A9099', boxWidth: 10, usePointStyle: true, font: { size: 10, family: 'Inter' } } }
        : { display: false },
      tooltip: {
        backgroundColor: 'rgba(10, 10, 12, 0.94)',
        borderColor: 'rgba(148, 163, 184, 0.2)', borderWidth: 1,
        titleFont: { size: 11, family: 'Inter' }, bodyFont: { size: 12, family: 'Inter' },
        padding: 10, displayColors: false,
      },
    },
    scales: {
      x: {
        grid: { display: false, drawBorder: false },
        border: { display: false },
        ticks: { ...tick, maxRotation: 0, autoSkip: true, maxTicksLimit: opts.xTicks ?? 5 },
      },
      y: {
        position: 'right',           // les valeurs à droite libèrent la lecture de la courbe
        grid: { color: grid, drawBorder: false, drawTicks: false },
        border: { display: false },
        min: opts.yMin, max: opts.yMax,
        ticks: {
          ...tick, maxTicksLimit: opts.yTicks ?? 4, padding: 6,
          callback: (v) => `${v}${opts.ySuffix || ''}`,
        },
      },
    },
  };
}

// Jeu de données d'une courbe, avec dégradé et lissage monotone.
export function lineDataset(label, data, color, extra = {}) {
  return {
    label,
    data,
    borderColor: color,
    borderWidth: 2.5,
    cubicInterpolationMode: 'monotone',
    tension: 0.4,
    spanGaps: true,
    fill: extra.fill === false ? false : {
      target: 'origin',
      above: (c) => areaGradient(c.chart.ctx, c.chart.chartArea, color, extra.alpha ?? 0.28),
    },
    ...extra,
  };
}
