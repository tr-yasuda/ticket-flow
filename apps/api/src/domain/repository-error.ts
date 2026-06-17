export class DuplicateEmailError extends Error {
  constructor(message = "Email already exists") {
    super(message);
    this.name = "DuplicateEmailError";
  }
}

export class DuplicateSlugError extends Error {
  constructor(message = "Slug already exists") {
    super(message);
    this.name = "DuplicateSlugError";
  }
}
