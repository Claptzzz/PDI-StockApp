/** Formatea un periodo académico como "2026/01". */
export const formatPeriod = (year: number, semester: number) =>
  `${year}/${semester === 1 ? '01' : '02'}`;
