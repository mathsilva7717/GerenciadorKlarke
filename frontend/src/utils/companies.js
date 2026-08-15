// Empresas disponíveis no select de identificação (cada uma tem seu logo/badge).
// Usado no gerenciamento de Máquinas e de Câmeras.
export const COMPANY_OPTIONS = [
  { value: 'TUDO POR 10 OU 20', label: 'Tudo por 10 ou 20', src: '/logo10.png' },
  { value: 'LIOMEX', label: 'Liomex Importadora', src: '/liomex.png' },
  { value: 'KLARKE', label: 'Klarke Solutions', src: '/klarke.png' },
];

// Badge (logo) da empresa. Usa o campo `company`; se vazio, infere pela localização (legado).
export const companyBadge = (company = '', loc = '') => {
  const c = (company || '').toUpperCase();
  const found = COMPANY_OPTIONS.find(o => o.value === c);
  if (found) return found;
  const u = (loc || '').toUpperCase();
  if (u.includes('LIOMEX')) return COMPANY_OPTIONS[1];
  if (u.includes('KLARKE')) return COMPANY_OPTIONS[2];
  if (u.includes('10 OU 20') || /S[ÃA]O VICENTE|PRAIA GRANDE|\bSV\b|\bPG\b/.test(u)) return COMPANY_OPTIONS[0];
  return null;
};
