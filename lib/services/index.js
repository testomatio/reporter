import { logger } from './logger.js';
import { artifactStorage } from './artifacts.js';
import { keyValueStorage } from './key-values.js';
import { dataStorage } from '../data-storage.js';

export const services = {
  logger,
  artifacts: artifactStorage,
  keyValues: keyValueStorage,
  setContext: context => {
    dataStorage.setContext(context);
  },
};
