/**
 * Retorna o config de autenticação para requisições Axios.
 * Inclui o token JWT e o nome do usuário logado.
 */
export function getAuthConfig() {
  const token = localStorage.getItem('klarke_token');
  const userData = localStorage.getItem('klarke_user');
  let user = 'Sistema';
  try {
    const parsed = JSON.parse(userData);
    user = parsed.username || userData;
  } catch {
    user = userData || 'Sistema';
  }
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-User': user,
    },
  };
}

/**
 * Retorna apenas o token JWT (sem X-User).
 * Útil para endpoints que não precisam do header de usuário.
 */
export function getTokenConfig() {
  const token = localStorage.getItem('klarke_token');
  return { headers: { Authorization: `Bearer ${token}` } };
}
