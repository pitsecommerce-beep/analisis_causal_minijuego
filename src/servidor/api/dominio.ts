// Solo personal del IPADE puede entrar como profesor
export const DOMINIO_PROFESOR = 'ipade.mx';
export const MENSAJE_DOMINIO = `Solo pueden acceder como profesor correos @${DOMINIO_PROFESOR}.`;

export function esCorreoProfesor(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  return email.trim().toLowerCase().endsWith(`@${DOMINIO_PROFESOR}`);
}
