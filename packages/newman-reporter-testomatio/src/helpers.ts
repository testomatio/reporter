import { AnyObject, KeyValueObject } from "./types";
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
  if (_.isEmpty(item) || !_.isFunction(item.parent) || !_.isFunction(item.forEachParent)) { return []; }

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
