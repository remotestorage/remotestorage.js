export interface RSNode {
  [key: string]: any;
}

export interface RSNodes {
  [key: string]: RSNode;
}

export interface RSEvent {
  [key: string]: string;
}

export interface ChangeObj {
  [key: string]: any;
}

export interface QueuedRequestResponse {
  statusCode: number;
  body?: object;
  contentType?: ContentType;
}

export type ContentType = any;
