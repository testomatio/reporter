import chalk from 'chalk';
import { AnyObject, KeyValueObject } from './types';
import _ from 'lodash';

export function beatifyVariablesList(varsList: KeyValueObject[]) {
  const beatifiedVarsList: AnyObject = {};

  for (let varItem of varsList) {
    beatifiedVarsList[varItem.key] = varItem.value;
  }

  return beatifiedVarsList;
}

export function getPrettyTimeFromTimestamp(timestamp: number) {
  const seconds = timestamp / 1000;
  return seconds.toFixed(1);
}

/**
 *
 * @param item represents postman collection item, which could be collection itself, folder or request
 * @returns path to postman request (through the folders)
 */
export function getGroupPath(item: any) {
  if (_.isEmpty(item) || !_.isFunction(item.parent) || !_.isFunction(item.forEachParent)) {
    return [];
  }

  const chain = [];
  item.forEachParent(function (parent: any) {
    chain.unshift(parent.name || parent.id);
  });

  // Add the current item only if it is not the collection
  item.parent() && chain.push(item.name || item.id);

  // slash "/" sign is used to divide the path on testomatio;
  // thus, it have to be replaced to prevent misleading if collection folder name contains slash in it's name
  // const formatedChain = chain.map(item => item.replace('/', '|'));
  // return formatedChain.join(separator);

  return chain;
}

export function getTestIdFromTestName(testName: string): string {
  const TEST_ID_REGEX = /@T([\w\d]{8})/;
  const regexMatches = testName.match(TEST_ID_REGEX);
  if (!regexMatches) return '';
  return regexMatches[1];
}

/**
 * Cut the long text to make it shorter (cuts the middle of the string to make start and end visible)
 */
export function cutLongText(text: string, options: { maxLength?: number, maxSizeInKb?: number, warnIfCut?: boolean }): string {
  if (!options.maxLength && !options.maxSizeInKb) throw new Error('You should provide either maxLength or maxWeightInKb');
  const { maxLength, maxSizeInKb } = options;
  const warnIfCut = options.warnIfCut ?? true;
  const cutWarning = chalk.redBright('  ... ✂️ log is cut here (in the middle) due to large size ✂️ ...');
  const maxLengthInSymbols = maxLength || maxSizeInKb! * 1024;
  if (text.length <= maxLengthInSymbols) return text;

  // cutting the middle of the string
  const start = text.slice(0, maxLengthInSymbols / 2);
  const end = text.slice(-maxLengthInSymbols / 2);
  return warnIfCut ? `${start}\n${cutWarning}\n${end}` : `${start}\n...\n${end}`;
}