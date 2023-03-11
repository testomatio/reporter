/* this file was created to parse data from newman run results
but later easier ways were found
for now this functionality is not used but may be used for later (e.g. for test code parsing)
so decided to leave*/

import { AnyObject, KeyValueObject } from "./types";

export type URL = {
  protocol: string,
  path: string[],
  host: string[],
  query: KeyValueObject[],
  variable: { [key: string]: any }[],
}

function stringifyQueryParams(queryParams: KeyValueObject[], vars: AnyObject): string {
  queryParams = JSON.parse(JSON.stringify(queryParams));

  if (!queryParams.length) return '';

  // url params starts with ? sign like ?param=value
  let stringifiedQueryParams = '?';

  for (const param of queryParams) {
    let paramValue = param.value;
    // item is variable and should be replaced with variable value
    if (paramValue.startsWith('{{') && paramValue.endsWith('}}')) {
      const varName = paramValue.replace('{{', '').replace('}}', '');
      paramValue = vars[varName];
    }

    stringifiedQueryParams += (param.key + '=' + paramValue);
  }
  return stringifiedQueryParams;
}

// some items are text, but some items are variables; e.g. host could be equal to ['www', '{{googleName}}, 'com']
// have to leave text as is, but replace variables with their values
export function stringifyURL(url: URL, vars: AnyObject): string {
  let protocol = url.protocol ? `${url.protocol}://` : '';
  let host = [];
  for (let hostItem of url.host) {
    // item is variable and should be replaved with variable value
    if (hostItem.startsWith('{{') && hostItem.endsWith('}}')) {
      const varName = hostItem.replace('{{', '').replace('}}', '');
      host.push(vars[varName]);
    } else host.push(hostItem);
  }
  let path = [];
  for (let pathItem of url.path) {
    // item is variable and should be replaved with variable value
    if (pathItem.startsWith('{{') && pathItem.endsWith('}}')) {
      const varName = pathItem.replace('{{', '').replace('}}', '');
      path.push(vars[varName]);
    } else path.push(pathItem);
  }
  return `${protocol}${host.join('.')}/${path.join('/')}${stringifyQueryParams(url.query, vars)}`
}