import type { Request, Response, ResponseMap } from './types';

/** Sends a request to the background service worker and unwraps the response. */
export async function send<R extends Request>(req: R): Promise<ResponseMap[R['type']]> {
  const res = (await chrome.runtime.sendMessage(req)) as Response<ResponseMap[R['type']]> | undefined;
  if (!res) throw new Error('No response from the extension background');
  if (!res.ok) throw new Error(res.error);
  return res.data;
}
