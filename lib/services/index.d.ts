export namespace services {
    export { logger };
    export { artifactStorage as artifacts };
    export { keyValueStorage as keyValues };
    export function setContext(context: any): void;
}
import { logger } from './logger.js';
import { artifactStorage } from './artifacts.js';
import { keyValueStorage } from './key-values.js';
