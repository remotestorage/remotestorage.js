class UnauthorizedError extends Error {
  code: string;

  constructor (message?: string, options: {code?: string} = {}) {
    super();
    this.name = 'Unauthorized';

    if (typeof message === 'undefined') {
      this.message = 'App authorization expired or revoked.';
    } else {
      this.message = message;
    }

    if (typeof options.code !== 'undefined') {
      this.code = options.code;
    }

    this.stack = (new Error()).stack;
  }
}

export = UnauthorizedError;
