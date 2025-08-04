import { logger } from './logger.js';
import { artifactStorage } from './artifacts.js';
import { keyValueStorage } from './key-values.js';
import { linkStorage } from './links.js';
import { dataStorage } from '../data-storage.js';

export const services = {
  logger,
  artifacts: artifactStorage,
  keyValues: keyValueStorage,
  links: linkStorage,
  setContext: context => {
    dataStorage.setContext(context);
  },
};
