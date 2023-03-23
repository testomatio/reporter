import chalk from "chalk";
import { AnyObject, KeyValueObject } from "./types";

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