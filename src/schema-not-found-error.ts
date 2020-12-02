class SchemaNotFound extends Error {
  constructor(uri: string) {
    super();
    const error = new Error("Schema not found: " + uri);
    error.name = "SchemaNotFound";
    return error;
  }
}

export = SchemaNotFound;
