import { logger } from './logger.js';
import { artifactStorage } from './artifacts.js';
import { keyValueStorage } from './key-values.js';
import { labelStorage } from './labels.js';
import { linkStorage } from './links.js';
import { dataStorage } from '../data-storage.js';

export const services = {
  logger,
  artifacts: artifactStorage,
  keyValues: keyValueStorage,
  labels: labelStorage,
  links: linkStorage,
  setContext: context => {
    dataStorage.setContext(context);
  },
};
