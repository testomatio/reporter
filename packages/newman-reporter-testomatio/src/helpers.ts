import { AnyObject, KeyValueObject } from "./types";

export function beatifyVariablesList(varsList: KeyValueObject[]) {
  const beatifiedVarsList: AnyObject = {};

  for (let varItem of varsList) {
    beatifiedVarsList[varItem.key] = varItem.value;
  }

  return beatifiedVarsList;
}
