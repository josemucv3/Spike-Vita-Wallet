import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Carga variables de entorno desde archivo .env
 * Sin dependencias externas, usando solo módulos nativos de Node.js
 */
export function loadEnvFile(): void {
  try {
    const envPath = join(__dirname, '../../.env');
    const envContent = readFileSync(envPath, 'utf-8');

    const lines = envContent.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Ignorar comentarios y líneas vacías
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      // Buscar el signo = (puede haber espacios alrededor)
      const equalIndex = trimmedLine.indexOf('=');

      if (equalIndex === -1) {
        continue;
      }

      const key = trimmedLine.substring(0, equalIndex).trim();
      let value = trimmedLine.substring(equalIndex + 1).trim();

      // Remover comillas si existen
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      // Solo establecer si no existe ya en process.env (prioridad a variables del sistema)
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    // Si el archivo .env no existe, no es un error crítico
    // Las variables pueden venir del sistema o tener defaults
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('Advertencia: No se pudo cargar el archivo .env:', (error as Error).message);
    }
  }
}

