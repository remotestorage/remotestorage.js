export type QueuedRequestResponse = {
  statusCode: number;
  body?: string | object;
  contentType?: string;
  revision?: string;
};
